import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAppStore } from '../stores/appStore';
import { useAuthStore } from '../stores/authStore';
import { useNotifications } from '../hooks/useNotifications';

function useQuery() {
  return new URLSearchParams(useLocation().search);
}

export const PaymentSuccess: React.FC = () => {
  const query = useQuery();
  const sessionId = query.get('session_id');
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const navigate = useNavigate();
  const addPayment = useAppStore(state => state.addPayment);
  const payments = useAppStore(state => state.payments);
  const updateBooking = useAppStore(state => state.updateBooking);
  const bookings = useAppStore(state => state.bookings);
  const slots = useAppStore(state => state.slots);
  const { user } = useAuthStore();
  const { sendPaymentReceipt } = useNotifications();
  const { sendBookingConfirmation } = useNotifications();

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const verify = async () => {
      if (!sessionId) {
        setStatus('No session found.');
        setLoading(false);
        timer = setTimeout(() => navigate('/', { replace: true }), 3000);
        return;
      }

      try {
        const paymentApi = await import('../API/paymentApi');
        const data = await paymentApi.verifySession({ session_id: sessionId || undefined });

        // If payment is complete, record it in app store
        if (data.payment_status === 'paid' || (data.payment_intent && data.payment_intent.status === 'succeeded')) {
          const bookingId = data.metadata?.bookingId || data.metadata?.bookingid || null;
          const amount = (data.amount_total || 0) / 100;
          const payment = {
            bookingId: bookingId || `booking-${Date.now()}`,
            userId: user?.id || 'unknown',
            amount,
            method: 'card' as const,
            status: 'completed' as const,
            transactionId: data.payment_intent?.charges?.[0]?.id || data.id
          };

          // Only add payment if it doesn't already exist (check by transactionId or bookingId)
          const already = payments.some(p => (payment.transactionId && p.transactionId === payment.transactionId) || (payment.bookingId && p.bookingId === payment.bookingId));
          if (!already) {
            try { addPayment(payment); } catch (e) { console.warn('addPayment failed', e); }
          }

          // Send payment receipt notification
          try {
            const localBooking = bookings.find(b => String(b.id) === String(bookingId));
            const slotId = localBooking?.slotId ?? null;
            const slot = slots.find(s => String(s.id) === String(slotId));
            const slotNumber = slot?.number ?? (slotId ? String(slotId) : null);
            sendPaymentReceipt?.(payment.transactionId, bookingId, slotId, slotNumber, amount);
          } catch (e) {
            console.debug('sendPaymentReceipt failed', e);
          }

          // Persist payment to server so backend can link it to the booking
          try {
            const paymentApiModule = await import('../API/paymentApi');
            // note: backend expects booking_id and user_id snake_case per serializers
            await paymentApiModule.createPayment({
              booking_id: bookingId,
              user_id: user?.id || null,
              amount,
              status: 'completed',
              transaction_id: payment.transactionId
            } as any);
          } catch (err) {
            console.warn('Failed to create payment on server', err);
          }

          if (bookingId) {
            try {
              const bookingApi = await import('../API/bookingApi');
              // update booking status and attach transaction id for reconciliation
              await bookingApi.updateBooking(bookingId, { status: 'completed', transaction_id: payment.transactionId } as any);
            } catch (e) { console.warn('updateBooking failed', e); }
          }

          // Send booking confirmation notification after payment completes
          try {
            // fetch booking details from server to ensure we have the canonical slot number
            let slotNumber: string | number | null = null;
            try {
              const bookingApi = await import('../API/bookingApi');
              const fresh = await bookingApi.fetchBookingById(bookingId as any);
              // bookingApi returns nested slot (ParkingSlotSerializer) under `slot`
              slotNumber = (fresh as any)?.slot?.slot_number ?? null;
            } catch (e) {
              // fallback to local store resolution
              const localBooking = bookings.find(b => String(b.id) === String(bookingId));
              const slotId = localBooking?.slotId ?? null;
              const slot = slots.find(s => String(s.id) === String(slotId));
              slotNumber = slot?.number ?? (slotId ? String(slotId) : null);
            }

            sendBookingConfirmation?.(bookingId, slotNumber);
          } catch (e) {
            console.debug('sendBookingConfirmation after payment failed', e);
          }

          setStatus('Payment verified. Thank you!');
        } else {
          setStatus(`Payment status: ${data.payment_status || data.payment_intent?.status}`);
        }
      } catch (err) {
        setStatus(`Verification error: ${(err as Error).message}`);
      } finally {
        setLoading(false);
        timer = setTimeout(() => navigate('/', { replace: true }), 4000);
      }
    };

    verify();

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [sessionId, navigate, addPayment, updateBooking]);

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-4">Payment Status</h2>
      {loading ? (
        <p>Verifying payment...</p>
      ) : (
        <>
          <p className="mb-2">{status}</p>
          {sessionId && (
            <p className="text-sm text-gray-600">Session ID: {sessionId}</p>
          )}
        </>
      )}
      <p className="mt-4 text-sm text-gray-500">You will be redirected shortly.</p>
    </div>
  );
};

export default PaymentSuccess;
