import { apiClient } from './apiClient';
import { recordApprovalCap } from '../utils/approvalCap';
import { normalizeAge } from '../utils/ageRequirement';

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
  const approvalCap = recordApprovalCap(job.id, job.approvalCap);
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
    // { approved, max, full, overCap } or null if the server didn't send one.
    approvalCap,
    // Optional age requirement; both null when none. maxAge is never set without minAge.
    minAge: normalizeAge(job.min_age),
    maxAge: normalizeAge(job.max_age),
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
  // deliberately through the third argument. minAge / maxAge are stripped for
  // the same reason: the age requirement has its own endpoint
  // (setAgeRequirement) and the general update never carries it.
  async updateJob(id, jobData, { screeningConfig } = {}) {
    // eslint-disable-next-line no-unused-vars
    const { screeningConfig: _config, screeningLocked: _locked, minAge: _minAge, maxAge: _maxAge, ...rest } = jobData;
    const body = screeningConfig !== undefined ? { ...rest, screeningConfig } : rest;
    const res = await apiClient.put(`/api/admin/jobs/${id}`, body);
    return normalizeJob(res.data);
  },

  /**
   * PUT /jobs/:id/approval-cap. `maxApproved` is a whole number >= 0, or null
   * for no cap. Its own endpoint, not part of the job save. Resolves to the
   * job's new { approved, max, full, overCap }.
   */
  async setApprovalCap(id, maxApproved) {
    const res = await apiClient.put(`/api/admin/jobs/${id}/approval-cap`, { maxApproved });
    return recordApprovalCap(id, res.data?.approvalCap);
  },

  /**
   * PUT /jobs/:id/age-requirement. Both keys are always sent: a whole number
   * (minAge >= 18, maxAge >= minAge, never maxAge without minAge) or null to
   * leave it unset; both null clears the requirement. Its own endpoint, not part
   * of the job save. The reply is { jobId, min_age, max_age }; resolves to the
   * stored { minAge, maxAge }.
   */
  async setAgeRequirement(id, { minAge, maxAge }) {
    const sent = { minAge: minAge ?? null, maxAge: maxAge ?? null };
    const res = await apiClient.put(`/api/admin/jobs/${id}/age-requirement`, sent);
    const data = res.data;
    if (data && ('min_age' in data || 'max_age' in data)) {
      return { minAge: normalizeAge(data.min_age), maxAge: normalizeAge(data.max_age) };
    }
    return sent;
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
