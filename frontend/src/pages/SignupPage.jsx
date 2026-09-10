import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { authApi } from '../api';

export default function SignupPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState(location.state?.email || '');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      navigate('/discover', { replace: true });
    }
  }, [navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!acceptedTerms) {
      setError('You must accept the Terms & Conditions to create an account.');
      return;
    }
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const cleanEmail = email.trim().toLowerCase();
      const res = await authApi.signup(cleanEmail, true);
      sessionStorage.setItem(`otp_sent_at_${cleanEmail}`, Date.now().toString());
      setSuccess(res.message || 'OTP sent! Check your email.');
      setTimeout(() => navigate('/verify-otp', { state: { email: cleanEmail, isLogin: false } }), 800);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page" style={{ justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <div style={{ 
          width: 64, height: 64, margin: '0 auto 1rem', 
          background: 'var(--primary-gradient)', borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 24px var(--accent-glow)' 
        }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
          </svg>
        </div>
        <h1>CampusHinge</h1>
        <p style={{ marginTop: '0.4rem' }}>Connect exclusively with students from your campus.</p>
      </div>

      <div className="glass-card">
        <h2 style={{ marginBottom: '0.4rem' }}>Create an Account</h2>
        <p style={{ marginBottom: '1.2rem', fontSize: '0.88rem' }}>
          Enter your official college email address to receive a 6-digit verification code.
        </p>

        <form onSubmit={handleSubmit}>
          <label>
            College Email
            <input
              type="email"
              placeholder="student@college.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </label>

          {/* Mandatory Terms & Conditions Checkbox */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.65rem',
              marginTop: '1rem',
              marginBottom: '1.25rem',
              textAlign: 'left',
            }}
          >
            <input
              type="checkbox"
              id="terms-checkbox"
              name="accepted_terms"
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
              htmlFor="terms-checkbox"
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
                Terms & Conditions
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

          <button
            type="submit"
            id="create-account-btn"
            className="btn-primary"
            disabled={loading || !acceptedTerms}
            style={{
              marginTop: '0.5rem',
              opacity: !acceptedTerms || loading ? 0.6 : 1,
              cursor: !acceptedTerms || loading ? 'not-allowed' : 'pointer',
              transition: 'opacity 0.2s ease',
            }}
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        {error && <p className="error" style={{ marginTop: '1rem' }}>{error}</p>}
        {success && <p className="success" style={{ marginTop: '1rem' }}>{success}</p>}
      </div>

      <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
          Already have an account?{' '}
          <button
            type="button"
            onClick={() => navigate('/login', { state: { email } })}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              color: 'var(--primary-pink)',
              fontWeight: 600,
              cursor: 'pointer',
              textDecoration: 'underline',
              fontSize: 'inherit',
            }}
          >
            Log In
          </button>
        </p>
      </div>
    </div>
  );
}
