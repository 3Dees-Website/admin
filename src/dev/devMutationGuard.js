/**
 * Dev-only guard for write requests. Local development points at the
 * production database, so a careless click on Shortlist or Reject would change
 * a real applicant and email them.
 *
 * In a dev build, every write to /api/admin/* (and the public application
 * submit) is answered here instead of being sent:
 *   - a few existing endpoints have a fake that returns the real record (read
 *     with an ordinary GET) changed in memory only;
 *   - a read that has to show what a fake did (the notes list) is overlaid in
 *     READ_OVERLAYS; every other GET passes through untouched;
 *   - everything else is refused with a clear error, so a new screen can't
 *     write by accident before it has a fake of its own.
 * Add a fake to HANDLERS in the same change as the screen that needs it.
 *
 * Opt out with VITE_ALLOW_REAL_MUTATIONS=true in your own .env.local. Reads
 * other than the overlays above are never touched. This file is only imported behind import.meta.env.DEV
 * (apiClient.js), so it is not part of a production build.
 */

const GUARDED = /^\/api\/(admin\/|applications(\/|$))/;
// A user's own bell read-state: harmless, and blocking it would break the bell.
const ALLOWED = [/^\/api\/admin\/notifications\//];

// Notes added through the faked POST, per application, so the timeline reads
// back what was "saved" (the real list never changes). Lives until the page
// is reloaded.
const fakeNotes = new Map();

// Scores "saved" through the faked PUT /scores, per application, and screening
// configurations "saved" through the faked job PUT, per job. The reads below
// overlay them, so the scoring grid and job form see what was faked.
const fakeScores = new Map(); // applicationId -> { jobId, scores, status, total, max, percentage }
const fakeJobConfigs = new Map(); // jobId -> screeningConfig
// Approval permissions "saved" through the faked PATCH /users/:id/permissions.
const fakeCanApprove = new Map(); // userId -> boolean

const round2 = (n) => Math.round(n * 100) / 100;
const jobIsLocked = (jobId) => [...fakeScores.values()].some((s) => s.jobId === jobId && Object.keys(s.scores).length > 0);

const ok = (data, what) => ({ success: true, data, message: `[dev fake] ${what} — nothing was sent to the server.` });
const now = () => new Date().toISOString();

const readApp = async (read, id) => (await read(`/api/admin/applications/${id}`)).data;

// The timeline note a status change's `notes` field writes, at the new stage.
const addFakeNote = (applicationId, stage, text) => {
  const note = {
    id: `dev-fake-${applicationId}-${Date.now()}`,
    application_id: applicationId,
    author_id: null,
    author_name: '(dev fake)',
    stage,
    body: String(text).trim(),
    kind: 'note',
    sent_to_egi: false,
    created_at: now(),
  };
  fakeNotes.set(applicationId, [...(fakeNotes.get(applicationId) || []), note]);
  return note;
};

const overlayApplication = (app) => {
  const fake = fakeScores.get(app.id);
  if (!fake) return app;
  // The real API sends these totals as numeric strings on list/detail rows.
  const asString = (n) => (n === null ? null : n.toFixed(2));
  return {
    ...app,
    status: fake.status,
    screening_scores: fake.scores,
    screening_total: asString(fake.total),
    screening_max: asString(fake.max),
    screening_percentage: asString(fake.percentage),
  };
};

const overlayJob = (job) => ({
  ...job,
  ...(fakeJobConfigs.has(job.id) ? { screening_config: fakeJobConfigs.get(job.id) } : {}),
  screeningLocked: job.screeningLocked === true || jobIsLocked(job.id),
});

// Reads that must also show what the faked writes did. Everything else that is
// a GET goes straight through.
const READ_OVERLAYS = [
  {
    path: /^\/api\/admin\/users$/,
    run: async ({ path, read }) => {
      const real = await read(path);
      return {
        ...real,
        data: (real.data || []).map((u) => (fakeCanApprove.has(u.id) ? { ...u, can_approve: fakeCanApprove.get(u.id) } : u)),
      };
    },
  },
  {
    path: /^\/api\/admin\/applications$/,
    run: async ({ path, read }) => {
      const real = await read(path);
      return { ...real, data: { ...real.data, items: (real.data?.items || []).map(overlayApplication) } };
    },
  },
  {
    // Not the fixed sub-routes (stats, export, …): export is a file download.
    path: /^\/api\/admin\/applications\/(?!stats$|export$|screened$|scores$)([^/]+)$/,
    run: async ({ path, read }) => {
      const real = await read(path);
      return { ...real, data: overlayApplication(real.data) };
    },
  },
  {
    path: /^\/api\/admin\/jobs$/,
    run: async ({ path, read }) => {
      const real = await read(path);
      return { ...real, data: (real.data || []).map(overlayJob) };
    },
  },
  {
    path: /^\/api\/admin\/jobs\/([^/]+)$/,
    run: async ({ path, read }) => {
      const real = await read(path);
      return { ...real, data: overlayJob(real.data) };
    },
  },
  {
    path: /^\/api\/admin\/applications\/([^/]+)\/notes$/,
    run: async ({ match, read }) => {
      const real = await read(`/api/admin/applications/${match[1]}/notes`);
      return { ...real, data: [...(real.data || []), ...(fakeNotes.get(match[1]) || [])] };
    },
  },
];

// One candidate of a faked PUT /scores, judged by the same rules the server
// states (field exists, 0..max, clearing only before screening, finalize needs
// every field). It does not check who is asking.
async function fakeScoreOne({ entry, config, finalize, jobId, read }) {
  const id = entry.applicationId;
  const app = overlayApplication(await readApp(read, id));
  const prior = fakeScores.get(id);
  const scores = { ...(prior?.scores || app.screening_scores || {}) };
  const status = prior?.status || app.status;
  const correction = status === 'Screened' || status === 'Archived';
  const changed = [];

  for (const [key, raw] of Object.entries(entry.scores || {})) {
    const field = config.fields.find((f) => f.key === key);
    if (!field) return { failed: { id, reason: `"${key}" is not a screening field of this job.` } };
    if (raw === null) {
      if (correction) return { failed: { id, reason: `The score for "${field.label}" cannot be cleared once the candidate is screened.` } };
      if (scores[key] !== undefined) changed.push(key);
      delete scores[key];
    } else {
      if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 0 || raw > field.max) {
        return { failed: { id, reason: `The score for "${field.label}" must be a number from 0 to ${field.max}.` } };
      }
      if (scores[key] !== round2(raw)) changed.push(key);
      scores[key] = round2(raw);
    }
  }

  const complete = config.fields.every((f) => typeof scores[f.key] === 'number');
  const max = round2(config.fields.reduce((sum, f) => sum + f.max, 0));
  const total = complete ? round2(config.fields.reduce((sum, f) => sum + scores[f.key], 0)) : null;
  const percentage = complete && max > 0 ? round2((total / max) * 100) : null;
  const finalizing = finalize === true && !correction;
  if (finalizing && !complete) {
    return { failed: { id, reason: 'Every screening field needs a score before the candidate can be moved to Screened.' } };
  }

  const nextStatus = finalizing ? 'Screened' : status;
  fakeScores.set(id, { jobId, scores, status: nextStatus, total, max, percentage });
  return changed.length === 0 && !finalizing
    ? { ok: { id, status, unchanged: true, complete } }
    : { ok: { id, status: nextStatus, complete, screening_total: total, screening_max: max, screening_percentage: percentage, changed } };
}

const HANDLERS = [
  {
    method: 'PUT',
    path: /^\/api\/admin\/applications\/scores$/,
    run: async ({ body, read }) => {
      const config = (await read(`/api/admin/jobs/${body.jobId}`)).data.screening_config
        || fakeJobConfigs.get(body.jobId);
      if (!config) {
        throw { error: 'ScreeningNotConfigured', message: 'This job has no screening fields yet. A superadmin must set them up before candidates can be screened.' };
      }
      const result = { success: [], failed: [], items: [] };
      for (const entry of body.entries || []) {
        const one = await fakeScoreOne({ entry, config, finalize: body.finalize, jobId: body.jobId, read });
        if (one.failed) result.failed.push(one.failed);
        else { result.success.push(one.ok.id); result.items.push(one.ok); }
      }
      return ok(result, `Score save${body.finalize ? ' with finalize' : ''}`);
    },
  },
  {
    // The only part of a job save that is faked is its screening configuration:
    // the rest of a job edit is acknowledged but not applied.
    method: 'PUT',
    path: /^\/api\/admin\/jobs\/([^/]+)$/,
    run: async ({ body, match, read }) => {
      const id = match[1];
      const real = overlayJob((await read(`/api/admin/jobs/${id}`)).data);
      if (body.screeningConfig) {
        const same = JSON.stringify(body.screeningConfig) === JSON.stringify(real.screening_config);
        if (!same && real.screeningLocked) {
          throw { error: 'ScreeningLocked', message: 'This job already has scored candidates, so its screening fields, maximum scores and skip-screening setting can no longer be changed.' };
        }
        fakeJobConfigs.set(id, body.screeningConfig);
        real.screening_config = body.screeningConfig;
      }
      // Like the real PUT response, this carries no screeningLocked.
      delete real.screeningLocked;
      return ok(real, 'Job update (only its screening configuration is kept)');
    },
  },
  {
    method: 'POST',
    path: /^\/api\/admin\/applications\/([^/]+)\/notes$/,
    run: async ({ body, match, read }) => {
      const id = match[1];
  {
    method: 'PATCH',
    path: /^\/api\/admin\/users\/([^/]+)\/permissions$/,
    run: async ({ body, match, read }) => {
      const user = ((await read('/api/admin/users')).data || []).find((u) => u.id === match[1]);
      if (!user) throw { error: 'NotFound', message: 'User not found.' };
      if (user.role !== 'admin') {
        throw { error: 'BadRequest', message: 'Superadmins can always approve; the permission only applies to admins.' };
      }
      if (typeof body.canApprove !== 'boolean') {
        throw { error: 'ValidationError', message: 'canApprove must be true or false.' };
      }
      fakeCanApprove.set(user.id, body.canApprove);
      return ok({ ...user, can_approve: body.canApprove }, 'Permission change');
    },
  },
      const app = await readApp(read, id);
      return ok(addFakeNote(id, app.status, body.body || ''), 'Note add');
    },
  },
  {
    method: 'PATCH',
    path: /^\/api\/admin\/applications\/bulk-status$/,
    run: async ({ body }) => {
      // A shared invite or note is only acknowledged: nothing is emailed. The
      // shared note appears on each application's faked timeline.
      if (body.notes) (body.ids || []).forEach((id) => addFakeNote(id, body.status, body.notes));
      return ok({ success: body.ids || [], failed: [] }, `Bulk change to ${body.status}${body.invite ? ' with a shared invitation (no email sent)' : ''}${body.rejection ? ' with a shared rejection message (no email sent)' : ''}`);
    },
  },
  {
    method: 'PATCH',
    path: /^\/api\/admin\/applications\/([^/]+)\/status$/,
    run: async ({ body, match, read }) => {
      const app = await readApp(read, match[1]);
      if (body.notes) addFakeNote(match[1], body.status, body.notes);
      return ok({
        ...app,
        status: body.status,
        // allowedTransitions is left as read: the real list depends on the
        // server's workflow, which a fake can't compute.
        ...(body.invite ? { invite_details: body.invite } : {}),
        // As the real server does: a rejection records where it began, and
        // reversing it clears that.
        ...(body.status === 'Rejected' ? { rejected_from: app.status } : {}),
        ...(app.status === 'Rejected' && body.status === 'Shortlisted' ? { rejected_from: null } : {}),
        status_history: [
          ...(app.status_history || []),
          { status: body.status, changedBy: body.changedBy, timestamp: now() },
        ],
      }, `Status change to ${body.status}`);
    },
  },
  {
    method: 'PATCH',
    path: /^\/api\/admin\/applications\/([^/]+)\/invite$/,
    run: async ({ body, match, read }) =>
      ok({ ...(await readApp(read, match[1])), invite_details: body.invite }, 'Invitation update (no email sent)'),
  },
  {
    method: 'PATCH',
    path: /^\/api\/admin\/applications\/([^/]+)\/notes$/,
    run: async ({ body, match, read }) =>
      ok({ ...(await readApp(read, match[1])), notes: body.notes }, 'Notes save'),
  },
  {
    method: 'PATCH',
    path: /^\/api\/admin\/applications\/([^/]+)$/,
    run: async ({ body, match, read }) => {
      const app = await readApp(read, match[1]);
      return ok({ ...app, form_data: { ...app.form_data, ...(body.formData || {}) } }, 'Application edit');
    },
  },
  {
    method: 'POST',
    path: /^\/api\/admin\/applications\/([^/]+)\/resend-egi$/,
    run: async ({ match, read }) => ok(await readApp(read, match[1]), 'EGI resend'),
  },
  {
    method: 'DELETE',
    path: /^\/api\/admin\/applications\/[^/]+$/,
    run: async () => ok(null, 'Application delete'),
  },
];

/**
 * Returns a fake response for a guarded write, throws for one with no fake,
 * and returns undefined for anything that should go through as normal.
 * `read(path)` performs a real GET.
 */
export async function guardDevMutation({ method, path, body, read }) {
  if (import.meta.env.VITE_ALLOW_REAL_MUTATIONS === 'true') return undefined;
  const cleanPath = path.split('?')[0];

  if (method === 'GET') {
    const overlay = READ_OVERLAYS.find((o) => o.path.test(cleanPath));
    return overlay ? overlay.run({ match: cleanPath.match(overlay.path), path, read }) : undefined;
  }
  if (!GUARDED.test(cleanPath) || ALLOWED.some((re) => re.test(cleanPath))) return undefined;

  const handler = HANDLERS.find((h) => h.method === method && h.path.test(cleanPath));
  if (!handler) {
    console.warn(`[dev-guard] Blocked ${method} ${cleanPath}: no fake exists for it.`);
    throw {
      error: 'DevMutationBlocked',
      message: `Dev guard: ${method} ${cleanPath} was not sent (local dev uses the production database). `
        + 'Add a fake in src/dev/devMutationGuard.js, or set VITE_ALLOW_REAL_MUTATIONS=true to send it for real.',
    };
  }

  console.info(`[dev-guard] Faked ${method} ${cleanPath}`, body);
  return handler.run({ body: body || {}, match: cleanPath.match(handler.path), read });
}
