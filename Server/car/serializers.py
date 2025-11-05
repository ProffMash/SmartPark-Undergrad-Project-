
from rest_framework import serializers
from django.utils import timezone
from .models import User, ParkingSlot, Booking, Payment, Ticket, Contact

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        # Expose all useful fields from the custom User model
        fields = [
            'id', 'email', 'username', 'role', 'name',
            'phone', 'vehicle_number', 'vehicle_model',
            'is_active', 'is_staff', 'is_superuser', 'created_at'
        ]
        

class ParkingSlotSerializer(serializers.ModelSerializer):
    # Expose is_booked as a writable BooleanField so admin clients can
    # explicitly mark a slot as booked/available via PATCH requests.
    # Note: the database column `is_booked` may still be kept in sync by
    # background jobs or booking lifecycle events.
    is_booked = serializers.BooleanField(required=False)

    class Meta:
        model = ParkingSlot
        # Include is_booked in the serialized shape and allow updates.
        fields = [
            'id', 'slot_number', 'location', 'coordinates_lat', 'coordinates_lng',
            'is_booked', 'price', 'type', 'facilities', 'created_at'
        ]

    def to_representation(self, instance):
        """Return a representation where `is_booked` is computed live from bookings.

        Only consider slots as booked if there is an 'active' or 'completed' booking overlapping now.
        """
        data = super().to_representation(instance)
        try:
            now = timezone.now()
            live = Booking.objects.filter(
                slot=instance
            ).filter(status__in=['active', 'completed']).filter(
                start_time__lte=now, end_time__gt=now
            ).exists()
            data['is_booked'] = bool(live)
        except Exception:
            # If anything goes wrong, fall back to stored DB value already in data
            pass
        return data

class BookingSerializer(serializers.ModelSerializer):
    # nested read-only representations
    user = UserSerializer(read_only=True)
    slot = ParkingSlotSerializer(read_only=True)
    # write-only id fields for creating/updating bookings
    # make write-only id fields optional for updates (PUT/PATCH) so partial updates
    # that only modify status or other fields don't need to re-send the slot/user ids.
    user_id = serializers.PrimaryKeyRelatedField(queryset=User.objects.all(), source='user', write_only=True, required=False)
    slot_id = serializers.PrimaryKeyRelatedField(queryset=ParkingSlot.objects.all(), source='slot', write_only=True, required=False)

    # allow explicit read/write access to transaction_id
    transaction_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    username = serializers.SerializerMethodField()
    user_id_read = serializers.SerializerMethodField()

    class Meta:
        model = Booking
        # explicitly list fields so transaction_id is clearly exposed
        fields = [
            'id', 'user', 'slot', 'user_id', 'slot_id',
            'start_time', 'end_time', 'status', 'amount',
            'transaction_id', 'created_at', 'username', 'user_id_read'
        ]

    def get_username(self, obj):
        return obj.user.username if obj.user else None

    def get_user_id_read(self, obj):
        return obj.user.id if obj.user else None

    def validate(self, data):
        # Ensure that on creation the required relations are present.
        # `user` and `slot` come from the write-only `user_id`/`slot_id` fields
        # because we set source='user'/'slot'. For updates, they may be omitted.
        if self.instance is None:
            # If user/slot weren't provided via the write-only fields, allow creation
            # when the request.user is authenticated (we'll infer user) but still
            # require a slot to be specified.
            request = self.context.get('request') if hasattr(self, 'context') else None
            has_user = 'user' in data
            has_slot = 'slot' in data
            # Also consider raw input names in initial_data (user_id/slot_id)
            if not has_user and hasattr(self, 'initial_data'):
                has_user = 'user_id' in getattr(self, 'initial_data', {})
            if not has_slot and hasattr(self, 'initial_data'):
                has_slot = 'slot_id' in getattr(self, 'initial_data', {})

            if not has_slot:
                raise serializers.ValidationError('slot_id is required when creating a booking')

            if not has_user:
                # allow missing user when request.user is authenticated; otherwise error
                if not (request and getattr(request, 'user', None) and request.user.is_authenticated):
                    raise serializers.ValidationError('user_id is required when creating a booking')
        return data

    def validate_amount(self, value):
        # Ensure total digits (without sign and decimal point) do not exceed 8
        from decimal import Decimal, InvalidOperation
        try:
            dec = Decimal(value)
        except (InvalidOperation, TypeError):
            raise serializers.ValidationError('Invalid amount')
        tup = dec.as_tuple()
        digits = tup.digits or ()
        if len(digits) > 8:
            raise serializers.ValidationError('amount must have no more than 8 digits in total')
        return value

class PaymentSerializer(serializers.ModelSerializer):
    booking = BookingSerializer(read_only=True)
    user = UserSerializer(read_only=True)
    booking_id = serializers.PrimaryKeyRelatedField(queryset=Booking.objects.all(), source='booking', write_only=True, required=True)
    user_id = serializers.PrimaryKeyRelatedField(queryset=User.objects.all(), source='user', write_only=True, required=True)
    slot_id = serializers.SerializerMethodField()
    slot_number = serializers.SerializerMethodField()
    payment_method = serializers.SerializerMethodField()
    date_time = serializers.SerializerMethodField()

    class Meta:
        model = Payment
        # explicitly list the fields we want in the API response for clarity
        fields = [
            'id', 'booking', 'booking_id', 'user', 'user_id', 'amount',
            'slot_id', 'slot_number', 'status', 'transaction_id',
            'stripe_session_id', 'stripe_payment_intent', 'payment_method',
            'paid_at', 'created_at', 'date_time'
        ]

    def get_slot_id(self, obj):
        # Return slot id from related slot if available
        if obj.slot_id:
            return obj.slot_id.id
        return None

    def get_slot_number(self, obj):
        # Return slot number from related slot if available
        if obj.slot_id:
            return obj.slot_id.slot_number
        return None

    def get_payment_method(self, obj):
        # If a specific method field exists on the model use it, otherwise
        # derive from Stripe fields when present.
        # Prefer more explicit model field if later added.
        # Currently we derive:
        if getattr(obj, 'stripe_payment_intent', None) or getattr(obj, 'stripe_session_id', None):
            return 'card (stripe)'
        # fallback to unknown since no explicit method stored
        return 'unknown'

    def get_date_time(self, obj):
        # Prefer paid_at if available, otherwise use created_at
        dt = obj.paid_at or obj.created_at
        if not dt:
            return None
        # ISO format string for client convenience
        return dt.isoformat()

class TicketSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    # Allow the serializer to include the user's PK on read responses while
    # still accepting `user_id` on create/update. Removing `write_only` makes
    # the field readable (it will return the user's id) and writable via PK.
    user_id = serializers.PrimaryKeyRelatedField(queryset=User.objects.all(), source='user', required=True)

    class Meta:
        model = Ticket
        fields = '__all__'

class ContactSerializer(serializers.ModelSerializer):
    class Meta:
        model = Contact
        fields = '__all__'


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=True)
    username = serializers.CharField(required=False, allow_blank=True, allow_null=True)

    class Meta:
        model = User
        # allow optional username and vehicle info during registration
        fields = ['email', 'username', 'name', 'password', 'role', 'phone', 'vehicle_number', 'vehicle_model']

    def create(self, validated_data):
        # Ensure a username is provided to the user manager; derive from email if absent
        raw_email = validated_data['email']
        base_username = validated_data.get('username') or raw_email.split('@')[0]
        username = base_username
        # Ensure uniqueness by appending a numeric suffix if needed
        counter = 0
        while User.objects.filter(username=username).exists():
            counter += 1
            username = f"{base_username}{counter}"

        user = User.objects.create_user(
            email=raw_email,
            username=username,
            password=validated_data['password'],
            name=validated_data.get('name', ''),
            role=validated_data.get('role', 'user'),
            phone=validated_data.get('phone', ''),
            vehicle_number=validated_data.get('vehicle_number', ''),
            vehicle_model=validated_data.get('vehicle_model', ''),
            
            
        )
        return user

    def validate_password(self, value):
        # ensure password is provided and has a reasonable minimum length
        if not value:
            raise serializers.ValidationError('Password is required')
        if len(value) < 6:
            raise serializers.ValidationError('Password must be at least 6 characters long')
        return value


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)