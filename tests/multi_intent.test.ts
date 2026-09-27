import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { updateIntentSchema, createProfileSchema } from '../src/validators/profile.schema.js';
import { swipeSchema } from '../src/validators/swipe.schema.js';
import {
  INTENTS,
  areCoursesCompatible,
  PREDEFINED_ACTIVITY_TAGS,
} from '../src/constants/intent.constants.js';
import { canSuperLike, scoreCandidateForIntent } from '../src/services/scoring.service.js';

describe('Multi-Intent Matching System Tests', () => {
  describe('1. Intent Validation Schemas', () => {
    it('accepts all 5 valid intents in updateIntentSchema', () => {
      for (const intent of INTENTS) {
        const res = updateIntentSchema.safeParse({ active_intent: intent });
        assert.equal(res.success, true, `Expected ${intent} to be valid`);
        if (res.success) assert.equal(res.data.active_intent, intent);
      }
    });

    it('rejects invalid intent strings in updateIntentSchema', () => {
      const invalidIntents = ['romance', 'hookup', 'business', '', 123, null];
      for (const bad of invalidIntents) {
        const res = updateIntentSchema.safeParse({ active_intent: bad });
        assert.equal(res.success, false, `Expected ${String(bad)} to fail validation`);
      }
    });

    it('validates activity_tags and active_intent in createProfileSchema', () => {
      const payload = {
        name: 'Test Student',
        bio: 'Hello campus world',
        photos: ['photo1.jpg', 'photo2.jpg'],
        branch: 'Computer Science',
        year: 2026,
        gender: 'male',
        interested_in: 'everyone',
        interests: ['Coding/Tech', 'Music'],
        activity_tags: ['Gym', 'Badminton'],
        active_intent: 'activity',
      };
      const res = createProfileSchema.safeParse(payload);
      assert.equal(res.success, true);
      if (res.success) {
        assert.equal(res.data.active_intent, 'activity');
        assert.deepEqual(res.data.activity_tags, ['Gym', 'Badminton']);
      }
    });

    it('swipeSchema accepts optional intent param for all 5 intents', () => {
      for (const intent of INTENTS) {
        const res = swipeSchema.safeParse({
          swiped_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
          action: 'like',
          intent,
        });
        assert.equal(res.success, true);
        if (res.success) assert.equal(res.data.intent, intent);
      }
    });
  });

  describe('2. Course Compatibility Logic (areCoursesCompatible)', () => {
    it('returns true for exact matching courses', () => {
      assert.equal(areCoursesCompatible('B.Tech CSE', 'B.Tech CSE'), true);
    });
    it('returns true for compatible tech groups', () => {
      assert.equal(areCoursesCompatible('B.Tech Computer Science', 'B.E. Information Technology'), true);
      assert.equal(areCoursesCompatible('BCA', 'MCA'), true);
    });
    it('returns false for unrelated courses', () => {
      assert.equal(areCoursesCompatible('B.Tech Civil', 'BA History'), false);
    });
    it('handles empty courses gracefully', () => {
      assert.equal(areCoursesCompatible('', 'B.Tech'), false);
      // @ts-expect-error — testing null input for robustness
      assert.equal(areCoursesCompatible(null, 'B.Tech'), false);
    });
  });

  describe('3. Intent-Aware Super Like Gating (canSuperLike)', () => {
    const baseUser = {
      interests: ['Coding/Tech', 'Music', 'Gaming', 'Reading'],
      activity_tags: ['Gym', 'Badminton', 'Football'],
      branch: 'Computer Science',
      year: 3,
    };

    it('Dating intent requires >= 4 shared interests', () => {
      const targetWith4 = { interests: ['Coding/Tech', 'Music', 'Gaming', 'Reading', 'Travel'] };
      const targetWith3 = { interests: ['Coding/Tech', 'Music', 'Gaming'] };
      assert.equal(canSuperLike('dating', baseUser, targetWith4).allowed, true);
      const result3 = canSuperLike('dating', baseUser, targetWith3);
      assert.equal(result3.allowed, false);
      assert.match(result3.reason ?? '', /4 or more/);
    });

    it('Study intent allows Super Like for compatible course & adjacent year', () => {
      const studyPartner = { interests: ['Art'], branch: 'Information Technology', year: 4 };
      assert.equal(canSuperLike('study', baseUser, studyPartner).allowed, true);
    });

    it('Study intent blocks Super Like when years are > 1 apart', () => {
      const studyPartner = { interests: ['Coding/Tech'], branch: 'Computer Science', year: 1 };
      const result = canSuperLike('study', baseUser, studyPartner);
      assert.equal(result.allowed, false);
      assert.match(result.reason ?? '', /adjacent graduation year/);
    });

    it('Activity intent allows Super Like if >= 2 shared activity tags', () => {
      const target = { activity_tags: ['Badminton', 'Gym'] };
      assert.equal(canSuperLike('activity', baseUser, target).allowed, true);
    });

    it('Activity intent blocks Super Like if < 2 shared activity tags', () => {
      const target = { activity_tags: ['Gym', 'Yoga'] }; // only 1 shared
      const result = canSuperLike('activity', baseUser, target);
      assert.equal(result.allowed, false);
      assert.match(result.reason ?? '', /2 or more activity tags/);
    });

    it('Networking intent allows Super Like for cross-branch connections', () => {
      const crossBranch = { branch: 'Mechanical Engineering', interests: ['Reading'] };
      assert.equal(canSuperLike('networking', baseUser, crossBranch).allowed, true);
    });

    it('Networking intent blocks when same branch and no shared career interests', () => {
      const sameNoCareer = { branch: 'Computer Science', interests: ['Music'] };
      const result = canSuperLike('networking', baseUser, sameNoCareer);
      assert.equal(result.allowed, false);
      assert.match(result.reason ?? '', /cross-branch/);
    });
  });

  describe('4. Intent-Aware Ranking & Scoring (scoreCandidateForIntent)', () => {
    const viewer = {
      id: 'viewer-1',
      gender: 'male',
      interested_in: 'female',
      year: 3,
      branch: 'Computer Science',
      interests: ['Coding/Tech', 'Entrepreneurship', 'Gaming'],
      activity_tags: ['Gym', 'Badminton'],
    };

    it('Dating scoring uses compatibility_score', () => {
      const c1 = { id: 'c1', interests: ['Coding/Tech', 'Gaming'], compatibility_score: 85 };
      const c2 = { id: 'c2', interests: ['Coding/Tech', 'Gaming'], compatibility_score: 45 };
      assert.equal(scoreCandidateForIntent('dating', viewer, c1), 85);
      assert.equal(scoreCandidateForIntent('dating', viewer, c2), 45);
    });

    it('Friendship scoring is gender-neutral and weights shared interests', () => {
      const femaleFriend = { id: 'f1', gender: 'female', year: 3, interests: ['Coding/Tech', 'Entrepreneurship', 'Gaming'] };
      const maleFriend = { id: 'f2', gender: 'male', year: 3, interests: ['Coding/Tech', 'Entrepreneurship', 'Gaming'] };
      const scoreFemale = scoreCandidateForIntent('friendship', viewer, femaleFriend);
      const scoreMale = scoreCandidateForIntent('friendship', viewer, maleFriend);
      assert.equal(scoreFemale, scoreMale, 'Friendship score should be gender-neutral');
      assert.ok(scoreFemale > 60);
    });

    it('Study scoring prioritizes course/branch and year similarity', () => {
      const sameBatchCS = { id: 's1', branch: 'Computer Science', year: 3, interests: ['Coding/Tech'] };
      const diffCourse = { id: 's2', branch: 'Fine Arts', year: 1, interests: [] as string[] };
      const scoreCS = scoreCandidateForIntent('study', viewer, sameBatchCS);
      const scoreArts = scoreCandidateForIntent('study', viewer, diffCourse);
      assert.ok(scoreCS > scoreArts, `CS (${scoreCS}) must outrank Arts 1st yr (${scoreArts})`);
    });

    it('Activity scoring rewards shared activity tags', () => {
      const buddy = { id: 'a1', activity_tags: ['Gym', 'Badminton'], interests: [] as string[] };
      const nonBuddy = { id: 'a2', activity_tags: ['Yoga'], interests: [] as string[] };
      const scoreBuddy = scoreCandidateForIntent('activity', viewer, buddy);
      const scorePeer = scoreCandidateForIntent('activity', viewer, nonBuddy);
      assert.ok(scoreBuddy > scorePeer, `Activity buddy (${scoreBuddy}) must outrank (${scorePeer})`);
    });

    it('Networking scoring gives cross-branch and career interest bonuses', () => {
      const crossEntrepreneur = { id: 'n1', branch: 'Business Administration', interests: ['Entrepreneurship'] };
      const sameBranchNoCareer = { id: 'n2', branch: 'Computer Science', interests: ['Gaming'] };
      const scoreCross = scoreCandidateForIntent('networking', viewer, crossEntrepreneur);
      const scoreSame = scoreCandidateForIntent('networking', viewer, sameBranchNoCareer);
      assert.ok(scoreCross > scoreSame, `Cross-branch (${scoreCross}) must outrank same-branch gamer (${scoreSame})`);
    });
  });

  describe('5. Predefined Activity Tags Consistency', () => {
    it('contains expected campus sports/activities', () => {
      assert.ok(PREDEFINED_ACTIVITY_TAGS.length >= 10);
      assert.ok(PREDEFINED_ACTIVITY_TAGS.includes('Gym'));
      assert.ok(PREDEFINED_ACTIVITY_TAGS.includes('Badminton'));
      assert.ok(PREDEFINED_ACTIVITY_TAGS.includes('Football'));
      assert.ok(PREDEFINED_ACTIVITY_TAGS.includes('Chess'));
    });
  });
});
