import { apiClient } from './apiClient';

function normalizeLog(log) {
  return {
    id: log.id,
    applicationId: log.application_id,
    applicantName: log.applicant_name,
    jobTitle: log.job_title,
    prevStatus: log.prev_status,
    newStatus: log.new_status,
    changedBy: log.changed_by,
    timestamp: log.timestamp,
  };
}

export const auditService = {
  async getAuditLogs(filters = {}) {
    const res = await apiClient.get('/api/admin/audit-logs', filters);
    return res.data.map(normalizeLog);
  },

  async exportCsv(filters = {}) {
    return apiClient.getBlob('/api/admin/audit-logs/export', filters);
  },
};
