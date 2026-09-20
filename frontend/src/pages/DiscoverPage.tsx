import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { discoverApi, swipeApi, profileApi, getPhotoUrl } from '../api';
import DiscoverProfileModal from '../components/DiscoverProfileModal';
import { Profile, SwipeAction } from '../types';
import { INTENTS, IntentType, INTENT_CONFIGS, getIntentConfig } from '../constants/intents';

interface DiscoverProfile extends Profile {
  compatibility_score?: number;
  compatibility_breakdown?: {
    interest: number;
    behavioral: number;
    freshness: number;
  };
  shared_interests?: string[];
  shared_activity_tags?: string[];
  intent_score?: number;
  is_fallback?: boolean;
  can_super_like?: boolean;
  super_like_reason?: string;
}

interface SuperLikeStatus {
  available: boolean;
  next_available_in_seconds: number;
  last_super_like_at: string | null;
}

interface FlyingCardState {
  profile: DiscoverProfile;
  direction: 'like' | 'pass' | 'super_like';
  x: number;
  y: number;
  rotate: number;
}

export default function DiscoverPage(): React.ReactNode {
  const [deck, setDeck] = useState<DiscoverProfile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [swipeMsg, setSwipeMsg] = useState<string>('');
  const [activeIntent, setActiveIntent] = useState<IntentType>('dating');
  const [myInterests, setMyInterests] = useState<string[]>([]);
  const [myActivityTags, setMyActivityTags] = useState<string[]>([]);
  const [myBranch, setMyBranch] = useState<string>('');
  const [myYear, setMyYear] = useState<number | null>(null);

  // Intent Switcher and confirmation modals
  const [showIntentModal, setShowIntentModal] = useState<boolean>(false);
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [confirmPendingIntent, setConfirmPendingIntent] = useState<IntentType | null>(null);

  const [topCardPhotoIndex, setTopCardPhotoIndex] = useState<number>(0);
  const [detailProfile, setDetailProfile] = useState<DiscoverProfile | null>(null);
  const [expandedBioProfileId, setExpandedBioProfileId] = useState<string | null>(null);

  // Gesture drag & flying animation state
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [flyingCard, setFlyingCard] = useState<FlyingCardState | null>(null);

  const [superLikeStatus, setSuperLikeStatus] = useState<SuperLikeStatus>({
    available: true,
    next_available_in_seconds: 0,
    last_super_like_at: null,
  });

  const pointerStartRef = useRef<{
    pointerId: number;
    x: number;
    y: number;
    target: HTMLElement;
    rect: DOMRect;
    time: number;
  } | null>(null);
  const isDraggingRef = useRef<boolean>(false);
  const isFetchingMoreRef = useRef<boolean>(false);
  const hasMoreRef = useRef<boolean>(true);
  const swipesInSessionRef = useRef<number>(0);

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

  // Buffer preloading & queue cycling: when remaining cards drop to <= 3, fetch more in the background
  useEffect(() => {
    if (deck.length > 3 || isFetchingMoreRef.current || !hasMoreRef.current || loading) return;

    async function fetchMore() {
      isFetchingMoreRef.current = true;
      try {
        const res = await discoverApi.getDeck(activeIntent);
        const incoming = (res.data as any)?.profiles || res.data || [];
        if (!Array.isArray(incoming) || incoming.length === 0) {
          hasMoreRef.current = false;
        } else {
          setDeck((prevDeck) => {
            if (prevDeck.length === 0) {
              return incoming;
            }
            const currentIds = new Set(prevDeck.map((p) => p.user_id || p.id));
            const fresh = incoming.filter((p: DiscoverProfile) => !currentIds.has(p.user_id || p.id));
            if (fresh.length === 0) {
              return prevDeck;
            }
            return [...prevDeck, ...fresh];
          });
        }
      } catch (err: any) {
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
      let photos: string[] = [];
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

  function formatCooldown(seconds: number): string {
    if (!seconds || seconds <= 0) return '';
    const hours = Math.floor(seconds / 3600);
    const mins = Math.ceil((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  }

  async function loadDeckAndProfile(intentOverride?: IntentType): Promise<void> {
    setLoading(true);
    setRefreshing(true);
    setError('');
    hasMoreRef.current = true;
    try {
      const targetIntent = intentOverride || activeIntent;
      const [deckRes, myProfileRes] = await Promise.all([
        discoverApi.getDeck(targetIntent),
        profileApi.getMyProfile().catch(() => ({ data: null })),
      ]);

      const resolvedDeckIntent = (deckRes.data as any)?.active_intent || targetIntent;
      setActiveIntent(resolvedDeckIntent);

      const profilesList = (deckRes.data as any)?.profiles || deckRes.data || [];
      setDeck(Array.isArray(profilesList) ? profilesList : []);
      setTopCardPhotoIndex(0);

      if ((deckRes.data as any)?.super_like) {
        setSuperLikeStatus((deckRes.data as any).super_like);
      }

      const p = myProfileRes?.data?.profile || (myProfileRes?.data as any);
      if (p) {
        if (p.interests) {
          let parsed: string[] = [];
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
        if (p.activity_tags) {
          let parsedAct: string[] = [];
          if (Array.isArray(p.activity_tags)) parsedAct = p.activity_tags;
          else if (typeof p.activity_tags === 'string') {
            try {
              parsedAct = JSON.parse(p.activity_tags);
            } catch {
              parsedAct = [];
            }
          }
          setMyActivityTags(parsedAct);
        }
        if (p.branch) setMyBranch(p.branch);
        if (p.year) setMyYear(p.year);
        if (!intentOverride && p.active_intent) {
          setActiveIntent(p.active_intent);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Error loading discovery deck');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function handleRequestIntentSwitch(newIntent: IntentType): void {
    if (newIntent === activeIntent) {
      setShowIntentModal(false);
      return;
    }
    // Confirm before switching if user has active swiping session in progress
    if (swipesInSessionRef.current > 0 && deck.length > 0) {
      setConfirmPendingIntent(newIntent);
      setShowConfirmModal(true);
      setShowIntentModal(false);
    } else {
      executeIntentSwitch(newIntent);
      setShowIntentModal(false);
    }
  }

  function executeIntentSwitch(newIntent: IntentType): void {
    setActiveIntent(newIntent);
    swipesInSessionRef.current = 0;
    profileApi.updateIntent(newIntent).catch(() => {});
    loadDeckAndProfile(newIntent);
  }

  // Perform card swipe animation and dispatch background API request
  const performSwipe = useCallback(
    (action: 'like' | 'pass' | 'super_like') => {
      const current = deck[0];
      if (!current || flyingCard) return;

      const targetId = current.user_id || current.id;
      if (!targetId) return;
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

      swipesInSessionRef.current += 1;

      // Async backend call with active intent context
      swipeApi
        .swipe(targetId, action, activeIntent)
        .then((res) => {
          const cfg = INTENT_CONFIGS[activeIntent];
          if (res.data?.matched) {
            setSwipeMsg(`🎉 It's a Match with ${current.name || 'someone'} (${cfg.label})!`);
          } else if (action === 'super_like') {
            setSwipeMsg(`⭐ Sent ${cfg.superLikeLabel} to ${current.name || 'someone'}!`);
          } else if (action === 'like') {
            setSwipeMsg(`Sent ${cfg.likeLabel} to ${current.name || 'someone'}!`);
          }
        })
        .catch((err: any) => {
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
        setDeck((prev) => {
          const nextDeck = prev.slice(1);
          if (nextDeck.length === 0) {
            hasMoreRef.current = true;
          }
          return nextDeck;
        });
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

  let topPhotos: string[] = [];
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

  let topInterests: string[] = [];
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

  const activeConfig = getIntentConfig(activeIntent);

  const canSuperLike = topProfile?.can_super_like !== undefined
    ? Boolean(topProfile.can_super_like)
    : (sharedInterests.length >= 4);

  const handlePrevPhoto = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (topPhotos.length <= 1) return;
    setTopCardPhotoIndex((prev) => (prev > 0 ? prev - 1 : topPhotos.length - 1));
  };

  const handleNextPhoto = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (topPhotos.length <= 1) return;
    setTopCardPhotoIndex((prev) => (prev < topPhotos.length - 1 ? prev + 1 : 0));
  };

  // Pointer gesture handlers (mouse + touch)
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (flyingCard || !topProfile) return;
    if (e.button !== undefined && e.button !== 0) return;
    if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('.photo-nav-btn')) return;

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

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
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

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
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
        handlePrevPhoto(e as any);
      } else if (clickX > width * 0.65) {
        handleNextPhoto(e as any);
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
  let topCardStyle: React.CSSProperties = {};
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
            onClick={() => loadDeckAndProfile()}
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

      {/* Active Intent Header Pill */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.85rem' }}>
        <button
          type="button"
          onClick={() => setShowIntentModal(true)}
          style={{
            background: activeConfig.badgeBg,
            border: `1.5px solid ${activeConfig.badgeBorder}`,
            color: '#fff',
            padding: '0.35rem 1rem',
            borderRadius: 'var(--radius-full)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            cursor: 'pointer',
            fontSize: '0.82rem',
            fontWeight: '600',
            boxShadow: `0 2px 14px ${activeConfig.badgeBg}`,
            transition: 'all 0.2s ease',
          }}
          title="Tap to switch campus matching intent"
        >
          <span style={{ fontSize: '1.05rem' }}>{activeConfig.icon}</span>
          <span>Discovering: <strong style={{ color: activeConfig.color }}>{activeConfig.discoverPill}</strong></span>
          <span style={{ fontSize: '0.72rem', opacity: 0.75, marginLeft: '0.2rem' }}>▾ Switch</span>
        </button>
      </div>

      {swipeMsg && <p className="success" style={{ marginBottom: '1rem', textAlign: 'center' }}>{swipeMsg}</p>}
      {error && <p className="error" style={{ marginBottom: '1rem' }}>{error}</p>}

      {loading && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ color: 'var(--text-muted)' }}>Finding campus matches for {activeConfig.label}…</p>
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
              {activeConfig.icon}
            </div>
          </div>
          <h2 style={{ fontSize: '1.45rem', marginBottom: '0.6rem', color: '#fff' }}>
            No more {activeConfig.discoverPill} for now
          </h2>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1.75rem', lineHeight: '1.55' }}>
            You've reviewed all candidates currently in {activeConfig.label} mode. You can check back soon, refresh, or switch your intent to explore other campus modes!
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', maxWidth: '280px', margin: '0 auto' }}>
            <button
              className="btn-primary"
              onClick={() => loadDeckAndProfile()}
              disabled={refreshing}
              style={{
                padding: '0.8rem 1.25rem',
                fontSize: '0.9rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                cursor: 'pointer',
              }}
            >
              ↻ Refresh {activeConfig.label} Deck
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setShowIntentModal(true)}
              style={{
                padding: '0.8rem 1.25rem',
                fontSize: '0.88rem',
              }}
            >
              🔄 Switch Matching Intent
            </button>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '1.25rem', marginTop: '0.3rem' }}>
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
                  {activeConfig.likeLabel.toUpperCase()}
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
                    {activeConfig.superLikeLabel.toUpperCase()}
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

          {/* ACTION BUTTONS (Intent-Aware) */}
          <div className="swipe-actions" style={{ flexDirection: 'column', alignItems: 'center', width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1.25rem' }}>
              <button
                className="action-btn action-pass"
                onClick={() => performSwipe('pass')}
                disabled={Boolean(flyingCard)}
                aria-label="Pass"
                title="Pass"
                style={{ cursor: flyingCard ? 'default' : 'pointer' }}
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              {/* Super Like Button — Unlocked per Intent Rules */}
              {canSuperLike && (
                <button
                  className="action-btn action-super-like"
                  onClick={() => superLikeStatus.available && performSwipe('super_like')}
                  disabled={!superLikeStatus.available || Boolean(flyingCard)}
                  title={
                    superLikeStatus.available
                      ? `${activeConfig.superLikeLabel}`
                      : `Next Super Like available in ${formatCooldown(superLikeStatus.next_available_in_seconds)}`
                  }
                  aria-label={activeConfig.superLikeLabel}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.5rem',
                    cursor: superLikeStatus.available && !flyingCard ? 'pointer' : 'not-allowed',
                  }}
                >
                  {activeConfig.superLikeIcon}
                </button>
              )}

              {/* Like / Wave / Study / Team Up / Connect Button */}
              <button
                className="action-btn action-like"
                onClick={() => performSwipe('like')}
                disabled={Boolean(flyingCard)}
                aria-label={activeConfig.likeLabel}
                title={activeConfig.likeLabel}
                style={{
                  cursor: flyingCard ? 'default' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.5rem',
                  background: `linear-gradient(135deg, ${activeConfig.color} 0%, var(--primary-pink) 100%)`,
                }}
              >
                {activeIntent === 'dating' ? (
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
                  </svg>
                ) : (
                  <span>{activeConfig.likeIcon}</span>
                )}
              </button>
            </div>

            {/* Super Like Status Notice */}
            {canSuperLike && !superLikeStatus.available && superLikeStatus.next_available_in_seconds > 0 && (
              <span style={{ fontSize: '0.75rem', color: '#ffd700', marginTop: '0.4rem', fontWeight: '600' }}>
                Next {activeConfig.superLikeLabel} available in {formatCooldown(superLikeStatus.next_available_in_seconds)}
              </span>
            )}
            {canSuperLike && superLikeStatus.available && (
              <span style={{ fontSize: '0.74rem', color: '#ffd700', marginTop: '0.4rem', fontWeight: '700', letterSpacing: '0.02em' }}>
                ⭐ {activeConfig.superLikeLabel} Unlocked!
              </span>
            )}
            {!canSuperLike && (
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.35rem', textAlign: 'center' }}>
                {topProfile?.super_like_reason || activeConfig.superLikeUnlockHint}
              </span>
            )}
          </div>
        </div>
      )}

      {/* INTENT SWITCHER MODAL */}
      {showIntentModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(5, 6, 12, 0.85)',
            backdropFilter: 'blur(12px)',
            zIndex: 1100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
          onClick={() => setShowIntentModal(false)}
        >
          <div
            className="glass-card"
            style={{
              width: '100%',
              maxWidth: '420px',
              padding: '1.5rem',
              borderRadius: 'var(--radius-lg)',
              background: '#111420',
              border: '1px solid rgba(255,255,255,0.15)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#fff', fontWeight: 700 }}>
                Campus Discovery Mode
              </h3>
              <button
                type="button"
                onClick={() => setShowIntentModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: '1.2rem',
                  cursor: 'pointer',
                }}
              >
                ✕
              </button>
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '1.1rem', lineHeight: '1.4' }}>
              Switching your mode adjusts your Discover deck ranking and like actions. Your past matches retain their original intent snapshot.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {INTENTS.map((intentKey) => {
                const cfg = INTENT_CONFIGS[intentKey];
                const isCurrent = activeIntent === intentKey;
                return (
                  <button
                    key={intentKey}
                    type="button"
                    onClick={() => handleRequestIntentSwitch(intentKey)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.9rem',
                      padding: '0.75rem 0.9rem',
                      borderRadius: 'var(--radius-md)',
                      background: isCurrent ? cfg.badgeBg : 'rgba(255,255,255,0.04)',
                      border: `1.5px solid ${isCurrent ? cfg.color : 'rgba(255,255,255,0.08)'}`,
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span style={{ fontSize: '1.5rem' }}>{cfg.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span style={{ fontSize: '0.95rem', fontWeight: 700, color: isCurrent ? cfg.color : '#fff' }}>
                          {cfg.label}
                        </span>
                        {isCurrent && (
                          <span style={{
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            color: cfg.color,
                            background: cfg.badgeBg,
                            padding: '0.1rem 0.45rem',
                            borderRadius: 'var(--radius-full)',
                            border: `1px solid ${cfg.color}`,
                          }}>
                            ACTIVE
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.15rem' }}>
                        {cfg.description}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION BEFORE SWITCHING INTENT MID-SWIPE */}
      {showConfirmModal && confirmPendingIntent && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(5, 6, 12, 0.9)',
            backdropFilter: 'blur(16px)',
            zIndex: 1200,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
          onClick={() => setShowConfirmModal(false)}
        >
          <div
            className="glass-card"
            style={{
              width: '100%',
              maxWidth: '380px',
              padding: '1.5rem',
              borderRadius: 'var(--radius-lg)',
              background: '#131724',
              border: '1px solid rgba(255,255,255,0.2)',
              textAlign: 'center',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: '2.4rem', marginBottom: '0.6rem' }}>
              {INTENT_CONFIGS[confirmPendingIntent].icon}
            </div>
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.2rem', color: '#fff', fontWeight: 700 }}>
              Switch to {INTENT_CONFIGS[confirmPendingIntent].label} Mode?
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.4rem', lineHeight: '1.45' }}>
              You have an active Discover session in progress ({swipesInSessionRef.current} profiles reviewed). Switching mode now will refresh your deck with students looking for <strong>{INTENT_CONFIGS[confirmPendingIntent].label}</strong>.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowConfirmModal(false)}
                style={{ flex: 1, padding: '0.65rem' }}
              >
                Keep Current
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  setShowConfirmModal(false);
                  executeIntentSwitch(confirmPendingIntent);
                }}
                style={{
                  flex: 1.2,
                  padding: '0.65rem',
                  background: `linear-gradient(135deg, ${INTENT_CONFIGS[confirmPendingIntent].color} 0%, var(--primary-pink) 100%)`,
                }}
              >
                Switch Mode
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FULL UNGATED PROFILE DETAIL MODAL */}
      {detailProfile && (
        <DiscoverProfileModal
          profile={detailProfile}
          myInterests={myInterests}
          myActivityTags={myActivityTags}
          intent={activeIntent}
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
interface RenderDeckCardProps {
  profile: DiscoverProfile;
  depth: number;
  dynamicScale?: number;
}

function RenderDeckCard({ profile, depth, dynamicScale }: RenderDeckCardProps): React.ReactNode {
  let photos: string[] = [];
  if (Array.isArray(profile.photos)) photos = profile.photos;
  else if (typeof profile.photos === 'string') {
    try {
      photos = JSON.parse(profile.photos);
    } catch {
      photos = [];
    }
  }

  const customStyle: React.CSSProperties =
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
