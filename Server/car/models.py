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
    vehicle_type = models.CharField(max_length=30)
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


@receiver(post_delete, sender=Booking)
def cancel_booking_expiry(sender, instance, **kwargs):
    try:
        from .tasks import cancel_schedule_for_booking
    except Exception:
        return
    cancel_schedule_for_booking(instance)
