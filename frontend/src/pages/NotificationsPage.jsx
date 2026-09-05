import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { notificationApi } from '../api';
import GatedProfileModal from '../components/GatedProfileModal';

export default function NotificationsPage() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedUserId, setSelectedUserId] = useState(null);

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 60000);
    return () => clearInterval(interval);
  }, []);

  async function loadNotifications() {
    setLoading(true);
    setError('');
    try {
      const res = await notificationApi.getNotifications();
      const list = res.data?.notifications || res.data || [];
      setNotifications(Array.isArray(list) ? list : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleNotificationClick(notif) {
    if (!notif.is_read) {
      try {
        await notificationApi.markAsRead(notif.id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, is_read: true, is_seen: true } : n))
        );
      } catch {
        // Ignore read mark error
      }
    }
    if (notif.match_id) {
      navigate(`/chat/${notif.match_id}`);
    } else {
      setSelectedUserId(notif.from_user_id);
    }
  }

  async function handleMarkAllRead() {
    try {
      await notificationApi.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true, is_seen: true })));
    } catch (err) {
      setError(err.message);
    }
  }

  function getRelativeTime(timestamp) {
    if (!timestamp) return '';
    let rawStr = String(timestamp);
    if (!rawStr.endsWith('Z') && !rawStr.includes('+')) {
      rawStr = rawStr.replace(' ', 'T') + 'Z';
    }
    const timeMs = new Date(rawStr).getTime();
    if (isNaN(timeMs)) return '';

    const seconds = Math.floor((Date.now() - timeMs) / 1000);
    if (seconds < 30) return 'Just now';
    if (seconds < 60) return `${Math.max(1, seconds)}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
        <div>
          <h1>Activity</h1>
          <p>Likes and updates on your profile.</p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="btn-secondary"
            style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem' }}
          >
            Mark all read
          </button>
        )}
      </div>

      {loading && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p>Loading activity...</p>
        </div>
      )}

      {error && <p className="error">{error}</p>}

      {!loading && notifications.length === 0 && (
        <div className="glass-card" style={{ textAlign: 'center', padding: '3rem 1.5rem', margin: 'auto 0' }}>
          <div style={{ fontSize: '3rem', marginBottom: '0.8rem' }}>🔔</div>
          <h2 style={{ marginBottom: '0.4rem' }}>No Likes Yet</h2>
          <p style={{ marginBottom: '1.2rem' }}>When someone likes your campus profile, you'll get notified right here!</p>
        </div>
      )}

      {!loading && notifications.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {notifications.map((notif) => (
            <div
              key={notif.id}
              className="match-card"
              onClick={() => handleNotificationClick(notif)}
              style={{
                borderColor: !notif.is_read ? 'var(--primary-pink)' : 'var(--glass-border)',
                background: !notif.is_read ? 'rgba(255, 64, 129, 0.08)' : 'var(--bg-card)',
                position: 'relative',
                cursor: 'pointer',
              }}
            >
              <div className="avatar" style={{ overflow: 'hidden' }}>
                {notif.from_user_photo ? (
                  <img
                    src={notif.from_user_photo}
                    alt={notif.from_user_name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  notif.type === 'message' ? '💬' : '💖'
                )}
              </div>

              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ color: '#fff', fontSize: '0.98rem', fontWeight: '600' }}>
                    {notif.type === 'message'
                      ? `${notif.from_user_name} sent you a message 💬`
                      : notif.match_id
                      ? `${notif.from_user_name} (Matched!)`
                      : 'Someone liked your profile 💖'}
                  </h4>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    {getRelativeTime(notif.created_at)}
                  </span>
                </div>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  {notif.type === 'message'
                    ? 'Tap to view conversation and reply 💬'
                    : notif.match_id
                    ? 'Mutual match active! Tap to send free message 💬'
                    : 'Tap to view profile details and match back.'}
                </p>
              </div>

              {notif.match_id ? (
                <button
                  className="btn-primary"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/chat/${notif.match_id}`);
                  }}
                  style={{ fontSize: '0.78rem', padding: '0.4rem 0.8rem', borderRadius: 'var(--radius-full)', whiteSpace: 'nowrap' }}
                >
                  {notif.type === 'message' ? '💬 Reply' : '💬 Chat (2 Free)'}
                </button>
              ) : (
                !notif.is_read && (
                  <div style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: 'var(--primary-pink)',
                    boxShadow: '0 0 6px var(--accent-glow)'
                  }} />
                )
              )}
            </div>
          ))}
        </div>
      )}

      {/* Gated Profile View Modal */}
      {selectedUserId && (
        <GatedProfileModal
          targetUserId={selectedUserId}
          onClose={() => setSelectedUserId(null)}
          onMatchCreated={() => loadNotifications()}
        />
      )}
    </div>
  );
}
