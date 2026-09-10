import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authApi, setToken } from '../api';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

export default function SignupPage() {
  const navigate = useNavigate();
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const googleBtnRef = useRef(null);
  const initializedRef = useRef(false);
  const acceptedTermsRef = useRef(acceptedTerms);

  useEffect(() => {
    acceptedTermsRef.current = acceptedTerms;
  }, [acceptedTerms]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      navigate('/discover', { replace: true });
    }
  }, [navigate]);

  // Google Sign-Up / Verification callback
  const handleGoogleResponse = useCallback(async (response) => {
    if (!response?.credential) {
      setError('Google verification failed. Please try again.');
      return;
    }

    if (!acceptedTermsRef.current) {
      setError('You must accept the Terms & Conditions and Privacy Policy to create an account.');
      return;
    }

    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const res = await authApi.googleSignIn(response.credential);
      setToken(res.data.token);

      // Store user info
      localStorage.setItem('user', JSON.stringify(res.data.user));

      setSuccess('Account verified successfully! Setting up profile…');

      setTimeout(() => {
        if (res.data.user.profile_completed || res.data.user.has_profile) {
          navigate('/discover', { replace: true });
        } else {
          navigate('/profile-setup', { replace: true });
        }
      }, 500);
    } catch (err) {
      setError(err.message || 'Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  // Initialize Google Identity Services
  useEffect(() => {
    if (initializedRef.current) return;

    function tryInit() {
      if (!window.google?.accounts?.id) return false;

      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleResponse,
        auto_select: false,
        cancel_on_tap_outside: true,
      });

      if (googleBtnRef.current) {
        window.google.accounts.id.renderButton(googleBtnRef.current, {
          type: 'standard',
          theme: 'filled_black',
          size: 'large',
          width: googleBtnRef.current.offsetWidth || 340,
          text: 'signup_with',
          shape: 'pill',
          logo_alignment: 'left',
        });
      }

      initializedRef.current = true;
      return true;
    }

    // Try immediately, then poll if GIS script hasn't loaded yet
    if (!tryInit()) {
      const interval = setInterval(() => {
        if (tryInit()) clearInterval(interval);
      }, 200);
      setTimeout(() => clearInterval(interval), 10000);
    }
  }, [handleGoogleResponse]);

  return (
    <div className="page" style={{ justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <div
          style={{
            width: 72,
            height: 72,
            margin: '0 auto 1rem',
            background: 'var(--primary-gradient)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 32px var(--accent-glow)',
            animation: 'pulse 2s ease-in-out infinite',
          }}
        >
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
            />
          </svg>
        </div>
        <h1 style={{ fontSize: '2rem', marginBottom: '0.3rem' }}>CampusHinge</h1>
        <p style={{ marginTop: '0.4rem', color: 'var(--text-muted)', fontSize: '0.95rem' }}>
          Connect exclusively with students from your campus.
        </p>
      </div>

      <div className="glass-card">
        <h2 style={{ marginBottom: '0.35rem', textAlign: 'center' }}>Create an Account</h2>
        <p style={{ marginBottom: '1.25rem', fontSize: '0.88rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          Sign up with your official college Google account for instant verification.
        </p>

        {/* Mandatory Terms & Conditions Checkbox */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.65rem',
            marginBottom: '1.25rem',
            textAlign: 'left',
            padding: '0.8rem 0.95rem',
            background: 'rgba(255, 255, 255, 0.03)',
            borderRadius: 10,
            border: acceptedTerms ? '1px solid rgba(255, 64, 129, 0.45)' : '1px solid var(--glass-border)',
            transition: 'border-color 0.2s ease',
          }}
        >
          <input
            type="checkbox"
            id="signup-terms-checkbox"
            checked={acceptedTerms}
            onChange={(e) => {
              setAcceptedTerms(e.target.checked);
              if (error) setError('');
            }}
            disabled={loading}
            style={{
              width: '18px',
              height: '18px',
              marginTop: '2px',
              accentColor: 'var(--primary-pink)',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          />
          <label
            htmlFor="signup-terms-checkbox"
            style={{
              fontSize: '0.84rem',
              lineHeight: '1.45',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              userSelect: 'none',
              margin: 0,
              fontWeight: 'normal',
            }}
          >
            I agree to the{' '}
            <Link
              to="/terms"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: 'var(--primary-pink)',
                fontWeight: 600,
                textDecoration: 'underline',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              Terms &amp; Conditions
            </Link>{' '}
            and{' '}
            <Link
              to="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: 'var(--primary-pink)',
                fontWeight: 600,
                textDecoration: 'underline',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              Privacy Policy
            </Link>
          </label>
        </div>

        {!acceptedTerms && (
          <p
            style={{
              fontSize: '0.78rem',
              color: 'var(--primary-pink)',
              textAlign: 'center',
              marginBottom: '0.85rem',
              marginTop: '-0.5rem',
            }}
          >
            👆 Please check the box above to accept the Terms &amp; Conditions to sign up.
          </p>
        )}

        {/* Google Sign-Up Button */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1rem',
            width: '100%',
          }}
        >
          <div
            style={{ width: '100%', position: 'relative' }}
            onClick={() => {
              if (!acceptedTerms) {
                setError('Please check the box to agree to the Terms & Conditions and Privacy Policy.');
              }
            }}
          >
            <div
              ref={googleBtnRef}
              id="google-signup-btn"
              style={{
                width: '100%',
                minHeight: 44,
                display: 'flex',
                justifyContent: 'center',
                opacity: !acceptedTerms || loading ? 0.45 : 1,
                pointerEvents: !acceptedTerms || loading ? 'none' : 'auto',
                transition: 'opacity 0.2s ease',
              }}
            />
          </div>

          {/* Loading indicator */}
          {loading && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                color: 'var(--text-muted)',
                fontSize: '0.85rem',
              }}
            >
              <div
                style={{
                  width: 16,
                  height: 16,
                  border: '2px solid var(--glass-border-light)',
                  borderTopColor: 'var(--primary-pink)',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                }}
              />
              Verifying your account…
            </div>
          )}
        </div>

        {/* Feedback messages */}
        {error && (
          <div style={{ marginTop: '1rem' }}>
            <p className="error" style={{ margin: 0, textAlign: 'center' }}>{error}</p>
          </div>
        )}

        {success && (
          <p className="success" style={{ marginTop: '1rem', textAlign: 'center' }}>{success}</p>
        )}

        {/* Supported campuses info */}
        <div
          style={{
            marginTop: '1.5rem',
            padding: '0.8rem 1rem',
            background: 'rgba(108, 99, 255, 0.06)',
            borderRadius: 10,
            border: '1px solid rgba(108, 99, 255, 0.12)',
          }}
        >
          <p
            style={{
              fontSize: '0.76rem',
              color: 'var(--text-dim)',
              margin: 0,
              textAlign: 'center',
              lineHeight: 1.6,
            }}
          >
            <strong style={{ color: 'var(--text-muted)' }}>Supported Campuses:</strong>
            <br />
            VIT Bhopal • LPU • BITS Pilani • Galgotias University
          </p>
        </div>
      </div>

      {/* Trust & Verification note */}
      <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
          🔒 Fast &amp; verified college student access via Google OAuth.
        </p>
        <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginTop: '0.75rem' }}>
          Already have an account?{' '}
          <Link
            to="/login"
            style={{
              color: 'var(--primary-pink)',
              fontWeight: 600,
              textDecoration: 'underline',
            }}
          >
            Log In
          </Link>
        </p>
      </div>

      {/* Legal Links */}
      <div className="legal-footer" style={{ marginTop: '1rem', marginBottom: '1rem' }}>
        <Link to="/privacy">Privacy Policy</Link>
        <span style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>•</span>
        <Link to="/terms">Terms of Service</Link>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 24px var(--accent-glow); }
          50% { box-shadow: 0 0 40px var(--accent-glow), 0 0 60px rgba(108, 99, 255, 0.15); }
        }
      `}</style>
    </div>
  );
}
