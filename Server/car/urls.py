from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
	UserViewSet,
	ParkingSlotViewSet,
	BookingViewSet,
	PaymentViewSet,
	TicketViewSet,
	ContactViewSet,
	RegisterView,
	LoginView,    
	CreateCheckoutSessionView,
	CancelPaymentView,
	VerifySessionView,
	PaymentHistoryView,
	BookingHistoryView,
)

router = DefaultRouter()
router.register(r'users', UserViewSet)
router.register(r'slots', ParkingSlotViewSet)
router.register(r'bookings', BookingViewSet)
router.register(r'payments', PaymentViewSet)
router.register(r'tickets', TicketViewSet)
router.register(r'contacts', ContactViewSet)

urlpatterns = [
	# Custom endpoints first so they are not shadowed by the ViewSet router
	path('payments/create-checkout-session/', CreateCheckoutSessionView.as_view(), name='create_checkout_session'),
	path('payments/cancel/', CancelPaymentView.as_view(), name='cancel_payment'),
	path('payments/verify/', VerifySessionView.as_view(), name='verify_session'),

	# Payment and Booking History endpoints
	path('payments/history/', PaymentHistoryView.as_view(), name='payment_history'),
	path('bookings/history/', BookingHistoryView.as_view(), name='booking_history'),

	path('', include(router.urls)),
	path('auth/register/', RegisterView.as_view(), name='register'),
	path('auth/login/', LoginView.as_view(), name='login'),
]
