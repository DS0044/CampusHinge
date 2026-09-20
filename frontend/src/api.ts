import {
  ApiResponse,
  AuthResponse,
  DiscoverDeckResponse,
  GoogleAuthResponse,
  Match,
  Message,
  NotificationItem,
  Profile,
  SwipeAction,
  SwipeResponse,
} from './types';

const API_BASE: string = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
export const API_ORIGIN: string = API_BASE.replace(/\/api\/?$/, '');

export interface ApiError extends Error {
  status?: number;
  retryAfter?: number;
}

export function getPhotoUrl(photo?: string | null): string {
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

export function getToken(): string | null {
  return localStorage.getItem('token');
}

export function setToken(token: string): void {
  localStorage.setItem('token', token);
}

export function clearToken(): void {
  localStorage.removeItem('token');
}

export function logout(): void {
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

async function request<T = any>(method: string, path: string, body: unknown = null): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const opts: RequestInit = { method, headers };
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
    const err: ApiError = new Error(data?.error?.message || `Request failed (${res.status})`);
    err.status = res.status;
    if (data?.error?.retryAfter != null) {
      err.retryAfter = data.error.retryAfter;
    }
    throw err;
  }
  return data as T;
}

// ── Auth ──
export const authApi = {
  login: (email: string) => request<AuthResponse>('POST', '/auth/login', { email }),
  signup: (email: string, accepted_terms: boolean) =>
    request<AuthResponse>('POST', '/auth/signup', { email, accepted_terms }),
  verifyOtp: (email: string, code: string) =>
    request<AuthResponse>('POST', '/auth/verify-otp', { email, code }),
  resendOtp: (email: string) =>
    request<ApiResponse<{ cooldownSeconds: number }>>('POST', '/auth/resend-otp', { email }),
  googleSignIn: (credential: string) =>
    request<GoogleAuthResponse>('POST', '/auth/google', { credential }),
};

// ── Profile ──
export const profileApi = {
  getMyProfile: () => request<ApiResponse<{ profile?: Profile } & Profile>>('GET', '/profile'),
  getProfileById: (userId: string) => request<ApiResponse<Profile>>('GET', `/profile/${userId}`),
  createOrUpdate: (data: Partial<Profile> & Record<string, unknown>) =>
    request<ApiResponse<Profile>>('POST', '/profile', data),
  getUploadUrl: (filename: string, content_type: string) =>
    request<ApiResponse<{ uploadUrl: string; key: string }>>('POST', '/profile/upload-url', {
      filename,
      content_type,
    }),
  uploadPhoto: async (file: File): Promise<ApiResponse<{ url: string }>> => {
    const formData = new FormData();
    formData.append('photo', file);
    const token = getToken();
    const headers: Record<string, string> = {};
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
  uploadPhotos: async (files: File | File[]): Promise<ApiResponse<{ urls: string[] }>> => {
    const formData = new FormData();
    const fileList = Array.isArray(files) ? files : [files];
    fileList.forEach((file) => formData.append('photos', file));

    const token = getToken();
    const headers: Record<string, string> = {};
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
  getDeck: () => request<ApiResponse<DiscoverDeckResponse>>('GET', '/discover'),
};

// ── Swipe ──
export const swipeApi = {
  swipe: (swiped_id: string, action: SwipeAction) =>
    request<ApiResponse<SwipeResponse>>('POST', '/swipe', { swiped_id, action }),
};

// ── Matches ──
export const matchApi = {
  getMatches: () => request<ApiResponse<Match[]>>('GET', '/matches'),
};

// ── Messages ──
export const messageApi = {
  getMessages: (matchId: string) =>
    request<ApiResponse<{ messages: Message[]; partner?: Profile; match?: Match }>>(
      'GET',
      `/messages/${matchId}`
    ),
  sendMessage: (matchId: string, content: string) =>
    request<ApiResponse<{ message: Message }>>('POST', `/messages/${matchId}`, { content }),
};

// ── Subscription ──
export const subscriptionApi = {
  subscribe: () => request<ApiResponse<unknown>>('POST', '/subscribe'),
};

// ── Notifications ──
export const notificationApi = {
  getNotifications: () => request<ApiResponse<NotificationItem[]>>('GET', '/notifications'),
  getUnreadCount: () =>
    request<ApiResponse<{ unread_count: number }>>('GET', '/notifications/unread-count'),
  getGatedProfile: (targetUserId: string) =>
    request<ApiResponse<Profile>>('GET', `/notifications/gated-profile/${targetUserId}`),
  markAsRead: (id: string) => request<ApiResponse<unknown>>('PATCH', `/notifications/${id}/read`),
  markAllAsRead: () => request<ApiResponse<unknown>>('PATCH', '/notifications/read-all'),
};

// ── Dev / Testing ──
export const devApi = {
  resetSwipes: () => request<ApiResponse<unknown>>('POST', '/dev/reset-swipes'),
  resetAllSwipes: () => request<ApiResponse<unknown>>('POST', '/dev/reset-all-swipes'),
};
