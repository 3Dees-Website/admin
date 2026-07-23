import { apiClient } from './apiClient';

export const profileService = {
  async getMe() {
    const res = await apiClient.get('/api/auth/me');
    return res.data.user;
  },

  async updateMyName(name) {
    const res = await apiClient.patch('/api/auth/me', { name });
    return res.data.user;
  },

  async changeMyPassword({ currentPassword, newPassword }) {
    await apiClient.patch('/api/auth/me/password', { currentPassword, newPassword });
  },
};
