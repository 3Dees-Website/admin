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

async function silentRefresh() {
  const refreshToken = localStorage.getItem(TOKEN_STORAGE_KEYS.refresh);
  if (!refreshToken) throw new Error('No refresh token available');

  const res = await fetch(`${BASE_URL}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  const json = await res.json();
  if (!res.ok || !json.success) throw json;

  localStorage.setItem(TOKEN_STORAGE_KEYS.access, json.data.accessToken);
  localStorage.setItem(TOKEN_STORAGE_KEYS.refresh, json.data.refreshToken);
}

function clearSession() {
  localStorage.removeItem(TOKEN_STORAGE_KEYS.access);
  localStorage.removeItem(TOKEN_STORAGE_KEYS.refresh);
  localStorage.removeItem(TOKEN_STORAGE_KEYS.user);
}

async function request(method, path, options = {}) {
  const { body, isFormData = false, isBlob = false } = options;

  const accessToken = localStorage.getItem(TOKEN_STORAGE_KEYS.access);
  const headers = {};
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
  if (body && !isFormData) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: isFormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
  });

  // Automatic token refresh on TokenExpired
  if (res.status === 401) {
    let errJson;
    try {
      errJson = await res.json();
    } catch {
      errJson = { error: 'Unauthorized', message: 'Unauthorized' };
    }

    if (errJson.error === 'TokenExpired') {
      if (isRefreshing) {
        // Queue this request until the in-flight refresh completes
        return new Promise((resolve, reject) => {
          refreshQueue.push({ resolve, reject });
        }).then(() => request(method, path, options))
          .catch((err) => { throw err; });
      }

      isRefreshing = true;
      try {
        await silentRefresh();
        processQueue(null);
        isRefreshing = false;
        return request(method, path, options);
      } catch (refreshErr) {
        processQueue(refreshErr);
        isRefreshing = false;
        clearSession();
        window.location.href = '/';
        throw refreshErr;
      }
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
  get: (path, params) => {
    return request('GET', `${path}${buildQueryString(params)}`);
  },
  getBlob: (path, params) => {
    return request('GET', `${path}${buildQueryString(params)}`, { isBlob: true });
  },
  post: (path, body) => request('POST', path, { body }),
  postForm: (path, formData) => request('POST', path, { body: formData, isFormData: true }),
  put: (path, body) => request('PUT', path, { body }),
  patch: (path, body) => request('PATCH', path, { body }),
  delete: (path) => request('DELETE', path),
};
