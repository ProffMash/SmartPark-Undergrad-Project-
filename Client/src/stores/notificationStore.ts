import { create } from 'zustand';
import { NotificationState } from '../types';

export const useNotificationStore = create<NotificationState>((set, _get) => ({
  notifications: [],
  unreadCount: 0,

  addNotification: (notificationData) => {
    const newNotification = {
      ...notificationData,
      id: `notification-${Date.now()}`,
      createdAt: new Date().toISOString()
    };
    
    set(state => ({
      notifications: [newNotification, ...state.notifications],
      unreadCount: state.unreadCount + 1
    }));

    // Show browser notification if permission granted
    if (Notification.permission === 'granted') {
      new Notification(notificationData.title, {
        body: notificationData.message,
        icon: '/vite.svg',
        tag: newNotification.id
      });
    }
  },

  markAsRead: (id) => {
    set(state => ({
      notifications: state.notifications.map(n => 
        n.id === id ? { ...n, isRead: true } : n
      ),
      unreadCount: Math.max(0, state.unreadCount - 1)
    }));
  },

  markAllAsRead: () => {
    set(state => ({
      notifications: state.notifications.map(n => ({ ...n, isRead: true })),
      unreadCount: 0
    }));
  },

  clearNotifications: () => {
    set({ notifications: [], unreadCount: 0 });
  }
}));