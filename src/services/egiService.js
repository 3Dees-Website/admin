import { apiClient } from './apiClient';

function normalizeQueueItem(item) {
  return {
    id: item.id,
    applicationId: item.application_id,
    referenceId: item.reference_id,
    applicantEmail: item.applicant_email,
    status: item.status,
    attempts: item.attempts,
    lastError: item.last_error,
    nextAttemptAt: item.next_attempt_at,
    createdAt: item.created_at,
    // Delivery truth derived server-side from status + attempts + lease.
    deliveryState: item.delivery_state,
    superseded: Boolean(item.superseded),
    canRetry: Boolean(item.can_retry),
    maxAttempts: item.max_attempts,
    applicationStatus: item.application_status,
    egiDecision: item.egi_decision,
    applicationEgiSyncStatus: item.application_egi_sync_status,
  };
}

function normalizeStat(stat) {
  return {
    status: stat.status,
    count: stat.count,
    oldest: stat.oldest,
    exhausted: stat.exhausted || 0,
    retrying: stat.retrying || 0,
    stuck: stat.stuck || 0,
  };
}

export const egiService = {
  async getQueueStats() {
    const res = await apiClient.get('/api/admin/egi/queue/stats');
    return res.data.map(normalizeStat);
  },

  async getQueueItems(filters = {}) {
    const res = await apiClient.get('/api/admin/egi/queue', filters);
    return res.data.map(normalizeQueueItem);
  },

  async retryQueueItem(id) {
    const res = await apiClient.post(`/api/admin/egi/queue/${id}/retry`);
    return normalizeQueueItem(res.data);
  },
};
