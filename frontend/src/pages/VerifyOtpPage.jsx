import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { authApi, setToken } from '../api';

const COOLDOWN_DURATION = 30;

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function getRemainingSeconds(cleanEmail) {
  if (!cleanEmail) return 0;
  const sentAtStr = sessionStorage.getItem(`otp_sent_at_${cleanEmail}`);
  if (!sentAtStr) return 0;
  const sentAt = parseInt(sentAtStr, 10);
  if (isNaN(sentAt)) return 0;
  const elapsed = Math.floor((Date.now() - sentAt) / 1000);
  const remaining = COOLDOWN_DURATION - elapsed;
  return remaining > 0 ? remaining : 0;
}

export default function VerifyOtpPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState(location.state?.email || '');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [resendError, setResendError] = useState('');
  const [resendSuccess, setResendSuccess] = useState('');
  const [cooldownTrigger, setCooldownTrigger] = useState(0);

  const cleanEmail = email.trim().toLowerCase();
  const [remainingSeconds, setRemainingSeconds] = useState(() => getRemainingSeconds(cleanEmail));

  const isLogin = Boolean(location.state?.isLogin);

  // Countdown timer with unmount cleanup and sessionStorage persistence
  useEffect(() => {
    if (!cleanEmail) {
      setRemainingSeconds(0);
      return;
    }

    // If no timestamp exists in sessionStorage yet, initialize it
    if (!sessionStorage.getItem(`otp_sent_at_${cleanEmail}`)) {
      sessionStorage.setItem(`otp_sent_at_${cleanEmail}`, Date.now().toString());
    }

    const updateRemaining = () => {
      const remaining = getRemainingSeconds(cleanEmail);
      setRemainingSeconds(remaining);
      return remaining;
    };

    const initialRemaining = updateRemaining();
    if (initialRemaining <= 0) return;

    const intervalId = setInterval(() => {
      const remaining = updateRemaining();
      if (remaining <= 0) {
        clearInterval(intervalId);
      }
    }, 1000);

    return () => clearInterval(intervalId);
  }, [cleanEmail, cooldownTrigger]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setResendError('');
    setResendSuccess('');
    setLoading(true);
    try {
      const res = await authApi.verifyOtp(email, code);
      setToken(res.data.token);
      // Clear OTP cooldown storage on successful login/verification
      sessionStorage.removeItem(`otp_sent_at_${cleanEmail}`);
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

  async function handleResend(e) {
    if (e) e.preventDefault();
    if (remainingSeconds > 0 || resending || !cleanEmail) return;

    setResending(true);
    setResendError('');
    setResendSuccess('');
    setError('');

    try {
      const res = await authApi.resendOtp(cleanEmail);
      sessionStorage.setItem(`otp_sent_at_${cleanEmail}`, Date.now().toString());
      setCooldownTrigger((prev) => prev + 1);
      setResendSuccess(res.message || 'New verification code sent! Check your email.');
    } catch (err) {
      // If resend fails, show inline error and keep resend available immediately
      setResendError(err.message || 'Failed to resend verification code.');
      // If server rejected due to remaining cooldown, sync timer with server retryAfter
      if (err.retryAfter) {
        const retrySec = parseInt(err.retryAfter, 10);
        if (!isNaN(retrySec) && retrySec > 0) {
          const fakeSentAt = Date.now() - (COOLDOWN_DURATION - retrySec) * 1000;
          sessionStorage.setItem(`otp_sent_at_${cleanEmail}`, fakeSentAt.toString());
          setCooldownTrigger((prev) => prev + 1);
        }
      }
    } finally {
      setResending(false);
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
              onChange={(e) => {
                setEmail(e.target.value);
                setError('');
                setResendError('');
                setResendSuccess('');
              }}
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
              onChange={(e) => {
                setCode(e.target.value.replace(/\D/g, ''));
                if (error) setError('');
              }}
              required
              disabled={loading}
              style={{ letterSpacing: '0.3em', textAlign: 'center', fontSize: '1.25rem', fontWeight: 'bold' }}
            />
          </label>

          <button type="submit" className="btn-primary" disabled={loading || code.length !== 6} style={{ marginTop: '0.5rem' }}>
            {loading ? 'Verifying...' : 'Verify & Enter'}
          </button>
        </form>

        {/* Resend OTP Section */}
        <div style={{ marginTop: '1.35rem', textAlign: 'center' }}>
          {remainingSeconds > 0 ? (
            <div>
              <button
                type="button"
                disabled={true}
                className="btn-resend-disabled"
                style={{
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid var(--glass-border)',
                  color: 'var(--text-dim)',
                  padding: '0.5rem 1rem',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  cursor: 'not-allowed',
                  opacity: 0.6,
                  pointerEvents: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <span>Resend OTP in {formatTime(remainingSeconds)}</span>
              </button>
            </div>
          ) : (
            <div>
              <button
                type="button"
                onClick={handleResend}
                disabled={resending || !cleanEmail}
                className="btn-resend-active"
                style={{
                  background: 'rgba(255, 64, 129, 0.08)',
                  border: '1px solid var(--primary-pink)',
                  color: 'var(--text-main)',
                  padding: '0.5rem 1.1rem',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: resending || !cleanEmail ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  transition: 'all 0.2s ease',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--primary-pink)" strokeWidth="2">
                  <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                </svg>
                <span>{resending ? 'Sending New Code...' : 'Resend OTP'}</span>
              </button>
            </div>
          )}

          {/* Inline feedback for Resend */}
          {resendError && (
            <p className="error" style={{ marginTop: '0.65rem', fontSize: '0.84rem' }}>
              {resendError}
            </p>
          )}
          {resendSuccess && (
            <p className="success" style={{ marginTop: '0.65rem', fontSize: '0.84rem' }}>
              {resendSuccess}
            </p>
          )}
        </div>

        {/* Verification error message */}
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
