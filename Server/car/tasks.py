from django_q.tasks import schedule
from django_q.models import Schedule
from django.utils import timezone
from django.db import transaction

from .models import Booking, ParkingSlot


def expire_bookings():
    """Expire bookings whose end_time has passed and free associated slots.

    Returns a tuple (updated_bookings, updated_slots).
    This function is safe to call from a management command, scheduler, or
    on-demand (for example from a view) to ensure slot flags are refreshed.
    """
    now = timezone.now()
    # Bookings that have ended and are not cancelled/expired
    expired_qs = Booking.objects.filter(end_time__lte=now).exclude(status__in=['cancelled', 'expired', 'completed']).select_related('slot')

    updated_bookings = 0
    updated_slots = 0

    # Wrap in transaction to avoid partial updates
    with transaction.atomic():
        for booking in expired_qs:
            slot = booking.slot

            if booking.status in ['cancelled', 'expired']:
                continue

            booking.status = 'completed'
            booking.save(update_fields=['status'])
            updated_bookings += 1

            # Only free the slot when there are no other non-cancelled/non-expired
            # bookings for the same slot that still extend past now.
            overlapping_or_future = Booking.objects.filter(
                slot=slot
            ).exclude(pk=booking.pk).exclude(status__in=['cancelled', 'expired']).filter(
                end_time__gt=now
            ).exists()

            if not overlapping_or_future and slot.is_booked:
                slot.is_booked = False
                slot.save(update_fields=['is_booked'])
                updated_slots += 1

    return updated_bookings, updated_slots


def expire_bookings_task():
    # Backwards compatible task entrypoint used by django-q schedule
    expire_bookings()


# Schedule the task if not already scheduled
if not Schedule.objects.filter(func='car.tasks.expire_bookings_task').exists():
    schedule('car.tasks.expire_bookings_task',
             name='Expire Bookings',
             schedule_type=Schedule.MINUTES,
             minutes=1,  # run every 1 minute
             repeats=-1)  # repeat forever


def expire_single_booking(booking_id):
    """Expire a single booking by id and free its slot if appropriate.

    This is intended to be scheduled as a one-off job at booking.end_time.
    The function is idempotent and safe to call multiple times.
    """
    try:
        booking_id = int(booking_id)
    except Exception:
        return False

    now = timezone.now()
    try:
        booking = Booking.objects.select_related('slot').get(pk=booking_id)
    except Booking.DoesNotExist:
        return False

    # Only expire bookings that have actually ended and are not already final
    if booking.end_time > now:
        # Not yet time to expire
        return False

    if booking.status in ['cancelled', 'expired', 'completed']:
        return False

    with transaction.atomic():
        booking.status = 'completed'
        booking.save(update_fields=['status'])

        slot = booking.slot
        # If there are no other non-cancelled/non-expired bookings that extend past now,
        # free the slot.
        overlapping_or_future = Booking.objects.filter(
            slot=slot
        ).exclude(pk=booking.pk).exclude(status__in=['cancelled', 'expired']).filter(
            end_time__gt=now
        ).exists()

        if not overlapping_or_future and slot.is_booked:
            slot.is_booked = False
            slot.save(update_fields=['is_booked'])

    return True


def schedule_expiry_for_booking(booking):
    """Create or replace a one-off django-q Schedule to expire this booking at end_time.

    booking: Booking instance
    """
    if not booking or not booking.end_time:
        return None

    # Use a stable schedule name so we can replace/cancel it later
    sched_name = f"expire_booking_{booking.id}"

    # Remove any existing schedule for this booking
    Schedule.objects.filter(name=sched_name).delete()

    # If end_time is in the past, schedule to run immediately
    next_run = booking.end_time
    try:
        schedule('car.tasks.expire_single_booking', str(booking.id), name=sched_name,
                 schedule_type=Schedule.ONCE, next_run=next_run)
        return sched_name
    except Exception:
        return None


def cancel_schedule_for_booking(booking):
    if not booking:
        return
    sched_name = f"expire_booking_{booking.id}"
    Schedule.objects.filter(name=sched_name).delete()
