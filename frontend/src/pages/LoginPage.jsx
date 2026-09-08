import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../api';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isNotRegistered, setIsNotRegistered] = useState(false);
  const navigate = useNavigate();

  // If already authenticated, redirect to discover
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      navigate('/discover', { replace: true });
    }
  }, [navigate]);

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsNotRegistered(false);
    setLoading(true);

    try {
      const cleanEmail = email.trim().toLowerCase();
      const res = await authApi.login(email);
      sessionStorage.setItem(`otp_sent_at_${cleanEmail}`, Date.now().toString());
      setSuccess(res.message || 'Verification code sent! Check your college email.');
      setTimeout(() => {
        navigate('/verify-otp', { state: { email: cleanEmail, isLogin: true } });
      }, 700);
    } catch (err) {
      setError(err.message || 'Failed to send login code.');
      if (
        err.message?.toLowerCase().includes('no account') ||
        err.message?.toLowerCase().includes('not found') ||
        err.message?.toLowerCase().includes('create an account')
      ) {
        setIsNotRegistered(true);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page" style={{ justifyContent: 'center' }}>
      {/* Brand Header */}
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <div
          style={{
            width: 64,
            height: 64,
            margin: '0 auto 1rem',
            background: 'var(--primary-gradient)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 24px var(--accent-glow)',
          }}
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
            />
          </svg>
        </div>
        <h1>CampusHinge</h1>
        <p style={{ marginTop: '0.4rem' }}>Connect exclusively with students from your campus.</p>
      </div>

      {/* Main Glass Card */}
      <div className="glass-card">
        <h2 style={{ marginBottom: '0.35rem' }}>Welcome Back</h2>
        <p style={{ marginBottom: '1.25rem', fontSize: '0.88rem' }}>
          Sign in with your campus email to continue your connections.
        </p>

        {/* Option 1: Log in with Email Form */}
        <form onSubmit={handleLogin}>
          <label>
            College Email
            <input
              type="email"
              placeholder="student@vitbhopal.ac.in"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError('');
                if (isNotRegistered) setIsNotRegistered(false);
              }}
              required
              disabled={loading}
              autoComplete="email"
            />
          </label>

          {/* Filled primary button for Option 1 */}
          <button
            type="submit"
            className="btn-primary"
            disabled={loading || !email.trim()}
            style={{ width: '100%', marginTop: '0.25rem' }}
          >
            {loading ? 'Sending Code...' : 'Log In with Email →'}
          </button>
        </form>

        {/* Feedback messages */}
        {error && (
          <div style={{ marginTop: '1rem' }}>
            <p className="error" style={{ margin: 0 }}>{error}</p>
            {isNotRegistered && (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => navigate('/signup', { state: { email } })}
                style={{
                  width: '100%',
                  marginTop: '0.6rem',
                  fontSize: '0.85rem',
                  padding: '0.6rem 1rem',
                  background: 'rgba(255, 64, 129, 0.12)',
                  borderColor: 'var(--primary-pink)',
                  color: 'var(--text-main)',
                }}
              >
                Sign Up as New User with this Email →
              </button>
            )}
          </div>
        )}

        {success && <p className="success" style={{ marginTop: '1rem' }}>{success}</p>}

        {/* Visual Divider between the two distinct options */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            margin: '1.6rem 0 1.2rem',
            gap: '0.75rem',
          }}
        >
          <div style={{ flex: 1, height: '1px', background: 'var(--glass-border-light)' }} />
          <span
            style={{
              fontSize: '0.72rem',
              color: 'var(--text-dim)',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              fontWeight: 700,
            }}
          >
            or
          </span>
          <div style={{ flex: 1, height: '1px', background: 'var(--glass-border-light)' }} />
        </div>

        {/* Option 2: Create a New Account (Secondary / Outlined Button) */}
        <div>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => navigate('/signup')}
            disabled={loading}
            style={{
              width: '100%',
              border: '1px solid var(--glass-border-light)',
              background: 'rgba(255, 255, 255, 0.04)',
              color: 'var(--text-main)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              padding: '0.85rem 1.2rem',
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <line x1="19" y1="8" x2="19" y2="14" />
              <line x1="22" y1="11" x2="16" y2="11" />
            </svg>
            <span>Create a New Account</span>
          </button>
        </div>
      </div>

      {/* Trust & Verification note */}
      <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
          🔒 Only students with verified college emails can join.
        </p>
      </div>
    </div>
  );
}
