import React, { useState } from 'react';
import { CreditCard, X, Lock, CheckCircle } from 'lucide-react';
import { useAppStore } from '../stores/appStore';
import { useAuthStore } from '../stores/authStore';
import { useNotifications } from '../hooks/useNotifications';
import { createCheckoutSession } from '../API/paymentApi';

interface PaymentModalProps {
  amount: number;
  slotNumber: string;
  onClose: () => void;
  onSuccess: () => void;
  bookingId?: string;
  slotId?: string;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  amount,
  slotNumber,
  onClose,
  onSuccess,
  bookingId: propBookingId,
  slotId: propSlotId
}) => {
  // If you want to use a Stripe Payment Link (no server), set VITE_PAYMENT_LINK in client/.env
  // Example: VITE_PAYMENT_LINK=https://buy.stripe.com/test_xxx
  const PAYMENT_LINK = (import.meta as any)?.env?.VITE_PAYMENT_LINK || '';

  const { addPayment } = useAppStore();
  const updateBooking = useAppStore(state => state.updateBooking);
  const { user } = useAuthStore();
  const { sendPaymentReceipt } = useNotifications();
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [cardData, setCardData] = useState({
    number: '4532 1234 5678 9012',
    expiry: '12/26',
    cvv: '123',
    name: 'John Doe'
  });

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsProcessing(true);

    // If a Payment Link is provided, use it (no server required)
    if (PAYMENT_LINK) {
      // Optionally you can append query params for bookkeeping
      const url = `${PAYMENT_LINK}`;
      window.location.href = url;
      return;
    }
    // Try server-backed Stripe Checkout
    try {
      const bookingId = propBookingId || `booking-${Date.now()}`;
      const payload = { amount, bookingId, userId: user.id };
      const data = await createCheckoutSession(payload);
      if (data && data.url) {
        window.location.href = data.url;
        return;
      }
      throw new Error('No checkout url returned');
    } catch (err) {
      console.warn('Stripe server failed, falling back to local simulation', err);

      // Fallback: simulate payment processing
      await new Promise(resolve => setTimeout(resolve, 2000));

  const bookingId = propBookingId || `booking-${Date.now()}`;

      const payment = {
        id: `pay_${Math.random().toString(36).substr(2, 9)}`,
        bookingId,
        userId: user.id,
        amount,
        method: paymentMethod as 'card' | 'paypal' | 'wallet',
        status: 'completed' as const,
        transactionId: `txn_${Math.random().toString(36).substr(2, 9)}`
      };

      addPayment(payment);
      // Mark booking as completed so the slot becomes officially booked in the store
  try { if (bookingId) updateBooking(bookingId, { status: 'completed' }); } catch (e) { console.warn('updateBooking failed', e); }

      // Send payment receipt notification (best-effort)
  try { sendPaymentReceipt(payment.id, payment.bookingId, propSlotId || 'slot-id', amount); } catch {}

      setIsProcessing(false);
      setIsSuccess(true);

      setTimeout(() => {
        onSuccess();
      }, 2000);
    }
  };

  if (isSuccess) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 text-center">
          <div className="mb-6">
            <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-gray-900 mb-2">Payment Successful!</h3>
            <p className="text-gray-600">
              Your parking slot #{slotNumber} has been booked successfully.
            </p>
          </div>
          
          <div className="bg-gray-50 p-4 rounded-lg mb-6">
            <p className="text-lg font-semibold text-gray-900">${amount} paid</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-2">
            <CreditCard className="h-6 w-6 text-blue-600" />
            <h3 className="text-lg sm:text-xl font-bold text-gray-900">Secure Payment</h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="bg-blue-50 p-4 rounded-lg mb-6">
          <div className="flex items-center justify-between">
            <span className="text-gray-700">Parking Slot #{slotNumber}</span>
            <span className="text-xl sm:text-2xl font-bold text-blue-600">${amount}</span>
          </div>
        </div>

        <form onSubmit={handlePayment} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Payment Method</label>
            <div className="space-y-2">
              {[
                { value: 'card', label: 'Credit Card' },
                { value: 'paypal', label: 'PayPal' },
                { value: 'wallet', label: 'Digital Wallet' }
              ].map((method) => (
                <label key={method.value} className="flex items-center">
                  <input
                    type="radio"
                    value={method.value}
                    checked={paymentMethod === method.value}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="mr-2"
                  />
                  <span className="text-gray-700">{method.label}</span>
                </label>
              ))}
            </div>
          </div>

          {paymentMethod === 'card' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Card Number</label>
                <input
                  type="text"
                  value={cardData.number}
                  onChange={(e) => setCardData(prev => ({ ...prev, number: e.target.value }))}
                  placeholder="1234 5678 9012 3456"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Expiry</label>
                  <input
                    type="text"
                    value={cardData.expiry}
                    onChange={(e) => setCardData(prev => ({ ...prev, expiry: e.target.value }))}
                    placeholder="MM/YY"
                    className="w-full px-2 sm:px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">CVV</label>
                  <input
                    type="text"
                    value={cardData.cvv}
                    onChange={(e) => setCardData(prev => ({ ...prev, cvv: e.target.value }))}
                    placeholder="123"
                    className="w-full px-2 sm:px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cardholder Name</label>
                <input
                  type="text"
                  value={cardData.name}
                  onChange={(e) => setCardData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="John Doe"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          )}

          <div className="flex items-center space-x-2 text-xs sm:text-sm text-gray-600">
            <Lock className="h-4 w-4" />
            <span>Your payment information is secure and encrypted</span>
          </div>

          <button
            type="submit"
            disabled={isProcessing}
            className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
          >
            {isProcessing ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                <span>Processing Payment...</span>
              </>
            ) : (
              <>
                <Lock className="h-5 w-5" />
                <span>Pay ${amount}</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};