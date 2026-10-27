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

const ok = (data, what) => ({ success: true, data, message: `[dev fake] ${what} — nothing was sent to the server.` });
const now = () => new Date().toISOString();

const readApp = async (read, id) => (await read(`/api/admin/applications/${id}`)).data;

// Reads that must also show what the faked writes did. Everything else that is
// a GET goes straight through.
const READ_OVERLAYS = [
  {
    path: /^\/api\/admin\/applications\/([^/]+)\/notes$/,
    run: async ({ match, read }) => {
      const real = await read(`/api/admin/applications/${match[1]}/notes`);
      return { ...real, data: [...(real.data || []), ...(fakeNotes.get(match[1]) || [])] };
    },
  },
];

const HANDLERS = [
  {
    method: 'POST',
    path: /^\/api\/admin\/applications\/([^/]+)\/notes$/,
    run: async ({ body, match, read }) => {
      const id = match[1];
      const app = await readApp(read, id);
      const note = {
        id: `dev-fake-${Date.now()}`,
        application_id: id,
        author_id: null,
        author_name: '(dev fake)',
        stage: app.status,
        body: String(body.body || '').trim(),
        kind: 'note',
        sent_to_egi: false,
        created_at: now(),
      };
      fakeNotes.set(id, [...(fakeNotes.get(id) || []), note]);
      return ok(note, 'Note add');
    },
  },
  {
    method: 'PATCH',
    path: /^\/api\/admin\/applications\/bulk-status$/,
    run: async ({ body }) => ok({ success: body.ids || [], failed: [] }, 'Bulk status change'),
  },
  {
    method: 'PATCH',
    path: /^\/api\/admin\/applications\/([^/]+)\/status$/,
    run: async ({ body, match, read }) => {
      const app = await readApp(read, match[1]);
      return ok({
        ...app,
        status: body.status,
        status_history: [
          ...(app.status_history || []),
          { status: body.status, changedBy: body.changedBy, timestamp: now() },
        ],
      }, `Status change to ${body.status}`);
    },
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
    return overlay ? overlay.run({ match: cleanPath.match(overlay.path), read }) : undefined;
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
