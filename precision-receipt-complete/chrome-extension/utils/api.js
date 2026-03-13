/**
 * Shared API fetch wrapper with JWT auth from chrome.storage.session
 */

const DEFAULT_API_BASE = 'http://localhost:8001';

async function getConfig() {
  const result = await chrome.storage.local.get(['apiBaseUrl', 'digitalSlipsUrl']);
  let apiBase = result.apiBaseUrl;

  // Auto-detect: if apiBaseUrl is empty, derive from digitalSlipsUrl
  // In production, nginx on the same origin proxies /api/* to backend
  if (!apiBase) {
    const siteUrl = result.digitalSlipsUrl || '';
    if (siteUrl && !siteUrl.includes('localhost')) {
      apiBase = siteUrl.replace(/\/$/, '');
    } else {
      apiBase = DEFAULT_API_BASE;
    }
  }

  return { apiBaseUrl: apiBase };
}

async function getAuthToken() {
  const result = await chrome.storage.session.get(['accessToken', 'refreshToken']);
  return {
    accessToken: result.accessToken || null,
    refreshToken: result.refreshToken || null,
  };
}

async function setAuthToken(accessToken, refreshToken) {
  await chrome.storage.session.set({ accessToken, refreshToken });
}

async function clearAuthToken() {
  await chrome.storage.session.remove(['accessToken', 'refreshToken', 'userInfo']);
}

async function refreshAccessToken() {
  const { refreshToken } = await getAuthToken();
  if (!refreshToken) return null;

  const { apiBaseUrl } = await getConfig();
  try {
    const resp = await fetch(`${apiBaseUrl}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!resp.ok) {
      await clearAuthToken();
      return null;
    }
    const data = await resp.json();
    await setAuthToken(data.access_token, data.refresh_token || refreshToken);
    return data.access_token;
  } catch {
    return null;
  }
}

/**
 * Authenticated API request with auto-refresh on 401
 */
async function apiFetch(path, options = {}) {
  const { apiBaseUrl } = await getConfig();
  let { accessToken } = await getAuthToken();

  const url = path.startsWith('http') ? path : `${apiBaseUrl}${path}`;

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  let resp = await fetch(url, { ...options, headers });

  // Auto-refresh on 401
  if (resp.status === 401 && accessToken) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      headers['Authorization'] = `Bearer ${newToken}`;
      resp = await fetch(url, { ...options, headers });
    }
  }

  if (!resp.ok) {
    const errorBody = await resp.json().catch(() => ({}));
    throw new ApiError(resp.status, errorBody.detail || resp.statusText, errorBody);
  }

  return resp.json();
}

class ApiError extends Error {
  constructor(status, message, body) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

// --- Specific API methods ---

async function login(username, password) {
  const { apiBaseUrl } = await getConfig();
  const formData = new URLSearchParams();
  formData.append('username', username);
  formData.append('password', password);

  const resp = await fetch(`${apiBaseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData,
  });

  if (!resp.ok) {
    const errorBody = await resp.json().catch(() => ({}));
    throw new ApiError(resp.status, errorBody.detail || 'Login failed', errorBody);
  }

  const data = await resp.json();
  await setAuthToken(data.access_token, data.refresh_token);
  if (data.user) {
    await chrome.storage.session.set({ userInfo: data.user });
  }
  return data;
}

async function retrieveSlip(drid) {
  return apiFetch(`/api/v1/deposit-slips/retrieve/${drid}`);
}

async function verifySlip(drid, verificationData) {
  return apiFetch(`/api/v1/deposit-slips/${drid}/verify`, {
    method: 'POST',
    body: JSON.stringify(verificationData),
  });
}

async function completeSlip(drid, completionData) {
  return apiFetch(`/api/v1/deposit-slips/${drid}/complete`, {
    method: 'POST',
    body: JSON.stringify(completionData),
  });
}

async function checkSlipStatus(drid) {
  return apiFetch(`/api/v1/deposit-slips/status/${drid}`);
}

export {
  apiFetch,
  login,
  retrieveSlip,
  verifySlip,
  completeSlip,
  checkSlipStatus,
  getAuthToken,
  setAuthToken,
  clearAuthToken,
  getConfig,
  ApiError,
};
