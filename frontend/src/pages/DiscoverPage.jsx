import { useState, useEffect } from 'react';
import { discoverApi, swipeApi, profileApi, getPhotoUrl } from '../api';
import DiscoverProfileModal from '../components/DiscoverProfileModal';

export default function DiscoverPage() {
  const [deck, setDeck] = useState([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [swipeMsg, setSwipeMsg] = useState('');
  const [myInterests, setMyInterests] = useState([]);
  const [cardPhotoIndex, setCardPhotoIndex] = useState(0);
  const [detailProfile, setDetailProfile] = useState(null);
  const [superLikeStatus, setSuperLikeStatus] = useState({
    available: true,
    next_available_in_seconds: 0,
    last_super_like_at: null,
  });

  useEffect(() => {
    loadDeckAndProfile();
  }, []);

  // Reset photo index when current card changes
  useEffect(() => {
    setCardPhotoIndex(0);
  }, [index]);

  // Cooldown countdown timer for Super Like
  useEffect(() => {
    if (superLikeStatus.available || superLikeStatus.next_available_in_seconds <= 0) return;
    const interval = setInterval(() => {
      setSuperLikeStatus((prev) => {
        if (prev.next_available_in_seconds <= 1) {
          return { ...prev, available: true, next_available_in_seconds: 0 };
        }
        return { ...prev, next_available_in_seconds: prev.next_available_in_seconds - 1 };
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [superLikeStatus.available, superLikeStatus.next_available_in_seconds]);

  function formatCooldown(seconds) {
    if (!seconds || seconds <= 0) return '';
    const hours = Math.floor(seconds / 3600);
    const mins = Math.ceil((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  }

  async function loadDeckAndProfile() {
    setLoading(true);
    setError('');
    try {
      const [deckRes, myProfileRes] = await Promise.all([
        discoverApi.getDeck(),
        profileApi.getMyProfile().catch(() => ({ data: null }))
      ]);

      const profilesList = deckRes.data?.profiles || deckRes.data || [];
      setDeck(Array.isArray(profilesList) ? profilesList : []);
      setIndex(0);

      if (deckRes.data?.super_like) {
        setSuperLikeStatus(deckRes.data.super_like);
      }

      const p = myProfileRes?.data?.profile || myProfileRes?.data;
      if (p?.interests) {
        let parsed = [];
        if (Array.isArray(p.interests)) parsed = p.interests;
        else if (typeof p.interests === 'string') {
          try { parsed = JSON.parse(p.interests); } catch { parsed = []; }
        }
        setMyInterests(parsed);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSwipe(action) {
    const profile = deck[index];
    if (!profile) return;
    setSwipeMsg('');
    const targetId = profile.user_id || profile.id;
    try {
      const res = await swipeApi.swipe(targetId, action);
      if (res.data?.matched) {
        setSwipeMsg(`🎉 It's a Match with ${profile.name || 'someone'}!`);
      } else if (action === 'super_like') {
        setSwipeMsg(`⭐ Super Liked ${profile.name || 'someone'}!`);
      }
      if (action === 'super_like') {
        setSuperLikeStatus({
          available: false,
          next_available_in_seconds: 24 * 3600,
          last_super_like_at: new Date().toISOString(),
        });
      }
      setIndex((prev) => prev + 1);
    } catch (err) {
      if (err.status === 429 && err.retryAfter) {
        setSuperLikeStatus((prev) => ({
          ...prev,
          available: false,
          next_available_in_seconds: err.retryAfter,
        }));
      }
      setError(err.message);
    }
  }

  const currentProfile = deck[index];

  // Parse candidate photos
  let photos = [];
  if (currentProfile) {
    if (Array.isArray(currentProfile.photos)) photos = currentProfile.photos;
    else if (typeof currentProfile.photos === 'string') {
      try { photos = JSON.parse(currentProfile.photos); } catch { photos = []; }
    }
  }

  // Parse candidate interests
  let candidateInterests = [];
  if (currentProfile) {
    if (Array.isArray(currentProfile.interests)) candidateInterests = currentProfile.interests;
    else if (typeof currentProfile.interests === 'string') {
      try { candidateInterests = JSON.parse(currentProfile.interests); } catch { candidateInterests = []; }
    }
  }

  // Compute shared interests
  const sharedInterests = currentProfile?.shared_interests && currentProfile.shared_interests.length > 0
    ? currentProfile.shared_interests
    : candidateInterests.filter((tag) => myInterests.includes(tag));

  const compatScore = currentProfile?.compatibility_score;
  const compatBreakdown = currentProfile?.compatibility_breakdown;

  const totalPhotos = photos.length;

  const handlePrevPhoto = (e) => {
    e.stopPropagation();
    setCardPhotoIndex((prev) => (prev > 0 ? prev - 1 : totalPhotos - 1));
  };

  const handleNextPhoto = (e) => {
    e.stopPropagation();
    setCardPhotoIndex((prev) => (prev < totalPhotos - 1 ? prev + 1 : 0));
  };

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1>Discover</h1>
        <button onClick={loadDeckAndProfile} className="btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
          ↻ Refresh
        </button>
      </div>

      {swipeMsg && <p className="success" style={{ marginBottom: '1rem', textAlign: 'center' }}>{swipeMsg}</p>}
      {error && <p className="error" style={{ marginBottom: '1rem' }}>{error}</p>}

      {loading && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p>Finding campus matches...</p>
        </div>
      )}

      {!loading && !currentProfile && (
        <div className="glass-card" style={{ textAlign: 'center', padding: '3rem 1.5rem', margin: 'auto 0' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✨</div>
          <h2 style={{ marginBottom: '0.5rem' }}>No More Profiles</h2>
          <p style={{ marginBottom: '1.5rem' }}>You've seen all potential matches in your campus deck for now!</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', maxWidth: '240px', margin: '0 auto' }}>
            <button className="btn-primary" onClick={loadDeckAndProfile}>
              Refresh Deck
            </button>
          </div>
        </div>
      )}

      {currentProfile && (
        <div className="deck-container">
          {/* DISCOVER CARD — 100% UNGATED FULL PHOTO VISIBILITY */}
          <div className="swipe-card" style={{ overflow: 'hidden', position: 'relative' }}>
            {/* Main Photo Display */}
            {totalPhotos > 0 ? (
              <img
                src={getPhotoUrl(photos[cardPhotoIndex] || photos[0])}
                alt={currentProfile.name}
                className="swipe-card-img"
              />
            ) : (
              <div
                className="swipe-card-img"
                style={{
                  background: 'linear-gradient(135deg, #1e2436 0%, #0d0f17 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '4rem',
                  color: 'var(--text-dim)'
                }}
              >
                👤
              </div>
            )}

            {/* Photo Pagination Bar (Indicators) */}
            {totalPhotos > 1 && (
              <div
                style={{
                  position: 'absolute',
                  top: '10px',
                  left: '10px',
                  right: '50px',
                  display: 'flex',
                  gap: '4px',
                  zIndex: 25,
                }}
              >
                {photos.map((_, idx) => (
                  <div
                    key={idx}
                    onClick={(e) => {
                      e.stopPropagation();
                      setCardPhotoIndex(idx);
                    }}
                    style={{
                      flex: 1,
                      height: '4px',
                      borderRadius: '2px',
                      background: idx === cardPhotoIndex ? '#fff' : 'rgba(255, 255, 255, 0.4)',
                      boxShadow: idx === cardPhotoIndex ? '0 0 6px rgba(255,255,255,0.8)' : 'none',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                  />
                ))}
              </div>
            )}

            {/* Info / View Full Profile Button */}
            <button
              onClick={() => setDetailProfile(currentProfile)}
              aria-label="View Profile Detail"
              style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                background: 'rgba(0, 0, 0, 0.55)',
                backdropFilter: 'blur(8px)',
                color: '#fff',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                borderRadius: '50%',
                width: '34px',
                height: '34px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1rem',
                cursor: 'pointer',
                zIndex: 25,
                boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
              }}
            >
              ℹ️
            </button>

            {/* Compatibility Score Badge */}
            {typeof compatScore === 'number' && (
              <div
                style={{
                  position: 'absolute',
                  top: '52px',
                  right: '10px',
                  background: compatScore >= 70
                    ? 'linear-gradient(135deg, #00e676, #00c853)'
                    : compatScore >= 40
                      ? 'linear-gradient(135deg, #ff9800, #f57c00)'
                      : 'linear-gradient(135deg, #78909c, #546e7a)',
                  color: '#fff',
                  borderRadius: '12px',
                  padding: '0.25rem 0.6rem',
                  fontSize: '0.78rem',
                  fontWeight: '700',
                  zIndex: 25,
                  boxShadow: compatScore >= 70
                    ? '0 2px 12px rgba(0, 230, 118, 0.5)'
                    : '0 2px 8px rgba(0,0,0,0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  letterSpacing: '0.02em',
                }}
                title={compatBreakdown
                  ? `Interest: ${compatBreakdown.interest}% | Behavioral: ${compatBreakdown.behavioral}% | Freshness: ${compatBreakdown.freshness}%`
                  : `${compatScore}% compatible`}
              >
                {compatScore >= 70 ? '💚' : compatScore >= 40 ? '🧡' : '🤍'}
                {compatScore}%
              </div>
            )}

            {/* Left & Right Tap Zones for Photo Cycling */}
            {totalPhotos > 1 && (
              <>
                <div
                  onClick={handlePrevPhoto}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    bottom: '120px',
                    width: '35%',
                    zIndex: 15,
                    cursor: 'pointer',
                  }}
                />
                <div
                  onClick={handleNextPhoto}
                  style={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    bottom: '120px',
                    width: '35%',
                    zIndex: 15,
                    cursor: 'pointer',
                  }}
                />
                {/* Arrow Buttons */}
                <button
                  onClick={handlePrevPhoto}
                  aria-label="Previous Photo"
                  style={{
                    position: 'absolute',
                    left: '8px',
                    top: '40%',
                    transform: 'translateY(-50%)',
                    background: 'rgba(0,0,0,0.35)',
                    border: 'none',
                    color: '#fff',
                    borderRadius: '50%',
                    width: '30px',
                    height: '30px',
                    zIndex: 20,
                    cursor: 'pointer',
                    fontSize: '1.2rem',
                    lineHeight: '1',
                  }}
                >
                  ‹
                </button>
                <button
                  onClick={handleNextPhoto}
                  aria-label="Next Photo"
                  style={{
                    position: 'absolute',
                    right: '8px',
                    top: '40%',
                    transform: 'translateY(-50%)',
                    background: 'rgba(0,0,0,0.35)',
                    border: 'none',
                    color: '#fff',
                    borderRadius: '50%',
                    width: '30px',
                    height: '30px',
                    zIndex: 20,
                    cursor: 'pointer',
                    fontSize: '1.2rem',
                    lineHeight: '1',
                  }}
                >
                  ›
                </button>
              </>
            )}

            <div className="swipe-card-gradient" />

            <div className="swipe-card-info" style={{ zIndex: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <h2 style={{ margin: 0, fontSize: '1.5rem' }}>{currentProfile.name || 'Campus Student'}</h2>
                  {currentProfile.year && (
                    <span className="swipe-card-badge">Class of '{String(currentProfile.year).slice(-2)}</span>
                  )}
                  {typeof compatScore === 'number' && compatScore >= 70 && (
                    <span style={{
                      background: 'linear-gradient(135deg, rgba(0, 230, 118, 0.2), rgba(0, 200, 83, 0.2))',
                      border: '1px solid rgba(0, 230, 118, 0.4)',
                      color: '#00e676',
                      padding: '0.15rem 0.55rem',
                      borderRadius: 'var(--radius-full)',
                      fontSize: '0.72rem',
                      fontWeight: '700',
                    }}>✨ Great Match</span>
                  )}
                </div>
                {totalPhotos > 1 && (
                  <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)', background: 'rgba(0,0,0,0.4)', padding: '0.15rem 0.5rem', borderRadius: '10px' }}>
                    📷 {cardPhotoIndex + 1}/{totalPhotos}
                  </span>
                )}
              </div>

              {currentProfile.bio && (
                <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.88rem', marginBottom: '0.5rem' }}>
                  {currentProfile.bio}
                </p>
              )}

              {/* Shared Interests Banner (If sharedInterests exist) */}
              {sharedInterests.length > 0 && (
                <div
                  style={{
                    background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.25) 0%, rgba(168, 85, 247, 0.25) 100%)',
                    border: '1px solid rgba(244, 114, 182, 0.4)',
                    backdropFilter: 'blur(10px)',
                    padding: '0.4rem 0.75rem',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    color: '#fbcfe8',
                    marginBottom: '0.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    boxShadow: '0 2px 8px rgba(236, 72, 153, 0.15)'
                  }}
                >
                  <span>✨</span>
                  <span>
                    You both like ({sharedInterests.length}):{' '}
                    <strong style={{ color: '#fff' }}>{sharedInterests.join(', ')}</strong>
                  </span>
                </div>
              )}

              {/* Interests Chips Grid */}
              {candidateInterests.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.2rem' }}>
                  {candidateInterests.map((interest, idx) => {
                    const isShared = sharedInterests.includes(interest);
                    return (
                      <span
                        key={idx}
                        style={{
                          background: isShared
                            ? 'linear-gradient(135deg, #ec4899 0%, #a855f7 100%)'
                            : 'rgba(255,255,255,0.15)',
                          border: isShared ? '1px solid rgba(244, 114, 182, 0.6)' : '1px solid transparent',
                          backdropFilter: 'blur(8px)',
                          padding: '0.22rem 0.65rem',
                          borderRadius: 'var(--radius-full)',
                          fontSize: '0.75rem',
                          fontWeight: isShared ? 600 : 400,
                          color: '#fff',
                          boxShadow: isShared ? '0 2px 6px rgba(236, 72, 153, 0.3)' : 'none'
                        }}
                      >
                        {isShared ? `✨ ${interest}` : interest}
                      </span>
                    );
                  })}
                </div>
              )}

              {/* View Full Profile Trigger Button */}
              <button
                onClick={() => setDetailProfile(currentProfile)}
                style={{
                  marginTop: '0.6rem',
                  background: 'none',
                  border: 'none',
                  color: 'rgba(255,255,255,0.8)',
                  fontSize: '0.8rem',
                  textDecoration: 'underline',
                  cursor: 'pointer',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem'
                }}
              >
                <span>🔍 Tap for full profile & photos</span>
              </button>
            </div>
          </div>

          <div className="swipe-actions" style={{ flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1.25rem' }}>
              <button className="action-btn action-pass" onClick={() => handleSwipe('pass')} aria-label="Pass">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              {/* Super Like Button — ONLY unlocked when 4+ interests match */}
              {sharedInterests.length >= 4 && (
                <button
                  className="action-btn action-super-like"
                  onClick={() => superLikeStatus.available && handleSwipe('super_like')}
                  disabled={!superLikeStatus.available}
                  title={
                    superLikeStatus.available
                      ? `⭐ Super Like (${sharedInterests.length} shared interests!)`
                      : `Next Super Like available in ${formatCooldown(superLikeStatus.next_available_in_seconds)}`
                  }
                  aria-label="Super Like"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.5rem',
                  }}
                >
                  ⭐
                </button>
              )}

              <button className="action-btn action-like" onClick={() => handleSwipe('like')} aria-label="Like">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
                </svg>
              </button>
            </div>

            {/* Optional Super Like Status / Cooldown notice when 4+ interests match */}
            {sharedInterests.length >= 4 && !superLikeStatus.available && superLikeStatus.next_available_in_seconds > 0 && (
              <span style={{ fontSize: '0.75rem', color: '#ffd700', marginTop: '0.4rem', fontWeight: '600' }}>
                Next Super Like available in {formatCooldown(superLikeStatus.next_available_in_seconds)}
              </span>
            )}
            {sharedInterests.length >= 4 && superLikeStatus.available && (
              <span style={{ fontSize: '0.74rem', color: '#ffd700', marginTop: '0.4rem', fontWeight: '700', letterSpacing: '0.02em' }}>
                ⭐ Super Like Unlocked ({sharedInterests.length} shared interests!)
              </span>
            )}
          </div>
        </div>
      )}

      {/* FULL UNGATED PROFILE DETAIL MODAL */}
      {detailProfile && (
        <DiscoverProfileModal
          profile={detailProfile}
          myInterests={myInterests}
          canSuperLike={sharedInterests.length >= 4}
          superLikeAvailable={superLikeStatus.available}
          superLikeCooldownText={formatCooldown(superLikeStatus.next_available_in_seconds)}
          onClose={() => setDetailProfile(null)}
          onSwipe={(action) => handleSwipe(action)}
        />
      )}
    </div>
  );
}

