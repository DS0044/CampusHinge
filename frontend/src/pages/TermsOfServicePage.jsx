import { useNavigate } from 'react-router-dom';

export default function TermsOfServicePage() {
  const navigate = useNavigate();

  return (
    <div className="page legal-page" style={{ justifyContent: 'flex-start' }}>
      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        className="btn-secondary"
        style={{
          alignSelf: 'flex-start',
          padding: '0.5rem 1rem',
          fontSize: '0.85rem',
          marginBottom: '1rem',
          borderRadius: 'var(--radius-full)',
        }}
      >
        ← Back
      </button>

      <div className="glass-card" style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', marginBottom: '0.3rem' }}>Terms of Service</h1>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
          Last updated: September 10, 2026
        </p>
      </div>

      <div className="glass-card legal-content" style={{ lineHeight: 1.75 }}>
        <section>
          <h2>1. Acceptance of Terms</h2>
          <p>
            By accessing or using CampusHinge ("the Platform"), available at{' '}
            <a href="https://www.campushinge.online" style={{ color: 'var(--primary-pink)' }}>
              www.campushinge.online
            </a>,
            you agree to be bound by these Terms of Service ("Terms"). If you do not agree
            to these Terms, please do not use the Platform.
          </p>
        </section>

        <section>
          <h2>2. Eligibility</h2>
          <p>To use CampusHinge, you must:</p>
          <ul>
            <li>Be at least <strong>18 years of age</strong></li>
            <li>Be a current student or alumnus of a supported educational institution</li>
            <li>Have a valid campus email address from a supported domain (e.g., vitbhopal.ac.in, lpu.co.in, bits-pilani.ac.in, galgotiasuniversity.ac.in)</li>
            <li>Sign in using a Google account associated with your campus email</li>
          </ul>
          <p>
            We reserve the right to verify your eligibility and revoke access if you do
            not meet these requirements.
          </p>
        </section>

        <section>
          <h2>3. Account Registration</h2>
          <p>
            You register by signing in with your Google account. You are responsible for
            maintaining the security of your account. You agree to:
          </p>
          <ul>
            <li>Provide accurate and truthful profile information</li>
            <li>Not create multiple accounts</li>
            <li>Not share your account with others</li>
            <li>Notify us immediately of any unauthorized access to your account</li>
          </ul>
        </section>

        <section>
          <h2>4. User Conduct</h2>
          <p>You agree <strong>not</strong> to:</p>
          <ul>
            <li>Harass, bully, threaten, or intimidate other users</li>
            <li>Post or share obscene, offensive, or sexually explicit content</li>
            <li>Impersonate another person or misrepresent your identity</li>
            <li>Use the Platform for solicitation, advertising, or commercial purposes</li>
            <li>Attempt to hack, scrape, or reverse-engineer the Platform</li>
            <li>Use automated bots, scripts, or tools to interact with the Platform</li>
            <li>Collect personal information of other users without consent</li>
            <li>Share private conversations or user information outside the Platform</li>
            <li>Engage in any activity that violates applicable laws or regulations</li>
          </ul>
          <p>
            Violation of these rules may result in immediate suspension or permanent ban
            from the Platform without prior notice.
          </p>
        </section>

        <section>
          <h2>5. User Content</h2>
          <p>
            You retain ownership of all content you post (photos, bio, messages). By posting
            content on CampusHinge, you grant us a non-exclusive, worldwide, royalty-free
            license to use, display, and distribute your content solely for the purpose of
            operating the Platform.
          </p>
          <p>You are solely responsible for the content you post. You represent that:</p>
          <ul>
            <li>You own or have the right to share all content you post</li>
            <li>Your content does not infringe any third-party rights</li>
            <li>Your content complies with these Terms and applicable laws</li>
          </ul>
          <p>
            We reserve the right to remove any content that violates these Terms without
            prior notice.
          </p>
        </section>

        <section>
          <h2>6. Matching & Messaging</h2>
          <p>
            CampusHinge facilitates connections between verified campus users. We do not
            guarantee compatibility, the quality of matches, or the outcome of any
            interaction. You acknowledge that:
          </p>
          <ul>
            <li>Matches are based on mutual interest (both users must like each other)</li>
            <li>We are not responsible for the behavior of other users</li>
            <li>You interact with other users at your own risk</li>
            <li>Messages are stored for delivery purposes and may be moderated for safety</li>
          </ul>
        </section>

        <section>
          <h2>7. Safety & Reporting</h2>
          <p>
            Your safety is important to us. If you encounter inappropriate behavior,
            harassment, or feel unsafe, please:
          </p>
          <ul>
            <li>Report the user through the Platform</li>
            <li>Contact us at <span style={{ color: 'var(--primary-pink)' }}>dd961847@gmail.com</span></li>
            <li>Contact local authorities if you feel in immediate danger</li>
          </ul>
          <p>
            <strong>Safety tip:</strong> Always meet in public places. Tell a friend where
            you're going. Trust your instincts.
          </p>
        </section>

        <section>
          <h2>8. Subscriptions & Payments</h2>
          <p>
            CampusHinge may offer premium features through paid subscriptions. If applicable:
          </p>
          <ul>
            <li>Pricing and features will be clearly displayed before purchase</li>
            <li>Payments are processed through secure third-party providers (Razorpay)</li>
            <li>Subscription terms (duration, renewal, cancellation) will be specified at purchase</li>
            <li>Refunds are subject to our refund policy and applicable regulations</li>
          </ul>
        </section>

        <section>
          <h2>9. Intellectual Property</h2>
          <p>
            The CampusHinge name, logo, design, code, and all related intellectual property
            are owned by CampusHinge. You may not copy, modify, distribute, or create
            derivative works from any part of our Platform without explicit written permission.
          </p>
        </section>

        <section>
          <h2>10. Disclaimer of Warranties</h2>
          <p>
            CampusHinge is provided <strong>"as is"</strong> and <strong>"as available"</strong>{' '}
            without warranties of any kind, either express or implied. We do not warrant that:
          </p>
          <ul>
            <li>The Platform will be uninterrupted, error-free, or secure</li>
            <li>Any matches will lead to successful relationships</li>
            <li>All user profiles are genuine or accurate</li>
          </ul>
        </section>

        <section>
          <h2>11. Limitation of Liability</h2>
          <p>
            To the maximum extent permitted by law, CampusHinge and its operators shall not
            be liable for any indirect, incidental, special, consequential, or punitive
            damages arising from your use of the Platform, including but not limited to
            damages for loss of data, personal injury, or emotional distress.
          </p>
        </section>

        <section>
          <h2>12. Account Termination</h2>
          <p>
            You may delete your account at any time. We reserve the right to suspend or
            terminate accounts that violate these Terms. Upon termination:
          </p>
          <ul>
            <li>Your profile will be removed from the Platform</li>
            <li>Your matches and conversations will be deleted</li>
            <li>You may lose access to any premium features</li>
          </ul>
        </section>

        <section>
          <h2>13. Changes to Terms</h2>
          <p>
            We may modify these Terms at any time. Material changes will be communicated
            through the Platform. Continued use after changes constitutes acceptance of the
            new Terms.
          </p>
        </section>

        <section>
          <h2>14. Governing Law</h2>
          <p>
            These Terms are governed by and construed in accordance with the laws of India.
            Any disputes shall be subject to the exclusive jurisdiction of the courts in
            Bhopal, Madhya Pradesh, India.
          </p>
        </section>

        <section>
          <h2>15. Contact Us</h2>
          <p>
            For questions, concerns, or feedback regarding these Terms, please contact us at:
          </p>
          <p style={{ color: 'var(--primary-pink)', fontWeight: 600 }}>
            📧 dd961847@gmail.com
          </p>
        </section>
      </div>
    </div>
  );
}
