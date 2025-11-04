from django_q.tasks import schedule
from django_q.models import Schedule
from django.db.utils import OperationalError
from django.utils import timezone
from django.db import transaction
import logging

from .models import Booking, ParkingSlot


def expire_bookings():
    """Expire bookings whose end_time has passed and free associated slots.

    Returns a tuple (updated_bookings, updated_slots).
    This function is safe to call from a management command, scheduler, or
    on-demand (for example from a view) to ensure slot flags are refreshed.
    """
    logger = logging.getLogger('car.tasks')
    now = timezone.now()
    # Bookings that have ended and are not cancelled/expired
    expired_qs = Booking.objects.filter(end_time__lte=now).exclude(status__in=['cancelled', 'expired', 'completed']).select_related('slot')

    updated_bookings = 0
    updated_slots = 0

    processed_ids = set()

    # Wrap in transaction to avoid partial updates
    with transaction.atomic():
        for booking in expired_qs:
            processed_ids.add(booking.id)
            slot = booking.slot

            if booking.status in ['cancelled', 'expired']:
                continue

            booking.status = 'completed'
            booking.save(update_fields=['status'])
            updated_bookings += 1
            logger.info(f"Expired booking id={booking.id} via DB filter")

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

        # Fallback pass to catch bookings with naive datetimes or missed by DB filter
        active_qs = Booking.objects.exclude(status__in=['cancelled', 'expired', 'completed']).select_related('slot')
        for booking in active_qs:
            if booking.id in processed_ids:
                continue
            try:
                end_time = booking.end_time
                if end_time is None:
                    continue
                # make aware if naive
                if end_time.tzinfo is None:
                    end_time = timezone.make_aware(end_time)
                if end_time <= now:
                    slot = booking.slot
                    booking.status = 'completed'
                    booking.save(update_fields=['status'])
                    updated_bookings += 1
                    logger.info(f"Expired booking id={booking.id} via fallback pass")

                    overlapping_or_future = Booking.objects.filter(
                        slot=slot
                    ).exclude(pk=booking.pk).exclude(status__in=['cancelled', 'expired']).filter(
                        end_time__gt=now
                    ).exists()

                    if not overlapping_or_future and slot.is_booked:
                        slot.is_booked = False
                        slot.save(update_fields=['is_booked'])
                        updated_slots += 1
            except Exception:
                logger.exception(f"Error while checking booking id={booking.id} for expiry")

    logger.info(f"expire_bookings finished: updated_bookings={updated_bookings}, updated_slots={updated_slots}")
    return updated_bookings, updated_slots


def expire_bookings_task():
    # Backwards compatible task entrypoint used by django-q schedule
    expire_bookings()


# Schedule the task if not already scheduled
try:
    if not Schedule.objects.filter(func='car.tasks.expire_bookings_task').exists():
        schedule('car.tasks.expire_bookings_task',
                 name='Expire Bookings',
                 schedule_type=Schedule.MINUTES,
                 minutes=1,  # run every 1 minute
                 repeats=-1)  # repeat forever
except OperationalError:
    # Table probably doesn't exist yet (migrations not applied). Log and skip scheduling.
    import logging
    logging.getLogger('car.tasks').warning('django_q Schedule table not available; skipping automatic schedule creation')


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


def activate_single_booking(booking_id):
    """Activate a single booking by id when its start_time arrives.

    This will set booking.status = 'active' (if not cancelled/expired/completed)
    and set the associated slot.is_booked = True unless other active booking logic
    prevents it. The function is idempotent.
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

    # Do not activate if booking already finished or cancelled
    if booking.end_time <= now:
        return False

    if booking.status in ['cancelled', 'expired', 'completed', 'active']:
        # Already final or active
        return False

    with transaction.atomic():
        booking.status = 'active'
        booking.save(update_fields=['status'])

        slot = booking.slot
        # Mark slot as booked (if not manual_locked and not already booked)
        if slot and not slot.is_booked:
            slot.is_booked = True
            slot.save(update_fields=['is_booked'])

    return True


def schedule_activation_for_booking(booking):
    """Schedule a one-off django-q job to activate this booking at start_time.

    If start_time is in the past and booking should already be active, this will
    return None and callers should activate immediately.
    """
    if not booking or not booking.start_time:
        return None

    sched_name = f"activate_booking_{booking.id}"
    # Remove any existing activation schedule
    Schedule.objects.filter(name=sched_name).delete()

    next_run = booking.start_time
    try:
        schedule('car.tasks.activate_single_booking', str(booking.id), name=sched_name,
                 schedule_type=Schedule.ONCE, next_run=next_run)
        return sched_name
    except Exception:
        return None


def cancel_activation_for_booking(booking):
    if not booking:
        return
    sched_name = f"activate_booking_{booking.id}"
    Schedule.objects.filter(name=sched_name).delete()
