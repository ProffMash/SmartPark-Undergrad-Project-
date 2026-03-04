def create_notification_if_not_exists(user, type, title, message, data):
    from .models import Notification
    exists = Notification.objects.filter(
        user=user,
        type=type,
        title=title,
        message=message,
        data=data
    ).exists()
    if not exists:
        Notification.objects.create(
            user=user,
            type=type,
            title=title,
            message=message,
            data=data
        )
from rest_framework import viewsets
from rest_framework.decorators import action
from .models import User, ParkingSlot, Booking, Payment, Ticket, TicketMessage, Contact
from .models import Notification
from .serializers import (
	UserSerializer,
	ParkingSlotSerializer,
	BookingSerializer,
	PaymentSerializer,
	TicketSerializer,
	TicketMessageSerializer,
	ContactSerializer,
    RegisterSerializer,
	LoginSerializer,
    NotificationSerializer,
)
from django.contrib.auth import authenticate
from rest_framework import status, permissions
from rest_framework.generics import ListAPIView
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.authtoken.models import Token
import os
import stripe
import json
from django.utils import timezone
from django.http import HttpResponse
from django.core.cache import cache
from time import time

class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer

    def list(self, request, *args, **kwargs):
        if not request.query_params:
            cached = cache.get('users_list')
            if cached is not None:
                return Response(cached)

            resp = super().list(request, *args, **kwargs)
            try:
                cache.set('users_list', resp.data, timeout=10)
            except Exception:
                pass
            return resp

        return super().list(request, *args, **kwargs)

    def retrieve(self, request, *args, **kwargs):
        pk = kwargs.get('pk')
        if pk:
            key = f'user_{pk}'
            cached = cache.get(key)
            if cached is not None:
                return Response(cached)

            resp = super().retrieve(request, *args, **kwargs)
            try:
                cache.set(key, resp.data, timeout=10)
            except Exception:
                pass
            return resp

        return super().retrieve(request, *args, **kwargs)

    @action(detail=True, methods=['post'], url_path='impersonate')
    def impersonate(self, request, pk=None):
        """
        Allow an admin to start an impersonation session for a user.
        Returns a token and minimal user data. Server-side must still
        enforce audit and permission checks.
        """
        # Only authenticated admins may impersonate
        if not getattr(request, 'user', None) or not request.user.is_authenticated:
            return Response({'detail': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
        try:
            if getattr(request.user, 'role', None) not in ['admin', 'operator'] or not request.user.is_active:
                return Response({'detail': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        except Exception:
            return Response({'detail': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)

        # Resolve target user
        try:
            target = self.get_object()
        except Exception:
            return Response({'detail': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

        # Issue or get a token for the target user (DRF TokenAuthentication)
        try:
            token_obj, created = Token.objects.get_or_create(user=target)
            token_key = getattr(token_obj, 'key', None)
        except Exception:
            token_key = None

        # Small audit record: create a notification for the admin (best-effort)
        try:
            Notification.objects.create(
                user=request.user,
                type='impersonation',
                title='Impersonation started',
                message=f'You started an impersonation session for user name={target.name}',
                data={'target_user_id': target.id}
            )
        except Exception:
            pass

        # Serialize minimal user data and include absolute avatar URL by
        # passing the request into serializer context.
        serialized = UserSerializer(target, context={'request': request})

        return Response({'token': token_key, 'user': serialized.data})

class ParkingSlotViewSet(viewsets.ModelViewSet):
    queryset = ParkingSlot.objects.all()
    serializer_class = ParkingSlotSerializer

    def list(self, request, *args, **kwargs):
        # Use a short-lived cache for the full slots list to reduce DB pressure
        # when frontends poll frequently. We only cache when no query params
        # are present to avoid caching filtered results.
        if not request.query_params:
            cached = cache.get('parking_slots_list')
            if cached is not None:
                return Response(cached)

            resp = super().list(request, *args, **kwargs)
            # Cache serialized JSON for a short time (10 seconds)
            try:
                cache.set('parking_slots_list', resp.data, timeout=10)
            except Exception:
                pass
            return resp

        return super().list(request, *args, **kwargs)

    def retrieve(self, request, *args, **kwargs):
        # Cache individual slot responses briefly to reduce DB hits.
        pk = kwargs.get('pk')
        if pk:
            key = f'parking_slot_{pk}'
            cached = cache.get(key)
            if cached is not None:
                return Response(cached)

            resp = super().retrieve(request, *args, **kwargs)
            try:
                cache.set(key, resp.data, timeout=10)
            except Exception:
                pass
            return resp

        return super().retrieve(request, *args, **kwargs)

class BookingViewSet(viewsets.ModelViewSet):
    queryset = Booking.objects.all()
    serializer_class = BookingSerializer


    def create(self, request, *args, **kwargs):
        # Allow clients to omit user_id; use authenticated request.user if available.
        data = request.data.copy() if isinstance(request.data, dict) else request.data
        if 'user_id' not in data and request.user and request.user.is_authenticated:
            data['user_id'] = request.user.id

        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)

        from django.db import transaction
        slot = serializer.validated_data.get('slot')
        start_time = serializer.validated_data.get('start_time')
        end_time = serializer.validated_data.get('end_time')
        if not slot:
            return Response({'error': 'Slot not provided'}, status=status.HTTP_400_BAD_REQUEST)
        if not start_time or not end_time:
            return Response({'error': 'Start and end time required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            with transaction.atomic():
                locked_slot = ParkingSlot.objects.select_for_update().get(pk=slot.id)
                # Check for overlapping active or completed bookings for this slot
                from .models import Booking
                overlap = Booking.objects.filter(
                    slot=locked_slot
                ).filter(status__in=['active', 'completed']).filter(
                    start_time__lt=end_time, end_time__gt=start_time
                ).exists()
                if overlap:
                    return Response({'error': 'Selected slot is already booked'}, status=status.HTTP_400_BAD_REQUEST)

                # Set booking status to 'pending' (not active) until payment is confirmed
                serializer.validated_data['status'] = 'pending'
                self.perform_create(serializer)
                # Notify admins about the new booking (best-effort)
                try:
                    booking = getattr(serializer, 'instance', None)
                    if booking:
                        try:
                            booking_user = getattr(booking, 'user', None)
                            notify_users = User.objects.filter(role__in=['admin', 'operator'], is_active=True)
                            for notify_user in notify_users:
                                try:
                                    # Deduplicate by type, title, message, and data
                                    msg = (
                                        f"New booking for slot {getattr(booking.slot, 'slot_number', 'Unknown')}"
                                        f" by {(booking_user.name or booking_user.username) if booking_user else 'Unknown'}"
                                    )
                                    data_fp = {
                                        'user_id': booking_user.id if booking_user else None,
                                        'slot_number': getattr(booking.slot, 'slot_number', None) if getattr(booking, 'slot', None) else None,
                                        'start_time': getattr(booking, 'start_time', None).isoformat() if getattr(booking, 'start_time', None) else None,
                                        'end_time': getattr(booking, 'end_time', None).isoformat() if getattr(booking, 'end_time', None) else None,
                                        'amount': float(getattr(booking, 'amount', None)) if getattr(booking, 'amount', None) is not None else None,
                                    }
                                    create_notification_if_not_exists(
                                        user=admin,
                                        type='new_booking',
                                        title='New Booking Created',
                                        message=msg,
                                        data=data_fp
                                    )
                                except Exception:
                                    pass
                        except Exception:
                            pass
                except Exception:
                    pass
                headers = self.get_success_headers(serializer.data)

        except ParkingSlot.DoesNotExist:
            return Response({'error': 'Selected slot not found'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({'error': 'Failed to create booking', 'detail': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    def list(self, request, *args, **kwargs):
        # Cache unfiltered booking list briefly to reduce DB pressure for admin lists
        if not request.query_params:
            cached = cache.get('bookings_list')
            if cached is not None:
                return Response(cached)

            resp = super().list(request, *args, **kwargs)
            try:
                cache.set('bookings_list', resp.data, timeout=10)
            except Exception:
                pass
            return resp

        return super().list(request, *args, **kwargs)

    def retrieve(self, request, *args, **kwargs):
        pk = kwargs.get('pk')
        if pk:
            key = f'booking_{pk}'
            cached = cache.get(key)
            if cached is not None:
                return Response(cached)

            resp = super().retrieve(request, *args, **kwargs)
            try:
                cache.set(key, resp.data, timeout=10)
            except Exception:
                pass
            return resp

        return super().retrieve(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        # Support partial updates via PUT from frontend and ensure we
        # allow partial updates for PUT/PATCH so frontends that send only
        # changed fields (e.g. only `status`) don't get a 400 from full-PUT
        partial = kwargs.pop('partial', False)
        if request.method == 'PUT':
            partial = True
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)

        # After successful save, mark the associated slot as booked only when
        # the booking becomes 'active'. Slot allocation on payment completion is
        # primarily handled by the Payment signal / verification flow; this
        # keeps update-based changes from incorrectly allocating slots.
        try:
            updated_status = serializer.validated_data.get('status')
            if updated_status == 'active':
                slot = getattr(instance, 'slot', None)
                if slot and not slot.is_booked:
                    slot.is_booked = True
                    slot.save()
        except Exception:
            pass

        return Response(serializer.data)

class PaymentViewSet(viewsets.ModelViewSet):
    queryset = Payment.objects.all()
    serializer_class = PaymentSerializer

    def list(self, request, *args, **kwargs):
        # If client passes user_id, don't cache; otherwise cache globally briefly
        if not request.query_params:
            cached = cache.get('payments_list')
            if cached is not None:
                return Response(cached)

            resp = super().list(request, *args, **kwargs)
            try:
                cache.set('payments_list', resp.data, timeout=10)
            except Exception:
                pass
            return resp

        return super().list(request, *args, **kwargs)

    def retrieve(self, request, *args, **kwargs):
        pk = kwargs.get('pk')
        if pk:
            key = f'payment_{pk}'
            cached = cache.get(key)
            if cached is not None:
                return Response(cached)

            resp = super().retrieve(request, *args, **kwargs)
            try:
                cache.set(key, resp.data, timeout=10)
            except Exception:
                pass
            return resp

        return super().retrieve(request, *args, **kwargs)

class TicketViewSet(viewsets.ModelViewSet):
    queryset = Ticket.objects.all()
    serializer_class = TicketSerializer

    def list(self, request, *args, **kwargs):
        if not request.query_params:
            cached = cache.get('tickets_list')
            if cached is not None:
                return Response(cached)

            resp = super().list(request, *args, **kwargs)
            try:
                cache.set('tickets_list', resp.data, timeout=10)
            except Exception:
                pass
            return resp

        return super().list(request, *args, **kwargs)

    def retrieve(self, request, *args, **kwargs):
        pk = kwargs.get('pk')
        if pk:
            key = f'ticket_{pk}'
            cached = cache.get(key)
            if cached is not None:
                return Response(cached)

            resp = super().retrieve(request, *args, **kwargs)
            try:
                cache.set(key, resp.data, timeout=10)
            except Exception:
                pass
            return resp

        return super().retrieve(request, *args, **kwargs)

    @action(detail=True, methods=['get', 'post'], url_path='messages')
    def messages(self, request, pk=None):
        """Get or create messages for a ticket"""
        ticket = self.get_object()
        
        if request.method == 'GET':
            messages = ticket.messages.all().order_by('created_at')
            serializer = TicketMessageSerializer(messages, many=True)
            return Response(serializer.data)
        
        elif request.method == 'POST':
            serializer = TicketMessageSerializer(data={
                'ticket_id': ticket.id,
                'sender_id': request.data.get('sender_id'),
                'message': request.data.get('message'),
            })
            if serializer.is_valid():
                serializer.save()
                # Update ticket status to in-progress if it was open
                if ticket.status == 'open':
                    ticket.status = 'in-progress'
                    ticket.save()
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='mark-read')
    def mark_read(self, request, pk=None):
        """Mark messages as read for a ticket based on the reader's role"""
        ticket = self.get_object()
        reader_id = request.data.get('reader_id')
        reader_role = request.data.get('reader_role', 'user')
        
        if reader_role in ['admin', 'operator']:
            # Admin/operator marks user messages as read
            ticket.messages.filter(sender__role='user', is_read=False).update(is_read=True)
        else:
            # User marks admin/operator messages as read
            ticket.messages.exclude(sender__role='user').filter(is_read=False).update(is_read=True)
        
        return Response({'status': 'ok'})


class ContactViewSet(viewsets.ModelViewSet):
    queryset = Contact.objects.all()
    serializer_class = ContactSerializer

    def list(self, request, *args, **kwargs):
        if not request.query_params:
            cached = cache.get('contacts_list')
            if cached is not None:
                return Response(cached)

            resp = super().list(request, *args, **kwargs)
            try:
                cache.set('contacts_list', resp.data, timeout=10)
            except Exception:
                pass
            return resp

        return super().list(request, *args, **kwargs)

    def retrieve(self, request, *args, **kwargs):
        pk = kwargs.get('pk')
        if pk:
            key = f'contact_{pk}'
            cached = cache.get(key)
            if cached is not None:
                return Response(cached)

            resp = super().retrieve(request, *args, **kwargs)
            try:
                cache.set(key, resp.data, timeout=10)
            except Exception:
                pass
            return resp

        return super().retrieve(request, *args, **kwargs)


class NotificationViewSet(viewsets.ModelViewSet):
    queryset = Notification.objects.all()
    serializer_class = NotificationSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        user_id = self.request.query_params.get('user_id') or self.request.query_params.get('userId')
        try:
            if user_id:
                uid = int(user_id)
            elif getattr(self.request, 'user', None) and self.request.user.is_authenticated:
                uid = self.request.user.id
            else:
                return qs.none()
        except Exception:
            return qs.none()

        # Cache a small serialized slice of notifications per-user for a short period
        key = f'notifications_user_{uid}'
        cached = cache.get(key)
        if cached is not None:
            # cached is serialized data (list)
            from rest_framework.response import Response
            return qs.filter(user_id=uid)  # return queryset; the viewset will serialize

        # Do not aggressively cache the queryset object; instead cache data in places
        # where serialization is heavy if needed. For now, return the filtered queryset.
        return qs.filter(user_id=uid)

    def create(self, request, *args, **kwargs):
        # Accept optional user_id or infer from authenticated user
        data = request.data.copy() if isinstance(request.data, dict) else request.data
        if 'user_id' not in data and getattr(request, 'user', None) and request.user.is_authenticated:
            data['user_id'] = request.user.id

        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

# Payment History for authenticated user

class PaymentHistoryView(ListAPIView):
    serializer_class = PaymentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user_id = self.request.query_params.get('user_id')
        if user_id:
            return Payment.objects.filter(user_id=user_id).order_by('-created_at')
        return Payment.objects.filter(user=self.request.user).order_by('-created_at')

# Booking History for authenticated user


from .tasks import expire_bookings

class BookingHistoryView(ListAPIView):
    serializer_class = BookingSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Avoid running the full expiry sweep on every request — only run it
        # if it hasn't run recently. This avoids heavy DB work when frontends
        # poll frequently. The scheduled django-q job will still run periodically.
        try:
            last = cache.get('expire_bookings_last_run')
        except Exception:
            last = None

        now_ts = time()
        if not last or (now_ts - float(last)) > 30:
            try:
                expire_bookings()
                cache.set('expire_bookings_last_run', now_ts, timeout=30)
            except Exception:
                pass

        user_id = self.request.query_params.get('user_id')
        if user_id:
            return Booking.objects.filter(user_id=user_id).order_by('-created_at')
        return Booking.objects.filter(user=self.request.user).order_by('-created_at')


class RegisterView(APIView):
    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            # create token for the new user
            token, _ = Token.objects.get_or_create(user=user)
            # Notify all admin users about the new registration
            try:
                notify_users = User.objects.filter(role__in=['admin', 'operator'], is_active=True)
                for notify_user in notify_users:
                    try:
                        msg = f'New user {user.name or user.email} has registered.'
                        data_fp = {'user_id': user.id, 'email': user.email}
                        create_notification_if_not_exists(
                            user=notify_user,
                            type='user_registered',
                            title='New User Registered',
                            message=msg,
                            data=data_fp
                        )
                    except Exception:
                        # best-effort: don't let notification failures block registration
                        pass
            except Exception:
                pass

            return Response({'message': 'User registered successfully', 'token': token.key}, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class LoginView(APIView):
    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if serializer.is_valid():
            email = serializer.validated_data['email']
            password = serializer.validated_data['password']
            user = authenticate(request, username=email, password=password)  # Use username=email
            if user is not None:
                # ensure user has a token and return it. Use the serializer
                # so `avatar` becomes an absolute URL when request is provided.
                token, _ = Token.objects.get_or_create(user=user)
                serializer = UserSerializer(user, context={'request': request})
                data = serializer.data
                data.update({'message': 'Login successful', 'token': token.key})
                return Response(data, status=status.HTTP_200_OK)
            return Response({'error': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# Stripe integration views
stripe_api_key = os.environ.get('STRIPE_SECRET_KEY')
stripe_webhook_secret = os.environ.get('STRIPE_WEBHOOK_SECRET')
if stripe_api_key:
    stripe.api_key = stripe_api_key


class CreateCheckoutSessionView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        import traceback
        try:
            # expects { amount: decimal, booking_id: int }
            data = request.data
            amount = data.get('amount')
            booking_id = data.get('bookingId') or data.get('booking_id')
            user_id = data.get('userId') or data.get('user_id')

            print('CreateCheckoutSession request data:', data)

            if amount is None or booking_id is None or user_id is None:
                return Response({'error': 'Missing amount, bookingId or userId'}, status=status.HTTP_400_BAD_REQUEST)

            try:
                # Use Decimal for accurate digit counting and then convert
                from decimal import Decimal, InvalidOperation
                try:
                    amount_decimal = Decimal(str(amount))
                except (InvalidOperation, TypeError, ValueError):
                    return Response({'error': 'Invalid amount'}, status=status.HTTP_400_BAD_REQUEST)

                # Round to 3 decimal places before digit validation
                amount_decimal = amount_decimal.quantize(Decimal('0.001'))
                tup = amount_decimal.as_tuple()
                digits = tup.digits or ()
                if len(digits) > 8:
                    return Response({'amount': ['Ensure that there are no more than 8 digits in total.']}, status=status.HTTP_400_BAD_REQUEST)
                # convert to float for downstream code that expects numeric
                amount_decimal = float(amount_decimal)
            except (TypeError, ValueError):
                return Response({'error': 'Invalid amount'}, status=status.HTTP_400_BAD_REQUEST)

            # Ensure booking_id and user_id are numeric (we require DB entries)
            try:
                booking_pk = int(booking_id)
                user_pk = int(user_id)
            except Exception:
                return Response({'error': 'bookingId and userId must be numeric IDs referencing server records'}, status=status.HTTP_400_BAD_REQUEST)

            # Create or update local Payment record with pending status
            try:
                booking = Booking.objects.get(pk=booking_pk)
                user = User.objects.get(pk=user_pk)
            except Booking.DoesNotExist:
                return Response({'error': 'Booking not found on server'}, status=status.HTTP_404_NOT_FOUND)
            except User.DoesNotExist:
                return Response({'error': 'User not found on server'}, status=status.HTTP_404_NOT_FOUND)

            payment = Payment.objects.create(
                booking=booking,
                user=user,
                amount=amount_decimal,
                status='pending',
            )

            # Build success/cancel URLs using request origin
            origin = request.headers.get('origin') or f"http://localhost:5173"
            success_url = f"{origin}/payment-success?session_id={{CHECKOUT_SESSION_ID}}"
            cancel_url = f"{origin}/payment-cancelled"

            if not stripe_api_key:
                # Return the payment id so frontend can proceed in a non-Stripe flow or show error
                print('Stripe API key not configured in environment')
                return Response({'error': 'Stripe not configured', 'payment_id': payment.id}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

            try:
                session = stripe.checkout.Session.create(
                    payment_method_types=['card'],
                    mode='payment',
                    line_items=[{
                        'price_data': {
                            'currency': 'kes',
                            'product_data': {'name': f'Parking booking {booking_pk}'},
                            'unit_amount': int(round(amount_decimal * 100)),
                        },
                        'quantity': 1,
                    }],
                    success_url=success_url,
                    cancel_url=cancel_url,
                    metadata={'bookingId': str(booking_pk), 'paymentId': str(payment.id), 'userId': str(user_pk)},
                )
            except Exception as e:
                # mark payment failed
                payment.status = 'failed'
                payment.save()
                print('Stripe session create failed:', str(e))
                traceback.print_exc()
                return Response({'error': 'Stripe session creation failed', 'detail': str(e)}, status=status.HTTP_502_BAD_GATEWAY)

            # store stripe session id for later verification
            payment.stripe_session_id = session.id
            payment.save()

            # Add slot_id and slot_number to response
            slot_id = None
            slot_number = None
            if payment.slot_id:
                slot_id = payment.slot_id.id
                slot_number = payment.slot_id.slot_number
            return Response({
                'url': session.url,
                'id': session.id,
                'payment_id': payment.id,
                'slot_id': slot_id,
                'slot_number': slot_number
            })
        except Exception as e:
            print('Unhandled error in CreateCheckoutSessionView:', str(e))
            import traceback
            traceback.print_exc()
            return Response({'error': 'Internal server error', 'detail': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class CancelPaymentView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        # expects { payment_id }
        payment_id = request.data.get('payment_id') or request.data.get('paymentId')
        if not payment_id:
            return Response({'error': 'Missing payment_id'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            payment = Payment.objects.get(pk=int(payment_id))
        except Payment.DoesNotExist:
            return Response({'error': 'Payment not found'}, status=status.HTTP_404_NOT_FOUND)

        # mark as cancelled/failed locally
        payment.status = 'failed'
        payment.save()

        # Free the slot if it was marked as booked (defensive, should not be booked yet)
        if payment.slot_id:
            slot = payment.slot_id
            from .models import Booking
            now = timezone.now()
            has_active = Booking.objects.filter(
                slot=slot
            ).exclude(status__in=['cancelled', 'expired']).filter(
                start_time__lte=now, end_time__gt=now
            ).exists()
            if not has_active and slot.is_booked:
                slot.is_booked = False
                slot.save(update_fields=['is_booked'])

        # Add slot_id and slot_number to response
        slot_id = None
        slot_number = None
        if payment.slot_id:
            slot_id = payment.slot_id.id
            slot_number = payment.slot_id.slot_number
        return Response({
            'message': 'Payment cancelled',
            'payment_id': payment.id,
            'slot_id': slot_id,
            'slot_number': slot_number
        })


class VerifySessionView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        # Accept either session_id (Stripe) or payment_id (local)
        session_id = request.query_params.get('session_id') or request.query_params.get('sessionId')
        payment_id = request.query_params.get('payment_id') or request.query_params.get('paymentId')

        if session_id and stripe_api_key:
            try:
                session = stripe.checkout.Session.retrieve(session_id, expand=['payment_intent'])
            except Exception as e:
                return Response({'error': 'Could not retrieve session', 'detail': str(e)}, status=status.HTTP_502_BAD_GATEWAY)

            payment_intent = session.payment_intent if hasattr(session, 'payment_intent') else None
            result = {
                'id': session.id,
                'url': getattr(session, 'url', None),
                'amount_total': getattr(session, 'amount_total', None),
                'currency': getattr(session, 'currency', None),
                'payment_status': getattr(session, 'payment_status', None),
                'metadata': getattr(session, 'metadata', None),
                'payment_intent': {
                    'id': getattr(payment_intent, 'id', None) if payment_intent else None,
                    'status': getattr(payment_intent, 'status', None) if payment_intent else None,
                    'charges': getattr(payment_intent, 'charges', {}).get('data', []) if payment_intent and getattr(payment_intent, 'charges', None) is not None else []
                } if payment_intent else None
            }
            # Reconcile local Payment record when Stripe shows a successful payment
            metadata = getattr(session, 'metadata', None) or {}
            payment = None
            try:
                payment_id = metadata.get('paymentId')
                if payment_id:
                    payment = Payment.objects.filter(pk=int(payment_id)).first()
                else:
                    # fallback to matching by stored stripe_session_id
                    payment = Payment.objects.filter(stripe_session_id=session.id).order_by('-created_at').first()
            except Exception:
                payment = None

            # Consider the intent/checkout paid if payment_status == 'paid' or payment_intent.status == 'succeeded'
            paid = False
            if getattr(session, 'payment_status', None) == 'paid':
                paid = True
            if payment_intent and getattr(payment_intent, 'status', None) == 'succeeded':
                paid = True

            if payment and paid:
                payment.status = 'completed'
                pi_id = getattr(payment_intent, 'id', None) if payment_intent else None
                payment.transaction_id = pi_id or payment.transaction_id
                payment.stripe_payment_intent = pi_id or payment.stripe_payment_intent
                payment.paid_at = payment.paid_at or timezone.now()
                payment.save()

                # If the payment is associated with a booking, mark booking completed
                try:
                        booking = payment.booking
                        if booking and booking.status != 'completed':
                            # Decide new status based on booking times and current time.
                            now = timezone.now()
                            # If booking was 'pending' (created but unpaid), and the current time
                            # falls within the booking window, mark it active. If end_time already
                            # passed, mark completed. Otherwise keep as pending until start_time.
                            if booking.status == 'pending':
                                if booking.start_time <= now < booking.end_time:
                                    booking.status = 'active'
                                elif now >= booking.end_time:
                                    booking.status = 'completed'
                                else:
                                    # future booking paid for: keep pending until start_time
                                    booking.status = 'pending'
                            elif booking.status == 'active':
                                # Already active; leave as active (don't mark completed on payment)
                                booking.status = 'active'
                            else:
                                # For any other state, be conservative and leave it unchanged
                                booking.status = booking.status

                            booking.save()

                            # Only now, mark the slot as booked if booking is active
                            slot = getattr(booking, 'slot', None)
                            if booking.status == 'active' and slot and not slot.is_booked:
                                slot.is_booked = True
                                slot.save(update_fields=['is_booked'])
                except Exception:
                    # best-effort; don't fail verification if slot update fails
                    pass

            return Response(result)

        if payment_id:
            try:
                payment = Payment.objects.get(pk=int(payment_id))
            except Payment.DoesNotExist:
                return Response({'error': 'Payment not found'}, status=status.HTTP_404_NOT_FOUND)

            serializer = PaymentSerializer(payment)
            return Response(serializer.data)

        return Response({'error': 'Provide session_id or payment_id'}, status=status.HTTP_400_BAD_REQUEST)


class HuggingFaceProxyView(APIView):
    """AI Chat endpoint – built-in SmartPark parking assistant."""
    permission_classes = [permissions.IsAuthenticated]

