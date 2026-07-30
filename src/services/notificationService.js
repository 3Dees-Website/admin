import { apiClient } from './apiClient';

export const notificationService = {
  async getNotifications() {
    const res = await apiClient.get('/api/admin/notifications');
    return res.data; // { items: [...], unreadCount }
  },

  async markRead(id) {
    const res = await apiClient.patch(`/api/admin/notifications/${id}/read`);
    return res.data;
  },

  async markAllRead() {
    const res = await apiClient.patch('/api/admin/notifications/read-all');
    return res.data;
  },
};
