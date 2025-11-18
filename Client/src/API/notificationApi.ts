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

export async function deleteNotification(notificationId: number | string) {
  const response = await api.delete(`notifications/${notificationId}/`);
  return response.data;
}

export async function deleteNotificationsBulk(ids: Array<number | string>) {
  // Delete in parallel but don't fail the whole batch on single failure
  await Promise.all(ids.map(async (id) => {
    try { await deleteNotification(id); } catch (e) { /* ignore per-item failures */ }
  }));
  return { success: true };
}

export default {
  createNotification,
  fetchNotifications,
  markAsRead,
};
