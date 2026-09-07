const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  isEmailAllowed,
  ALLOWLIST,
  signupSchema,
} = require('../src/validators/auth.schema');

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

  describe('1. Exact Email Match and Mismatch (same domain, different local part)', () => {
    it('matches exact email international@LNCTU.ac.in', () => {
      assert.equal(isEmailAllowed('international@LNCTU.ac.in'), true);
      assert.equal(isEmailAllowed('international@lnctu.ac.in'), true);
    });

    it('rejects different local parts under the same domain (e.g. student@LNCTU.ac.in)', () => {
      assert.equal(isEmailAllowed('student@LNCTU.ac.in'), false);
      assert.equal(isEmailAllowed('admin@lnctu.ac.in'), false);
      assert.equal(isEmailAllowed('admissions@LNCTU.ac.in'), false);
    });
  });

  describe('2. Exact Domain Match and Mismatch', () => {
    it('matches any email from exact_domain vitbhopal.ac.in', () => {
      assert.equal(isEmailAllowed('student@vitbhopal.ac.in'), true);
      assert.equal(isEmailAllowed('faculty.member@vitbhopal.ac.in'), true);
      assert.equal(isEmailAllowed('21bce10001@vitbhopal.ac.in'), true);
    });

    it('matches any email from exact_domain lpu.co.in', () => {
      assert.equal(isEmailAllowed('student@lpu.co.in'), true);
      assert.equal(isEmailAllowed('john.doe@lpu.co.in'), true);
    });

    it('rejects domains that differ from exact_domain', () => {
      assert.equal(isEmailAllowed('student@vitvellore.ac.in'), false);
      assert.equal(isEmailAllowed('student@vitchennai.ac.in'), false);
      assert.equal(isEmailAllowed('student@lpu.edu'), false);
      assert.equal(isEmailAllowed('student@lpu.com'), false);
    });
  });

  describe('3. Wildcard Subdomain Match across Multiple Campuses', () => {
    it('matches pilani campus (pilani.bits-pilani.ac.in)', () => {
      assert.equal(isEmailAllowed('f20200001@pilani.bits-pilani.ac.in'), true);
      assert.equal(isEmailAllowed('student@pilani.bits-pilani.ac.in'), true);
    });

    it('matches goa campus (goa.bits-pilani.ac.in)', () => {
      assert.equal(isEmailAllowed('f20200002@goa.bits-pilani.ac.in'), true);
      assert.equal(isEmailAllowed('student@goa.bits-pilani.ac.in'), true);
    });

    it('matches hyderabad campus (hyderabad.bits-pilani.ac.in)', () => {
      assert.equal(isEmailAllowed('f20200003@hyderabad.bits-pilani.ac.in'), true);
      assert.equal(isEmailAllowed('student@hyderabad.bits-pilani.ac.in'), true);
    });

    it('matches apex domain and deeply nested subdomains', () => {
      assert.equal(isEmailAllowed('admin@bits-pilani.ac.in'), true);
      assert.equal(isEmailAllowed('student@cs.pilani.bits-pilani.ac.in'), true);
    });

    it('rejects domains that merely contain the substring without dot prefix', () => {
      assert.equal(isEmailAllowed('attacker@fakebits-pilani.ac.in'), false);
      assert.equal(isEmailAllowed('attacker@notbits-pilani.ac.in'), false);
      assert.equal(isEmailAllowed('attacker@bits-pilani.ac.in.attacker.com'), false);
    });
  });

  describe('4. Rejection of Unrelated / Random Domains', () => {
    it('rejects public email providers', () => {
      assert.equal(isEmailAllowed('user@gmail.com'), false);
      assert.equal(isEmailAllowed('test@yahoo.com'), false);
      assert.equal(isEmailAllowed('person@outlook.com'), false);
      assert.equal(isEmailAllowed('dev@hotmail.com'), false);
    });

    it('rejects non-allowlisted universities and arbitrary domains', () => {
      assert.equal(isEmailAllowed('student@harvard.edu'), false);
      assert.equal(isEmailAllowed('student@mit.edu'), false);
      assert.equal(isEmailAllowed('user@unknown-college.ac.in'), false);
    });

    it('handles invalid / malformed inputs safely without throwing', () => {
      assert.equal(isEmailAllowed(''), false);
      assert.equal(isEmailAllowed(null), false);
      assert.equal(isEmailAllowed(undefined), false);
      assert.equal(isEmailAllowed(123), false);
      assert.equal(isEmailAllowed('plainstring'), false);
      assert.equal(isEmailAllowed('@vitbhopal.ac.in'), false);
      assert.equal(isEmailAllowed('user@'), false);
      assert.equal(isEmailAllowed('user@@vitbhopal.ac.in'), false);
    });
  });

  describe('5. Case-insensitivity', () => {
    it('handles mixed/uppercase in exact_email (LNCTU.ac.in vs lnctu.ac.in)', () => {
      assert.equal(isEmailAllowed('international@LNCTU.ac.in'), true);
      assert.equal(isEmailAllowed('INTERNATIONAL@LNCTU.AC.IN'), true);
      assert.equal(isEmailAllowed('International@lnctu.ac.in'), true);
      assert.equal(isEmailAllowed('INTERNATIONAL@lnctu.ac.in'), true);
    });

    it('handles mixed/uppercase in exact_domain', () => {
      assert.equal(isEmailAllowed('STUDENT@VITBHOPAL.AC.IN'), true);
      assert.equal(isEmailAllowed('Student@VitBhopal.Ac.In'), true);
      assert.equal(isEmailAllowed('STUDENT@LPU.CO.IN'), true);
      assert.equal(isEmailAllowed('User@Lpu.Co.In'), true);
    });

    it('handles mixed/uppercase in wildcard_subdomain', () => {
      assert.equal(isEmailAllowed('STUDENT@PILANI.BITS-PILANI.AC.IN'), true);
      assert.equal(isEmailAllowed('Student@Goa.Bits-Pilani.Ac.In'), true);
      assert.equal(isEmailAllowed('USER@HYDERABAD.BITS-PILANI.AC.IN'), true);
    });
  });

  describe('6. Signup Validation Error Message', () => {
    it('accepts eligible email and parses successfully', () => {
      const validEmails = [
        'student@vitbhopal.ac.in',
        'international@lnctu.ac.in',
        'scholar@lpu.co.in',
        'coder@pilani.bits-pilani.ac.in',
      ];

      for (const email of validEmails) {
        const result = signupSchema.safeParse({ email });
        assert.equal(result.success, true, `Expected ${email} to be accepted by signupSchema`);
        assert.equal(result.data.email, email.toLowerCase().trim());
      }
    });

    it('returns the generic error message for ineligible email instead of listing allowed domains', () => {
      const invalidEmails = [
        'user@gmail.com',
        'student@lnctu.ac.in',
        'student@harvard.edu',
        'fake@notbits-pilani.ac.in',
      ];

      for (const email of invalidEmails) {
        const result = signupSchema.safeParse({ email });
        assert.equal(result.success, false, `Expected ${email} to fail validation`);
        const emailError = result.error.errors.find((e) => e.path.includes('email'));
        assert.ok(emailError, 'Should have error on email field');
        assert.equal(
          emailError.message,
          "This email isn't eligible for verification",
          'Error message must match generic specification'
        );
      }
    });
  });
});
