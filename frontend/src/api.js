const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
export const API_ORIGIN = API_BASE.replace(/\/api\/?$/, '');

export function getPhotoUrl(photo) {
  if (!photo || typeof photo !== 'string') return '';
  const trimmed = photo.trim();
  if (trimmed.startsWith('blob:') || trimmed.startsWith('data:')) return trimmed;
  if (trimmed.startsWith('http://localhost:3000/uploads/')) {
    return `${API_ORIGIN}/cdn/${trimmed.replace('http://localhost:3000/uploads/', 'uploads/')}`;
  }
  if (trimmed.startsWith('http://localhost:3000/cdn/')) {
    return `${API_ORIGIN}${trimmed.replace('http://localhost:3000', '')}`;
  }
  if (trimmed.startsWith('https://') || trimmed.startsWith('http://')) {
    return trimmed;
  }
  if (trimmed.startsWith('/cdn/')) {
    return `${API_ORIGIN}${trimmed}`;
  }
  if (trimmed.startsWith('/uploads/')) {
    return `${API_ORIGIN}/cdn${trimmed}`;
  }
  if (trimmed.startsWith('uploads/')) {
    return `${API_ORIGIN}/cdn/${trimmed}`;
  }
  return `${API_ORIGIN}/cdn/uploads/${trimmed}`;
}

function getToken() {
  return localStorage.getItem('token');
}

export function setToken(token) {
  localStorage.setItem('token', token);
}

export function clearToken() {
  localStorage.removeItem('token');
}

export function logout() {
  clearToken();
  // Clean up the singleton socket connection
  try {
    import('./socketManager').then(({ destroySocket }) => destroySocket()).catch(() => {});
  } catch (e) {
    // socketManager may not be loaded in all contexts
  }
  try {
    localStorage.clear();
    sessionStorage.clear();
  } catch (e) {
    console.error('Error clearing storage:', e);
  }
  // Replace current history entry so user cannot navigate back with browser back button
  window.location.replace('/login');
}

async function request(method, path, body = null) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${API_BASE}${path}`, opts);
  const data = await res.json();

  if (!res.ok) {
    if (res.status === 401) {
      clearToken();
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch (e) {}
      const publicPaths = ['/login', '/signup', '/verify-otp', '/terms', '/privacy'];
      if (!publicPaths.includes(window.location.pathname)) {
        window.location.replace('/login');
      }
    }
    const err = new Error(data?.error?.message || `Request failed (${res.status})`);
    err.status = res.status;
    if (data?.error?.retryAfter != null) {
      err.retryAfter = data.error.retryAfter;
    }
    throw err;
  }
  return data;
}

// ── Auth ──
export const authApi = {
  login: (email) => request('POST', '/auth/login', { email }),
  signup: (email, accepted_terms) => request('POST', '/auth/signup', { email, accepted_terms }),
  verifyOtp: (email, code) => request('POST', '/auth/verify-otp', { email, code }),
  resendOtp: (email) => request('POST', '/auth/resend-otp', { email }),
  googleSignIn: (credential) => request('POST', '/auth/google', { credential }),
};

// ── Profile ──
export const profileApi = {
  getMyProfile: () => request('GET', '/profile'),
  createOrUpdate: (data) => request('POST', '/profile', data),
  getUploadUrl: (filename, content_type) =>
    request('POST', '/profile/upload-url', { filename, content_type }),
  uploadPhoto: async (file) => {
    const formData = new FormData();
    formData.append('photo', file);
    const token = getToken();
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE}/profile/upload`, {
      method: 'POST',
      headers,
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error?.message || 'Photo upload failed');
    }
    return data;
  },
  uploadPhotos: async (files) => {
    const formData = new FormData();
    const fileList = Array.isArray(files) ? files : [files];
    fileList.forEach((file) => formData.append('photos', file));

    const token = getToken();
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE}/profile/upload`, {
      method: 'POST',
      headers,
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error?.message || 'Photo upload failed');
    }
    return data;
  },
};

// ── Discover ──
export const discoverApi = {
  getDeck: () => request('GET', '/discover'),
};

// ── Swipe ──
export const swipeApi = {
  swipe: (swiped_id, action) => request('POST', '/swipe', { swiped_id, action }),
};

// ── Matches ──
export const matchApi = {
  getMatches: () => request('GET', '/matches'),
};

// ── Messages ──
export const messageApi = {
  getMessages: (matchId) => request('GET', `/messages/${matchId}`),
  sendMessage: (matchId, content) => request('POST', `/messages/${matchId}`, { content }),
};

// ── Subscription ──
export const subscriptionApi = {
  subscribe: () => request('POST', '/subscribe'),
};

// ── Notifications ──
export const notificationApi = {
  getNotifications: () => request('GET', '/notifications'),
  getUnreadCount: () => request('GET', '/notifications/unread-count'),
  getGatedProfile: (targetUserId) => request('GET', `/notifications/gated-profile/${targetUserId}`),
  markAsRead: (id) => request('PATCH', `/notifications/${id}/read`),
  markAllAsRead: () => request('PATCH', '/notifications/read-all'),
};

// ── Dev / Testing ──
export const devApi = {
  resetSwipes: () => request('POST', '/dev/reset-swipes'),
  resetAllSwipes: () => request('POST', '/dev/reset-all-swipes'),
};

