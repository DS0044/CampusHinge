import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { notificationApi, swipeApi, subscriptionApi, profileApi, getPhotoUrl } from '../api';

export default function GatedProfileModal({ targetUserId, onClose, onMatchCreated }) {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [swiping, setSwiping] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [matchInfo, setMatchInfo] = useState(null);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [myInterests, setMyInterests] = useState([]);

  useEffect(() => {
    let mounted = true;
    async function loadData() {
      if (!targetUserId) return;
      setLoading(true);
      setError('');
      try {
        // Pre-fetch own interests for matching chemistry
        try {
          const myRes = await profileApi.getMyProfile();
          const me = myRes.data?.profile;
          if (mounted && me?.interests) {
            const list = Array.isArray(me.interests)
              ? me.interests
              : typeof me.interests === 'string'
              ? JSON.parse(me.interests)
              : [];
            setMyInterests(list);
          }
        } catch {
          // Non-critical
        }

        const res = await notificationApi.getGatedProfile(targetUserId);
        if (mounted) {
          const prof = res.data?.profile || null;
          setProfile(prof);
          if (prof?.has_matched && prof?.match_id) {
            setMatchInfo({ matchId: prof.match_id });
          }
        }
      } catch (err) {
        if (mounted) setError(err.message);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadData();
    return () => {
      mounted = false;
    };
  }, [targetUserId]);

  async function loadGatedProfile(silent = false) {
    if (!silent) setLoading(true);
    setError('');
    try {
      const res = await notificationApi.getGatedProfile(targetUserId);
      const prof = res.data?.profile || null;
      setProfile(prof);
      if (prof?.has_matched && prof?.match_id) {
        setMatchInfo({ matchId: prof.match_id });
      }
    } catch (err) {
      if (!silent) setError(err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  }

  async function handleLikeBack() {
    setSwiping(true);
    setError('');
    try {
      const res = await swipeApi.swipe(targetUserId, 'like');
      const isMatch = Boolean(res.data?.matched);
      const mId = res.data?.match_id;

      if (isMatch && mId) {
        setMatchInfo({ matchId: mId });
        // Immediately flip the local view to unlocked so the user instantly sees the full profile
        setProfile((prev) => ({
          ...prev,
          is_locked: false,
          has_matched: true,
          match_id: mId,
          name: prev?.real_name || prev?.name || 'Matched User',
        }));
        if (onMatchCreated) onMatchCreated();
      }
      // Re-fetch fresh full profile details
      await loadGatedProfile(true);
    } catch (err) {
      setError(err.message || 'Failed to match back.');
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

  // Process photos list
  let photosList = [];
  if (profile) {
    if (Array.isArray(profile.photos)) {
      photosList = profile.photos.filter(Boolean);
    } else if (typeof profile.photos === 'string') {
      try {
        const parsed = JSON.parse(profile.photos);
        if (Array.isArray(parsed)) photosList = parsed.filter(Boolean);
      } catch {
        photosList = [];
      }
    }
    if (photosList.length === 0 && profile.primary_photo) {
      photosList = [profile.primary_photo];
    }
  }

  // Process interests & matching chemistry
  let candidateInterests = [];
  if (profile) {
    if (Array.isArray(profile.interests)) {
      candidateInterests = profile.interests;
    } else if (typeof profile.interests === 'string') {
      try {
        candidateInterests = JSON.parse(profile.interests);
      } catch {
        candidateInterests = [];
      }
    }
  }

  let sharedInterests = [];
  if (Array.isArray(profile?.shared_interests) && profile.shared_interests.length > 0) {
    sharedInterests = profile.shared_interests;
  } else if (Array.isArray(myInterests) && candidateInterests.length > 0) {
    sharedInterests = candidateInterests.filter((tag) => myInterests.includes(tag));
  }

  const isUnlocked = profile ? !profile.is_locked : false;
  const isMatched = profile?.has_matched || Boolean(matchInfo?.matchId) || Boolean(profile?.match_id);
  const activeMatchId = profile?.match_id || matchInfo?.matchId;
  const totalPhotos = photosList.length;

  const prevPhoto = (e) => {
    e?.stopPropagation();
    setPhotoIndex((prev) => (prev > 0 ? prev - 1 : totalPhotos - 1));
  };

  const nextPhoto = (e) => {
    e?.stopPropagation();
    setPhotoIndex((prev) => (prev < totalPhotos - 1 ? prev + 1 : 0));
  };

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
        animation: 'fadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
      onClick={onClose}
    >
      <div
        className="glass-card modal-pop-card"
        style={{
          width: '100%',
          maxWidth: '440px',
          maxHeight: '90vh',
          overflowY: 'auto',
          position: 'relative',
          padding: 0,
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--glass-border-light)',
          background: '#0e111a',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.7), 0 0 30px rgba(255, 64, 129, 0.15)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          aria-label="Close Profile"
          style={{
            position: 'absolute',
            top: '14px',
            right: '14px',
            background: 'rgba(0, 0, 0, 0.6)',
            color: '#fff',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '50%',
            width: '34px',
            height: '34px',
            padding: 0,
            fontSize: '1.2rem',
            cursor: 'pointer',
            zIndex: 30,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            transition: 'all 0.15s ease',
          }}
        >
          ×
        </button>

        {loading && (
          <div style={{ padding: '4rem 1rem', textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.8rem', animation: 'spin 1.5s infinite linear' }}>✨</div>
            <p style={{ color: 'var(--text-muted)' }}>Loading profile details...</p>
          </div>
        )}

        {error && (
          <div style={{ padding: '2rem 1.5rem', textAlign: 'center' }}>
            <p className="error" style={{ marginBottom: '1rem' }}>{error}</p>
            <button className="btn-secondary" onClick={() => loadGatedProfile()}>Try Again</button>
          </div>
        )}

        {!loading && profile && (
          <div>
            {/* Celebratory Match Banner when Matched */}
            {isMatched && (
              <div
                style={{
                  background: 'linear-gradient(135deg, rgba(255, 64, 129, 0.9) 0%, rgba(124, 77, 255, 0.9) 100%)',
                  color: '#fff',
                  padding: '0.65rem 1rem',
                  fontSize: '0.85rem',
                  fontWeight: '700',
                  textAlign: 'center',
                  letterSpacing: '0.02em',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                  boxShadow: '0 4px 15px rgba(255, 64, 129, 0.35)',
                }}
              >
                <span>🎉</span> It's a Mutual Match! You can now chat freely.
              </div>
            )}

            {/* UNLOCKED VIEW: FULL PHOTO GALLERY */}
            {isUnlocked ? (
              <div style={{ position: 'relative', width: '100%', aspectRatio: '3/4', background: '#07090e' }}>
                {totalPhotos > 0 ? (
                  <img
                    src={getPhotoUrl(photosList[photoIndex])}
                    alt={`${profile.name} photo ${photoIndex + 1}`}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      display: 'block',
                      transition: 'opacity 0.2s ease',
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
                      fontSize: '4rem',
                      color: 'var(--text-dim)',
                    }}
                  >
                    👤
                  </div>
                )}

                {/* Photo Pagination Line Indicators */}
                {totalPhotos > 1 && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '12px',
                      left: '12px',
                      right: '56px',
                      display: 'flex',
                      gap: '4px',
                      zIndex: 20,
                    }}
                  >
                    {photosList.map((_, idx) => (
                      <div
                        key={idx}
                        onClick={(e) => {
                          e.stopPropagation();
                          setPhotoIndex(idx);
                        }}
                        style={{
                          flex: 1,
                          height: '4px',
                          borderRadius: '2px',
                          background: idx === photoIndex ? '#fff' : 'rgba(255, 255, 255, 0.35)',
                          boxShadow: idx === photoIndex ? '0 0 8px rgba(255,255,255,0.8)' : 'none',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                        }}
                      />
                    ))}
                  </div>
                )}

                {/* Left / Right Click Areas for Photo Navigation */}
                {totalPhotos > 1 && (
                  <>
                    <div
                      onClick={prevPhoto}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        bottom: 0,
                        width: '35%',
                        zIndex: 10,
                        cursor: 'pointer',
                      }}
                    />
                    <div
                      onClick={nextPhoto}
                      style={{
                        position: 'absolute',
                        top: 0,
                        right: 0,
                        bottom: 0,
                        width: '35%',
                        zIndex: 10,
                        cursor: 'pointer',
                      }}
                    />
                    <button
                      onClick={prevPhoto}
                      aria-label="Previous Photo"
                      style={{
                        position: 'absolute',
                        left: '10px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'rgba(0,0,0,0.45)',
                        border: 'none',
                        color: '#fff',
                        borderRadius: '50%',
                        width: '32px',
                        height: '32px',
                        zIndex: 20,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.2rem',
                      }}
                    >
                      ‹
                    </button>
                    <button
                      onClick={nextPhoto}
                      aria-label="Next Photo"
                      style={{
                        position: 'absolute',
                        right: '10px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'rgba(0,0,0,0.45)',
                        border: 'none',
                        color: '#fff',
                        borderRadius: '50%',
                        width: '32px',
                        height: '32px',
                        zIndex: 20,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.2rem',
                      }}
                    >
                      ›
                    </button>
                  </>
                )}

                {/* Photo Counter Badge */}
                {totalPhotos > 1 && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '12px',
                      right: '12px',
                      background: 'rgba(0, 0, 0, 0.65)',
                      backdropFilter: 'blur(6px)',
                      color: '#fff',
                      padding: '0.2rem 0.6rem',
                      borderRadius: 'var(--radius-full)',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      zIndex: 20,
                    }}
                  >
                    {photoIndex + 1} / {totalPhotos}
                  </div>
                )}
              </div>
            ) : (
              /* LOCKED VIEW: BLURRED AVATAR PREVIEW */
              <div style={{ padding: '2rem 1.5rem 1rem 1.5rem', textAlign: 'center' }}>
                <div
                  style={{
                    width: '120px',
                    height: '120px',
                    borderRadius: '50%',
                    overflow: 'hidden',
                    margin: '0 auto 0.9rem auto',
                    border: '3px solid var(--primary-pink)',
                    boxShadow: '0 8px 24px var(--accent-glow), 0 0 20px rgba(255, 64, 129, 0.4)',
                    background: 'var(--primary-gradient)',
                    position: 'relative',
                  }}
                >
                  {profile.primary_photo || photosList[0] ? (
                    <img
                      src={getPhotoUrl(profile.primary_photo || photosList[0])}
                      alt="Someone"
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        filter: 'blur(16px) brightness(0.85)',
                        transform: 'scale(1.25)',
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
                        fontSize: '2.8rem',
                      }}
                    >
                      👤
                    </div>
                  )}
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'rgba(0, 0, 0, 0.35)',
                      fontSize: '1.8rem',
                      pointerEvents: 'none',
                    }}
                  >
                    🔒
                  </div>
                </div>

                <h2 style={{ fontSize: '1.45rem', margin: '0 0 0.3rem 0', color: '#fff' }}>
                  Someone
                </h2>
                <span
                  style={{
                    fontSize: '0.82rem',
                    color: '#ff4081',
                    fontWeight: '600',
                    letterSpacing: '0.02em',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                  }}
                >
                  🔒 Liked Your Profile
                </span>
              </div>
            )}

            {/* Profile Content Body */}
            <div style={{ padding: '1.25rem' }}>
              {isUnlocked ? (
                /* UNLOCKED FULL PROFILE BODY */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                  {/* Name & Graduation Badge */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                      <h2 style={{ fontSize: '1.5rem', margin: 0, color: '#fff' }}>{profile.name}</h2>
                      {profile.year && (
                        <span
                          style={{
                            background: 'var(--primary-gradient)',
                            padding: '0.22rem 0.65rem',
                            borderRadius: 'var(--radius-full)',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            color: '#fff',
                          }}
                        >
                          Passout {String(profile.year).slice(-2)}
                        </span>
                      )}
                      {isMatched && (
                        <span
                          style={{
                            background: 'rgba(0, 230, 118, 0.15)',
                            border: '1px solid rgba(0, 230, 118, 0.4)',
                            color: '#00e676',
                            padding: '0.22rem 0.65rem',
                            borderRadius: 'var(--radius-full)',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                          }}
                        >
                          💖 Mutual Match
                        </span>
                      )}
                    </div>
                  </div>

                  {/* About / Bio */}
                  {profile.bio && (
                    <div>
                      <h4
                        style={{
                          fontSize: '0.75rem',
                          color: 'var(--text-muted)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          marginBottom: '0.35rem',
                        }}
                      >
                        About
                      </h4>
                      <p
                        style={{
                          color: 'rgba(255, 255, 255, 0.92)',
                          fontSize: '0.94rem',
                          lineHeight: '1.5',
                          whiteSpace: 'pre-line',
                          margin: 0,
                        }}
                      >
                        {profile.bio}
                      </p>
                    </div>
                  )}

                  {/* Matching Interests Banner */}
                  {sharedInterests.length > 0 && (
                    <div
                      style={{
                        background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.2) 0%, rgba(168, 85, 247, 0.2) 100%)',
                        border: '1px solid rgba(244, 114, 182, 0.4)',
                        borderRadius: 'var(--radius-md)',
                        padding: '0.75rem 1rem',
                      }}
                    >
                      <div
                        style={{
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          color: '#fbcfe8',
                          marginBottom: '0.5rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                        }}
                      >
                        <span>✨</span> Matching Interests ({sharedInterests.length})
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                        {sharedInterests.map((tag, idx) => (
                          <span
                            key={idx}
                            style={{
                              background: 'linear-gradient(135deg, #ec4899 0%, #a855f7 100%)',
                              border: '1px solid rgba(244, 114, 182, 0.6)',
                              color: '#fff',
                              padding: '0.28rem 0.7rem',
                              borderRadius: 'var(--radius-full)',
                              fontSize: '0.78rem',
                              fontWeight: 600,
                              boxShadow: '0 2px 8px rgba(236, 72, 153, 0.3)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                            }}
                          >
                            <span>✨</span>
                            <span>{tag}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* All Interests */}
                  {candidateInterests.length > 0 && (
                    <div>
                      <h4
                        style={{
                          fontSize: '0.75rem',
                          color: 'var(--text-muted)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          marginBottom: '0.45rem',
                        }}
                      >
                        Interests ({candidateInterests.length})
                      </h4>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                        {candidateInterests.map((tag, idx) => {
                          const isMatch = sharedInterests.includes(tag);
                          return (
                            <span
                              key={idx}
                              style={{
                                background: isMatch
                                  ? 'linear-gradient(135deg, rgba(236, 72, 153, 0.25) 0%, rgba(168, 85, 247, 0.25) 100%)'
                                  : 'rgba(255, 255, 255, 0.08)',
                                border: isMatch ? '1px solid rgba(244, 114, 182, 0.5)' : '1px solid var(--glass-border)',
                                color: isMatch ? '#fbcfe8' : 'rgba(255, 255, 255, 0.88)',
                                padding: '0.28rem 0.68rem',
                                borderRadius: 'var(--radius-full)',
                                fontSize: '0.78rem',
                                fontWeight: isMatch ? 600 : 400,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.25rem',
                              }}
                            >
                              {isMatch && <span style={{ fontSize: '0.75rem' }}>✨</span>}
                              <span>{tag}</span>
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Action: Chat Button */}
                  {activeMatchId && (
                    <div style={{ marginTop: '0.4rem' }}>
                      <button
                        className="btn-primary"
                        onClick={() => {
                          onClose();
                          navigate(`/chat/${activeMatchId}`);
                        }}
                        style={{
                          width: '100%',
                          padding: '0.85rem 1rem',
                          fontSize: '0.96rem',
                          fontWeight: '700',
                          borderRadius: 'var(--radius-md)',
                          boxShadow: '0 4px 20px rgba(255, 64, 129, 0.4)',
                        }}
                      >
                        💬 Chat with {profile.name}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                /* LOCKED VIEW CARD */
                <div
                  style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 64, 129, 0.3)',
                    borderRadius: 'var(--radius-md)',
                    padding: '1.4rem 1.1rem',
                    textAlign: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.75rem',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                  }}
                >
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
                      Identity &amp; Profile Blurred
                    </h3>
                    <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', lineHeight: '1.45', margin: 0 }}>
                      Like back to reveal their full photo gallery, identity, and start chatting!
                    </p>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', width: '100%', marginTop: '0.4rem' }}>
                    <button
                      className="btn-primary"
                      onClick={handleLikeBack}
                      disabled={swiping}
                      style={{
                        width: '100%',
                        padding: '0.82rem 1rem',
                        fontSize: '0.94rem',
                        fontWeight: '700',
                        boxShadow: '0 4px 15px rgba(255, 64, 129, 0.35)',
                        transition: 'transform 0.15s ease',
                      }}
                    >
                      {swiping ? 'Matching & Unlocking...' : '💖 Like Back to Unlock'}
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
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
