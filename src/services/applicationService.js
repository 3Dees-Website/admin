import { apiClient } from './apiClient';

function normalizeApplication(app) {
  return {
    id: app.id,
    jobId: app.job_id,
    referenceId: app.reference_id,
    formData: app.form_data || {},
    documents: app.documents || {},
    verificationDocuments: app.verification_documents || [],
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
    egiResendCount: app.egi_resend_count || 0,
    applicantName: app.applicant_name || '',
    applicantEmail: app.applicant_email || '',
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

function normalizeStateStat(stat) {
  return {
    state: stat.state,
    count: stat.count,
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

  async getStatsByState() {
    const res = await apiClient.get('/api/admin/applications/stats/by-state');
    return {
      total: res.data.total,
      items: res.data.items.map(normalizeStateStat),
    };
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

  async updateApplication(id, { formData, documents }) {
    const res = await apiClient.patch(`/api/admin/applications/${id}`, {
      formData,
      documents,
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

  async addVerificationDocument(id, formData) {
    const res = await apiClient.postForm(`/api/admin/applications/${id}/verification-documents`, formData);
    return normalizeApplication(res.data);
  },

  async deleteVerificationDocument(id, docId) {
    const res = await apiClient.delete(`/api/admin/applications/${id}/verification-documents/${docId}`);
    return normalizeApplication(res.data);
  },

  async resendToEgi(id, egiNote) {
    const res = await apiClient.post(`/api/admin/applications/${id}/resend-egi`, { egiNote });
    return normalizeApplication(res.data);
  },

  async getDocumentUrl(id, key) {
    const res = await apiClient.post(`/api/admin/applications/${id}/document-url`, { key });
    return res.data.url;
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
