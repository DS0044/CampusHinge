import { useNavigate } from 'react-router-dom';

export default function PrivacyPolicyPage() {
  const navigate = useNavigate();

  return (
    <div className="page legal-page" style={{ justifyContent: 'flex-start' }}>
      {/* Back button */}
      <button
        onClick={() => navigate('/login')}
        className="btn-secondary"
        style={{
          alignSelf: 'flex-start',
          padding: '0.5rem 1rem',
          fontSize: '0.85rem',
          marginBottom: '1rem',
          borderRadius: 'var(--radius-full)',
          cursor: 'pointer',
        }}
      >
        ← Back to Sign In
      </button>

      <div className="glass-card" style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', marginBottom: '0.3rem' }}>Privacy Policy</h1>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
          Last updated: September 10, 2026
        </p>
      </div>

      <div className="glass-card legal-content" style={{ lineHeight: 1.75 }}>
        <section>
          <h2>1. Introduction</h2>
          <p>
            Welcome to CampusHinge ("we," "our," or "us"). CampusHinge is a campus-verified
            dating platform that connects students from verified educational institutions.
            We are committed to protecting your privacy and handling your personal data
            with care and transparency.
          </p>
          <p>
            This Privacy Policy explains how we collect, use, disclose, and safeguard your
            information when you use our platform at{' '}
            <a href="https://www.campushinge.online" style={{ color: 'var(--primary-pink)' }}>
              www.campushinge.online
            </a>.
          </p>
        </section>

        <section>
          <h2>2. Information We Collect</h2>

          <h3>2.1 Information from Google Sign-In</h3>
          <p>
            When you sign in using your Google account, we receive the following information
            from Google:
          </p>
          <ul>
            <li><strong>Email address</strong> — Used to verify your campus affiliation</li>
            <li><strong>Full name</strong> — Used for your profile display name</li>
            <li><strong>Profile picture</strong> — Used as your default avatar (optional)</li>
            <li><strong>Google account ID</strong> — Used for authentication purposes only</li>
          </ul>
          <p>
            We only request the minimum permissions necessary (email and basic profile).
            We do <strong>not</strong> access your Google contacts, Gmail, Google Drive,
            calendar, or any other Google services.
          </p>

          <h3>2.2 Profile Information You Provide</h3>
          <p>When you set up your profile, you may voluntarily provide:</p>
          <ul>
            <li>Display name and bio</li>
            <li>Age and gender</li>
            <li>College/university name</li>
            <li>Profile photos</li>
            <li>Interests and preferences</li>
          </ul>

          <h3>2.3 Usage Data</h3>
          <p>We automatically collect certain information when you use our platform:</p>
          <ul>
            <li>Swipe and match activity</li>
            <li>Chat messages (stored for delivery purposes)</li>
            <li>Device information and browser type</li>
            <li>Timestamps and session information</li>
          </ul>
        </section>

        <section>
          <h2>3. How We Use Your Information</h2>
          <p>We use the information we collect to:</p>
          <ul>
            <li>Verify your campus email domain for eligibility</li>
            <li>Create and maintain your account</li>
            <li>Display your profile to other verified campus users</li>
            <li>Facilitate matches and enable messaging</li>
            <li>Send important account notifications</li>
            <li>Improve and maintain our platform</li>
            <li>Prevent fraud and ensure platform safety</li>
          </ul>
        </section>

        <section>
          <h2>4. Data Sharing & Disclosure</h2>
          <p>We do <strong>not</strong> sell, trade, or rent your personal data to third parties. We may share information only in these cases:</p>
          <ul>
            <li>
              <strong>With other users:</strong> Your profile information (name, photos, bio,
              college) is visible to other verified users on the platform as part of the
              matching experience.
            </li>
            <li>
              <strong>Service providers:</strong> We use trusted third-party services
              (Cloudflare for hosting, Vercel for frontend delivery) that may process data
              on our behalf under strict confidentiality obligations.
            </li>
            <li>
              <strong>Legal requirements:</strong> We may disclose information if required
              by law, court order, or governmental regulation.
            </li>
          </ul>
        </section>

        <section>
          <h2>5. Data Storage & Security</h2>
          <p>
            Your data is stored securely using Cloudflare's infrastructure with encryption
            in transit (HTTPS/TLS) and at rest. We implement industry-standard security
            measures including:
          </p>
          <ul>
            <li>JWT-based authentication with secure token handling</li>
            <li>Encrypted data storage</li>
            <li>Regular security reviews</li>
            <li>Access controls and monitoring</li>
          </ul>
        </section>

        <section>
          <h2>6. Your Rights</h2>
          <p>You have the right to:</p>
          <ul>
            <li><strong>Access</strong> your personal data stored on our platform</li>
            <li><strong>Update or correct</strong> your profile information at any time</li>
            <li><strong>Delete your account</strong> and all associated data</li>
            <li><strong>Revoke Google permissions</strong> via your Google Account settings at{' '}
              <a href="https://myaccount.google.com/permissions" style={{ color: 'var(--primary-pink)' }}>
                myaccount.google.com/permissions
              </a>
            </li>
          </ul>
        </section>

        <section>
          <h2>7. Cookies & Local Storage</h2>
          <p>
            We use browser local storage to maintain your session (authentication token).
            We do not use third-party tracking cookies. Google's sign-in widget may set
            its own cookies as described in{' '}
            <a href="https://policies.google.com/privacy" style={{ color: 'var(--primary-pink)' }}>
              Google's Privacy Policy
            </a>.
          </p>
        </section>

        <section>
          <h2>8. Age Requirement</h2>
          <p>
            CampusHinge is intended for college/university students who are 18 years of age
            or older. We do not knowingly collect data from individuals under 18.
          </p>
        </section>

        <section>
          <h2>9. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. We will notify users of
            significant changes through the platform. Continued use of CampusHinge after
            changes constitutes acceptance of the updated policy.
          </p>
        </section>

        <section>
          <h2>10. Contact Us</h2>
          <p>
            If you have questions about this Privacy Policy or wish to exercise your data
            rights, please contact us at:
          </p>
          <p style={{ color: 'var(--primary-pink)', fontWeight: 600 }}>
            📧 dd961847@gmail.com
          </p>
        </section>
      </div>
    </div>
  );
}
