import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { notificationApi, swipeApi, subscriptionApi, getPhotoUrl } from '../api';

export default function GatedProfileModal({ targetUserId, onClose, onMatchCreated }) {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [swiping, setSwiping] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [matchInfo, setMatchInfo] = useState(null);

  useEffect(() => {
    loadGatedProfile();
  }, [targetUserId]);

  async function loadGatedProfile() {
    setLoading(true);
    setError('');
    try {
      const res = await notificationApi.getGatedProfile(targetUserId);
      setProfile(res.data?.profile || null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleLikeBack() {
    setSwiping(true);
    setError('');
    try {
      const res = await swipeApi.swipe(targetUserId, 'like');
      if (res.data?.matched) {
        setMatchInfo({ matchId: res.data.match_id });
        if (onMatchCreated) onMatchCreated();
      }
      // Reload profile — now that mutual match exists, backend returns full unlocked profile!
      await loadGatedProfile();
    } catch (err) {
      setError(err.message);
    } finally {
      setSwiping(false);
    }
  }

  async function handleSubscribe() {
    setUnlocking(true);
    setError('');
    try {
      await subscriptionApi.subscribe();
      await loadGatedProfile();
    } catch (err) {
      setError(err.message);
    } finally {
      setUnlocking(false);
    }
  }

  if (!targetUserId) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(5, 6, 12, 0.88)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        animation: 'fadeIn 0.25s ease-out',
      }}
      onClick={onClose}
    >
      <div
        className="glass-card modal-pop-card"
        style={{
          width: '100%',
          maxWidth: '420px',
          maxHeight: '90vh',
          overflowY: 'auto',
          position: 'relative',
          padding: '1.5rem',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--glass-border-light)',
          background: '#0d0f18',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.7), 0 0 30px rgba(255, 64, 129, 0.15)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            position: 'absolute',
            top: '14px',
            right: '14px',
            background: 'rgba(255,255,255,0.08)',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: '50%',
            width: '32px',
            height: '32px',
            padding: 0,
            fontSize: '1.2rem',
            cursor: 'pointer',
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s ease',
          }}
        >
          ×
        </button>

        {loading && (
          <div style={{ padding: '3rem 1rem', textAlign: 'center' }}>
            <p>Loading profile...</p>
          </div>
        )}

        {error && <p className="error" style={{ marginBottom: '1rem', textAlign: 'center' }}>{error}</p>}

        {matchInfo && (
          <div className="success" style={{ marginBottom: '1rem', textAlign: 'center', fontWeight: '600' }}>
            🎉 It's a Match! You can now chat freely.
          </div>
        )}

        {!loading && profile && (
          <div>
            {/* Header / Avatar */}
            <div style={{ textAlign: 'center', marginBottom: '1.2rem' }}>
              <div
                style={{
                  width: '105px',
                  height: '105px',
                  borderRadius: '50%',
                  overflow: 'hidden',
                  margin: '0 auto 0.75rem auto',
                  border: '3px solid var(--primary-pink)',
                  boxShadow: '0 8px 24px var(--accent-glow), 0 0 15px rgba(255, 64, 129, 0.4)',
                  background: 'var(--primary-gradient)',
                  position: 'relative',
                }}
              >
                {profile.primary_photo || profile.photos?.[0] ? (
                  <img
                    src={getPhotoUrl(profile.primary_photo || profile.photos[0])}
                    alt={profile.has_matched ? profile.name : 'Someone'}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      filter: profile.has_matched ? 'none' : 'blur(16px) brightness(0.85)',
                      transform: profile.has_matched ? 'scale(1)' : 'scale(1.25)',
                      transition: 'filter 0.5s ease, transform 0.5s ease',
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '2.5rem',
                    }}
                  >
                    👤
                  </div>
                )}
                {!profile.has_matched && (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'rgba(0, 0, 0, 0.3)',
                      fontSize: '1.5rem',
                      pointerEvents: 'none',
                    }}
                  >
                    🔒
                  </div>
                )}
              </div>

              <h2 style={{ fontSize: '1.45rem', margin: '0 0 0.25rem 0', color: '#fff' }}>
                {profile.has_matched ? profile.name : 'Someone'}
              </h2>
              <span
                style={{
                  fontSize: '0.8rem',
                  color: profile.has_matched ? '#00e676' : '#ff4081',
                  fontWeight: '600',
                  letterSpacing: '0.02em',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                }}
              >
                {profile.has_matched ? '💖 Mutual Match' : '🔒 Liked Your Profile'}
              </span>
            </div>

            {/* Gated / Locked Section */}
            {profile.is_locked ? (
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 64, 129, 0.3)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1.25rem 1rem',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.75rem',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                }}
              >
                {/* Animated Pulsing Lock Badge */}
                <div
                  className="lock-badge-pulse"
                  style={{
                    width: '54px',
                    height: '54px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #ff4081 0%, #7c4dff 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.6rem',
                  }}
                >
                  🔐
                </div>

                <div>
                  <h3 style={{ fontSize: '1.1rem', margin: '0 0 0.35rem 0', color: '#fff' }}>
                    Identity & Profile Blurred
                  </h3>
                  <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', lineHeight: '1.45' }}>
                    Like back to reveal their full photo, identity, and start chatting!
                  </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', width: '100%', marginTop: '0.4rem' }}>
                  <button
                    className="btn-primary"
                    onClick={handleLikeBack}
                    disabled={swiping}
                    style={{
                      width: '100%',
                      padding: '0.8rem 1rem',
                      fontSize: '0.92rem',
                      fontWeight: '600',
                      boxShadow: '0 4px 15px rgba(255, 64, 129, 0.35)',
                      transition: 'transform 0.15s ease',
                    }}
                  >
                    {swiping ? 'Liking back...' : '💖 Like Back to Unlock'}
                  </button>

                  <button
                    className="btn-secondary"
                    onClick={handleSubscribe}
                    disabled={unlocking}
                    style={{ width: '100%', padding: '0.65rem 1rem', fontSize: '0.82rem' }}
                  >
                    {unlocking ? 'Unlocking...' : '⚡ Subscribe to View All'}
                  </button>
                </div>
              </div>
            ) : (
              /* Unlocked View */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem', marginTop: '0.8rem', animation: 'fadeIn 0.3s ease-out' }}>
                {profile.bio && (
                  <div>
                    <h4 style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.2rem' }}>About</h4>
                    <p style={{ fontSize: '0.92rem', color: '#fff', lineHeight: '1.45' }}>{profile.bio}</p>
                  </div>
                )}

                {profile.year && (
                  <div>
                    <h4 style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.2rem' }}>Graduation</h4>
                    <p style={{ fontSize: '0.92rem', color: '#fff' }}>Class of '{String(profile.year).slice(-2)}</p>
                  </div>
                )}

                {profile.interests?.length > 0 && (
                  <div>
                    <h4 style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>Interests</h4>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                      {profile.interests.map((tag, i) => (
                        <span
                          key={i}
                          style={{
                            background: 'rgba(255,255,255,0.1)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            padding: '0.25rem 0.65rem',
                            borderRadius: '12px',
                            fontSize: '0.78rem',
                            color: '#fff',
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {profile.photos?.length > 1 && (
                  <div>
                    <h4 style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>Photos</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                      {profile.photos.slice(1).map((photoUrl, idx) => (
                        <img
                          key={idx}
                          src={getPhotoUrl(photoUrl)}
                          alt={`${profile.name} photo ${idx + 2}`}
                          style={{ width: '100%', aspectRatio: '3/4', objectFit: 'cover', borderRadius: 'var(--radius-sm)' }}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Free Messaging & Chat Action Button */}
                {(profile.match_id || matchInfo?.matchId) && (
                  <div style={{ marginTop: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                    <div
                      style={{
                        fontSize: '0.78rem',
                        color: '#fbcfe8',
                        textAlign: 'center',
                        background: 'rgba(236, 72, 153, 0.15)',
                        padding: '0.35rem 0.6rem',
                        borderRadius: '8px',
                        border: '1px solid rgba(244, 114, 182, 0.3)',
                      }}
                    >
                      ⚡ 2 Free Messages allowed in this match
                    </div>
                    <button
                      className="btn-primary"
                      onClick={() => {
                        onClose();
                        navigate(`/chat/${profile.match_id || matchInfo.matchId}`);
                      }}
                      style={{ width: '100%', padding: '0.75rem 1rem', fontSize: '0.92rem' }}
                    >
                      💬 Send Free Message & Chat
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
