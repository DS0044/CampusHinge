import { useState } from 'react';
import { getPhotoUrl } from '../api';

export default function DiscoverProfileModal({
  profile,
  myInterests = [],
  canSuperLike = false,
  superLikeAvailable = true,
  superLikeCooldownText = '',
  onClose,
  onSwipe,
}) {
  const [photoIndex, setPhotoIndex] = useState(0);

  if (!profile) return null;

  // Handle photos
  let photosList = [];
  if (Array.isArray(profile.photos)) {
    photosList = profile.photos;
  } else if (typeof profile.photos === 'string') {
    try { photosList = JSON.parse(profile.photos); } catch { photosList = []; }
  }

  // Handle interests
  let candidateInterests = [];
  if (Array.isArray(profile.interests)) {
    candidateInterests = profile.interests;
  } else if (typeof profile.interests === 'string') {
    try { candidateInterests = JSON.parse(profile.interests); } catch { candidateInterests = []; }
  }

  // Calculate shared interests
  const userInterests = Array.isArray(myInterests) ? myInterests : [];
  const sharedInterests = candidateInterests.filter((tag) => userInterests.includes(tag));
  const nonSharedInterests = candidateInterests.filter((tag) => !userInterests.includes(tag));

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
        className="glass-card"
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
          }}
        >
          ×
        </button>

        {/* Photo Gallery / Carousel — 100% CLEAR, UNGATED */}
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

          {/* Photo Pagination Indicators */}
          {totalPhotos > 1 && (
            <div
              style={{
                position: 'absolute',
                top: '12px',
                left: '12px',
                right: '50px',
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
              {/* Arrow Buttons */}
              <button
                onClick={prevPhoto}
                aria-label="Previous Photo"
                style={{
                  position: 'absolute',
                  left: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'rgba(0,0,0,0.4)',
                  border: 'none',
                  color: '#fff',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  zIndex: 20,
                  cursor: 'pointer',
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
                  background: 'rgba(0,0,0,0.4)',
                  border: 'none',
                  color: '#fff',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  zIndex: 20,
                  cursor: 'pointer',
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

        {/* Profile Content Body */}
        <div style={{ padding: '1.25rem' }}>
          {/* Header */}
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: '1.5rem', margin: 0, color: '#fff' }}>{profile.name}</h2>
              {profile.year && (
                <span
                  style={{
                    background: 'var(--primary-gradient)',
                    padding: '0.25rem 0.65rem',
                    borderRadius: 'var(--radius-full)',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: '#fff',
                  }}
                >
                  Class of '{String(profile.year).slice(-2)}
                </span>
              )}
            </div>
          </div>

          {/* About / Bio */}
          {profile.bio && (
            <div style={{ marginBottom: '1.2rem' }}>
              <h4
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: '0.4rem',
                }}
              >
                About
              </h4>
              <p
                style={{
                  color: 'rgba(255, 255, 255, 0.9)',
                  fontSize: '0.95rem',
                  lineHeight: '1.5',
                  whiteSpace: 'pre-line',
                }}
              >
                {profile.bio}
              </p>
            </div>
          )}

          {/* Interests & Shared Interests Section */}
          {candidateInterests.length > 0 && (
            <div style={{ marginBottom: '1.5rem' }}>
              <h4
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: '0.6rem',
                }}
              >
                Interests
              </h4>

              {/* Shared Interests Banner (Only if sharedInterests > 0) */}
              {sharedInterests.length > 0 && (
                <div
                  style={{
                    background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.2) 0%, rgba(168, 85, 247, 0.2) 100%)',
                    border: '1px solid rgba(244, 114, 182, 0.4)',
                    borderRadius: 'var(--radius-md)',
                    padding: '0.75rem 1rem',
                    marginBottom: '0.8rem',
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
                    <span>✨</span> You both like ({sharedInterests.length})
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                    {sharedInterests.map((tag, idx) => (
                      <span
                        key={idx}
                        style={{
                          background: 'linear-gradient(135deg, #ec4899 0%, #a855f7 100%)',
                          border: '1px solid rgba(244, 114, 182, 0.6)',
                          color: '#fff',
                          padding: '0.3rem 0.75rem',
                          borderRadius: 'var(--radius-full)',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          boxShadow: '0 2px 8px rgba(236, 72, 153, 0.3)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                        }}
                      >
                        <span>✨</span>
                        <span>{tag}</span>
                        <span style={{ opacity: 0.85, fontSize: '0.7rem' }}>(in common)</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Other Candidate Interests */}
              {nonSharedInterests.length > 0 && (
                <div>
                  {sharedInterests.length > 0 && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                      Other interests:
                    </div>
                  )}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                    {nonSharedInterests.map((tag, idx) => (
                      <span
                        key={idx}
                        style={{
                          background: 'rgba(255, 255, 255, 0.1)',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                          color: 'rgba(255, 255, 255, 0.85)',
                          padding: '0.25rem 0.65rem',
                          borderRadius: 'var(--radius-full)',
                          fontSize: '0.78rem',
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons (Pass / Super Like / Like) directly in detail modal */}
          {onSwipe && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  className="btn-secondary"
                  onClick={() => {
                    onSwipe('pass');
                    onClose();
                  }}
                  style={{ flex: 1, padding: '0.75rem', fontSize: '0.95rem' }}
                >
                  ✕ Pass
                </button>
                {canSuperLike && (
                  <button
                    className="btn-primary"
                    disabled={!superLikeAvailable}
                    onClick={() => {
                      if (superLikeAvailable) {
                        onSwipe('super_like');
                        onClose();
                      }
                    }}
                    style={{
                      flex: 1.2,
                      padding: '0.75rem',
                      fontSize: '0.95rem',
                      background: superLikeAvailable ? 'linear-gradient(135deg, #ffd700 0%, #ff8c00 100%)' : 'rgba(255,215,0,0.15)',
                      color: superLikeAvailable ? '#000' : '#888',
                      fontWeight: '700',
                      border: '1px solid rgba(255,215,0,0.4)',
                      boxShadow: superLikeAvailable ? '0 4px 15px rgba(255,215,0,0.35)' : 'none',
                      cursor: superLikeAvailable ? 'pointer' : 'not-allowed',
                    }}
                  >
                    ⭐ Super Like
                  </button>
                )}
                <button
                  className="btn-primary"
                  onClick={() => {
                    onSwipe('like');
                    onClose();
                  }}
                  style={{ flex: 1, padding: '0.75rem', fontSize: '0.95rem' }}
                >
                  💖 Like
                </button>
              </div>
              {canSuperLike && !superLikeAvailable && superLikeCooldownText && (
                <span style={{ fontSize: '0.75rem', color: '#ffd700', textAlign: 'center', fontWeight: '600' }}>
                  Next Super Like available in {superLikeCooldownText}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
