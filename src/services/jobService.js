import { apiClient } from './apiClient';

// The API returns snake_case keys at the top level. Normalise to camelCase
// so the rest of the app stays unchanged.
// Response key is screening_config; the request key is screeningConfig.
// { skipScreening, fields: [{ key, label, max }], passMark? } or null.
function normalizeScreeningConfig(config) {
  if (!config || typeof config !== 'object') return null;
  return {
    skipScreening: config.skipScreening === true,
    fields: Array.isArray(config.fields)
      ? config.fields.map((f) => ({ key: f.key, label: f.label, max: Number(f.max) }))
      : [],
    passMark: config.passMark === undefined || config.passMark === null ? null : Number(config.passMark),
  };
}

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
    // View-only for any admin; editing is superadmin-only (server-enforced).
    screeningConfig: normalizeScreeningConfig(job.screening_config),
    // Only GET /admin/jobs and /:id carry this. POST/PUT responses don't, so it
    // stays undefined ("not loaded") after a save until the jobs are refetched.
    screeningLocked: typeof job.screeningLocked === 'boolean' ? job.screeningLocked : undefined,
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
    // eslint-disable-next-line no-unused-vars
    const { screeningLocked: _locked, ...rest } = jobData;
    const res = await apiClient.post('/api/admin/jobs', rest);
    return normalizeJob(res.data);
  },

  // Callers pass back whole normalized jobs (e.g. the Active/Closed toggle), so
  // screeningConfig / screeningLocked are stripped here: the server refuses a
  // config change from a plain admin, and a round-tripped config that isn't
  // byte-identical would look like one. The screening editor sends it
  // deliberately through the third argument.
  async updateJob(id, jobData, { screeningConfig } = {}) {
    // eslint-disable-next-line no-unused-vars
    const { screeningConfig: _config, screeningLocked: _locked, ...rest } = jobData;
    const body = screeningConfig !== undefined ? { ...rest, screeningConfig } : rest;
    const res = await apiClient.put(`/api/admin/jobs/${id}`, body);
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
