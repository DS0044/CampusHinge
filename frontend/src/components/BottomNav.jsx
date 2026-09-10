import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { notificationApi } from '../api';
import { onSocketEvent } from '../socketManager';

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);

  const currentPath = location.pathname;
  const isPublicPage = ['/signup', '/login', '/verify-otp', '/', '/terms', '/privacy'].includes(currentPath);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (isPublicPage || !token) return;
    
    // Initial fetch via HTTP (once)
    fetchUnread();

    // Listen for real-time unread count updates via socket
    // This replaces HTTP polling — no more waking up the free-tier server every 60s
    const unsubUnread = onSocketEvent('unread_count', ({ unread_count }) => {
      setUnreadCount(unread_count || 0);
    });

    // Also listen for notifications to increment count
    const unsubNotification = onSocketEvent('notification', () => {
      setUnreadCount((prev) => prev + 1);
    });

    // Fallback: poll every 5 minutes (only as a safety net, not primary)
    const interval = setInterval(fetchUnread, 5 * 60 * 1000);

    return () => {
      unsubUnread();
      unsubNotification();
      clearInterval(interval);
    };
  }, [currentPath, isPublicPage]);

  async function fetchUnread() {
    try {
      const res = await notificationApi.getUnreadCount();
      setUnreadCount(res.data?.unread_count || 0);
    } catch {
      // Ignore polling errors
    }
  }

  // Don't show navigation on auth/login/signup/legal pages or inside individual chat
  if (isPublicPage || currentPath.startsWith('/chat')) {
    return null;
  }

  return (
    <nav className="bottom-nav">
      <button
        className={`nav-item ${currentPath === '/discover' ? 'active' : ''}`}
        onClick={() => navigate('/discover')}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-4.386l.001-.001zm0 0A7.498 7.498 0 0118 10.5a7.498 7.498 0 01-2.638 5.714" />
        </svg>
        <span>Discover</span>
      </button>

      <button
        className={`nav-item ${currentPath === '/matches' || currentPath.startsWith('/chat') ? 'active' : ''}`}
        onClick={() => navigate('/matches')}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
        </svg>
        <span>Matches</span>
      </button>

      <button
        className={`nav-item ${currentPath === '/notifications' ? 'active' : ''}`}
        onClick={() => navigate('/notifications')}
        style={{ position: 'relative' }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
        </svg>
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: '2px',
            right: '12px',
            background: 'var(--primary-pink)',
            color: '#fff',
            fontSize: '0.62rem',
            fontWeight: '700',
            borderRadius: '9999px',
            minWidth: '16px',
            height: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 4px',
            boxShadow: '0 0 8px var(--accent-glow)'
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
        <span>Activity</span>
      </button>

      <button
        className={`nav-item ${currentPath === '/profile-setup' ? 'active' : ''}`}
        onClick={() => navigate('/profile-setup')}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
        </svg>
        <span>Profile</span>
      </button>
    </nav>
  );
}
