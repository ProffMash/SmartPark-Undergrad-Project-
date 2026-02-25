import { useEffect, useRef } from 'react';
import { useNotificationStore } from '../stores/notificationStore';
import { useAuthStore } from '../stores/authStore';
import { useAppStore } from '../stores/appStore';

export const useNotifications = () => {
  const { addNotification, clearNotifications, markAllAsRead } = useNotificationStore();
  const { user } = useAuthStore();
  const { bookings, slots } = useAppStore();

  const notifiedExpiriesRef = useRef<Set<string | number>>(new Set());
  const expiredNotifiedRef = useRef<Set<string | number>>(new Set());

  // Set up booking reminders
  useEffect(() => {
    if (!user) return;

    const resolveSlotNumberForBooking = (booking: any) => {
      try {
        const slotId = (booking as any)?.slotId ?? null;
        const slot = slots.find((s: any) => String(s.id) === String(slotId));
        return slot?.number ?? (slotId ? String(slotId) : null);
      } catch (e) {
        return null;
      }
    };

    const EXPIRY_NOTIFICATION_WINDOW_MIN = 5; 

    const checkBookingReminders = () => {
      const userBookings = bookings.filter(
        b => b.userId === user.id && b.endTime && !['cancelled', 'expired', 'completed'].includes(b.status)
      );
      
      userBookings.forEach(booking => {
        const startTime = booking.startTime ? new Date(booking.startTime) : null;
        const now = new Date();
        const hoursUntilStart = startTime ? (startTime.getTime() - now.getTime()) / (1000 * 60 * 60) : null;

        if (hoursUntilStart != null && hoursUntilStart <= 1 && hoursUntilStart > 0.5) {
          addNotification({
            userId: user.id,
            type: 'booking_reminder',
            title: 'Booking Reminder',
            message: `Your parking slot booking starts in ${Math.round(hoursUntilStart * 60)} minutes. Don't forget to arrive on time!`,
            data: { bookingId: booking.id },
            isRead: false
          });
        }
        // Send expiry reminder 1 minute before booking end
        try {
          const endTime = booking.endTime ? new Date(booking.endTime) : null;
          const now = new Date();
          const minutesUntilEnd = endTime ? (endTime.getTime() - now.getTime()) / (1000 * 60) : null;
          if (minutesUntilEnd != null && minutesUntilEnd <= 1 && minutesUntilEnd > 0 && !notifiedExpiriesRef.current.has(booking.id)) {
            notifiedExpiriesRef.current.add(booking.id);
            const slotNumber = resolveSlotNumberForBooking(booking);
            addNotification({
              userId: user.id,
              type: 'booking_expiry',
              title: 'Booking Ending Soon',
              message: slotNumber
                ? `Your parking slot booking for slot #${slotNumber} will expire in about 1 minute. Please wrap up or extend your booking.`
                : `Your parking slot booking will expire in about 1 minute. Please wrap up or extend your booking.`,
              data: { bookingId: booking.id, slotId: booking.slotId, slotNumber },
              isRead: false
            });
          }
          // Send notification when booking has expired, but only if it expired recently
          if (
            minutesUntilEnd != null &&
            minutesUntilEnd <= 0 &&
            minutesUntilEnd > -EXPIRY_NOTIFICATION_WINDOW_MIN &&
            !expiredNotifiedRef.current.has(booking.id)
          ) {
            expiredNotifiedRef.current.add(booking.id);
            const slotNumber = resolveSlotNumberForBooking(booking);
            addNotification({
              userId: user.id,
              type: 'booking_expired',
              title: 'Booking Expired',
              message: slotNumber
                ? `Your booking for slot #${slotNumber} has ended. Thank you for using SmartPark.`
                : `Your booking has ended. Thank you for using SmartPark.`,
              data: { bookingId: booking.id, slotId: booking.slotId, slotNumber },
              isRead: false
            });
          }
        } catch (e) {
        }
      });
    };

    const interval = setInterval(checkBookingReminders, 15 * 1000);
    checkBookingReminders(); // Check immediately

    return () => clearInterval(interval);
  }, [bookings, user, addNotification]);

  const sendBookingConfirmation = (bookingId: string | number | null, slotNumber?: string | number | null) => {
    if (!user) return;

    // Resolve slotNumber if not provided using local bookings/slots
    let resolvedSlotNumber: string = '';
    if (slotNumber) {
      resolvedSlotNumber = String(slotNumber);
    } else {
      try {
        const localBooking = bookings.find(b => String(b.id) === String(bookingId));
        const slotId = localBooking?.slotId ?? null;
        const slot = slots.find(s => String(s.id) === String(slotId));
        resolvedSlotNumber = slot?.number ?? (slotId ? String(slotId) : '');
      } catch (e) {
        resolvedSlotNumber = '';
      }
    }

    addNotification({
      userId: user.id,
      type: 'booking_confirmation',
      title: 'Booking Confirmed!',
      message: resolvedSlotNumber
        ? `Your parking slot #${resolvedSlotNumber} has been successfully booked. You will receive a reminder before your booking starts.`
        : `Your booking (id: ${bookingId}) has been successfully processed. You will receive a reminder before your booking starts.`,
      data: { bookingId },
      isRead: false
    });
  };

  const sendPaymentReceipt = (
    paymentId: string | number,
    bookingId: string | number | null,
    slotId: string | number | null,
    slotNumber?: string | number | null,
    amount?: number
  ) => {
    if (!user) return;

    const amountText = typeof amount === 'number' ? `KSh ${amount}` : 'an amount';
    const message = slotNumber
      ? `Payment of ${amountText} for slot #${slotNumber} processed successfully. Click to download your receipt.`
      : `Payment of ${amountText} processed successfully. Click to download your receipt.`;

    addNotification({
      userId: user.id,
      type: 'payment_receipt',
      title: 'Payment Receipt',
      message,
      data: { paymentId, bookingId, slotId, slotNumber },
      isRead: false
    });
  };

  return {
    sendBookingConfirmation,
    sendPaymentReceipt,
    clearNotifications,
    markAllAsRead
  };
};