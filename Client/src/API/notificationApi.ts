import api from './apiClient';

export interface CreateNotificationPayload {
  user_id?: number | string;
  type: string;
  title: string;
  message: string;
  data?: any;
  is_read?: boolean;
}

export async function createNotification(payload: CreateNotificationPayload) {
  const response = await api.post('notifications/', payload);
  return response.data;
}

export async function fetchNotifications(userId?: number | string) {
  const params: any = {};
  if (userId) params.user_id = userId;
  const response = await api.get('notifications/', { params });
  return response.data;
}

export async function markAsRead(notificationId: number | string) {
  const response = await api.patch(`notifications/${notificationId}/`, { is_read: true });
  return response.data;
}

export default {
  createNotification,
  fetchNotifications,
  markAsRead,
};
