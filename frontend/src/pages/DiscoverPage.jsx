import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { discoverApi, swipeApi, profileApi, getPhotoUrl } from '../api';
import DiscoverProfileModal from '../components/DiscoverProfileModal';

export default function DiscoverPage() {
  const [deck, setDeck] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [swipeMsg, setSwipeMsg] = useState('');
  const [myInterests, setMyInterests] = useState([]);
  const [topCardPhotoIndex, setTopCardPhotoIndex] = useState(0);
  const [detailProfile, setDetailProfile] = useState(null);
  const [expandedBioProfileId, setExpandedBioProfileId] = useState(null);

  // Gesture drag & flying animation state
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [flyingCard, setFlyingCard] = useState(null);

  const [superLikeStatus, setSuperLikeStatus] = useState({
    available: true,
    next_available_in_seconds: 0,
    last_super_like_at: null,
  });

  const pointerStartRef = useRef(null);
  const isDraggingRef = useRef(false);
  const isFetchingMoreRef = useRef(false);
  const hasMoreRef = useRef(true);

  // Initial load
  useEffect(() => {
    loadDeckAndProfile();
  }, []);

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

  // Buffer preloading: when remaining cards drop to <= 3, fetch more in the background
  useEffect(() => {
    if (deck.length > 3 || isFetchingMoreRef.current || !hasMoreRef.current || loading) return;

    async function fetchMore() {
      isFetchingMoreRef.current = true;
      try {
        const res = await discoverApi.getDeck();
        const incoming = res.data?.profiles || res.data || [];
        if (!Array.isArray(incoming) || incoming.length === 0) {
          hasMoreRef.current = false;
        } else {
          setDeck((prevDeck) => {
            const currentIds = new Set(prevDeck.map((p) => p.user_id || p.id));
            const fresh = incoming.filter((p) => !currentIds.has(p.user_id || p.id));
            if (fresh.length === 0) {
              hasMoreRef.current = false;
              return prevDeck;
            }
            return [...prevDeck, ...fresh];
          });
        }
      } catch (err) {
        console.warn('Background deck preload failed:', err.message);
      } finally {
        isFetchingMoreRef.current = false;
      }
    }

    fetchMore();
  }, [deck.length, loading]);

  // Prefetch first photo of upcoming profiles into memory for zero image flicker
  useEffect(() => {
    deck.slice(0, 3).forEach((p) => {
      let photos = [];
      try {
        photos = Array.isArray(p.photos) ? p.photos : JSON.parse(p.photos || '[]');
      } catch {
        photos = [];
      }
      if (photos[0]) {
        const img = new Image();
        img.src = getPhotoUrl(photos[0]);
      }
    });
  }, [deck]);

  function formatCooldown(seconds) {
    if (!seconds || seconds <= 0) return '';
    const hours = Math.floor(seconds / 3600);
    const mins = Math.ceil((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  }

  async function loadDeckAndProfile() {
    setLoading(true);
    setRefreshing(true);
    setError('');
    hasMoreRef.current = true;
    try {
      const [deckRes, myProfileRes] = await Promise.all([
        discoverApi.getDeck(),
        profileApi.getMyProfile().catch(() => ({ data: null })),
      ]);

      const profilesList = deckRes.data?.profiles || deckRes.data || [];
      setDeck(Array.isArray(profilesList) ? profilesList : []);
      setTopCardPhotoIndex(0);

      if (deckRes.data?.super_like) {
        setSuperLikeStatus(deckRes.data.super_like);
      }

      const p = myProfileRes?.data?.profile || myProfileRes?.data;
      if (p?.interests) {
        let parsed = [];
        if (Array.isArray(p.interests)) parsed = p.interests;
        else if (typeof p.interests === 'string') {
          try {
            parsed = JSON.parse(p.interests);
          } catch {
            parsed = [];
          }
        }
        setMyInterests(parsed);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  // Perform card swipe animation and dispatch background API request
  const performSwipe = useCallback(
    (action) => {
      const current = deck[0];
      if (!current || flyingCard) return;

      const targetId = current.user_id || current.id;
      setSwipeMsg('');

      let targetX = 0;
      let targetY = dragOffset.y;
      let targetRotate = 0;

      const screenW = typeof window !== 'undefined' ? window.innerWidth : 400;
      const screenH = typeof window !== 'undefined' ? window.innerHeight : 700;

      if (action === 'like') {
        targetX = Math.max(screenW * 0.9, 550);
        targetRotate = 22;
      } else if (action === 'pass') {
        targetX = -Math.max(screenW * 0.9, 550);
        targetRotate = -22;
      } else if (action === 'super_like') {
        targetX = dragOffset.x * 0.5;
        targetY = -Math.max(screenH * 0.95, 750);
        targetRotate = 0;
      }

      // Mark current card as flying off screen
      setFlyingCard({
        profile: current,
        direction: action,
        x: targetX,
        y: targetY,
        rotate: targetRotate,
      });
      setDragOffset({ x: 0, y: 0 });
      setIsDragging(false);

      // Async backend call (does not block immediate deck progression)
      swipeApi
        .swipe(targetId, action)
        .then((res) => {
          if (res.data?.matched) {
            setSwipeMsg(`🎉 It's a Match with ${current.name || 'someone'}!`);
          } else if (action === 'super_like') {
            setSwipeMsg(`⭐ Super Liked ${current.name || 'someone'}!`);
          }
        })
        .catch((err) => {
          if (err.status === 429 && err.retryAfter) {
            setSuperLikeStatus((prev) => ({
              ...prev,
              available: false,
              next_available_in_seconds: err.retryAfter,
            }));
          }
          console.error('Swipe error:', err.message);
        });

      if (action === 'super_like') {
        setSuperLikeStatus({
          available: false,
          next_available_in_seconds: 24 * 3600,
          last_super_like_at: new Date().toISOString(),
        });
      }

      // Settle animation and advance to next card
      setTimeout(() => {
        setDeck((prev) => prev.slice(1));
        setFlyingCard(null);
        setTopCardPhotoIndex(0);
      }, 260);
    },
    [deck, flyingCard, dragOffset.x, dragOffset.y]
  );

  // Active top profile calculations
  const topProfile = deck[0];
  const topProfileId = topProfile ? (topProfile.user_id || topProfile.id || 'p0') : null;
  const isBioExpanded = expandedBioProfileId === topProfileId;

  let topPhotos = [];
  if (topProfile) {
    if (Array.isArray(topProfile.photos)) topPhotos = topProfile.photos;
    else if (typeof topProfile.photos === 'string') {
      try {
        topPhotos = JSON.parse(topProfile.photos);
      } catch {
        topPhotos = [];
      }
    }
  }

  let topInterests = [];
  if (topProfile) {
    if (Array.isArray(topProfile.interests)) topInterests = topProfile.interests;
    else if (typeof topProfile.interests === 'string') {
      try {
        topInterests = JSON.parse(topProfile.interests);
      } catch {
        topInterests = [];
      }
    }
  }

  const topBioText = (topProfile?.bio || '').trim();
  const topBioWords = topBioText ? topBioText.split(/\s+/) : [];
  const isTopBioLong = topBioWords.length > 10 || topBioText.length > 60;
  const displayedTopBio = isTopBioLong && !isBioExpanded
    ? topBioWords.slice(0, 10).join(' ')
    : topBioText;

  const sharedInterests =
    topProfile?.shared_interests && topProfile.shared_interests.length > 0
      ? topProfile.shared_interests
      : topInterests.filter((tag) => myInterests.includes(tag));

  const canSuperLike = sharedInterests.length >= 4;

  const handlePrevPhoto = (e) => {
    e?.stopPropagation();
    if (topPhotos.length <= 1) return;
    setTopCardPhotoIndex((prev) => (prev > 0 ? prev - 1 : topPhotos.length - 1));
  };

  const handleNextPhoto = (e) => {
    e?.stopPropagation();
    if (topPhotos.length <= 1) return;
    setTopCardPhotoIndex((prev) => (prev < topPhotos.length - 1 ? prev + 1 : 0));
  };

  // Pointer gesture handlers (mouse + touch)
  const handlePointerDown = (e) => {
    if (flyingCard || !topProfile) return;
    if (e.button !== undefined && e.button !== 0) return;
    if (e.target.closest('button') || e.target.closest('.photo-nav-btn')) return;

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}

    pointerStartRef.current = {
      pointerId: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      target: e.currentTarget,
      rect: e.currentTarget.getBoundingClientRect(),
      time: Date.now(),
    };
    isDraggingRef.current = false;
  };

  const handlePointerMove = (e) => {
    if (!pointerStartRef.current || flyingCard) return;
    const dx = e.clientX - pointerStartRef.current.x;
    const dy = e.clientY - pointerStartRef.current.y;

    if (!isDraggingRef.current && Math.hypot(dx, dy) > 8) {
      isDraggingRef.current = true;
      setIsDragging(true);
    }

    if (isDraggingRef.current) {
      setDragOffset({ x: dx, y: dy });
    }
  };

  const handlePointerUp = (e) => {
    if (!pointerStartRef.current) return;
    const start = pointerStartRef.current;
    pointerStartRef.current = null;

    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {}

    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      setIsDragging(false);

      const dx = dragOffset.x;
      const dy = dragOffset.y;
      const SWIPE_THRESHOLD = 95;

      if (dx > SWIPE_THRESHOLD) {
        performSwipe('like');
      } else if (dx < -SWIPE_THRESHOLD) {
        performSwipe('pass');
      } else if (dy < -115 && Math.abs(dx) < 80 && canSuperLike && superLikeStatus.available) {
        performSwipe('super_like');
      } else {
        // Spring back to center
        setDragOffset({ x: 0, y: 0 });
      }
    } else {
      // It was a tap (movement <= 8px)
      const rect = start.rect;
      const clickX = e.clientX - rect.left;
      const width = rect.width;

      if (clickX < width * 0.35) {
        handlePrevPhoto(e);
      } else if (clickX > width * 0.65) {
        handleNextPhoto(e);
      } else {
        setDetailProfile(topProfile);
      }
    }
  };

  const handlePointerCancel = () => {
    pointerStartRef.current = null;
    isDraggingRef.current = false;
    setIsDragging(false);
    setDragOffset({ x: 0, y: 0 });
  };

  // Render top active card style
  let topCardStyle = {};
  if (flyingCard) {
    topCardStyle = {
      transform: `translate3d(${flyingCard.x}px, ${flyingCard.y}px, 0) rotate(${flyingCard.rotate}deg)`,
      opacity: 0,
      transition: 'transform 0.28s ease-out, opacity 0.28s ease-out',
      pointerEvents: 'none',
    };
  } else if (isDragging) {
    topCardStyle = {
      transform: `translate3d(${dragOffset.x}px, ${dragOffset.y}px, 0) rotate(${dragOffset.x * 0.04}deg)`,
      transition: 'none',
    };
  } else {
    topCardStyle = {
      transform: 'translate3d(0, 0, 0) rotate(0deg)',
      transition: 'transform 0.32s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
    };
  }

  // Stamp opacities
  const likeStampOpacity = !flyingCard && dragOffset.x > 20 ? Math.min((dragOffset.x - 20) / 75, 1) : 0;
  const passStampOpacity = !flyingCard && dragOffset.x < -20 ? Math.min((-dragOffset.x - 20) / 75, 1) : 0;
  const superStampOpacity =
    !flyingCard && canSuperLike && dragOffset.y < -35 && Math.abs(dragOffset.x) < 70
      ? Math.min((-dragOffset.y - 35) / 75, 1)
      : 0;

  // Background card subtle responsive scaling
  const dragMagnitude = Math.min(Math.abs(dragOffset.x) / 900, 0.05);

  return (
    <div className="page">
      {/* Top Professional Header with Center Brand Logo */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          maxWidth: '440px',
          margin: '0 auto 1rem auto',
          padding: '0.2rem 0',
          position: 'relative',
        }}
      >
        {/* Left spacer for symmetric centering */}
        <div style={{ width: '42px', display: 'flex', justifyContent: 'flex-start' }} />

        {/* Top Middle Logo — Professional Presentation */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            userSelect: 'none',
          }}
          onClick={loadDeckAndProfile}
          title="CampusHinge — Tap to refresh deck"
        >
          <div
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* Subtle brand glow behind logo */}
            <div
              style={{
                position: 'absolute',
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(255, 64, 129, 0.45) 0%, rgba(255, 112, 67, 0.2) 60%, transparent 80%)',
                filter: 'blur(12px)',
                zIndex: 0,
                pointerEvents: 'none',
              }}
            />
            <img
              src="/campushinge-logo.jpg"
              alt="CampusHinge"
              style={{
                height: '56px',
                width: '56px',
                borderRadius: '16px',
                objectFit: 'cover',
                position: 'relative',
                zIndex: 1,
                border: '1.5px solid rgba(255, 64, 129, 0.35)',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.6), 0 0 24px rgba(255, 64, 129, 0.25)',
                transition: 'transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.25s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.06)';
                e.currentTarget.style.boxShadow = '0 6px 24px rgba(255, 64, 129, 0.45), 0 0 32px rgba(255, 112, 67, 0.35)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.6), 0 0 24px rgba(255, 64, 129, 0.25)';
              }}
            />
          </div>
          <span
            style={{
              marginTop: '0.35rem',
              fontSize: '0.98rem',
              fontWeight: 800,
              letterSpacing: '0.02em',
              background: 'linear-gradient(135deg, #ff4081 0%, #ff6e40 50%, #ffa726 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              textShadow: '0 2px 10px rgba(255, 64, 129, 0.2)',
            }}
          >
            CampusHinge
          </span>
        </div>

        {/* Right refresh button */}
        <div style={{ width: '42px', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={loadDeckAndProfile}
            disabled={refreshing}
            title="Refresh deck"
            aria-label="Refresh deck"
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--glass-border)',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: refreshing ? 'default' : 'pointer',
              fontSize: '1.2rem',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              if (!refreshing) {
                e.currentTarget.style.borderColor = 'var(--primary-pink)';
                e.currentTarget.style.color = '#fff';
                e.currentTarget.style.boxShadow = '0 0 12px var(--accent-glow)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--glass-border)';
              e.currentTarget.style.color = 'var(--text-muted)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <span
              style={{
                display: 'inline-block',
                transform: refreshing ? 'rotate(360deg)' : 'none',
                transition: 'transform 0.6s ease',
              }}
            >
              ↻
            </span>
          </button>
        </div>
      </div>

      {swipeMsg && <p className="success" style={{ marginBottom: '1rem', textAlign: 'center' }}>{swipeMsg}</p>}
      {error && <p className="error" style={{ marginBottom: '1rem' }}>{error}</p>}

      {loading && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ color: 'var(--text-muted)' }}>Finding campus matches…</p>
        </div>
      )}

      {/* EMPTY STATE: Displayed when all profiles are seen */}
      {!loading && deck.length === 0 && (
        <div
          className="glass-card"
          style={{
            textAlign: 'center',
            padding: '3rem 1.75rem',
            margin: 'auto 0',
            maxWidth: '440px',
            width: '100%',
          }}
        >
          <div className="empty-state-beacon">
            <div className="beacon-pulse" />
            <div className="beacon-pulse" />
            <div className="beacon-pulse" />
            <div className="beacon-core">
              ✨
            </div>
          </div>
          <h2 style={{ fontSize: '1.45rem', marginBottom: '0.6rem', color: '#fff' }}>
            You've seen everyone for now
          </h2>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1.75rem', lineHeight: '1.55' }}>
            You're all caught up! Check back soon for new campus profiles, or refresh to see if new students joined.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem', maxWidth: '280px', margin: '0 auto' }}>
            <button
              className="btn-primary"
              onClick={loadDeckAndProfile}
              disabled={refreshing}
              style={{
                padding: '0.85rem 1.25rem',
                fontSize: '0.92rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                cursor: 'pointer',
              }}
            >
              ↻ Check for New Profiles
            </button>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '1.25rem', marginTop: '0.4rem' }}>
              <Link to="/matches" style={{ fontSize: '0.84rem', color: 'var(--primary-pink)', fontWeight: 600 }}>
                View Matches →
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* STACKED HINGE-STYLE CARD DECK */}
      {!loading && deck.length > 0 && (
        <div className="deck-container">
          <div className="deck-stack">
            {/* Card 2 (Bottom card if available) */}
            {deck[2] && (
              <RenderDeckCard
                profile={deck[2]}
                depth={2}
              />
            )}

            {/* Card 1 (Underneath top card) */}
            {deck[1] && (
              <RenderDeckCard
                profile={deck[1]}
                depth={1}
                dynamicScale={0.95 + dragMagnitude}
              />
            )}

            {/* Top Card (Interactive Deck 0) */}
            {topProfile && (
              <div
                className="swipe-card card-depth-0"
                style={topCardStyle}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerCancel}
              >
                {/* Visual Feedback Stamps */}
                <div
                  className="swipe-stamp swipe-stamp-like"
                  style={{ opacity: flyingCard?.direction === 'like' ? 1 : likeStampOpacity }}
                >
                  LIKE
                </div>
                <div
                  className="swipe-stamp swipe-stamp-pass"
                  style={{ opacity: flyingCard?.direction === 'pass' ? 1 : passStampOpacity }}
                >
                  NOPE
                </div>
                {canSuperLike && (
                  <div
                    className="swipe-stamp swipe-stamp-super"
                    style={{ opacity: flyingCard?.direction === 'super_like' ? 1 : superStampOpacity }}
                  >
                    SUPER LIKE
                  </div>
                )}

                {/* Main Photo Display */}
                {topPhotos.length > 0 ? (
                  <img
                    src={getPhotoUrl(topPhotos[topCardPhotoIndex] || topPhotos[0])}
                    alt={topProfile.name}
                    className="swipe-card-img"
                    draggable={false}
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
                      color: 'var(--text-dim)',
                    }}
                  >
                    👤
                  </div>
                )}

                {/* Photo Pagination Indicator Bars */}
                {topPhotos.length > 1 && (
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
                    {topPhotos.map((_, idx) => (
                      <div
                        key={idx}
                        className="photo-indicator"
                        onClick={(e) => {
                          e.stopPropagation();
                          setTopCardPhotoIndex(idx);
                        }}
                        style={{
                          flex: 1,
                          height: '4px',
                          borderRadius: '2px',
                          background: idx === topCardPhotoIndex ? '#fff' : 'rgba(255, 255, 255, 0.4)',
                          boxShadow: idx === topCardPhotoIndex ? '0 0 6px rgba(255,255,255,0.8)' : 'none',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                        }}
                      />
                    ))}
                  </div>
                )}

                {/* Info / View Full Profile Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDetailProfile(topProfile);
                  }}
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
                {typeof topProfile.compatibility_score === 'number' && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '52px',
                      right: '10px',
                      background:
                        topProfile.compatibility_score >= 70
                          ? 'linear-gradient(135deg, #00e676, #00c853)'
                          : topProfile.compatibility_score >= 40
                          ? 'linear-gradient(135deg, #ff9800, #f57c00)'
                          : 'linear-gradient(135deg, #78909c, #546e7a)',
                      color: '#fff',
                      borderRadius: '12px',
                      padding: '0.25rem 0.6rem',
                      fontSize: '0.78rem',
                      fontWeight: '700',
                      zIndex: 25,
                      boxShadow:
                        topProfile.compatibility_score >= 70
                          ? '0 2px 12px rgba(0, 230, 118, 0.5)'
                          : '0 2px 8px rgba(0,0,0,0.4)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      letterSpacing: '0.02em',
                    }}
                    title={
                      topProfile.compatibility_breakdown
                        ? `Interest: ${topProfile.compatibility_breakdown.interest}% | Behavioral: ${topProfile.compatibility_breakdown.behavioral}% | Freshness: ${topProfile.compatibility_breakdown.freshness}%`
                        : `${topProfile.compatibility_score}% compatible`
                    }
                  >
                    {topProfile.compatibility_score >= 70 ? '💚' : topProfile.compatibility_score >= 40 ? '🧡' : '🤍'}
                    {topProfile.compatibility_score}%
                  </div>
                )}

                {/* Left & Right Arrow Buttons for Photo Cycling */}
                {topPhotos.length > 1 && (
                  <>
                    <button
                      className="photo-nav-btn"
                      onClick={handlePrevPhoto}
                      aria-label="Previous Photo"
                      style={{
                        position: 'absolute',
                        left: '8px',
                        top: '40%',
                        transform: 'translateY(-50%)',
                        background: 'rgba(0,0,0,0.38)',
                        border: 'none',
                        color: '#fff',
                        borderRadius: '50%',
                        width: '32px',
                        height: '32px',
                        zIndex: 22,
                        cursor: 'pointer',
                        fontSize: '1.25rem',
                        lineHeight: '1',
                      }}
                    >
                      ‹
                    </button>
                    <button
                      className="photo-nav-btn"
                      onClick={handleNextPhoto}
                      aria-label="Next Photo"
                      style={{
                        position: 'absolute',
                        right: '8px',
                        top: '40%',
                        transform: 'translateY(-50%)',
                        background: 'rgba(0,0,0,0.38)',
                        border: 'none',
                        color: '#fff',
                        borderRadius: '50%',
                        width: '32px',
                        height: '32px',
                        zIndex: 22,
                        cursor: 'pointer',
                        fontSize: '1.25rem',
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
                      <h2 style={{ margin: 0, fontSize: '1.5rem' }}>{topProfile.name || 'Campus Student'}</h2>
                      {topProfile.year && (
                        <span className="swipe-card-badge">Passout {String(topProfile.year).slice(-2)}</span>
                      )}
                      {typeof topProfile.compatibility_score === 'number' && topProfile.compatibility_score >= 70 && (
                        <span
                          style={{
                            background: 'linear-gradient(135deg, rgba(0, 230, 118, 0.2), rgba(0, 200, 83, 0.2))',
                            border: '1px solid rgba(0, 230, 118, 0.4)',
                            color: '#00e676',
                            padding: '0.15rem 0.55rem',
                            borderRadius: 'var(--radius-full)',
                            fontSize: '0.72rem',
                            fontWeight: '700',
                          }}
                        >
                          ✨ Great Match
                        </span>
                      )}
                    </div>
                    {topPhotos.length > 1 && (
                      <span
                        style={{
                          fontSize: '0.75rem',
                          color: 'rgba(255,255,255,0.7)',
                          background: 'rgba(0,0,0,0.4)',
                          padding: '0.15rem 0.5rem',
                          borderRadius: '10px',
                        }}
                      >
                        📷 {topCardPhotoIndex + 1}/{topPhotos.length}
                      </span>
                    )}
                  </div>

                  {topBioText && (
                    <div style={{ marginBottom: '0.5rem' }}>
                      <p
                        style={{
                          color: 'rgba(255,255,255,0.9)',
                          fontSize: '0.88rem',
                          margin: 0,
                          lineHeight: '1.45',
                          wordBreak: 'break-word',
                        }}
                      >
                        <span>{displayedTopBio}</span>
                        {isTopBioLong && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedBioProfileId(isBioExpanded ? null : topProfileId);
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--primary-pink, #ff4081)',
                              fontWeight: 700,
                              cursor: 'pointer',
                              padding: '0 0 0 0.35rem',
                              fontSize: '0.85rem',
                              display: 'inline',
                              textDecoration: 'underline',
                            }}
                          >
                            {isBioExpanded ? 'See less' : '... See more'}
                          </button>
                        )}
                      </p>
                    </div>
                  )}

                  {/* View Full Profile Trigger Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDetailProfile(topProfile);
                    }}
                    style={{
                      marginTop: '0.4rem',
                      background: 'none',
                      border: 'none',
                      color: 'rgba(255,255,255,0.85)',
                      fontSize: '0.82rem',
                      textDecoration: 'underline',
                      cursor: 'pointer',
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                    }}
                  >
                    <span>🔍 Tap for full profile, matching interests &amp; photos</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ACTION BUTTONS (Synchronized with Card Transition) */}
          <div className="swipe-actions" style={{ flexDirection: 'column', alignItems: 'center', width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1.25rem' }}>
              <button
                className="action-btn action-pass"
                onClick={() => performSwipe('pass')}
                disabled={Boolean(flyingCard)}
                aria-label="Pass"
                style={{ cursor: flyingCard ? 'default' : 'pointer' }}
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              {/* Super Like Button — ONLY unlocked when 4+ interests match */}
              {canSuperLike && (
                <button
                  className="action-btn action-super-like"
                  onClick={() => superLikeStatus.available && performSwipe('super_like')}
                  disabled={!superLikeStatus.available || Boolean(flyingCard)}
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
                    cursor: superLikeStatus.available && !flyingCard ? 'pointer' : 'not-allowed',
                  }}
                >
                  ⭐
                </button>
              )}

              <button
                className="action-btn action-like"
                onClick={() => performSwipe('like')}
                disabled={Boolean(flyingCard)}
                aria-label="Like"
                style={{ cursor: flyingCard ? 'default' : 'pointer' }}
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
                </svg>
              </button>
            </div>

            {/* Super Like Status & Cooldown Notice */}
            {canSuperLike && !superLikeStatus.available && superLikeStatus.next_available_in_seconds > 0 && (
              <span style={{ fontSize: '0.75rem', color: '#ffd700', marginTop: '0.4rem', fontWeight: '600' }}>
                Next Super Like available in {formatCooldown(superLikeStatus.next_available_in_seconds)}
              </span>
            )}
            {canSuperLike && superLikeStatus.available && (
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
          canSuperLike={canSuperLike}
          superLikeAvailable={superLikeStatus.available}
          superLikeCooldownText={formatCooldown(superLikeStatus.next_available_in_seconds)}
          onClose={() => setDetailProfile(null)}
          onSwipe={(action) => {
            setDetailProfile(null);
            performSwipe(action);
          }}
        />
      )}
    </div>
  );
}

/**
 * RenderDeckCard — Displays stacked cards underneath the active card
 * Provides visual depth and continuous deck perception
 */
function RenderDeckCard({ profile, depth, dynamicScale }) {
  let photos = [];
  if (Array.isArray(profile.photos)) photos = profile.photos;
  else if (typeof profile.photos === 'string') {
    try {
      photos = JSON.parse(profile.photos);
    } catch {
      photos = [];
    }
  }

  const customStyle =
    depth === 1 && dynamicScale
      ? { transform: `scale(${dynamicScale}) translateY(12px)` }
      : {};

  return (
    <div className={`swipe-card card-depth-${depth}`} style={customStyle}>
      {photos.length > 0 ? (
        <img
          src={getPhotoUrl(photos[0])}
          alt={profile.name}
          className="swipe-card-img"
          draggable={false}
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
            color: 'var(--text-dim)',
          }}
        >
          👤
        </div>
      )}

      <div className="swipe-card-gradient" />

      <div className="swipe-card-info" style={{ zIndex: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.2rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.5rem' }}>{profile.name || 'Campus Student'}</h2>
          {profile.year && (
            <span className="swipe-card-badge">Passout {String(profile.year).slice(-2)}</span>
          )}
        </div>

        {profile.bio && (
          <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.88rem', marginBottom: '0.5rem' }}>
            {(() => {
              const bText = profile.bio.trim();
              const bWords = bText.split(/\s+/);
              return bWords.length > 10 || bText.length > 60
                ? bWords.slice(0, 10).join(' ') + '...'
                : bText;
            })()}
          </p>
        )}
      </div>
    </div>
  );
}
