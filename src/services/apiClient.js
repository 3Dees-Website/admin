const _configuredUrl = import.meta.env.VITE_API_BASE_URL;
if (!_configuredUrl && import.meta.env.PROD) {
  throw new Error('VITE_API_BASE_URL is not set. Set it in your .env file before building for production.');
}
export const BASE_URL = _configuredUrl || 'http://localhost:3000';

export const TOKEN_STORAGE_KEYS = {
  access: '3dees_access_token',
  refresh: '3dees_refresh_token',
  user: '3dees_current_user',
};

// Tracks whether a token refresh is already in flight so concurrent
// requests don't each try to refresh independently.
let isRefreshing = false;
let refreshQueue = [];

function processQueue(error) {
  refreshQueue.forEach((p) => (error ? p.reject(error) : p.resolve()));
  refreshQueue = [];
}

// ── Refresh timing/retry tuning ───────────────────────────────────────────
//
// 15+ staff share one office connection, so a busy server, a dropped
// packet, or a brief timeout are expected, routine events — not evidence
// the session is dead. Only a genuine 401/403 from the refresh endpoint (or
// having no refresh token at all) means the session is actually over.
// Everything else here exists to ride out a transient blip without ever
// clearing tokens or redirecting for one.

const REFRESH_TIMEOUT_MS = 8000; // per refresh attempt
const REQUEST_TIMEOUT_MS = 45000; // ordinary JSON calls only, unless a call passes timeoutMs — see request()
const REFRESH_BACKOFF_MS = [1000, 3000, 7000]; // delay before attempts 2, 3, 4
const MAX_REFRESH_ATTEMPTS = REFRESH_BACKOFF_MS.length + 1; // 4 total attempts
// The backend's rate-limit response (429) doesn't expose Retry-After or
// RateLimit-* cross-origin (confirmed: no Access-Control-Expose-Headers is
// set), so res.headers.get('Retry-After') normally reads null in the
// browser. The read below is kept in case that ever changes, but this fixed
// fallback is the value that actually gets used today.
const FALLBACK_429_DELAY_MS = 10000;
// After a fresh refresh, retry the original request at most once more. If
// it STILL comes back TokenExpired, something is wrong beyond simple
// expiry (clock skew, a backend bug, a token invalidated the instant it was
// issued) — refreshing again is unlikely to help and is exactly the
// unbounded-recursion risk this guards against.
const MAX_TOKEN_RETRY_DEPTH = 1;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// +/-20% jitter so multiple tabs hitting the same blip at once don't all
// retry in lockstep and collide again on the next attempt.
function jitter(ms) {
  const spread = ms * 0.2;
  return Math.round(ms + (Math.random() * spread * 2 - spread));
}

function classifyRefreshStatus(status) {
  if (status === 401 || status === 403) return { kind: 'TERMINAL', reason: 'rejected' };
  if (status === 429) return { kind: 'TRANSIENT', reason: 'rate_limited' };
  if (status >= 500 && status < 600) return { kind: 'TRANSIENT', reason: 'server_error' };
  // Unrecognised status (e.g. a 400) — treated conservatively as transient.
  // Logging someone out wrongly is worse than one extra, likely-useless retry.
  return { kind: 'TRANSIENT', reason: 'unrecognised_status' };
}

/**
 * Performs exactly one POST /api/auth/refresh attempt and returns a
 * normalized outcome instead of throwing, so refreshWithRetry() can inspect
 * it without try/catch plumbing:
 *   { ok: true }
 *   { ok: false, kind: 'TERMINAL' | 'TRANSIENT', reason, usedToken, retryAfterMs? }
 * `usedToken` is the refresh token this specific attempt sent — captured so
 * a later TERMINAL rejection can tell whether another tab rotated the
 * token underneath us in the meantime (see resolveTerminal below).
 */
async function attemptRefresh() {
  const usedToken = localStorage.getItem(TOKEN_STORAGE_KEYS.refresh);
  if (!usedToken) {
    return { ok: false, kind: 'TERMINAL', reason: 'no_token', usedToken: null };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REFRESH_TIMEOUT_MS);

  let res;
  try {
    res = await fetch(`${BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: usedToken }),
      signal: controller.signal,
    });
  } catch (networkErr) {
    clearTimeout(timeoutId);
    const timedOut = networkErr?.name === 'AbortError';
    return { ok: false, kind: 'TRANSIENT', reason: timedOut ? 'timeout' : 'network', usedToken };
  }
  clearTimeout(timeoutId);

  // Defensive Retry-After read. Harmless if the backend ever starts
  // exposing it cross-origin; reads null today, so FALLBACK_429_DELAY_MS
  // is what actually gets used.
  let retryAfterMs;
  try {
    const header = res.headers.get('Retry-After');
    const parsed = header ? Number(header) : NaN;
    if (!Number.isNaN(parsed) && parsed >= 0) retryAfterMs = parsed * 1000;
  } catch {
    // Header not readable — fall through to the fixed fallback.
  }

  let json;
  try {
    json = await res.json();
  } catch {
    // Non-JSON body (e.g. a proxy's HTML error page on a 502/504) — transient.
    return { ok: false, kind: 'TRANSIENT', reason: 'bad_body', usedToken };
  }

  if (res.ok && json.success) {
    localStorage.setItem(TOKEN_STORAGE_KEYS.access, json.data.accessToken);
    localStorage.setItem(TOKEN_STORAGE_KEYS.refresh, json.data.refreshToken);
    return { ok: true };
  }

  return { ok: false, ...classifyRefreshStatus(res.status), usedToken, retryAfterMs };
}

/**
 * Handles a TERMINAL outcome from attemptRefresh(). The backend rotates the
 * refresh token on every successful refresh, so with several tabs open, tab
 * A can refresh and write a new token to localStorage while tab B's attempt
 * is still in flight with the old one — tab B then legitimately gets back
 * 401 InvalidToken even though the session is alive.
 *
 * Guard: before accepting TERMINAL, re-read the refresh token. If it no
 * longer matches the one this attempt sent, another tab refreshed
 * underneath us — retry exactly once with whatever's there now, and only
 * accept TERMINAL if that retry also comes back rejected. Narrow on
 * purpose: one extra attempt, only when the stored token changed, only
 * here on the terminal path. No cross-tab messaging is added.
 */
async function resolveTerminal(outcome, alreadyRetriedForRotation = false) {
  if (!alreadyRetriedForRotation) {
    const currentToken = localStorage.getItem(TOKEN_STORAGE_KEYS.refresh);
    if (currentToken && currentToken !== outcome.usedToken) {
      const retryOutcome = await attemptRefresh();
      if (retryOutcome.ok) return { kind: 'SUCCESS' };
      if (retryOutcome.kind === 'TERMINAL') {
        return resolveTerminal(retryOutcome, true);
      }
      // The rotation-retry itself hit a transient failure (e.g. a network
      // blip coincided) — we can no longer be sure the session is dead, so
      // don't conclude TERMINAL from this. Surface it as exhausted-transient
      // instead of spending more of the main retry budget on it.
      return { kind: 'TRANSIENT_EXHAUSTED' };
    }
  }
  return { kind: 'TERMINAL' };
}

/**
 * Retries silentRefresh() up to MAX_REFRESH_ATTEMPTS times with backoff on
 * TRANSIENT failures (network drop, timeout, 5xx, 429, bad body, or any
 * unrecognised status). A TERMINAL failure (401/403, or no refresh token)
 * ends the loop immediately, after the rotation check above. Never throws —
 * always resolves to one of:
 *   { kind: 'SUCCESS' }
 *   { kind: 'TERMINAL' }
 *   { kind: 'TRANSIENT_EXHAUSTED' }
 */
async function refreshWithRetry() {
  for (let attempt = 0; attempt < MAX_REFRESH_ATTEMPTS; attempt++) {
    const outcome = await attemptRefresh();

    if (outcome.ok) return { kind: 'SUCCESS' };
    if (outcome.kind === 'TERMINAL') return resolveTerminal(outcome);

    const isLastAttempt = attempt === MAX_REFRESH_ATTEMPTS - 1;
    if (isLastAttempt) return { kind: 'TRANSIENT_EXHAUSTED' };

    const waitMs = outcome.reason === 'rate_limited'
      ? jitter(outcome.retryAfterMs ?? FALLBACK_429_DELAY_MS)
      : jitter(REFRESH_BACKOFF_MS[attempt]);
    await delay(waitMs);
  }
  // Unreachable (the loop always returns via one of the branches above),
  // kept only so the function has an explicit final return.
  return { kind: 'TRANSIENT_EXHAUSTED' };
}

function clearSession() {
  localStorage.removeItem(TOKEN_STORAGE_KEYS.access);
  localStorage.removeItem(TOKEN_STORAGE_KEYS.refresh);
  localStorage.removeItem(TOKEN_STORAGE_KEYS.user);
}

/**
 * Best-effort server-side revocation of the refresh token when a session
 * ends terminally. Fire-and-forget: never awaited by the caller, never
 * throws. Duplicates authService.logout's raw-fetch call rather than
 * importing authService, because authService.js imports BASE_URL from this
 * file — importing authService here would create a circular import.
 */
function revokeRefreshTokenBestEffort(refreshToken) {
  if (!refreshToken) return;
  fetch(`${BASE_URL}/api/auth/logout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  }).catch(() => {
    // Best-effort only — the local session is torn down regardless of
    // whether the server-side revoke succeeds.
  });
}

async function request(method, path, options = {}, depth = 0) {
  const { body, isFormData = false, isBlob = false, timeoutMs = REQUEST_TIMEOUT_MS } = options;

  const accessToken = localStorage.getItem(TOKEN_STORAGE_KEYS.access);
  const headers = {};
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
  if (body && !isFormData) headers['Content-Type'] = 'application/json';

  // A timeout guards ordinary JSON calls against an indefinite hang. CSV
  // exports (isBlob) and uploads (isFormData) are exempt on purpose — these
  // are exactly the large, slow transfers a short timeout would wrongly
  // kill, especially over a shared office connection. The timeout exists to
  // stop indefinite hangs, not to enforce speed, hence the generous value.
  // A caller may pass timeoutMs to change the duration for one call; it
  // never changes which calls are exempt.
  const controller = (!isBlob && !isFormData) ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: isFormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller?.signal,
    });
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }

  // Automatic token refresh on TokenExpired
  if (res.status === 401) {
    let errJson;
    try {
      errJson = await res.json();
    } catch {
      errJson = { error: 'Unauthorized', message: 'Unauthorized' };
    }

    if (errJson.error === 'TokenExpired') {
      if (depth >= MAX_TOKEN_RETRY_DEPTH) {
        console.error(
          `[apiClient] PersistentAuthFailure: ${method} ${path} still returned TokenExpired ` +
          `at retry depth ${depth} after a successful token refresh.`
        );
        throw {
          error: 'PersistentAuthFailure',
          message: 'Something went wrong renewing your session. Please refresh the page, or sign in again if the problem continues.',
        };
      }

      if (isRefreshing) {
        // Queue this request until the in-flight refresh completes
        return new Promise((resolve, reject) => {
          refreshQueue.push({ resolve, reject });
        }).then(() => request(method, path, options, depth + 1))
          .catch((err) => { throw err; });
      }

      isRefreshing = true;
      const outcome = await refreshWithRetry();
      isRefreshing = false;

      if (outcome.kind === 'SUCCESS') {
        processQueue(null);
        return request(method, path, options, depth + 1);
      }

      if (outcome.kind === 'TERMINAL') {
        const terminalError = {
          error: 'SessionExpired',
          message: 'Your session has ended. Please sign in again.',
        };
        processQueue(terminalError);
        revokeRefreshTokenBestEffort(localStorage.getItem(TOKEN_STORAGE_KEYS.refresh));
        clearSession();
        window.location.href = '/';
        throw terminalError;
      }

      // TRANSIENT_EXHAUSTED — do NOT clear tokens, do NOT redirect. The
      // session may well still be fine; we just couldn't confirm it right
      // now. Leave tokens intact so the next action can try again.
      const transientError = {
        error: 'SessionRefreshUnavailable',
        message: 'Connection problem. Your work is safe — please try that again in a moment.',
      };
      processQueue(transientError);
      throw transientError;
    }

    throw errJson;
  }

  // CSV / binary download
  if (isBlob) {
    if (res.ok) return res.blob();
    let errJson;
    try {
      errJson = await res.json();
    } catch {
      errJson = { message: 'Download failed' };
    }
    throw errJson;
  }

  let json;
  try {
    json = await res.json();
  } catch {
    throw { message: `Unexpected response from server (HTTP ${res.status})` };
  }

  if (!res.ok || !json.success) throw json;
  return json;
}

function buildQueryString(params) {
  if (!params) return '';
  const entries = Object.entries(params).filter(
    ([, value]) => value !== undefined && value !== null && value !== ''
  );
  return entries.length ? `?${new URLSearchParams(entries)}` : '';
}

export const apiClient = {
  get: (path, params, { timeoutMs } = {}) => {
    return request('GET', `${path}${buildQueryString(params)}`, { timeoutMs });
  },
  getBlob: (path, params) => {
    return request('GET', `${path}${buildQueryString(params)}`, { isBlob: true });
  },
  post: (path, body, { timeoutMs } = {}) => request('POST', path, { body, timeoutMs }),
  postForm: (path, formData) => request('POST', path, { body: formData, isFormData: true }),
  put: (path, body, { timeoutMs } = {}) => request('PUT', path, { body, timeoutMs }),
  patch: (path, body, { timeoutMs } = {}) => request('PATCH', path, { body, timeoutMs }),
  delete: (path, { timeoutMs } = {}) => request('DELETE', path, { timeoutMs }),
};
