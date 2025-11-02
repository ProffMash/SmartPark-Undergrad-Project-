import { useEffect } from 'react';
import { useNotificationStore } from '../stores/notificationStore';
import { useAuthStore } from '../stores/authStore';
import { useAppStore } from '../stores/appStore';

export const useNotifications = () => {
  const { addNotification, clearNotifications, markAllAsRead } = useNotificationStore();
  const { user } = useAuthStore();
  const { bookings } = useAppStore();

  // Set up booking reminders
  useEffect(() => {
    if (!user) return;

    const checkBookingReminders = () => {
      const userBookings = bookings.filter(b => b.userId === user.id && b.status === 'active');
      
      userBookings.forEach(booking => {
        const startTime = new Date(booking.startTime);
        const now = new Date();
        const timeDiff = startTime.getTime() - now.getTime();
        const hoursUntilStart = timeDiff / (1000 * 60 * 60);

        // Send reminder 1 hour before booking starts
        if (hoursUntilStart <= 1 && hoursUntilStart > 0.5) {
          addNotification({
            userId: user.id,
            type: 'booking_reminder',
            title: 'Booking Reminder',
            message: `Your parking slot booking starts in ${Math.round(hoursUntilStart * 60)} minutes. Don't forget to arrive on time!`,
            data: { bookingId: booking.id },
            isRead: false
          });
        }
      });
    };

    // Check for reminders every 30 minutes
    const interval = setInterval(checkBookingReminders, 30 * 60 * 1000);
    checkBookingReminders(); // Check immediately

    return () => clearInterval(interval);
  }, [bookings, user, addNotification]);

  const sendBookingConfirmation = (bookingId: string, slotNumber: string) => {
    if (!user) return;

    addNotification({
      userId: user.id,
      type: 'booking_confirmation',
      title: 'Booking Confirmed!',
      message: `Your parking slot #${slotNumber} has been successfully booked. You will receive a reminder before your booking starts.`,
      data: { bookingId },
      isRead: false
    });
  };

  const sendPaymentReceipt = (paymentId: string, bookingId: string, slotId: string, amount: number) => {
    if (!user) return;

    addNotification({
      userId: user.id,
      type: 'payment_receipt',
      title: 'Payment Receipt',
      message: `Payment of $${amount} processed successfully. Click to download your receipt.`,
      data: { paymentId, bookingId, slotId },
      isRead: false
    });
  };

  return {
    sendBookingConfirmation,
    sendPaymentReceipt,
    // Helper to clear all notifications (UI components can call this)
    clearNotifications,
    // Helper to mark all as read
    markAllAsRead
  };
};