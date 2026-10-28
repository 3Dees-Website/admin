import { apiClient } from './apiClient';

function normalizeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    // Separate from role. Superadmins can always approve whatever this says.
    canApprove: user.can_approve === true,
    createdAt: user.created_at,
    lastLogin: user.last_login,
  };
}

export const userService = {
  // All routes are superadmin-only (enforced by the backend).

  async getUsers() {
    const res = await apiClient.get('/api/admin/users');
    return res.data.map(normalizeUser);
  },

  async createUser({ name, email, password, role = 'admin' }) {
    const res = await apiClient.post('/api/admin/users', { name, email, password, role });
    return normalizeUser(res.data);
  },

  async toggleStatus(id) {
    const res = await apiClient.patch(`/api/admin/users/${id}/status`);
    return normalizeUser(res.data);
  },

  // Admins only: the server refuses a superadmin, who can always approve.
  // The "nothing changed" reply carries only part of the row (no dates), so
  // callers take canApprove from it rather than replacing the whole user.
  async setCanApprove(id, canApprove) {
    const res = await apiClient.patch(`/api/admin/users/${id}/permissions`, { canApprove });
    return normalizeUser(res.data);
  },

  async resetPassword(id, newPassword) {
    await apiClient.patch(`/api/admin/users/${id}/password`, { newPassword });
  },

  async deleteUser(id) {
    await apiClient.delete(`/api/admin/users/${id}`);
  },
};
