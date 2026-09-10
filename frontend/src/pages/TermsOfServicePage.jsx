import { useNavigate, Link } from 'react-router-dom';

export default function TermsOfServicePage() {
  const navigate = useNavigate();

  return (
    <div className="page legal-page" style={{ justifyContent: 'flex-start' }}>
      {/* Navigation header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: '1.25rem' }}>
        <button
          onClick={() => {
            if (window.history.length > 1) {
              navigate(-1);
            } else {
              navigate('/signup');
            }
          }}
          className="btn-secondary"
          style={{
            padding: '0.5rem 1rem',
            fontSize: '0.85rem',
            borderRadius: 'var(--radius-full)',
          }}
        >
          ← Back
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
            <li><strong>Super-Likes:</strong> Users may send a Super-Like to express high priority interest. Free accounts are limited to one (1) Super-Like every rolling 24-hour period, with priority notifications displayed in the recipient's activity feed.</li>
            <li><strong>Interest Affinity:</strong> Profiles display shared interests (such as coding, music, literature, sports). Shared interest counters assist in determining affinity ranking.</li>
            <li><strong>No Guarantee:</strong> We do not warrant or guarantee that you will receive matches, responses, or romantic compatibility.</li>
          </ul>
        </section>

        <section>
          <h2>6. Real-Time Chat &amp; Community Communications</h2>
          <p>
            Upon matching, users are granted access to private, real-time messaging powered by live WebSocket connections. When using chat, you agree to:
          </p>
          <ul>
            <li>Engage in polite, respectful, and consensual dialogue.</li>
            <li>Never transmit unrequested sexually explicit photos, unsolicited links, commercial sales pitches, or scam messages.</li>
            <li>Refrain from abusive language, stalking, persistent unwanted contact, intimidation, or extortion.</li>
            <li>Acknowledge that conversations may be subject to automated abuse detection and administrative review in the event of user reporting.</li>
          </ul>
        </section>

        <section>
          <h2>7. Subscriptions, Paywalls &amp; Payments</h2>
          <p>
            CampusHinge offers optional premium subscription plans (e.g., CampusHinge Gold/Plus) unlocking enhanced features such as unlimited swipes, the ability to see who liked your profile before swiping, additional super-likes, and profile badges:
          </p>
          <ul>
            <li><strong>Payment Gateway:</strong> All financial transactions and renewals are securely processed through authorized payment gateways (including Razorpay). CampusHinge does not store complete credit card or debit card numbers on its servers.</li>
            <li><strong>Subscription Validity:</strong> Paid privileges remain valid for the duration selected during purchase. When a subscription expires without renewal, accounts gracefully revert to standard free campus tier privileges.</li>
            <li><strong>Refunds:</strong> Unless explicitly required by applicable statutory consumer protection laws in India, subscription fees and digital purchases are non-refundable once activated.</li>
          </ul>
        </section>

        <section>
          <h2>8. Safety, In-App Reporting &amp; User Blocking</h2>
          <p>
            Your emotional and physical well-being is our highest priority:
          </p>
          <ul>
            <li><strong>Immediate User Blocking:</strong> You can block any matched user at any moment. Blocking instantly severs the match, deletes reciprocal chat visibility, and prevents future discovery on either user's feed.</li>
            <li><strong>Reporting System:</strong> If you observe any behavior that violates these Terms or poses a threat, you are strongly urged to submit an in-app report detailing the offense.</li>
            <li><strong>Real-World Meetups:</strong> When deciding to meet a match offline on or off campus, always choose public locations (such as campus cafeterias, libraries, or busy student centers), notify trusted friends or roommates, and arrange your own transportation.</li>
          </ul>
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
        </section>

        <section>
          <h2>10. Account Suspension, Termination &amp; Bans</h2>
          <p>
            We reserve the unconditional right to investigate reports and unilaterally suspend, deactivate, or permanently ban any account, without liability or refund, if:
          </p>
          <ul>
            <li>You violate any clause of these Terms or engage in conduct detrimental to the campus community.</li>
            <li>Your university email address is deactivated, revoked, or found to be invalid.</li>
            <li>You engage in fraudulent payment chargebacks or unauthorized transactions.</li>
            <li>You attempt to reverse-engineer, scrape, DDoS, or breach the application's APIs, databases, or WebSocket servers.</li>
          </ul>
          <p>
            You may also voluntary discontinue your use of the Platform and delete your account and associated profile data at any time via in-app profile settings.
          </p>
        </section>

        <section>
          <h2>11. Disclaimer of Warranties &amp; Limitation of Liability</h2>
          <p>
            CampusHinge is provided on an <strong>"AS IS"</strong> and <strong>"AS AVAILABLE"</strong> basis without warranties of any kind, whether express or implied.
            To the fullest extent permissible under applicable law, CampusHinge, its developers, operators, and affiliates disclaim all liability for any indirect,
            punitive, incidental, or consequential damages resulting from user conduct, offline interactions, loss of data, or service interruptions.
          </p>
        </section>

        <section>
          <h2>12. Updates to Terms &amp; Version Tracking</h2>
          <p>
            We may revise and update these Terms from time to time to accommodate new features, security protocols, or legal obligations.
            Any updates will be reflected with a revised <strong>"Last updated"</strong> date and incremented <strong>terms_version</strong> in our system.
            Your continuous usage of CampusHinge following any updates constitutes your explicit agreement and acceptance of the revised Terms.
          </p>
        </section>

        <section>
          <h2>13. Governing Law &amp; Dispute Resolution</h2>
          <p>
            These Terms &amp; Conditions are governed by and construed in accordance with the substantive laws of India. Any claim or dispute arising out
            of or relating to CampusHinge shall be subject to the exclusive jurisdiction of the competent courts located in Bhopal, Madhya Pradesh, India.
          </p>
        </section>

        <section>
          <h2>14. Contact &amp; Support</h2>
          <p>
            If you have questions, inquiries, or feedback regarding these Terms, please reach out to our administration team at:
          </p>
          <p style={{ color: 'var(--primary-pink)', fontWeight: 600 }}>
            📧 dd961847@gmail.com
          </p>
        </section>
      </div>
    </div>
  );
}
