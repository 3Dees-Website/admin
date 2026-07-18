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
  async getAuditLogsPage({ page, pageSize, ...filters } = {}) {
    const res = await apiClient.get('/api/admin/audit-logs', { ...filters, page, pageSize });
    return {
      items: res.data.items.map(normalizeLog),
      total: res.data.total,
      page: res.data.page,
      pageSize: res.data.pageSize,
    };
  },

  async exportCsv(filters = {}) {
    return apiClient.getBlob('/api/admin/audit-logs/export', filters);
  },
};
