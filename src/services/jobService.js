import { apiClient } from './apiClient';

// The API returns snake_case keys at the top level. Normalise to camelCase
// so the rest of the app stays unchanged.
function normalizeJob(job) {
  return {
    id: job.id,
    title: job.title,
    clientOrg: job.client_org,
    category: job.category,
    type: job.type,
    location: job.location,
    openings: job.openings,
    salaryRange: job.salary_range,
    description: job.description,
    responsibilities: job.responsibilities,
    requirements: job.requirements,
    closingDate: job.closing_date,
    status: job.status,
    postedBy: job.posted_by,
    applicationRequirements: job.application_requirements,
    createdAt: job.created_at,
    isExpired: job.is_expired,
  };
}

export const jobService = {
  // ── Admin routes (auth required) ──────────────────────────────────────────

  async getAdminJobs(filters = {}) {
    const res = await apiClient.get('/api/admin/jobs', filters);
    return res.data.map(normalizeJob);
  },

  async getAdminJob(id) {
    const res = await apiClient.get(`/api/admin/jobs/${id}`);
    return normalizeJob(res.data);
  },

  async createJob(jobData) {
    const res = await apiClient.post('/api/admin/jobs', jobData);
    return normalizeJob(res.data);
  },

  async updateJob(id, jobData) {
    const res = await apiClient.put(`/api/admin/jobs/${id}`, jobData);
    return normalizeJob(res.data);
  },

  async deleteJob(id) {
    await apiClient.delete(`/api/admin/jobs/${id}`);
  },

  // ── Public routes (no auth required) ─────────────────────────────────────

  async getPublicJobs(filters = {}) {
    const res = await apiClient.get('/api/jobs', filters);
    return res.data.map(normalizeJob);
  },

  async getPublicJob(id) {
    const res = await apiClient.get(`/api/jobs/${id}`);
    return normalizeJob(res.data);
  },
};
