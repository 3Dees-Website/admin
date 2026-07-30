import { apiClient } from './apiClient';

export const categoryService = {
  async getCategories() {
    const res = await apiClient.get('/api/admin/categories');
    return res.data; // [{ id, name }, ...]
  },

  async createCategory(name) {
    const res = await apiClient.post('/api/admin/categories', { name });
    return res.data; // { id, name }
  },

  async deleteCategory(id) {
    await apiClient.delete(`/api/admin/categories/${id}`);
  },
};
