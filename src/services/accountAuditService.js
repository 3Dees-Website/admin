import { apiClient } from './apiClient';

// details is JSONB and normally arrives parsed, but a string or any other
// shape must not reach the page as anything but a plain object.
function normalizeDetails(details) {
  let value = details;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return {};
    }
  }
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

const asText = (value) => (value === null || value === undefined ? null : String(value));

function normalizeEntry(entry) {
  return {
    id: entry.id,
    action: asText(entry.action) || '',
    timestamp: entry.timestamp,
    actor: {
      id: asText(entry.actor_id),
      name: asText(entry.actor_name),
      email: asText(entry.actor_email),
      role: asText(entry.actor_role),
    },
    target: {
      id: asText(entry.target_user_id),
      name: asText(entry.target_name),
      email: asText(entry.target_email),
      role: asText(entry.target_role),
    },
    details: normalizeDetails(entry.details),
  };
}

export const accountAuditService = {
  // Superadmin only (enforced by the backend). userId matches the account as
  // either actor or target.
  async getAccountAuditLogsPage({ page, pageSize, ...filters } = {}) {
    const res = await apiClient.get('/api/admin/account-audit-logs', { ...filters, page, pageSize });
    const items = Array.isArray(res.data?.items) ? res.data.items : [];
    return {
      items: items.filter(Boolean).map(normalizeEntry),
      total: res.data?.total ?? 0,
      page: res.data?.page,
      pageSize: res.data?.pageSize,
    };
  },
};
