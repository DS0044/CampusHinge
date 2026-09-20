import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { profileApi, logout, getPhotoUrl } from '../api';
import { PREDEFINED_INTERESTS, MAX_INTERESTS_LIMIT } from '../constants/interests';
import { INTENTS, IntentType, INTENT_CONFIGS, PREDEFINED_ACTIVITY_TAGS } from '../constants/intents';
import { Gender, InterestedIn } from '../types';

interface GenderOption {
  label: string;
  value: Gender;
}

interface InterestedOption {
  label: string;
  value: InterestedIn;
}

const GENDER_OPTIONS: GenderOption[] = [
  { label: 'Male', value: 'male' },
  { label: 'Female', value: 'female' },
  { label: 'Non-binary', value: 'non_binary' },
];

const INTERESTED_OPTIONS: InterestedOption[] = [
  { label: 'Male', value: 'male' },
  { label: 'Female', value: 'female' },
  { label: 'Everyone', value: 'everyone' },
];

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

interface PhotoItem {
  id: string;
  url?: string;
  file?: File;
  previewUrl: string;
}

interface ProfileFormState {
  name: string;
  bio: string;
  branch: string;
  year: string;
  gender: Gender;
  interested_in: InterestedIn;
  interests: string[];
  activity_tags: string[];
  active_intent: IntentType;
  email_notifications: boolean;
}

export default function ProfileSetupPage(): React.ReactNode {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [loading, setLoading] = useState<boolean>(false);
  const [fetching, setFetching] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [photoError, setPhotoError] = useState<string>('');
  const [interestError, setInterestError] = useState<string>('');
  const [intentNotice, setIntentNotice] = useState<string>('');
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const [form, setForm] = useState<ProfileFormState>({
    name: '',
    bio: '',
    branch: '',
    year: '',
    gender: 'male',
    interested_in: 'everyone',
    interests: [],
    activity_tags: [],
    active_intent: 'dating',
    email_notifications: true,
  });

  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [showLogoutModal, setShowLogoutModal] = useState<boolean>(false);

  function handleLogout(): void {
    logout();
  }

  function handleIntentChange(newIntent: IntentType): void {
    setForm((prev) => ({ ...prev, active_intent: newIntent }));
    setIntentNotice(`Active mode: ${INTENT_CONFIGS[newIntent].label}`);
    setTimeout(() => setIntentNotice(''), 3500);
    profileApi.updateIntent(newIntent).catch(() => {});
  }

  function toggleActivityTag(tag: string): void {
    setForm((prev) => {
      const current = Array.isArray(prev.activity_tags) ? prev.activity_tags : [];
      if (current.includes(tag)) {
        return { ...prev, activity_tags: current.filter((t) => t !== tag) };
      }
      if (current.length >= 8) {
        return prev;
      }
      return { ...prev, activity_tags: [...current, tag] };
    });
  }

  useEffect(() => {
    loadExistingProfile();
  }, []);

  async function loadExistingProfile(): Promise<void> {
    try {
      const res = await profileApi.getMyProfile();
      const p = res.data?.profile || res.data;
      if (p) {
        let parsedInterests: string[] = [];
        if (Array.isArray(p.interests)) {
          parsedInterests = p.interests;
        } else if (typeof p.interests === 'string') {
          try { parsedInterests = JSON.parse(p.interests); } catch { parsedInterests = []; }
        }

        let parsedPhotos: string[] = [];
        if (Array.isArray(p.photos)) {
          parsedPhotos = p.photos;
        } else if (typeof p.photos === 'string') {
          try { parsedPhotos = JSON.parse(p.photos); } catch { parsedPhotos = []; }
        }

        let parsedActivityTags: string[] = [];
        if (Array.isArray(p.activity_tags)) {
          parsedActivityTags = p.activity_tags;
        } else if (typeof p.activity_tags === 'string') {
          try { parsedActivityTags = JSON.parse(p.activity_tags); } catch { parsedActivityTags = []; }
        }

        setForm({
          name: p.name || '',
          bio: p.bio || '',
          branch: p.branch || '',
          year: p.year ? String(p.year) : '',
          gender: (p.gender as Gender) || 'male',
          interested_in: (p.interested_in as InterestedIn) || 'everyone',
          interests: Array.isArray(parsedInterests) ? parsedInterests : [],
          activity_tags: Array.isArray(parsedActivityTags) ? parsedActivityTags : [],
          active_intent: (p.active_intent as IntentType) || 'dating',
          email_notifications: p.email_notifications !== 0 && (p.email_notifications as unknown) !== false,
        });

        if (Array.isArray(parsedPhotos)) {
          setPhotos(
            parsedPhotos.map((url, idx) => ({
              id: `existing-${idx}-${Date.now()}`,
              url,
              previewUrl: getPhotoUrl(url),
            }))
          );
        }
      }
    } catch {
      // Profile doesn't exist yet, proceed with default form
    } finally {
      setFetching(false);
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>): void {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function handleBlur(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>): void {
    setTouched((prev) => ({ ...prev, [e.target.name]: true }));
  }

  function addFiles(files: File[]): void {
    setPhotoError('');
    const newItems: PhotoItem[] = [];
    for (const file of files) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        setPhotoError(`File "${file.name}" is not a supported format. Please use JPG, PNG, or WEBP.`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        setPhotoError(`File "${file.name}" exceeds the 5MB size limit.`);
        continue;
      }
      newItems.push({
        id: `new-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        file,
        previewUrl: URL.createObjectURL(file),
      });
    }

    setPhotos((prev) => {
      const combined = [...prev, ...newItems];
      if (combined.length > 6) {
        setPhotoError('Maximum 6 photos allowed. Extra photos were ignored.');
        return combined.slice(0, 6);
      }
      return combined;
    });
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>): void {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(Array.from(e.target.files));
      e.target.value = '';
    }
  }

  function handleDragOver(e: React.DragEvent): void {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent): void {
    e.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent): void {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(Array.from(e.dataTransfer.files));
    }
  }

  function handleRemovePhoto(index: number): void {
    setPhotoError('');
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }

  function handleMovePhoto(index: number, direction: number): void {
    setPhotos((prev) => {
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const updated = [...prev];
      const temp = updated[index];
      updated[index] = updated[targetIndex];
      updated[targetIndex] = temp;
      return updated;
    });
  }

  // Validation status checks
  const isNameValid = form.name.trim().length > 0;
  const photoCount = photos.length;
  const isPhotoCountValid = photoCount >= 2 && photoCount <= 6;

  function toggleInterest(tag: string): void {
    setInterestError('');
    setForm((prev) => {
      const current = Array.isArray(prev.interests) ? prev.interests : [];
      if (current.includes(tag)) {
        return { ...prev, interests: current.filter((t) => t !== tag) };
      }
      if (current.length >= MAX_INTERESTS_LIMIT) {
        setInterestError(`You can select up to ${MAX_INTERESTS_LIMIT} interests.`);
        return prev;
      }
      return { ...prev, interests: [...current, tag] };
    });
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError('');
    setPhotoError('');

    if (!isNameValid) {
      setTouched((prev) => ({ ...prev, name: true }));
      setError('Display Name is required.');
      return;
    }
    if (!isPhotoCountValid) {
      setPhotoError('Please add between 2 and 6 photos before saving.');
      return;
    }

    setLoading(true);
    try {
      // 1. Separate existing photo URLs from new File objects
      const newFiles: File[] = [];

      for (const item of photos) {
        if (item.file) {
          newFiles.push(item.file);
        }
      }

      let uploadedUrls: string[] = [];
      if (newFiles.length > 0) {
        const uploadRes = await profileApi.uploadPhotos(newFiles);
        uploadedUrls = (uploadRes.data as any)?.urls || ((uploadRes.data as any)?.url ? [(uploadRes.data as any).url] : []);
      }

      // Maintain order: match upload index to new file order
      let uploadedIdx = 0;
      const finalPhotoUrls = photos.map((item) => {
        if (item.url) return item.url;
        if (item.file) {
          const url = uploadedUrls[uploadedIdx];
          uploadedIdx++;
          return url;
        }
        return null;
      }).filter((url): url is string => Boolean(url));

      if (finalPhotoUrls.length < 2) {
        throw new Error('Add at least 2 photos to complete your profile.');
      }

      const payload = {
        name: form.name.trim(),
        bio: form.bio ? form.bio.trim() : null,
        branch: form.branch ? form.branch.trim() : null,
        year: form.year ? parseInt(form.year, 10) : null,
        gender: form.gender,
        interested_in: form.interested_in,
        interests: Array.isArray(form.interests) ? form.interests : [],
        activity_tags: Array.isArray(form.activity_tags) ? form.activity_tags : [],
        active_intent: form.active_intent || 'dating',
        photos: finalPhotoUrls,
        email_notifications: form.email_notifications,
      };

      await profileApi.createOrUpdate(payload);

      // Update stored user state
      try {
        const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
        storedUser.profile_completed = true;
        storedUser.has_profile = true;
        localStorage.setItem('user', JSON.stringify(storedUser));
        localStorage.setItem('profile_completed', 'true');
      } catch {}

      // Automatically open the Discover page
      try {
        navigate('/discover', { replace: true });
      } catch {
        window.location.replace('/discover');
      }

      // Fallback timer to guarantee navigation to Discover page
      setTimeout(() => {
        if (window.location.pathname !== '/discover') {
          window.location.replace('/discover');
        }
      }, 100);
    } catch (err: any) {
      setError(err.message || 'Error updating profile');
    } finally {
      setLoading(false);
    }
  }

  if (fetching) {
    return (
      <div className="page" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <p>Loading profile...</p>
      </div>
    );
  }

  return (
    <div className="page" style={{ paddingBottom: '6rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.2rem', gap: '0.75rem' }}>
        <div>
          <h1>Edit Your Profile</h1>
          <p>Let your campus matches know more about you.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowLogoutModal(true)}
          title="Log Out"
          style={{
            background: 'rgba(255, 82, 82, 0.1)',
            border: '1px solid rgba(255, 82, 82, 0.25)',
            color: '#ff5252',
            borderRadius: 'var(--radius-sm)',
            padding: '0.5rem 0.8rem',
            fontSize: '0.8rem',
            fontWeight: 600,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            cursor: 'pointer',
            flexShrink: 0,
            marginTop: '0.2rem',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          <span>Log Out</span>
        </button>
      </div>

      <div className="glass-card">
        <form onSubmit={handleSubmit}>
          {/* Display Name */}
          <label>
            Display Name *
            <input 
              name="name" 
              value={form.name} 
              onChange={handleChange} 
              onBlur={handleBlur}
              required 
              placeholder="Your name" 
              style={{ borderColor: touched.name && !isNameValid ? '#ff5252' : undefined }}
            />
            {touched.name && !isNameValid && (
              <span style={{ fontSize: '0.78rem', color: '#ff5252', marginTop: '0.2rem' }}>
                Display Name is required.
              </span>
            )}
          </label>

          {/* Bio */}
          <label>
            Bio
            <textarea 
              name="bio" 
              value={form.bio} 
              onChange={handleChange} 
              maxLength={500} 
              rows={3} 
              placeholder="Tell others what you love, your vibe, or hobbies..." 
            />
          </label>

          {/* Course / Branch & Graduation Year */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
            <label>
              Course / Branch
              <input 
                name="branch" 
                value={form.branch} 
                onChange={handleChange} 
                placeholder="e.g. Computer Science" 
                maxLength={100} 
              />
            </label>

            <label>
              Graduation Year
              <input 
                name="year" 
                type="number" 
                value={form.year} 
                onChange={handleChange} 
                placeholder="e.g. 2026" 
                min={2000} 
                max={2035} 
              />
            </label>
          </div>

          {/* Active Campus Intent (Single-Select Radio Cards) */}
          <div style={{ margin: '1.2rem 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Active Campus Intent *
              </span>
              {intentNotice && (
                <span style={{ fontSize: '0.78rem', color: 'var(--primary-pink)', fontWeight: '600' }}>
                  ✓ {intentNotice}
                </span>
              )}
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.75rem', lineHeight: '1.3' }}>
              Choose your single active mode. Your Discover feed, scoring logic, and like actions will tailor to this intent.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.55rem' }}>
              {INTENTS.map((intentKey) => {
                const cfg = INTENT_CONFIGS[intentKey];
                const isSelected = form.active_intent === intentKey;
                return (
                  <button
                    key={intentKey}
                    type="button"
                    onClick={() => handleIntentChange(intentKey)}
                    style={{
                      background: isSelected ? cfg.badgeBg : 'rgba(255,255,255,0.03)',
                      border: `1.5px solid ${isSelected ? cfg.color : 'rgba(255,255,255,0.1)'}`,
                      borderRadius: 'var(--radius-md)',
                      padding: '0.75rem 0.6rem',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s ease',
                      boxShadow: isSelected ? `0 0 12px ${cfg.badgeBg}` : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: '0.3rem' }}>
                      <span style={{ fontSize: '1.3rem' }}>{cfg.icon}</span>
                      <div style={{
                        width: 15,
                        height: 15,
                        borderRadius: '50%',
                        border: `2px solid ${isSelected ? cfg.color : 'rgba(255,255,255,0.3)'}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                        {isSelected && (
                          <div style={{ width: 7, height: 7, borderRadius: '50%', background: cfg.color }} />
                        )}
                      </div>
                    </div>
                    <span style={{ fontSize: '0.88rem', fontWeight: '700', color: isSelected ? cfg.color : '#fff', marginBottom: '0.15rem' }}>
                      {cfg.label}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', lineHeight: '1.2' }}>
                      {cfg.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Gender & Interested In */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
            <label>
              Gender *
              <select name="gender" value={form.gender} onChange={handleChange} required>
                {GENDER_OPTIONS.map((g) => (
                  <option key={g.value} value={g.value}>{g.label}</option>
                ))}
              </select>
            </label>

            <label>
              Interested In *
              <select name="interested_in" value={form.interested_in} onChange={handleChange} required>
                {INTERESTED_OPTIONS.map((g) => (
                  <option key={g.value} value={g.value}>{g.label}</option>
                ))}
              </select>
            </label>
          </div>

          {/* Interests Chip Selector */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.4rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Your Interests
              </span>
              <span style={{ 
                fontSize: '0.78rem', 
                fontWeight: '600', 
                color: form.interests.length >= 6 ? 'var(--primary-pink)' : 'var(--text-muted)',
                background: 'rgba(255,255,255,0.06)',
                padding: '0.2rem 0.6rem',
                borderRadius: 'var(--radius-full)'
              }}>
                {form.interests.length} / 6 selected
              </span>
            </div>

            {/* Picked Summary Pills */}
            {form.interests.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.3rem' }}>
                {form.interests.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleInterest(tag)}
                    style={{
                      background: 'var(--primary-gradient)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 'var(--radius-full)',
                      padding: '0.35rem 0.75rem',
                      fontSize: '0.8rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      boxShadow: '0 2px 8px var(--accent-glow)'
                    }}
                  >
                    <span>{tag}</span>
                    <span style={{ opacity: 0.8, fontSize: '0.9rem' }}>×</span>
                  </button>
                ))}
              </div>
            )}

            {/* Chip Grid Selector */}
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.45rem',
              maxHeight: '180px',
              overflowY: 'auto',
              padding: '0.6rem',
              background: 'rgba(15, 17, 26, 0.6)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--glass-border)'
            }}>
              {PREDEFINED_INTERESTS.map((tag) => {
                const isSelected = form.interests.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleInterest(tag)}
                    style={{
                      background: isSelected ? 'var(--primary-gradient)' : 'rgba(255, 255, 255, 0.07)',
                      color: isSelected ? '#fff' : 'var(--text-muted)',
                      border: isSelected ? '1px solid var(--primary-pink)' : '1px solid var(--glass-border)',
                      borderRadius: 'var(--radius-full)',
                      padding: '0.35rem 0.7rem',
                      fontSize: '0.78rem',
                      fontWeight: isSelected ? '600' : '500',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      transform: isSelected ? 'scale(1.03)' : 'none'
                    }}
                  >
                    {isSelected ? `✓ ${tag}` : tag}
                  </button>
                );
              })}
            </div>

            {interestError && (
              <p style={{ fontSize: '0.78rem', color: 'var(--primary-pink)', marginTop: '0.2rem' }}>
                ⚠️ {interestError}
              </p>
            )}
          </div>

          {/* Activity & Sports Tags Selector */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
            marginTop: '0.6rem',
            background: form.active_intent === 'activity' ? 'rgba(6, 214, 160, 0.06)' : 'transparent',
            border: form.active_intent === 'activity' ? '1px solid rgba(6, 214, 160, 0.25)' : 'none',
            padding: form.active_intent === 'activity' ? '0.8rem' : 0,
            borderRadius: 'var(--radius-md)',
            transition: 'all 0.2s ease',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{
                fontSize: '0.85rem',
                fontWeight: '600',
                color: form.active_intent === 'activity' ? '#06d6a0' : 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                Activity & Sports Tags {form.active_intent === 'activity' ? '• (Active Mode Priority ⚽)' : ''}
              </span>
              <span style={{
                fontSize: '0.78rem',
                fontWeight: '600',
                color: form.activity_tags.length >= 2 ? '#06d6a0' : 'var(--text-muted)',
                background: 'rgba(255,255,255,0.06)',
                padding: '0.2rem 0.6rem',
                borderRadius: 'var(--radius-full)'
              }}>
                {form.activity_tags.length} selected
              </span>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
              Pick activities, sports, and gym interests to match with campus workout and game partners.
            </p>

            {/* Picked Activity Pills */}
            {form.activity_tags.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.2rem' }}>
                {form.activity_tags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleActivityTag(tag)}
                    style={{
                      background: 'rgba(6, 214, 160, 0.22)',
                      color: '#06d6a0',
                      border: '1px solid rgba(6, 214, 160, 0.45)',
                      borderRadius: 'var(--radius-full)',
                      padding: '0.35rem 0.75rem',
                      fontSize: '0.8rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                    }}
                  >
                    <span>{tag}</span>
                    <span style={{ opacity: 0.8, fontSize: '0.9rem' }}>×</span>
                  </button>
                ))}
              </div>
            )}

            {/* Activity Chip Grid */}
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.45rem',
              marginTop: '0.3rem',
            }}>
              {PREDEFINED_ACTIVITY_TAGS.map((tag) => {
                const isSelected = form.activity_tags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleActivityTag(tag)}
                    style={{
                      background: isSelected ? 'rgba(6, 214, 160, 0.2)' : 'rgba(255,255,255,0.05)',
                      color: isSelected ? '#06d6a0' : 'var(--text-muted)',
                      border: isSelected ? '1px solid #06d6a0' : '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 'var(--radius-full)',
                      padding: '0.35rem 0.75rem',
                      fontSize: '0.8rem',
                      fontWeight: isSelected ? '600' : '400',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {isSelected ? `✓ ${tag}` : tag}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Email Notifications Toggle */}
          <label style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', marginTop: '0.4rem' }}>
            <input 
              type="checkbox" 
              name="email_notifications" 
              checked={form.email_notifications} 
              onChange={(e) => setForm((prev) => ({ ...prev, email_notifications: e.target.checked }))}
              style={{ width: 'auto', margin: 0, cursor: 'pointer' }}
            />
            <span style={{ fontSize: '0.85rem', color: 'var(--text-main)', textTransform: 'none', letterSpacing: 'normal' }}>
              Receive email notifications when someone likes your profile 📧
            </span>
          </label>

          {/* Multi-Photo Uploader Section */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.4rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Profile Photos *
              </span>
              <span style={{ 
                fontSize: '0.8rem', 
                fontWeight: '600', 
                color: isPhotoCountValid ? '#00e676' : 'var(--primary-pink)',
                background: isPhotoCountValid ? 'rgba(0,230,118,0.1)' : 'rgba(255,64,129,0.1)',
                padding: '0.2rem 0.6rem',
                borderRadius: 'var(--radius-full)'
              }}>
                {photoCount} / 6 photos
              </span>
            </div>

            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Add <strong>2 to 6 photos</strong>. The 1st photo is your primary profile picture.
            </p>

            {/* Hidden File Input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />

            {/* Photo Grid */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(3, 1fr)', 
              gap: '0.65rem',
              marginTop: '0.4rem'
            }}>
              {photos.map((item, idx) => (
                <div
                  key={item.id || idx}
                  style={{
                    position: 'relative',
                    aspectRatio: '3 / 4',
                    borderRadius: 'var(--radius-sm)',
                    overflow: 'hidden',
                    border: idx === 0 ? '2px solid var(--primary-pink)' : '1px solid var(--glass-border)',
                    background: '#0d0f17',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                  }}
                >
                  <img
                    src={getPhotoUrl(item.previewUrl || item.url)}
                    alt={`Photo ${idx + 1}`}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />

                  {/* Primary Badge */}
                  {idx === 0 && (
                    <span style={{
                      position: 'absolute',
                      top: '4px',
                      left: '4px',
                      background: 'var(--primary-gradient)',
                      color: '#fff',
                      fontSize: '0.65rem',
                      fontWeight: '700',
                      padding: '0.15rem 0.4rem',
                      borderRadius: 'var(--radius-sm)',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.5)'
                    }}>
                      ★ Primary
                    </span>
                  )}

                  {/* Delete Button */}
                  <button
                    type="button"
                    onClick={() => handleRemovePhoto(idx)}
                    aria-label="Remove photo"
                    style={{
                      position: 'absolute',
                      top: '4px',
                      right: '4px',
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      background: 'rgba(0, 0, 0, 0.75)',
                      color: '#fff',
                      border: '1px solid rgba(255, 255, 255, 0.3)',
                      padding: 0,
                      fontSize: '0.85rem',
                      lineHeight: 1
                    }}
                  >
                    ×
                  </button>

                  {/* Reorder Buttons */}
                  <div style={{
                    position: 'absolute',
                    bottom: '4px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    display: 'flex',
                    gap: '4px',
                    background: 'rgba(0,0,0,0.6)',
                    padding: '2px 4px',
                    borderRadius: '12px'
                  }}>
                    {idx > 0 && (
                      <button
                        type="button"
                        onClick={() => handleMovePhoto(idx, -1)}
                        style={{ padding: 0, width: '18px', height: '18px', fontSize: '0.7rem', background: 'transparent', color: '#fff' }}
                        title="Move Left"
                      >
                        ‹
                      </button>
                    )}
                    {idx < photos.length - 1 && (
                      <button
                        type="button"
                        onClick={() => handleMovePhoto(idx, 1)}
                        style={{ padding: 0, width: '18px', height: '18px', fontSize: '0.7rem', background: 'transparent', color: '#fff' }}
                        title="Move Right"
                      >
                        ›
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {/* Add Photo Tile / Dropzone */}
              {photos.length < 6 && (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  style={{
                    aspectRatio: '3 / 4',
                    borderRadius: 'var(--radius-sm)',
                    border: isDragging ? '2px dashed var(--primary-pink)' : '2px dashed var(--glass-border-light)',
                    background: isDragging ? 'rgba(255, 64, 129, 0.1)' : 'rgba(255, 255, 255, 0.03)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    gap: '0.4rem',
                    transition: 'all 0.2s ease',
                    color: 'var(--text-muted)'
                  }}
                >
                  <span style={{ fontSize: '1.5rem', lineHeight: 1 }}>+</span>
                  <span style={{ fontSize: '0.7rem', fontWeight: '600', textAlign: 'center' }}>
                    Add Photo
                  </span>
                </div>
              )}
            </div>

            {/* Validation Message */}
            {!isPhotoCountValid && (
              <p style={{ fontSize: '0.8rem', color: 'var(--primary-pink)', marginTop: '0.3rem' }}>
                ⚠️ Add at least 2 photos (min 2, max 6).
              </p>
            )}
            {photoError && (
              <p style={{ fontSize: '0.8rem', color: '#ff5252', marginTop: '0.3rem' }}>
                {photoError}
              </p>
            )}
          </div>

          {/* Submit Button */}
          <button 
            type="submit" 
            className="btn-primary" 
            disabled={loading} 
            style={{ marginTop: '1rem', width: '100%' }}
            aria-label="Save and Continue"
          >
            {loading ? 'Saving Profile...' : 'Save & Continue'}
          </button>
        </form>

        {error && <p className="error" style={{ marginTop: '1rem' }}>{error}</p>}
      </div>

      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1.25rem',
          }}
          onClick={() => setShowLogoutModal(false)}
        >
          <div
            className="glass-card"
            style={{
              maxWidth: '360px',
              width: '100%',
              padding: '1.5rem',
              textAlign: 'center',
              boxShadow: '0 16px 40px rgba(0,0,0,0.6)',
              border: '1px solid var(--glass-border-light)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                width: 48,
                height: 48,
                margin: '0 auto 1rem',
                borderRadius: '50%',
                background: 'rgba(255, 82, 82, 0.15)',
                color: '#ff5252',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </div>

            <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem', color: 'var(--text-main)' }}>
              Log Out?
            </h3>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
              Your session will be securely cleared. You will be redirected to the Login page.
            </p>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowLogoutModal(false)}
                style={{ flex: 1, padding: '0.75rem' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleLogout}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  background: '#ff5252',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                Log Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
