import { apiClient } from './apiClient';

// Bulk status updates run server-side four at a time (up to 100 ids), so a
// large batch can outlast apiClient's ordinary 45s timeout.
//
// 90s is NOT arbitrary — do not raise it. api.3deesrecruitment.com sits
// behind Cloudflare, which cuts off a request that goes 100s without a
// response. Above that, Cloudflare ends the request first and the admin gets
// its error page instead of our "Still Processing" warning, which tells them
// their approvals are probably going through. This must stay under 100s.
const BULK_STATUS_TIMEOUT_MS = 90000;

// PUT /scores takes at most this many entries per request (the backend's bulk
// cap); a bigger cohort is sent in several requests.
const SCORES_CHUNK_SIZE = 100;
const SCORING_PAGE_SIZE = 100;

// GET /applications and GET /applications/:id send the screening totals as
// numeric strings ("75.50"); GET /screened and PUT /scores send real numbers.
// Either way the app works with numbers, or null before the first score.
function toNumberOrNull(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

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
    // Only GET /applications/:id carries these. Left undefined when absent
    // ("not loaded"), which is distinct from egi_delivery: null ("never queued").
    egiDelivery: app.egi_delivery,
    egiCanResend: app.egi_can_resend,
    egiResendKind: app.egi_resend_kind,
    // The server's own list of statuses this user may move this application to
    // now. null = the server didn't send one (no pipeline), which is not the
    // same as [] ("nothing allowed"). Sent camelCase; snake accepted too.
    allowedTransitions: Array.isArray(app.allowedTransitions)
      ? app.allowedTransitions
      : Array.isArray(app.allowed_transitions) ? app.allowed_transitions : null,
    // null until invited, then { mode:'text', body } or
    // { mode:'structured', venue, dateTime, phone, instructions? }
    inviteDetails: app.invite_details ?? null,
    // Only set while status is Rejected: the status it was rejected from.
    rejectedFrom: app.rejected_from ?? null,
    // { [fieldKey]: number }, {} before the first score
    screeningScores: app.screening_scores || {},
    screeningTotal: toNumberOrNull(app.screening_total),
    screeningMax: toNumberOrNull(app.screening_max),
    screeningPercentage: toNumberOrNull(app.screening_percentage),
    screenedAt: app.screened_at ?? null,
    applicantName: app.applicant_name || '',
    applicantEmail: app.applicant_email || '',
    stateOfOrigin: app.form_data?.stateOfOrigin || null,
    submittedAt: app.submitted_at,
    // Joined fields present on list/single endpoints
    jobTitle: app.job_title,
    clientOrg: app.client_org,
    category: app.category,
    location: app.location,
  };
}

// One entry of the notes timeline. `stage` is the application's status right
// after the action that wrote the note; kind 'egi' is the approval note that
// also went to EGI (sentToEgi); kind 'system' is a backend audit entry (author
// name "System", no authorId).
function normalizeNote(note) {
  return {
    id: note.id,
    applicationId: note.application_id,
    authorId: note.author_id ?? null,
    authorName: note.author_name || 'Unknown admin',
    stage: note.stage,
    body: note.body,
    kind: note.kind,
    sentToEgi: note.sent_to_egi === true,
    createdAt: note.created_at,
  };
}

// One item of PUT /scores's result. The totals are real numbers here (unlike
// list/detail rows, where they are strings); `changed` lists the field keys
// that were written, and an unchanged candidate comes back with unchanged:true.
function normalizeScoreItem(item) {
  return {
    id: item.id,
    status: item.status,
    complete: item.complete === true,
    unchanged: item.unchanged === true,
    screeningTotal: toNumberOrNull(item.screening_total),
    screeningMax: toNumberOrNull(item.screening_max),
    screeningPercentage: toNumberOrNull(item.screening_percentage),
    changed: Array.isArray(item.changed) ? item.changed : [],
  };
}

// One row of GET /screened: explicit columns only (no documents or form
// answers), with real numbers for the totals. It carries no allowedTransitions
// today (null here), so the screen reads each row's own from the detail
// endpoint until the list sends it.
function normalizeScreenedItem(item) {
  return {
    id: item.id,
    referenceId: item.reference_id,
    applicantName: item.applicant_name || '',
    applicantEmail: item.applicant_email || '',
    status: item.status,
    jobId: item.job_id,
    jobTitle: item.job_title,
    stateOfOrigin: item.state_of_origin || null,
    screeningScores: item.screening_scores || {},
    screeningTotal: toNumberOrNull(item.screening_total),
    screeningMax: toNumberOrNull(item.screening_max),
    screeningPercentage: toNumberOrNull(item.screening_percentage),
    screenedAt: item.screened_at ?? null,
    submittedAt: item.submitted_at,
    egiDecision: item.egi_decision,
    // Informational only: nothing is gated on the pass mark.
    passMark: item.pass_mark ?? null,
    passed: item.passed ?? null,
    allowedTransitions: Array.isArray(item.allowedTransitions)
      ? item.allowedTransitions
      : Array.isArray(item.allowed_transitions) ? item.allowed_transitions : null,
  };
}

function normalizeJobStat(stat) {
  return {
    jobId: stat.jobId,
    total: stat.total,
    pending: stat.pending,
    shortlisted: stat.shortlisted,
    screened: stat.screened,
    approved: stat.approved,
    rejected: stat.rejected,
    archived: stat.archived,
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

  /**
   * The Screened (and Saved) list. view: 'Screened' | 'Archived' | 'both'
   * (case-sensitive; anything else is a 400). sort: score | name | state | job |
   * submitted, order: asc | desc.
   */
  async getScreenedPage({ page, pageSize, ...filters } = {}) {
    const res = await apiClient.get('/api/admin/applications/screened', { ...filters, page, pageSize });
    return {
      items: res.data.items.map(normalizeScreenedItem),
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

  // `rejection` is { template:'standard' } or { message } (exactly one);
  // `invite` is the shortlist invitation ({ mode:'text', body } or
  // { mode:'structured', venue, dateTime, phone, instructions? }); `notes` is
  // an internal note written to the timeline at the new stage.
  async updateStatus(id, { status, notes, egiNote, invite, rejection, changedBy }) {
    const res = await apiClient.patch(`/api/admin/applications/${id}/status`, {
      status,
      ...(notes !== undefined ? { notes } : {}),
      ...(egiNote !== undefined ? { egiNote } : {}),
      ...(invite !== undefined ? { invite } : {}),
      ...(rejection !== undefined ? { rejection } : {}),
      changedBy,
    });
    return normalizeApplication(res.data);
  },

  // The notes timeline: oldest first, append-only. Nothing edits or
  // removes a note, so there is no conflict to handle.
  async getNotes(id) {
    const res = await apiClient.get(`/api/admin/applications/${id}/notes`);
    return res.data.map(normalizeNote);
  },

  async addNote(id, body) {
    const res = await apiClient.post(`/api/admin/applications/${id}/notes`, { body });
    return normalizeNote(res.data);
  },

  /**
   * Every candidate on a job matching any of `queries` (each a set of list
   * filters, e.g. { status: 'Screened' }), for the scoring grid. The list
   * endpoint takes one value per filter and 100 rows a page, so this reads each
   * query in turn. Beyond `softCap` rows in total it returns
   * { tooMany: true, total } without fetching the rest.
   */
  async getScoringCandidates({ jobId, queries, softCap }) {
    const firstPages = await Promise.all(
      queries.map((query) => applicationService.getApplicationsPage({ jobId, ...query, page: 1, pageSize: SCORING_PAGE_SIZE })),
    );
    const total = firstPages.reduce((sum, p) => sum + p.total, 0);
    if (total > softCap) return { tooMany: true, total, items: [] };

    const items = firstPages.flatMap((p) => p.items);
    for (const [i, first] of firstPages.entries()) {
      for (let page = 2; (page - 1) * SCORING_PAGE_SIZE < first.total; page += 1) {
        const next = await applicationService.getApplicationsPage({
          jobId, ...queries[i], page, pageSize: SCORING_PAGE_SIZE,
        });
        items.push(...next.items);
      }
    }
    return { tooMany: false, total, items };
  },

  /**
   * PUT /scores. entries: [{ applicationId, scores: { [fieldKey]: number|null } }].
   * `finalize` moves every entry's candidate to Screened if all fields are
   * scored (entries must then carry at least one score). The request always
   * answers 200 with per-candidate results, so success/failed are what count.
   *
   * Sent in chunks of SCORES_CHUNK_SIZE. A chunk that gets no usable answer is
   * reported as failed for each of its candidates rather than thrown, so the
   * other chunks still go through. Scores are set to a value, not added, so
   * sending the same entry again is safe.
   */
  async saveScores({ jobId, entries, finalize = false }) {
    const result = { success: [], failed: [], items: [] };
    for (let i = 0; i < entries.length; i += SCORES_CHUNK_SIZE) {
      const chunk = entries.slice(i, i + SCORES_CHUNK_SIZE);
      try {
        const res = await apiClient.put(
          '/api/admin/applications/scores',
          { jobId, entries: chunk, ...(finalize ? { finalize: true } : {}) },
          { timeoutMs: BULK_STATUS_TIMEOUT_MS },
        );
        result.success.push(...(res.data.success || []));
        result.failed.push(...(res.data.failed || []));
        result.items.push(...(res.data.items || []).map(normalizeScoreItem));
      } catch (err) {
        const reason = err?.error
          ? (err.message || 'The server refused the request.')
          : 'No answer from the server, so these scores may or may not have been saved. Reload to check.';
        chunk.forEach((entry) => result.failed.push({ id: entry.applicationId, reason }));
      }
    }
    return result;
  },

  // "Update & resend invite": only while Shortlisted. The response carries no
  // allowedTransitions, so callers refetch the row.
  async updateInvite(id, invite) {
    const res = await apiClient.patch(`/api/admin/applications/${id}/invite`, { invite });
    return normalizeApplication(res.data);
  },

  async updateApplication(id, { formData, documents }) {
    const res = await apiClient.patch(`/api/admin/applications/${id}`, {
      formData,
      documents,
    });
    return normalizeApplication(res.data);
  },

  // One shared egiNote / invite / rejection / notes for the whole batch.
  async bulkUpdateStatus({ ids, status, egiNote, invite, rejection, notes, changedBy }) {
    const res = await apiClient.patch('/api/admin/applications/bulk-status', {
      ids,
      status,
      ...(egiNote !== undefined ? { egiNote } : {}),
      ...(invite !== undefined ? { invite } : {}),
      ...(rejection !== undefined ? { rejection } : {}),
      ...(notes !== undefined ? { notes } : {}),
      changedBy,
    }, { timeoutMs: BULK_STATUS_TIMEOUT_MS });
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

  async deleteApplication(id) {
    await apiClient.delete(`/api/admin/applications/${id}`);
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
