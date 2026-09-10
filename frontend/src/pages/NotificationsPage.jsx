import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { notificationApi, swipeApi, getPhotoUrl } from '../api';
import GatedProfileModal from '../components/GatedProfileModal';

export default function NotificationsPage() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [likingId, setLikingId] = useState(null);

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

  async function handleLikeBack(e, notif) {
    e.stopPropagation();
    setLikingId(notif.from_user_id);
    setError('');
    try {
      const res = await swipeApi.swipe(notif.from_user_id, 'like');
      if (res.data?.matched) {
        // Immediately reveal photo and name for this entry in local state
        setNotifications((prev) =>
          prev.map((n) =>
            n.from_user_id === notif.from_user_id
              ? {
                  ...n,
                  match_id: res.data.match_id,
                  is_matched: true,
                  from_user_name: n.real_name || n.from_user_name || 'Matched User',
                  is_read: true,
                }
              : n
          )
        );
      }
      await loadNotifications();
    } catch (err) {
      setError(err.message || 'Failed to match back.');
    } finally {
      setLikingId(null);
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
          {[...notifications].sort((a, b) => {
            const aSuper = a.type === 'super_like';
            const bSuper = b.type === 'super_like';
            if (aSuper && !bSuper) return -1;
            if (!aSuper && bSuper) return 1;
            return new Date(b.created_at || 0) - new Date(a.created_at || 0);
          }).map((notif) => {
            const isMatched = Boolean(notif.match_id || notif.is_matched);
            const isSuperLike = notif.type === 'super_like';
            const isRevealed = isMatched || notif.type === 'message';
            const photoUrl = getPhotoUrl(notif.from_user_photo);
            const senderName = notif.from_user_name || notif.real_name || 'Campus Student';
            const displayName = isRevealed || isSuperLike ? senderName : 'Someone';

            const sharedList = Array.isArray(notif.shared_interests) && notif.shared_interests.length > 0
              ? notif.shared_interests
              : (notif.metadata?.shared_interests || []);
            const sharedCount = notif.shared_interests_count || notif.metadata?.shared_count || sharedList.length;
            const sharedText = sharedList.join(', ');

            return (
              <div
                key={notif.id}
                className="match-card"
                onClick={() => handleNotificationClick(notif)}
                style={{
                  borderColor: isSuperLike
                    ? 'rgba(255, 215, 0, 0.6)'
                    : !notif.is_read
                    ? 'var(--primary-pink)'
                    : 'var(--glass-border)',
                  background: isSuperLike
                    ? 'linear-gradient(135deg, rgba(255, 215, 0, 0.12) 0%, rgba(255, 140, 0, 0.08) 100%)'
                    : !notif.is_read
                    ? 'rgba(255, 64, 129, 0.08)'
                    : 'var(--bg-card)',
                  boxShadow: isSuperLike
                    ? '0 4px 18px rgba(255, 215, 0, 0.18)'
                    : 'none',
                  position: 'relative',
                  cursor: 'pointer',
                  transition: 'all 0.25s ease',
                }}
              >
                {/* Pinned / Star Badge for Super Likes */}
                {isSuperLike && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '-8px',
                      right: '12px',
                      background: 'linear-gradient(135deg, #ffd700 0%, #ff8c00 100%)',
                      color: '#000',
                      fontSize: '0.68rem',
                      fontWeight: '800',
                      padding: '0.15rem 0.55rem',
                      borderRadius: 'var(--radius-full)',
                      letterSpacing: '0.03em',
                      boxShadow: '0 2px 8px rgba(255, 215, 0, 0.4)',
                      zIndex: 5,
                    }}
                  >
                    ⭐ SUPER LIKE
                  </div>
                )}

                {/* Avatar with blur if not matched back */}
                <div
                  className="avatar"
                  style={{
                    overflow: 'hidden',
                    position: 'relative',
                    borderRadius: '50%',
                    width: '50px',
                    height: '50px',
                    flexShrink: 0,
                    border: isSuperLike ? '2px solid #ffd700' : 'none',
                    background: isSuperLike ? 'linear-gradient(135deg, #ffd700, #ff8c00)' : 'var(--primary-gradient)',
                  }}
                >
                  {photoUrl ? (
                    <img
                      src={photoUrl}
                      alt={displayName}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        filter: isRevealed ? 'none' : 'blur(14px) brightness(0.82)',
                        transform: isRevealed ? 'scale(1)' : 'scale(1.25)',
                        transition: 'filter 0.5s cubic-bezier(0.16, 1, 0.3, 1), transform 0.5s ease',
                      }}
                    />
                  ) : (
                    isSuperLike ? '⭐' : notif.type === 'message' ? '💬' : '💖'
                  )}

                  {/* Lock overlay when photo is blurred */}
                  {!isRevealed && photoUrl && (
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'rgba(0, 0, 0, 0.3)',
                        fontSize: '1.05rem',
                        pointerEvents: 'none',
                      }}
                    >
                      {isSuperLike ? '⭐' : '🔒'}
                    </div>
                  )}
                </div>

                {/* Info and Super Like description */}
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h4 style={{ color: isSuperLike ? '#ffd700' : '#fff', fontSize: '0.96rem', fontWeight: '600' }}>
                      {isSuperLike ? (
                        `⭐ ${displayName} sent you a Super Like`
                      ) : notif.type === 'message' ? (
                        `${displayName} sent you a message 💬`
                      ) : isRevealed ? (
                        `${displayName} (Matched!) 💖`
                      ) : (
                        'Someone liked your profile 💖'
                      )}
                    </h4>
                    <span style={{ fontSize: '0.72rem', color: isSuperLike ? 'rgba(255, 215, 0, 0.8)' : 'var(--text-muted)' }}>
                      {getRelativeTime(notif.created_at)}
                    </span>
                  </div>

                  {isSuperLike ? (
                    <div style={{ marginTop: '0.2rem' }}>
                      <p style={{ fontSize: '0.82rem', color: '#fcd34d', margin: 0, fontWeight: '500' }}>
                        • {sharedCount} shared interests: <strong style={{ color: '#fff' }}>{sharedText || 'Multiple shared interests'}</strong>
                      </p>
                      {!isRevealed && (
                        <p style={{ fontSize: '0.74rem', color: 'rgba(255, 255, 255, 0.65)', marginTop: '0.15rem', margin: 0 }}>
                          Like back to start chatting 💬
                        </p>
                      )}
                    </div>
                  ) : (
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                      {notif.type === 'message'
                        ? 'Tap to view conversation and reply 💬'
                        : isRevealed
                        ? 'Mutual match active! Tap to chat 💬'
                        : 'Like them back to reveal their full photo & name.'}
                    </p>
                  )}
                </div>

                {/* Right side action: Chat button if matched, Like Back button if not matched */}
                {isRevealed && notif.match_id ? (
                  <button
                    className="btn-primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/chat/${notif.match_id}`);
                    }}
                    style={{
                      fontSize: '0.78rem',
                      padding: '0.4rem 0.8rem',
                      borderRadius: 'var(--radius-full)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {notif.type === 'message' ? '💬 Reply' : '💬 Chat'}
                  </button>
                ) : !isRevealed ? (
                  <button
                    className="btn-primary"
                    disabled={likingId === notif.from_user_id}
                    onClick={(e) => handleLikeBack(e, notif)}
                    style={{
                      fontSize: '0.78rem',
                      padding: '0.42rem 0.85rem',
                      borderRadius: 'var(--radius-full)',
                      whiteSpace: 'nowrap',
                      background: isSuperLike
                        ? 'linear-gradient(135deg, #ffd700 0%, #ff8c00 100%)'
                        : 'var(--primary-gradient)',
                      color: isSuperLike ? '#000' : '#fff',
                      boxShadow: isSuperLike
                        ? '0 2px 12px rgba(255, 215, 0, 0.4)'
                        : '0 2px 10px var(--accent-glow)',
                      fontWeight: '700',
                    }}
                  >
                    {likingId === notif.from_user_id ? 'Matching...' : 'Like Back 💖'}
                  </button>
                ) : (
                  !notif.is_read && (
                    <div
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: isSuperLike ? '#ffd700' : 'var(--primary-pink)',
                        boxShadow: isSuperLike ? '0 0 8px rgba(255, 215, 0, 0.8)' : '0 0 6px var(--accent-glow)',
                      }}
                    />
                  )
                )}
              </div>
            );
          })}
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
