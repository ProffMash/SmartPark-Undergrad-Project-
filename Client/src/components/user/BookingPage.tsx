import React, { useState, useEffect } from 'react';
import FadeLoader from 'react-spinners/FadeLoader';
import { MapPin, X, Navigation } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { useAuthStore } from '../../stores/authStore';
import { add } from 'date-fns';
import { useMemo } from 'react';
import { createBooking as apiCreateBooking } from '../../API/bookingApi';
import { useNotifications } from '../../hooks/useNotifications';
import { createCheckoutSession } from '../../API/paymentApi';
import type { ParkingSlot } from '../../types';

export const BookingPage: React.FC = () => {
  const { slots, addBooking, setSlots } = useAppStore();
  const { user } = useAuthStore();
  const { sendBookingConfirmation } = useNotifications();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<number | string | null>(null);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [durationHours, setDurationHours] = useState(2);
  const [durationMinutes, setDurationMinutes] = useState(0);
  const [startTime, setStartTime] = useState(
    new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16)
  );

  // Helper: format a Date as 'YYYY-MM-DDTHH:mm' for <input type="datetime-local" />
  const formatAsLocalDatetimeInput = (d: Date = new Date()) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    const year = d.getFullYear();
    const month = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    const hour = pad(d.getHours());
    const minute = pad(d.getMinutes());
    return `${year}-${month}-${day}T${hour}:${minute}`;
  };

  // Helper: calculate distance between two [lat, lng] points in km
  function getDistanceKm(a: [number, number], b: [number, number]) {
    const toRad = (v: number) => (v * Math.PI) / 180;
    const R = 6371; // Earth radius in km
    const dLat = toRad(b[0] - a[0]);
    const dLng = toRad(b[1] - a[1]);
    const lat1 = toRad(a[0]);
    const lat2 = toRad(b[0]);
    const aVal =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(aVal), Math.sqrt(1 - aVal));
    return R * c;
  }

  // Only show slots that are available and within 2km of userLocation (if userLocation is available)
  const availableSlots = slots.filter(slot => {
    if (slot.isBooked) return false;
    if (!userLocation) return true; // If no user location, show all available
    // Prefer slot.coordinates, fallback to coordinates_lat/lng
    let slotCoords: [number, number] | undefined = slot.coordinates;
    if (!slotCoords && slot.coordinates_lat != null && slot.coordinates_lng != null) {
      slotCoords = [slot.coordinates_lat, slot.coordinates_lng];
    }
    if (!slotCoords) return false;
    return getDistanceKm(userLocation, slotCoords) <= 2; // within 2km
  });
  const selectedSlotData = slots.find(slot => slot.id === selectedSlot);
  const totalAmount = selectedSlotData
    ? Number((selectedSlotData.price * ((durationHours * 60 + durationMinutes) / 60)).toFixed(2))
    : 0;

  // computed endTime string formatted for datetime-local input
  const endTime = useMemo(() => {
    try {
      const dt = add(new Date(startTime), { hours: durationHours, minutes: durationMinutes });
      return formatAsLocalDatetimeInput(dt);
    } catch (e) {
      return '';
    }
  }, [startTime, durationHours, durationMinutes]);

  const handleBooking = async () => {
    if (!selectedSlotData || !user) return;
    // Prepare booking payload and create booking on the server so the server has the canonical id
      // Always use 3 decimal places for amount
      const userStartDate = new Date(startTime);
      const userEndDate = add(userStartDate, { hours: durationHours, minutes: durationMinutes });
      const bookingPayload = {
        user_id: Number(user.id),
        slot_id: Number(selectedSlotData.id),
        start_time: userStartDate.toISOString(),
        end_time: userEndDate.toISOString(),
        status: 'active',
        amount: Number(totalAmount.toFixed(2))
      } as any;

  let serverBookingId: number | string | null = null;
  let serverBooking: any = null;
    try {
      serverBooking = await apiCreateBooking(bookingPayload);
      serverBookingId = serverBooking.id;

      // Add the server booking to local store (shape mapping)
      addBooking({
        id: serverBooking.id,
        userId: serverBooking.user_id,
        slotId: serverBooking.slot_id,
        startTime: serverBooking.start_time,
        endTime: serverBooking.end_time,
        status: serverBooking.status as any,
        amount: Number(serverBooking.amount || 0),
        createdAt: serverBooking.created_at
      } as any);

      // Update startTime and endTime in UI to use stored values from backend
      setStartTime(new Date(serverBooking.start_time).toISOString().slice(0, 16));
      // Send booking confirmation notification
      try {
        sendBookingConfirmation?.(serverBooking.id, selectedSlotData.number);
      } catch (e) {
        // non-fatal if sending notification fails
        console.debug('sendBookingConfirmation failed', e);
      }
    } catch (err) {
      console.error('Server booking creation failed; aborting payment flow', err);
      setError('Failed to create booking on server. Please try again.');
      // Do not proceed to payment when server-sided booking creation fails.
      return;
    }

    // Start Stripe Checkout via backend API client
    (async () => {
      try {
        // bookingId must be a numeric server-side id. If it's missing or not numeric,
        // abort the payment flow to avoid server-side 400s.
        const bookingIdForSession = serverBookingId;
        const bookingIdNumeric = Number(bookingIdForSession);
        if (!bookingIdForSession || Number.isNaN(bookingIdNumeric)) {
          console.error('Invalid booking id from server, aborting checkout', bookingIdForSession);
          setError('Invalid server booking id, cannot start payment. Please try again.');
          return;
        }
        // Always use 3 decimal places for amount
  const payload = { amount: totalAmount.toFixed(2), bookingId: bookingIdNumeric, userId: user.id };
        const data = await createCheckoutSession(payload);
        // data: { url, id, payment_id }
        if (data && data.url) {
          window.location.href = data.url;
        } else if ((import.meta as any)?.env?.VITE_PAYMENT_LINK) {
          window.location.href = (import.meta as any).env.VITE_PAYMENT_LINK;
        } else {
          alert('Payment could not be initiated.');
        }
      } catch (err) {
        console.error('Checkout start failed', err);
        if ((import.meta as any)?.env?.VITE_PAYMENT_LINK) {
          window.location.href = (import.meta as any).env.VITE_PAYMENT_LINK;
        } else {
          alert('Payment could not be initiated.');
        }
      }
    })();
  };

  useEffect(() => {
    let mounted = true;
    let intervalId: any = null;

    // get user location for navigation
    try {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation([position.coords.latitude, position.coords.longitude]);
        },
        (err) => {
          // ignore geolocation errors silently — navigation will just be disabled
          console.debug('Geolocation not available or permission denied', err);
        }
      );
    } catch (e) {
      // navigator may not be available in some test environments
    }

    const loadSlots = async () => {
      setLoading(true);
      setError(null);
      try {
        const api = await import('../../API/parkingSlotApi');
        const data = await api.fetchParkingSlots();
        // Map API shape to app shape with explicit types
          const mapped: ParkingSlot[] = data.map((s: any) => {
          const lat = s.coordinates_lat != null ? Number(s.coordinates_lat) : undefined;
          const lng = s.coordinates_lng != null ? Number(s.coordinates_lng) : undefined;
          const coordinates = (lat != null && lng != null) ? ([lat, lng] as [number, number]) : undefined;

          return {
            id: s.id,
            number: String(s.slot_number),
            location: s.location ?? '',
            coordinates,
            coordinates_lat: lat,
            coordinates_lng: lng,
            isBooked: Boolean(s.is_booked),
            price: Number(s.price) || 0,
            // API may return legacy 'disabled' type; map it to 'regular' so it matches
            // the app's allowed union: 'regular' | 'premium' | 'vip'
            type: s.type === 'premium' || s.type === 'vip' ? s.type : 'regular',
            facilities: Array.isArray(s.facilities) ? s.facilities : [],
            createdAt: s.created_at ?? new Date().toISOString()
          };
        });

        if (mounted) {
          setSlots(mapped);
        }
      } catch (err: any) {
        console.error('Failed to load parking slots', err);
        if (mounted) setError(err?.message || 'Failed to load parking slots');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadSlots();

    // Poll every 20 seconds to pick up slot availability changes (e.g., expired bookings)
    intervalId = setInterval(() => {
      if (!mounted) return;
      loadSlots();
    }, 20000);

    return () => {
      mounted = false;
      if (intervalId) clearInterval(intervalId);
    };
  }, [setSlots]);

  const getDirections = (slotId: number | string) => {
    const slot = slots.find((s) => s.id === slotId);
    if (!slot) return;
    const coords =
      slot.coordinates && slot.coordinates.length === 2
        ? slot.coordinates
        : slot.coordinates_lat != null && slot.coordinates_lng != null
        ? [slot.coordinates_lat, slot.coordinates_lng]
        : null;

    if (!coords || !userLocation) {
      // If no coords or no user location, try to open the slot location only
      if (coords) {
        const url = `https://www.google.com/maps/search/?api=1&query=${coords[0]},${coords[1]}`;
        window.open(url, '_blank');
      }
      return;
    }

    const url = `https://www.google.com/maps/dir/${userLocation[0]},${userLocation[1]}/${coords[0]},${coords[1]}`;
    window.open(url, '_blank');
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Book a Parking Slot</h1>
          <p className="text-gray-600">Select an available slot and choose your booking duration</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          <div className="lg:col-span-2 order-2 lg:order-1">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-6">Available Parking Slots</h2>
              {loading && (
                <div className="flex items-center justify-center min-h-[200px]">
                  <FadeLoader color="#2563EB" />
                </div>
              )}
              {error && (
                <div className="mb-4 p-3 rounded bg-red-50 text-red-700">{error}</div>
              )}
              
              {availableSlots.length === 0 ? (
                <div className="text-center py-12">
                  <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Available Slots</h3>
                  <p className="text-gray-600">All parking slots are currently booked. Please try again later.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {availableSlots.map((slot) => (
                    <div
                      key={slot.id}
                      // clicking the card selects it, but does not open the modal
                      onClick={() => setSelectedSlot(slot.id)}
                      className={`p-4 border-2 rounded-xl cursor-pointer transition-all duration-300 ${
                        selectedSlot === slot.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-2">
                          <span className="text-lg font-bold text-gray-900">#{slot.number}</span>
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            slot.type === 'premium'
                              ? 'bg-purple-100 text-purple-800'
                              : slot.type === 'vip'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {slot.type}
                          </span>
                        </div>
                        <span className="text-lg font-bold text-blue-600">${slot.price}/hr</span>
                      </div>
                      
                      <div className="flex items-center text-sm text-gray-600 mb-3">
                        <MapPin className="h-4 w-4 mr-1" />
                        {slot.location}
                      </div>
                      
                      <div className="flex flex-wrap gap-1">
                        {slot.facilities.map((facility, index) => (
                          <span
                            key={index}
                            className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded"
                          >
                            {facility}
                          </span>
                        ))}
                      </div>
                      {/* Show inline "Book Now" button when this slot is selected */}
                      {selectedSlot === slot.id && (
                        <div className="mt-4 flex gap-3">
                          {/* Navigate button (opens Google Maps directions) */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              getDirections(slot.id);
                            }}
                            className="flex-1 inline-flex items-center justify-center gap-2 border border-gray-300 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                          >
                            <Navigation className="h-4 w-4" />
                            <span className="text-sm">Navigate</span>
                          </button>

                          {/* Primary booking action */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              // Set start time to the user's local current time
                              setStartTime(formatAsLocalDatetimeInput(new Date()));
                              setShowBookingModal(true);
                            }}
                            className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                          >
                            Book Now
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Booking Details Modal (opens when user clicks "Book Now" inside a slot) */}
      {showBookingModal && selectedSlotData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg sm:text-xl font-bold text-gray-900">Booking Details</h3>
              <button
                onClick={() => setShowBookingModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Start Time</label>
                <input
                  type="datetime-local"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  min={formatAsLocalDatetimeInput(new Date())}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">End Time</label>
                <input
                  type="datetime-local"
                  value={endTime}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-200 bg-gray-50 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Duration</label>
                <div className="flex gap-2">
                  <select
                    value={durationHours}
                    onChange={(e) => setDurationHours(Number(e.target.value))}
                    className="w-1/2 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {[0,1,2,3,4,5,6,8,12,24].map(hours => (
                      <option key={hours} value={hours}>
                        {hours} {hours === 1 ? 'hour' : 'hours'}
                      </option>
                    ))}
                  </select>

                  <input
                    type="number"
                    min={0}
                    max={59}
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Math.max(0, Math.min(59, Number(e.target.value || 0))))}
                    className="w-1/2 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    aria-label="Minutes"
                  />
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-semibold text-gray-900 mb-2">Selected Slot</h4>
                <div className="space-y-2 text-sm sm:text-base">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Slot:</span>
                    <span className="font-medium">#{selectedSlotData.number}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Location:</span>
                    <span className="font-medium">{selectedSlotData.location}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Duration:</span>
                    <span className="font-medium">{durationHours}h {durationMinutes}m</span>
                  </div>
                  <div className="flex justify-between text-base sm:text-lg">
                    <span className="font-semibold">Total:</span>
                    <span className="font-bold text-blue-600">${totalAmount}</span>
                  </div>
                </div>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={() => setShowBookingModal(false)}
                  className="flex-1 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>

                <button
                  onClick={() => {
                    // start booking flow then close modal for UI responsiveness
                    handleBooking();
                    setShowBookingModal(false);
                  }}
                  disabled={!selectedSlot}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Confirm & Pay
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

  {/* Payment handled via Stripe Checkout (server) - secure modal removed */}
    </div>
  );
};
