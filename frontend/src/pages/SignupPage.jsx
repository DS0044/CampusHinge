import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { authApi } from '../api';

export default function SignupPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState(location.state?.email || '');
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
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const res = await authApi.signup(email);
      setSuccess(res.message || 'OTP sent! Check your email.');
      setTimeout(() => navigate('/verify-otp', { state: { email, isLogin: false } }), 800);
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

          <button type="submit" className="btn-primary" disabled={loading} style={{ marginTop: '0.5rem' }}>
            {loading ? 'Sending Code...' : 'Continue with OTP →'}
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
