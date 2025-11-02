from django.test import TestCase
from django.utils import timezone
from django.core.management import call_command
from datetime import timedelta

from .models import User, ParkingSlot, Booking


class ExpireBookingsTest(TestCase):
	def setUp(self):
		self.user = User.objects.create_user(email='test@example.com', username='testuser', password='pass123')
		self.slot = ParkingSlot.objects.create(slot_number='A1', location='Lot 1', coordinates_lat=0.0, coordinates_lng=0.0, is_booked=False, price=5.00, type='regular')

	def test_booking_expires_and_slot_freed(self):
		# create a booking that ended 1 minute ago
		past_end = timezone.now() - timedelta(minutes=1)
		start = past_end - timedelta(hours=1)
		booking = Booking.objects.create(user=self.user, slot=self.slot, start_time=start, end_time=past_end, status='active', amount=5.00)
		# simulate that slot was marked booked when booking was created
		self.slot.is_booked = True
		self.slot.save()

		# run management command
		call_command('expire_bookings')

		booking.refresh_from_db()
		self.slot.refresh_from_db()

		self.assertEqual(booking.status, 'expired')
		self.assertFalse(self.slot.is_booked)
