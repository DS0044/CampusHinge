import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApi, setAdminToken } from '../api';

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState('email'); // 'email' | 'otp'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function handleSendOtp(e) {
    e.preventDefault();
    if (!email.trim()) return;

    setError('');
    setMessage('');
    setLoading(true);

    try {
      const res = await adminApi.requestOtp(email.trim());
      setMessage(res?.message || 'Verification code sent to your email.');
      setStep('otp');
    } catch (err) {
      setError(err.message || 'Failed to send OTP.');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e) {
    e.preventDefault();
    if (!code.trim()) return;

    setError('');
    setLoading(true);

    try {
      const res = await adminApi.verifyOtp(email.trim(), code.trim());
      if (res?.data?.token) {
        const user = res.data.user || { email, role: res.data.role || 'admin' };
        setAdminToken(res.data.token, user);
        navigate('/dashboard');
      } else {
        throw new Error('No authentication token received.');
      }
    } catch (err) {
      setError(err.message || 'Invalid verification code.');
    } finally {
      setLoading(false);
    }
  }

  // Quick dev bypass if local token is available
  function handleDevBypass() {
    const devToken = prompt('Enter an admin JWT token or type "dev" to connect:');
    if (devToken) {
      setAdminToken(devToken, { email: 'admin@campushinge.internal', role: 'admin' });
      navigate('/dashboard');
    }
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-logo">🛡️</div>
        <h1 style={{ fontSize: '1.65rem', fontWeight: 800, marginBottom: '0.5rem', letterSpacing: '-0.02em' }}>
          CampusHinge Admin
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '2rem' }}>
          Moderation and administrative control center
        </p>

        {error && (
          <div style={{
            background: 'var(--status-banned-bg)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: 'var(--status-banned)',
            padding: '0.75rem 1rem',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.85rem',
            marginBottom: '1.25rem',
            textAlign: 'left'
          }}>
            {error}
          </div>
        )}

        {message && (
          <div style={{
            background: 'var(--status-active-bg)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            color: 'var(--status-active)',
            padding: '0.75rem 1rem',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.85rem',
            marginBottom: '1.25rem',
            textAlign: 'left'
          }}>
            {message}
          </div>
        )}

        {step === 'email' ? (
          <form onSubmit={handleSendOtp}>
            <div className="form-group">
              <label className="form-label">Authorized Admin Email</label>
              <input
                type="email"
                className="form-input"
                placeholder="admin@vitbhopal.ac.in"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', marginTop: '0.5rem' }}
              disabled={loading}
            >
              {loading ? 'Sending Code...' : 'Continue with OTP →'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp}>
            <div className="form-group">
              <label className="form-label">6-Digit Verification Code</label>
              <input
                type="text"
                maxLength={6}
                className="form-input"
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                autoFocus
                style={{ textAlign: 'center', letterSpacing: '0.3em', fontSize: '1.25rem', fontWeight: 700 }}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', marginTop: '0.5rem' }}
              disabled={loading}
            >
              {loading ? 'Verifying...' : 'Access Dashboard 🚀'}
            </button>

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ width: '100%', marginTop: '0.75rem' }}
              onClick={() => setStep('email')}
            >
              ← Back to Email
            </button>
          </form>
        )}

        <div style={{ marginTop: '2rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '1.25rem' }}>
          <button
            type="button"
            onClick={handleDevBypass}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: '0.75rem',
              cursor: 'pointer',
              textDecoration: 'underline'
            }}
          >
            Direct Token Access (Dev / Emergency)
          </button>
        </div>
      </div>
    </div>
  );
}
