import React, { useState, useEffect } from 'react';
import { Bell, X, Download, CheckCircle, Clock, CreditCard, Trash2 } from 'lucide-react';
import { useNotificationStore } from '../stores/notificationStore';
import { useAuthStore } from '../stores/authStore';
import { useAppStore } from '../stores/appStore';
import { generatePaymentReceipt } from '../utils/pdfGenerator';
import { format } from 'date-fns';

export const NotificationCenter: React.FC = () => {
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearNotifications } = useNotificationStore();
  const { user } = useAuthStore();
  const { payments, bookings, slots } = useAppStore();
  const [isOpen, setIsOpen] = useState(false);

  // Request notification permission on component mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const userNotifications = notifications.filter(n => n.userId === user?.id);

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'booking_confirmation':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'new_booking':
        return <Bell className="h-5 w-5 text-yellow-600" />;
      case 'booking_reminder':
        return <Clock className="h-5 w-5 text-blue-600" />;
      case 'payment_receipt':
        return <CreditCard className="h-5 w-5 text-purple-600" />;
      case 'payment_succeeded':
        return <CreditCard className="h-5 w-5 text-green-600" />;
      default:
        return <Bell className="h-5 w-5 text-gray-600" />;
    }
  };

  const handleDownloadReceipt = (notification: any) => {
    if (notification.type === 'payment_receipt' && notification.data) {
      const payment = payments.find(p => p.id === notification.data.paymentId);
      const booking = bookings.find(b => b.id === notification.data.bookingId);
      const slot = slots.find(s => s.id === notification.data.slotId);
      
      if (payment && booking && slot && user) {
        generatePaymentReceipt(payment, booking, slot, user);
        markAsRead(notification.id);
      }
    }
  };

  const handleNotificationClick = (notification: any) => {
    if (!notification.isRead) {
      markAsRead(notification.id);
    }
  };

  return (
    <div className="relative">
      {/* Notification Bell */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-1.5 sm:p-2 text-gray-600 hover:text-gray-900 transition-colors inline-flex items-center flex-shrink-0"
        aria-label="Open notifications"
      >
        <Bell className="h-5 w-5 sm:h-6 sm:w-6" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] sm:text-xs rounded-full h-4 w-4 sm:h-5 sm:w-5 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Panel */}
      {isOpen && (
        <>
          {/* Mobile overlay */}
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Desktop dropdown (large screens) */}
          <div className="hidden lg:block absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-xl border z-50 max-h-96 overflow-hidden">
            <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Notifications</h3>
              <div className="flex items-center space-x-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-sm text-blue-600 hover:text-blue-700 transition-colors"
                  >
                    Mark all read
                  </button>
                )}

                {notifications.length > 0 && (
                  <button
                    onClick={() => {
                      const ok = confirm('Clear all notifications? This cannot be undone.');
                      if (ok) {
                        clearNotifications();
                        setIsOpen(false);
                      }
                    }}
                    title="Clear all notifications"
                    className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                    aria-label="Clear all notifications"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                )}

                <button
                  onClick={() => setIsOpen(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors lg:hidden"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="max-h-80 overflow-y-auto">
              {userNotifications.length === 0 ? (
                <div className="p-6 text-center">
                  <Bell className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600">No notifications yet</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {userNotifications.map((notification) => (
                    <div
                      key={notification.id}
                      onClick={() => handleNotificationClick(notification)}
                      className={`p-4 hover:bg-gray-50 transition-colors cursor-pointer ${
                        !notification.isRead ? 'bg-blue-50' : ''
                      }`}
                    >
                      <div className="flex items-start space-x-3">
                        <div className="flex-shrink-0 mt-1">
                          {getNotificationIcon(notification.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className={`text-sm font-medium ${
                              !notification.isRead ? 'text-gray-900' : 'text-gray-700'
                            }`}>
                              {notification.title}
                            </p>
                            {!notification.isRead && (
                              <div className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0"></div>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 mt-1 break-words">
                            {notification.message}
                          </p>
                          <div className="flex items-center justify-between mt-2">
                            <p className="text-xs text-gray-500">
                              {format(new Date(notification.createdAt), 'MMM dd, HH:mm')}
                            </p>
                            {notification.type === 'payment_receipt' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDownloadReceipt(notification);
                                }}
                                className="text-xs bg-purple-600 text-white px-2 py-1 rounded hover:bg-purple-700 transition-colors flex items-center space-x-1"
                              >
                                <Download className="h-3 w-3" />
                                <span>Download PDF</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {userNotifications.length > 0 && (
              <div className="p-4 border-t bg-gray-50">
                <button
                  onClick={() => {
                    clearNotifications();
                    setIsOpen(false);
                  }}
                  className="w-full text-sm text-gray-600 hover:text-gray-800 transition-colors"
                >
                  Clear all notifications
                </button>
              </div>
            )}
          </div>

          {/* Mobile centered modal (small screens) */}
          <div className="lg:hidden fixed inset-0 z-50 flex items-center justify-center px-4">
            {/* overlay */}
            <div className="absolute inset-0 bg-black bg-opacity-50" onClick={() => setIsOpen(false)} />

            {/* modal card */}
            <div className="relative w-full max-w-md mx-auto bg-white rounded-xl shadow-xl border z-50 max-h-[90vh] overflow-hidden">
              <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Notifications</h3>
                <div className="flex items-center space-x-2">
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="text-sm text-blue-600 hover:text-blue-700 transition-colors"
                    >
                      Mark all read
                    </button>
                  )}
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div className="overflow-y-auto max-h-[calc(90vh-64px)]">
                {userNotifications.length === 0 ? (
                  <div className="p-6 text-center">
                    <Bell className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600">No notifications yet</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200">
                    {userNotifications.map((notification) => (
                      <div
                        key={notification.id}
                        onClick={() => handleNotificationClick(notification)}
                        className={`p-4 hover:bg-gray-50 transition-colors cursor-pointer ${
                          !notification.isRead ? 'bg-blue-50' : ''
                        }`}
                      >
                        <div className="flex items-start space-x-3">
                          <div className="flex-shrink-0 mt-1">
                            {getNotificationIcon(notification.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <p className={`text-sm font-medium ${
                                !notification.isRead ? 'text-gray-900' : 'text-gray-700'
                              }`}>
                                {notification.title}
                              </p>
                              {!notification.isRead && (
                                <div className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0"></div>
                              )}
                            </div>
                            <p className="text-sm text-gray-600 mt-1 break-words">
                              {notification.message}
                            </p>
                            <div className="flex items-center justify-between mt-2">
                              <p className="text-xs text-gray-500">
                                {format(new Date(notification.createdAt), 'MMM dd, HH:mm')}
                              </p>
                              {notification.type === 'payment_receipt' && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDownloadReceipt(notification);
                                  }}
                                  className="text-xs bg-purple-600 text-white px-2 py-1 rounded hover:bg-purple-700 transition-colors flex items-center space-x-1"
                                >
                                  <Download className="h-3 w-3" />
                                  <span>Download PDF</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {userNotifications.length > 0 && (
                <div className="p-4 border-t bg-gray-50">
                  <button
                    onClick={() => {
                      clearNotifications();
                      setIsOpen(false);
                    }}
                    className="w-full text-sm text-gray-600 hover:text-gray-800 transition-colors"
                  >
                    Clear all notifications
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};