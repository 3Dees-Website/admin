import { apiClient } from './apiClient';

export const profileService = {
  async getMe() {
    const res = await apiClient.get('/api/auth/me');
    return res.data.user;
  },

  // The two things on the signed-in user that can change while a session is
  // open: whether they may approve (a superadmin can grant or remove it) and
  // whether the backend's applicant pipeline is on. /me carries the flag
  // beside `user`; accept it inside `user` too.
  async getSessionFlags() {
    const res = await apiClient.get('/api/auth/me');
    const user = res.data.user;
    return {
      canApprove: user?.can_approve === true,
      pipelineV2: (res.data.pipelineV2 ?? user?.pipelineV2) === true,
    };
  },

  async updateMyName(name) {
    const res = await apiClient.patch('/api/auth/me', { name });
    return res.data.user;
  },

  async changeMyPassword({ currentPassword, newPassword }) {
    await apiClient.patch('/api/auth/me/password', { currentPassword, newPassword });
  },
};
