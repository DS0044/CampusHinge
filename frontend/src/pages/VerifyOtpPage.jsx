import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { authApi, setToken } from '../api';

export default function VerifyOtpPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState(location.state?.email || '');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isLogin = Boolean(location.state?.isLogin);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await authApi.verifyOtp(email, code);
      setToken(res.data.token);
      if (res.data?.user?.profile_completed || res.data?.user?.has_profile) {
        navigate('/discover', { replace: true });
      } else {
        navigate('/profile-setup', { replace: true });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page" style={{ justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <h1>Enter Verification Code</h1>
        <p style={{ marginTop: '0.4rem' }}>
          We sent a 6-digit verification code to <br />
          <strong style={{ color: 'var(--text-main)' }}>{email || 'your email'}</strong>
        </p>
      </div>

      <div className="glass-card">
        <form onSubmit={handleSubmit}>
          <label>
            Campus Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </label>

          <label>
            6-Digit OTP Code
            <input
              type="text"
              placeholder="123456"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              required
              disabled={loading}
              style={{ letterSpacing: '0.3em', textAlign: 'center', fontSize: '1.25rem', fontWeight: 'bold' }}
            />
          </label>

          <button type="submit" className="btn-primary" disabled={loading || code.length !== 6} style={{ marginTop: '0.5rem' }}>
            {loading ? 'Verifying...' : 'Verify & Enter'}
          </button>
        </form>

        {error && <p className="error" style={{ marginTop: '1rem' }}>{error}</p>}
      </div>

      <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
        <button 
          className="btn-secondary" 
          onClick={() => navigate(isLogin ? '/login' : '/signup', { state: { email } })} 
          style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem' }}
        >
          {isLogin ? '← Back to Log In' : '← Change Email'}
        </button>
      </div>
    </div>
  );
}
