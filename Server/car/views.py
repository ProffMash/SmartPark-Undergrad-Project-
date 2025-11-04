from rest_framework import viewsets
from .models import User, ParkingSlot, Booking, Payment, Ticket, Contact
from .serializers import (
	UserSerializer,
	ParkingSlotSerializer,
	BookingSerializer,
	PaymentSerializer,
	TicketSerializer,
	ContactSerializer,
    RegisterSerializer,
	LoginSerializer,
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

class UserViewSet(viewsets.ModelViewSet):
	queryset = User.objects.all()
	serializer_class = UserSerializer

class ParkingSlotViewSet(viewsets.ModelViewSet):
    queryset = ParkingSlot.objects.all()
    serializer_class = ParkingSlotSerializer

    def list(self, request, *args, **kwargs):
        # The serializer computes live `is_booked` state; no need to run the
        # background expiry check on every request which can be slow.
        return super().list(request, *args, **kwargs)

    def retrieve(self, request, *args, **kwargs):
        # Live availability is computed in the serializer.
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
                headers = self.get_success_headers(serializer.data)

        except ParkingSlot.DoesNotExist:
            return Response({'error': 'Selected slot not found'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({'error': 'Failed to create booking', 'detail': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

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

class TicketViewSet(viewsets.ModelViewSet):
	queryset = Ticket.objects.all()
	serializer_class = TicketSerializer


class ContactViewSet(viewsets.ModelViewSet):
    queryset = Contact.objects.all()
    serializer_class = ContactSerializer

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
        # Run expiry logic before returning bookings so status is always up to date
        expire_bookings()
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
                # ensure user has a token and return it
                token, _ = Token.objects.get_or_create(user=user)
                return Response({
                    'id': user.id,
                    'email': user.email,
                    'username': user.username,
                    'role': user.role,
                    'name': user.name,
                    'phone': user.phone,
                    'vehicle_number': user.vehicle_number,
                    'vehicle_model': user.vehicle_model,
                    'vehicle_type': user.vehicle_type,
                    'is_active': user.is_active,
                    'created_at': user.created_at,
                    'message': 'Login successful',
                    'token': token.key,
                }, status=status.HTTP_200_OK)
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
                            'currency': 'usd',
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