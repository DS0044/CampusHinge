import { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { profileApi } from '../api';

export default function ProtectedRoute({ children, requireCompletedProfile = true }) {
  const location = useLocation();
  const token = localStorage.getItem('token');
  const [checking, setChecking] = useState(true);
  const [isCompleted, setIsCompleted] = useState(null);

  useEffect(() => {
    if (!token) {
      setChecking(false);
      return;
    }

    checkProfileStatus();
  }, [token, location.pathname]);

  async function checkProfileStatus() {
    try {
      const res = await profileApi.getMyProfile();
      const p = res.data?.profile || res.data;
      
      let photoCount = 0;
      if (p?.photos) {
        try {
          const photos = typeof p.photos === 'string' ? JSON.parse(p.photos) : p.photos;
          if (Array.isArray(photos)) photoCount = photos.length;
        } catch {
          photoCount = 0;
        }
      }

      const completed = Boolean(
        p &&
        p.name &&
        p.gender &&
        p.interested_in &&
        photoCount >= 2
      );

      setIsCompleted(completed);
    } catch (err) {
      // Profile does not exist yet
      setIsCompleted(false);
    } finally {
      setChecking(false);
    }
  }

  // 1. Not logged in -> redirect to login
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // 2. Checking status -> show loading state
  if (checking) {
    return (
      <div className="page" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <p style={{ color: 'var(--text-muted)' }}>Verifying profile...</p>
      </div>
    );
  }

  // 3. Logged in, but profile not completed -> force setup screen
  if (requireCompletedProfile && !isCompleted && location.pathname !== '/profile-setup') {
    return <Navigate to="/profile-setup" replace />;
  }

  return children;
}
