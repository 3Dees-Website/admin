import { apiClient } from './apiClient';

// The API stores personal_info with firstName/lastName separately.
// The UI expects a fullName string, so we derive it when missing.
function normalizePersonalInfo(info) {
  if (!info) return null;
  const fullName =
    info.fullName ||
    `${info.firstName || ''} ${info.lastName || ''}`.trim();
  return { ...info, fullName };
}

function normalizeApplication(app) {
  return {
    id: app.id,
    jobId: app.job_id,
    referenceId: app.reference_id,
    personalInfo: normalizePersonalInfo(app.personal_info),
    educationInfo: app.education_info,
    documents: app.documents,
    status: app.status,
    statusHistory: app.status_history,
    notes: app.notes,
    egiNote: app.egi_note,
    egiSyncStatus: app.egi_sync_status,
    egiDecision: app.egi_decision,
    egiDecisionNote: app.egi_decision_note,
    egiDecisionBy: app.egi_decision_by,
    egiDecisionAt: app.egi_decision_at,
    egiReferenceId: app.egi_reference_id,
    submittedAt: app.submitted_at,
    // Joined fields present on list/single endpoints
    jobTitle: app.job_title,
    clientOrg: app.client_org,
    category: app.category,
    location: app.location,
  };
}

function normalizeJobStat(stat) {
  return {
    jobId: stat.jobId,
    total: stat.total,
    pending: stat.pending,
    shortlisted: stat.shortlisted,
    approved: stat.approved,
    rejected: stat.rejected,
  };
}

export const applicationService = {
  // ── Admin routes (auth required) ──────────────────────────────────────────

  async getApplicationsPage({ page, pageSize, ...filters } = {}) {
    const res = await apiClient.get('/api/admin/applications', { ...filters, page, pageSize });
    return {
      items: res.data.items.map(normalizeApplication),
      total: res.data.total,
      page: res.data.page,
      pageSize: res.data.pageSize,
    };
  },

  async getStats() {
    const res = await apiClient.get('/api/admin/applications/stats');
    return res.data; // { total, byStatus, submittedToday, byEgiDecision, byEgiSyncStatus }
  },

  async getStatsByJob() {
    const res = await apiClient.get('/api/admin/applications/stats/by-job');
    return res.data.items.map(normalizeJobStat);
  },

  async getApplication(id) {
    const res = await apiClient.get(`/api/admin/applications/${id}`);
    return normalizeApplication(res.data);
  },

  async updateStatus(id, { status, notes, egiNote, changedBy }) {
    const res = await apiClient.patch(`/api/admin/applications/${id}/status`, {
      status,
      notes,
      ...(egiNote !== undefined ? { egiNote } : {}),
      changedBy,
    });
    return normalizeApplication(res.data);
  },

  async updateApplication(id, { personalInfo, educationInfo, documents, notes }) {
    const res = await apiClient.patch(`/api/admin/applications/${id}`, {
      personalInfo,
      educationInfo,
      documents,
      notes,
    });
    return normalizeApplication(res.data);
  },

  async bulkUpdateStatus({ ids, status, egiNote, changedBy }) {
    const res = await apiClient.patch('/api/admin/applications/bulk-status', {
      ids,
      status,
      ...(egiNote !== undefined ? { egiNote } : {}),
      changedBy,
    });
    return res.data; // { success: [...ids], failed: [{ id, reason }] }
  },

  async exportCsv(filters = {}) {
    return apiClient.getBlob('/api/admin/applications/export', filters);
  },

  // ── Public route ──────────────────────────────────────────────────────────

  async submitApplication(formData) {
    const res = await apiClient.postForm('/api/applications', formData);
    return res.data; // { id, referenceId, status }
  },
};
