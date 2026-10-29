import { apiClient } from './apiClient';
import { normalizePermissions } from '../utils/sessionUser';

function normalizeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    ...normalizePermissions(user),
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

  // Admins only: the server refuses a superadmin. Sends a diff, never the full
  // list. The reply is the full updated user; the "nothing changed" reply
  // carries only part of the row (no dates), so callers take `permissions`
  // from it rather than replacing the whole user.
  async changePermissions(id, { grant = [], revoke = [] }) {
    const res = await apiClient.patch(`/api/admin/users/${id}/permissions`, { grant, revoke });
    return normalizeUser(res.data);
  },

  // Superadmin only. [{ key, label, description }] — the keys that can be granted.
  async getPermissionRegistry() {
    const res = await apiClient.get('/api/admin/users/permissions/registry');
    const list = Array.isArray(res.data) ? res.data : (res.data?.permissions ?? []);
    return list.map((p) => ({ key: p.key, label: p.label || p.key, description: p.description || '' }));
  },

  async resetPassword(id, newPassword) {
    await apiClient.patch(`/api/admin/users/${id}/password`, { newPassword });
  },

  async deleteUser(id) {
    await apiClient.delete(`/api/admin/users/${id}`);
  },
};
