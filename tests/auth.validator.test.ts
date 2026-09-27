import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isEmailAllowed, ALLOWLIST, signupSchema } from '../src/validators/auth.schema.js';
import { isAllowedDomain } from '../src/config/allowedDomains.js';

describe('Email Verification Allowlist & isEmailAllowed', () => {
  describe('Allowlist Configuration', () => {
    it('contains exact_domain for vitbhopal.ac.in', () => {
      const vitRule = ALLOWLIST.find(
        (r) => r.type === 'exact_domain' && r.value.toLowerCase() === 'vitbhopal.ac.in'
      );
      assert.ok(vitRule, 'VIT Bhopal domain should be in allowlist as exact_domain');
    });

    it('contains exact_email for international@LNCTU.ac.in', () => {
      const lnctuRule = ALLOWLIST.find(
        (r) => r.type === 'exact_email' && r.value.toLowerCase() === 'international@lnctu.ac.in'
      );
      assert.ok(lnctuRule, 'LNCTU exact email should be in allowlist');
    });

    it('contains exact_domain for lpu.co.in', () => {
      const lpuRule = ALLOWLIST.find(
        (r) => r.type === 'exact_domain' && r.value.toLowerCase() === 'lpu.co.in'
      );
      assert.ok(lpuRule, 'LPU exact domain should be in allowlist');
    });

    it('contains wildcard_subdomain for bits-pilani.ac.in', () => {
      const bitsRule = ALLOWLIST.find(
        (r) => r.type === 'wildcard_subdomain' && r.value.toLowerCase() === 'bits-pilani.ac.in'
      );
      assert.ok(bitsRule, 'BITS Pilani wildcard subdomain should be in allowlist');
    });
  });

  describe('1. Exact Email Match and Mismatch', () => {
    it('matches exact email international@LNCTU.ac.in', () => {
      assert.equal(isEmailAllowed('international@LNCTU.ac.in'), true);
      assert.equal(isEmailAllowed('international@lnctu.ac.in'), true);
    });

    it('rejects different local parts under the same domain', () => {
      assert.equal(isEmailAllowed('student@LNCTU.ac.in'), false);
      assert.equal(isEmailAllowed('admin@lnctu.ac.in'), false);
    });
  });

  describe('2. Exact Domain Match and Mismatch', () => {
    it('matches any email from exact_domain vitbhopal.ac.in', () => {
      assert.equal(isEmailAllowed('student@vitbhopal.ac.in'), true);
      assert.equal(isEmailAllowed('21bce10001@vitbhopal.ac.in'), true);
    });

    it('rejects domains that differ from exact_domain', () => {
      assert.equal(isEmailAllowed('student@vitvellore.ac.in'), false);
      assert.equal(isEmailAllowed('student@lpu.edu'), false);
    });
  });

  describe('3. Wildcard Subdomain Match', () => {
    it('matches pilani campus', () => {
      assert.equal(isEmailAllowed('f20200001@pilani.bits-pilani.ac.in'), true);
    });
    it('matches goa campus', () => {
      assert.equal(isEmailAllowed('f20200002@goa.bits-pilani.ac.in'), true);
    });
    it('matches hyderabad campus', () => {
      assert.equal(isEmailAllowed('f20200003@hyderabad.bits-pilani.ac.in'), true);
    });
    it('rejects domains that merely contain the substring', () => {
      assert.equal(isEmailAllowed('attacker@fakebits-pilani.ac.in'), false);
      assert.equal(isEmailAllowed('attacker@bits-pilani.ac.in.attacker.com'), false);
    });
  });

  describe('4. Rejection of Unrelated Domains', () => {
    it('rejects public email providers', () => {
      assert.equal(isEmailAllowed('user@gmail.com'), false);
      assert.equal(isEmailAllowed('test@yahoo.com'), false);
    });
    it('handles invalid / malformed inputs safely', () => {
      // @ts-expect-error — intentionally testing non-string inputs
      assert.equal(isEmailAllowed(null), false);
      // @ts-expect-error
      assert.equal(isEmailAllowed(undefined), false);
      assert.equal(isEmailAllowed(''), false);
      assert.equal(isEmailAllowed('@vitbhopal.ac.in'), false);
      assert.equal(isEmailAllowed('user@'), false);
    });
  });

  describe('5. Case-insensitivity', () => {
    it('handles uppercase in exact_email', () => {
      assert.equal(isEmailAllowed('INTERNATIONAL@LNCTU.AC.IN'), true);
    });
    it('handles uppercase in exact_domain', () => {
      assert.equal(isEmailAllowed('STUDENT@VITBHOPAL.AC.IN'), true);
    });
    it('handles uppercase in wildcard_subdomain', () => {
      assert.equal(isEmailAllowed('STUDENT@PILANI.BITS-PILANI.AC.IN'), true);
    });
  });

  describe('6. Signup Validation Error Message', () => {
    it('accepts eligible emails', () => {
      const validEmails = [
        'student@vitbhopal.ac.in',
        'international@lnctu.ac.in',
        'scholar@lpu.co.in',
        'coder@pilani.bits-pilani.ac.in',
      ];
      for (const email of validEmails) {
        const result = signupSchema.safeParse({ email });
        assert.equal(result.success, true, `Expected ${email} to be accepted`);
      }
    });
    it('returns the generic error for ineligible email', () => {
      const result = signupSchema.safeParse({ email: 'user@gmail.com' });
      assert.equal(result.success, false);
      if (!result.success) {
        const emailError = result.error.errors.find((e) => e.path.includes('email'));
        assert.ok(emailError);
        assert.equal(emailError.message, "This email isn't eligible for verification");
      }
    });
  });

  describe('7. ALLOWED_EXTRA_EMAILS Exception Allowlist', () => {
    it('allows ideepaksingh44@gmail.com via ALLOWED_EXTRA_EMAILS env var', () => {
      assert.equal(isEmailAllowed('ideepaksingh44@gmail.com'), true);
      assert.equal(isAllowedDomain('ideepaksingh44@gmail.com'), true);
    });
    it('still rejects other non-allowed emails under the same provider', () => {
      assert.equal(isEmailAllowed('otherperson@gmail.com'), false);
      assert.equal(isAllowedDomain('otherperson@gmail.com'), false);
    });
    it('allows custom extraEmails parameter', () => {
      assert.equal(
        isEmailAllowed('test.dev@gmail.com', undefined, 'test.dev@gmail.com, another@yahoo.com'),
        true
      );
      assert.equal(
        isEmailAllowed('unlisted@gmail.com', undefined, 'test.dev@gmail.com'),
        false
      );
    });
  });
});
