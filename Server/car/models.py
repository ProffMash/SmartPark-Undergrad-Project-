from django.db import models
from django.contrib.auth.models import AbstractUser, BaseUserManager


class CustomUserManager(BaseUserManager):
    def create_user(self, email, username, password=None, role='user', **extra_fields):
        if not email:
            raise ValueError('Email is required')
        if not username:
            raise ValueError('Username is required')
        email = self.normalize_email(email)
        user = self.model(email=email, username=username, role=role, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, username, password=None, **extra_fields):
        extra_fields.setdefault('is_user', True)
        extra_fields.setdefault('is_superuser', True)
        return self.create_user(email, username, password, role='admin', **extra_fields)

class User(AbstractUser):
    email = models.EmailField(unique=True)
    username = models.CharField(max_length=150, unique=True)
    name = models.CharField(max_length=100)
    phone = models.CharField(max_length=20)
    vehicle_number = models.CharField(max_length=20)
    vehicle_model = models.CharField(max_length=50, blank=True, null=True)
    ROLE_CHOICES = (
        ('admin', 'Admin'),
        ('user', 'User'),
    )
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default='user')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    # Override the default related_name for inherited ManyToMany fields to
    # avoid reverse accessor name clashes with the built-in auth.User model.
    groups = models.ManyToManyField(
        'auth.Group',
        related_name='car_users',
        blank=True,
        help_text='The groups this user belongs to.'
    )
    user_permissions = models.ManyToManyField(
        'auth.Permission',
        related_name='car_user_permissions',
        blank=True,
        help_text='Specific permissions for this user.'
    )

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']

    objects = CustomUserManager()

    def __str__(self):
        return self.email



class ParkingSlot(models.Model):
    slot_number = models.CharField(max_length=20)
    location = models.CharField(max_length=100)
    coordinates_lat = models.FloatField()
    coordinates_lng = models.FloatField()
    is_booked = models.BooleanField(default=False)
    price = models.DecimalField(max_digits=8, decimal_places=2)
    TYPE_CHOICES = [
        ('regular', 'Regular'),
        ('premium', 'Premium'),
        ('vip', 'VIP'),
    ]
    type = models.CharField(max_length=10, choices=TYPE_CHOICES)
    facilities = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    manual_locked = models.BooleanField(default=False)

    def __str__(self):
        return f"Slot {self.slot_number} ({self.type})"



class Booking(models.Model):
    user = models.ForeignKey('User', on_delete=models.CASCADE)
    slot = models.ForeignKey('ParkingSlot', on_delete=models.CASCADE)
    start_time = models.DateTimeField()
    end_time = models.DateTimeField()
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
        ('expired', 'Expired'),
    ]
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='active')
    amount = models.DecimalField(max_digits=8, decimal_places=2)
    Payment_id = models.ForeignKey(
        'Payment',
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='bookings'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    # Soft-archive flag to allow users/admins to hide old bookings without deleting them
    archived = models.BooleanField(default=False)

    def __str__(self):
        return f"Booking {self.id} - User {self.user_id}"



class Payment(models.Model):
    booking = models.ForeignKey('Booking', on_delete=models.CASCADE)
    user = models.ForeignKey('User', on_delete=models.CASCADE)
    amount = models.DecimalField(max_digits=8, decimal_places=2)
    slot_id = models.ForeignKey('ParkingSlot', on_delete=models.CASCADE, blank=True, null=True)
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    ]
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending')
    transaction_id = models.CharField(max_length=100, blank=True, null=True)
    stripe_session_id = models.CharField(max_length=200, blank=True, null=True)
    stripe_payment_intent = models.CharField(max_length=200, blank=True, null=True)
    paid_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    # Soft-archive flag to hide old payments without deleting them
    archived = models.BooleanField(default=False)

    def __str__(self):
        return f"Payment {self.id} - Booking {self.booking_id}"


class Ticket(models.Model):
    user = models.ForeignKey('User', on_delete=models.CASCADE)
    subject = models.CharField(max_length=200)
    message = models.TextField()
    STATUS_CHOICES = [
        ('open', 'Open'),
        ('in-progress', 'In Progress'),
        ('resolved', 'Resolved'),
        ('closed', 'Closed'),
    ]
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='open')
    PRIORITY_CHOICES = [
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
    ]
    priority = models.CharField(max_length=10, choices=PRIORITY_CHOICES, default='medium')
    response = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Ticket {self.id} - {self.subject}"
    
class Contact(models.Model):
    name = models.CharField(max_length=100)
    email = models.EmailField()
    message = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Contact {self.id} - {self.name}"


class Notification(models.Model):
    NOTIFY_TYPES = [
        ('booking_confirmation', 'Booking Confirmation'),
        ('booking_reminder', 'Booking Reminder'),
        ('payment_receipt', 'Payment Receipt'),
        ('booking_expiry', 'Booking Expiry'),
        ('booking_expired', 'Booking Expired'),
    ]

    user = models.ForeignKey('User', on_delete=models.CASCADE, related_name='notifications')
    type = models.CharField(max_length=50, choices=NOTIFY_TYPES)
    title = models.CharField(max_length=200)
    message = models.TextField()
    data = models.JSONField(blank=True, null=True)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Notification {self.id} -> {self.user_id} : {self.type}"


# Signals to schedule per-booking expiry jobs
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.utils import timezone

# --- Slot freeing logic on booking cancel/expire ---
def update_slot_booked_flag(slot):
    """Set slot.is_booked = True if any active bookings exist, else False."""
    from .models import Booking
    now = timezone.now()
    has_active = Booking.objects.filter(
        slot=slot
    ).exclude(status__in=['cancelled', 'expired']).filter(
        start_time__lte=now, end_time__gt=now
    ).exists()
    if slot.is_booked != has_active:
        slot.is_booked = has_active
        slot.save(update_fields=['is_booked'])


@receiver(post_save, sender=Booking)
def schedule_booking_expiry(sender, instance, created, **kwargs):
    """Schedule or reschedule a one-off expiry job for this booking.

    If booking is cancelled or already expired, cancel any scheduled job.
    """
    try:
        from .tasks import schedule_expiry_for_booking, cancel_schedule_for_booking
    except Exception:
        return

    # If booking is cancelled/expired, free the slot if needed
    if instance.status in ['cancelled', 'expired']:
        cancel_schedule_for_booking(instance)
        # Free slot if no other active bookings
        if instance.slot:
            update_slot_booked_flag(instance.slot)
        return

    # (re)schedule expiry at instance.end_time
    schedule_expiry_for_booking(instance)
    # Reconcile status immediately for bookings that overlap now or already ended.
    try:
        now = timezone.now()
        # If booking should be active now, only activate it if payment exists and is completed
        if instance.start_time <= now < instance.end_time:
            try:
                # Look for any completed payment for this booking
                paid = Payment.objects.filter(booking=instance, status='completed').exists()
            except Exception:
                paid = False
            if paid and instance.status != 'active':
                instance.status = 'active'
                try:
                    instance.save(update_fields=['status'])
                except Exception:
                    pass

        # If booking already ended, mark completed (idempotent)
        if instance.end_time <= now and instance.status not in ['completed', 'cancelled', 'expired']:
            instance.status = 'completed'
            try:
                instance.save(update_fields=['status'])
            except Exception:
                pass

        # Ensure the slot.is_booked flag reflects active bookings
        if instance.slot:
            update_slot_booked_flag(instance.slot)
    except Exception:
        # best-effort; don't allow signal to crash the save
        pass


@receiver(post_save, sender=Payment)
def handle_payment_completed(sender, instance, created, **kwargs):
    """When a Payment becomes completed, reconcile the associated booking
    and mark the slot as booked only if the booking is active.

    This ensures the backend is the source of truth for slot allocation
    and prevents slots being marked booked before payment verification.
    """
    try:
        # Only run logic when payment status is 'completed'
        if instance.status != 'completed':
            return

        booking = getattr(instance, 'booking', None)
        if not booking:
            return

        now = timezone.now()

        # If booking was pending, determine whether to activate or complete it
        if booking.status == 'pending':
            if booking.start_time <= now < booking.end_time:
                booking.status = 'active'
            elif now >= booking.end_time:
                booking.status = 'completed'
            else:
                # future booking remains pending until its start_time
                booking.status = 'pending'

        # Associate payment with booking if missing
        try:
            if not booking.Payment_id:
                booking.Payment_id = instance
        except Exception:
            pass

        # Save booking and mark slot as booked only if active
        try:
            booking.save()
        except Exception:
            pass

        slot = getattr(booking, 'slot', None)
        if booking.status == 'active' and slot and not slot.is_booked:
            slot.is_booked = True
            try:
                slot.save(update_fields=['is_booked'])
            except Exception:
                pass
    except Exception:
        # swallow errors to avoid breaking payment flow
        pass


@receiver(post_delete, sender=Booking)
def cancel_booking_expiry(sender, instance, **kwargs):
    try:
        from .tasks import cancel_schedule_for_booking
    except Exception:
        return
    cancel_schedule_for_booking(instance)
