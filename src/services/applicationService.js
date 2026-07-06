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
    egiSyncStatus: app.egi_sync_status,
    submittedAt: app.submitted_at,
    // Joined fields present on list/single endpoints
    jobTitle: app.job_title,
    clientOrg: app.client_org,
    category: app.category,
    location: app.location,
  };
}

export const applicationService = {
  // ── Admin routes (auth required) ──────────────────────────────────────────

  async getApplications(filters = {}) {
    const res = await apiClient.get('/api/admin/applications', filters);
    return res.data.map(normalizeApplication);
  },

  async getApplication(id) {
    const res = await apiClient.get(`/api/admin/applications/${id}`);
    return normalizeApplication(res.data);
  },

  async updateStatus(id, { status, notes, changedBy }) {
    const res = await apiClient.patch(`/api/admin/applications/${id}/status`, {
      status,
      notes,
      changedBy,
    });
    return normalizeApplication(res.data);
  },

  async bulkUpdateStatus({ ids, status, changedBy }) {
    const res = await apiClient.patch('/api/admin/applications/bulk-status', {
      ids,
      status,
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
