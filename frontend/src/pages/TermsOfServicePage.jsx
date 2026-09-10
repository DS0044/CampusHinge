import { useNavigate, Link } from 'react-router-dom';

export default function TermsOfServicePage() {
  const navigate = useNavigate();

  return (
    <div className="page legal-page" style={{ justifyContent: 'flex-start' }}>
      {/* Navigation header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: '1.25rem' }}>
        <button
          onClick={() => navigate('/login')}
          className="btn-secondary"
          style={{
            padding: '0.5rem 1rem',
            fontSize: '0.85rem',
            borderRadius: 'var(--radius-full)',
            cursor: 'pointer',
          }}
        >
          ← Back to Sign In
        </button>
        <Link
          to="/privacy"
          style={{
            fontSize: '0.85rem',
            color: 'var(--primary-pink)',
            textDecoration: 'underline',
            fontWeight: 600,
          }}
        >
          View Privacy Policy →
        </Link>
      </div>

      <div className="glass-card" style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.65rem', marginBottom: '0.35rem' }}>Terms &amp; Conditions</h1>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-dim)' }}>
            Last updated: September 10, 2026
          </span>
          <span style={{ fontSize: '0.75rem', padding: '0.15rem 0.5rem', background: 'rgba(255,64,129,0.15)', color: 'var(--primary-pink)', borderRadius: '4px', fontWeight: 600 }}>
            Version 1.0
          </span>
        </div>
      </div>

      <div className="glass-card legal-content" style={{ lineHeight: 1.8 }}>
        <section>
          <h2>1. Acceptance of Terms &amp; Conditions</h2>
          <p>
            Welcome to <strong>CampusHinge</strong> ("we," "our," or "the Platform"). By accessing, registering for,
            or using our application via web or mobile devices, you acknowledge that you have read, understood, and agree
            to be bound by these Terms &amp; Conditions ("Terms") and our <Link to="/privacy" style={{ color: 'var(--primary-pink)' }}>Privacy Policy</Link>.
            If you do not agree to these Terms, you may not access or use the Platform.
          </p>
        </section>

        <section>
          <h2>2. Minimum Age &amp; Eligibility Requirements</h2>
          <p>CampusHinge is exclusively crafted for authentic university and college communities. To register, create a profile, or use CampusHinge, you represent and warrant that:</p>
          <ul>
            <li>You are at least <strong>18 years of age</strong>. We enforce a strict zero-tolerance policy against underage accounts.</li>
            <li>You are an actively enrolled undergraduate, postgraduate student, or faculty member/alumnus affiliated with an approved educational institution.</li>
            <li>You possess a valid, active college-issued email address under an authorized campus domain (such as <code>@vitbhopal.ac.in</code>, <code>@lnctu.ac.in</code>, <code>@lpu.co.in</code>, <code>@bits-pilani.ac.in</code>, or approved university extensions).</li>
            <li>You have not been previously suspended, banned, or removed from CampusHinge for violating our community safety rules.</li>
          </ul>
        </section>

        <section>
          <h2>3. Campus Email OTP Verification &amp; Account Authenticity</h2>
          <p>
            To eliminate bot profiles, malicious actors, and non-student intruders, CampusHinge mandates strict cryptographic and email-based authentication:
          </p>
          <ul>
            <li><strong>Domain Restriction:</strong> Registration is restricted strictly to verified institutional email domains. Generic personal emails (such as Gmail, Yahoo, Outlook) are prohibited unless explicitly whitelisted for certified development testing.</li>
            <li><strong>One-Time Password (OTP) Flow:</strong> Accounts are authenticated via single-use 6-digit verification codes dispatched directly to your college inbox with strict 10-minute expirations and 30-second resend cooldowns.</li>
            <li><strong>Single Account Policy:</strong> You may only register and operate one active user account corresponding to your verified student identity. You may not share, sell, transfer, or lend account credentials to any third party.</li>
            <li><strong>How Your College Email is Handled:</strong> Your campus email is utilized exclusively for verification, secure session management, and crucial account notifications. We do <strong>not</strong> sell, rent, or trade your email address to commercial marketing brokers or third-party advertisers.</li>
          </ul>
        </section>

        <section>
          <h2>4. Profile Requirements &amp; Photo Guidelines</h2>
          <p>
            To foster a transparent and genuine dating and networking environment, every user must adhere to our profile standards before participating in matching:
          </p>
          <ul>
            <li><strong>Mandatory Profile Completion:</strong> You must supply your authentic first name, academic branch/discipline, year of study, self-identified gender, and dating preference.</li>
            <li><strong>Minimum Photo Quota:</strong> Users must upload a minimum of <strong>two (2) authentic, high-quality photographs</strong> displaying their clear, recognizable likeness before browsing campus decks or unlocking interactive features.</li>
            <li><strong>Prohibited Media:</strong> You agree not to upload any imagery containing nudity, sexually suggestive or pornographic poses, violence, hate symbols, weapons, illicit substances, or copyrighted photographs belonging to others.</li>
            <li><strong>Anti-Catfishing &amp; Impersonation:</strong> Impersonating another student, utilizing AI-generated fake personas (deepfakes), or misrepresenting your college graduation year is strictly forbidden and constitutes immediate grounds for permanent banning.</li>
          </ul>
        </section>

        <section>
          <h2>5. Matching, Swiping &amp; Super-Like Mechanics</h2>
          <p>
            CampusHinge utilizes an algorithmic discovery deck designed to connect students sharing academic backgrounds and mutual interests:
          </p>
          <ul>
            <li><strong>Mutual Consent Matching:</strong> A match is formed only when two users mutually express interest ("Like"). Neither party can initiate direct messaging until mutual consent is established.</li>
            <li><strong>Super-Like Capability:</strong> Users can send prioritized Super-Likes subject to campus affinity filters (such as requiring 4+ shared interests) and daily frequency limits.</li>
            <li><strong>Daily Limits &amp; Cool-Off:</strong> Free accounts are subject to daily swipe quotas that reset every 24 hours to prevent spamming and automated swiping.</li>
          </ul>
        </section>

        <section>
          <h2>6. Subscriptions &amp; Payments</h2>
          <p>
            CampusHinge may offer premium subscription plans ("CampusHinge Premium") that grant access to enhanced features such as unlimited swipes, profile rewinds, and match boosts:
          </p>
          <ul>
            <li><strong>Billing &amp; Processing:</strong> Payments are processed via authorized payment gateways (e.g. Razorpay). By subscribing, you authorize recurring charges in accordance with the selected billing cycle.</li>
            <li><strong>Refund Policy:</strong> All subscription fees are non-refundable except where required by applicable consumer protection laws.</li>
            <li><strong>Cancellation:</strong> You may cancel your subscription at any time via your account settings. Access to premium features will continue until the end of the current billing cycle.</li>
          </ul>
        </section>

        <section>
          <h2>7. User Conduct &amp; Safety Guidelines</h2>
          <p>
            You agree to interact respectfully with other members of the campus community. You must NOT:
          </p>
          <ul>
            <li>Harass, stalk, intimidate, bully, or defame any member of CampusHinge.</li>
            <li>Send unsolicited explicit messages, solicitations, commercial promotions, or spam.</li>
            <li>Publish or share private communications or photos of another user without their explicit consent.</li>
            <li>Use the platform for commercial solicitation, prostitution, or human trafficking.</li>
          </ul>
        </section>

        <section>
          <h2>8. Intellectual Property</h2>
          <p>
            All visual designs, logos, software code, databases, and graphical elements associated with CampusHinge are the exclusive intellectual property of CampusHinge and its licensors.
            You may not copy, modify, distribute, or reverse-engineer any portion of the service.
          </p>
        </section>

        <section>
          <h2>9. Data Protection &amp; Privacy Basics</h2>
          <p>
            We adhere to rigorous data hygiene practices:
          </p>
          <ul>
            <li>Data in transit is protected using modern HTTPS / TLS 1.3 encryption.</li>
            <li>Session credentials utilize cryptographically signed JSON Web Tokens (JWT).</li>
            <li>You maintain ownership of your photographs and personal text, granting CampusHinge a limited license solely necessary to host, display, and deliver content within the platform.</li>
            <li>For comprehensive disclosures on data collection, local storage tokens, and retention periods, consult our <Link to="/privacy" style={{ color: 'var(--primary-pink)' }}>Privacy Policy</Link>.</li>
          </ul>
          <p style={{ color: 'var(--primary-pink)', fontWeight: 600 }}>
            📧 dd961847@gmail.com
          </p>
        </section>

        {/* Accept & Return Action Section */}
        <section style={{ marginTop: '2rem', padding: '1.25rem', background: 'rgba(255, 64, 129, 0.06)', borderRadius: '12px', border: '1px solid rgba(255, 64, 129, 0.25)', textAlign: 'center' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '0.4rem', color: '#fff' }}>Ready to create your account?</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.2rem' }}>
            By tapping below, you agree to these Terms &amp; Conditions and can complete verification.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'center' }}>
            <button
              onClick={() => {
                sessionStorage.setItem('acceptedTerms', 'true');
                navigate('/login', { state: { acceptedTerms: true } });
              }}
              className="btn-primary"
              style={{ width: '100%', maxWidth: '320px', cursor: 'pointer', padding: '0.9rem 1.5rem', fontSize: '0.95rem' }}
            >
              ✓ Agree &amp; Return to Sign In
            </button>
            <button
              onClick={() => navigate('/login')}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                fontSize: '0.85rem',
                cursor: 'pointer',
                textDecoration: 'underline',
                padding: '0.3rem',
              }}
            >
              ← Back to Sign In without agreeing
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
