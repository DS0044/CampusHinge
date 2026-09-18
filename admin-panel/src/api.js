const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export function getAdminToken() {
  return localStorage.getItem('campushinge_admin_token');
}

export function setAdminToken(token, user = null) {
  localStorage.setItem('campushinge_admin_token', token);
  if (user) {
    localStorage.setItem('campushinge_admin_user', JSON.stringify(user));
  }
}

export function clearAdminToken() {
  localStorage.removeItem('campushinge_admin_token');
  localStorage.removeItem('campushinge_admin_user');
}

export function getAdminUser() {
  try {
    const raw = localStorage.getItem('campushinge_admin_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function request(method, path, body = null) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getAdminToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const opts = { method, headers };
  if (body) {
    opts.body = JSON.stringify(body);
  }

  const res = await fetch(`${API_BASE}${path}`, opts);
  const data = await res.json();

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      clearAdminToken();
      if (window.location.pathname !== '/login') {
        window.location.replace('/login');
      }
    }
    const err = new Error(data?.error?.message || `Request failed with status ${res.status}`);
    err.status = res.status;
    throw err;
  }

  return data;
}

export const adminApi = {
  // Auth
  requestOtp: (email) => request('POST', '/auth/login', { email }),
  verifyOtp: (email, code) => request('POST', '/auth/verify-otp', { email, code }),

  // Stats & KPIs
  getStats: () => request('GET', '/admin/stats'),

  // Users Management
  getUsers: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request('GET', `/admin/users${query ? `?${query}` : ''}`);
  },
  banUser: (userId) => request('POST', `/admin/ban/${userId}`),
  unbanUser: (userId) => request('POST', `/admin/unban/${userId}`),

  // Reports Moderation
  getReports: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request('GET', `/admin/reports${query ? `?${query}` : ''}`);
  },
  reviewReport: (reportId, status) =>
    request('POST', `/admin/reports/${reportId}/review`, { status }),

  // Health
  checkHealth: async () => {
    try {
      const res = await fetch(`${API_BASE.replace(/\/api\/?$/, '')}/health`);
      return res.ok;
    } catch {
      return false;
    }
  },
};
