const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { updateIntentSchema, createProfileSchema } = require('../src/validators/profile.schema');
const { swipeSchema } = require('../src/validators/swipe.schema');
const {
  INTENTS,
  areCoursesCompatible,
  PREDEFINED_ACTIVITY_TAGS,
  CAREER_INTERESTS,
} = require('../src/constants/intent.constants');
const {
  canSuperLike,
  scoreCandidateForIntent,
} = require('../src/services/scoring.service');

describe('Multi-Intent Matching System Tests', () => {
  describe('1. Intent Validation Schemas', () => {
    it('accepts all 5 valid intents in updateIntentSchema', () => {
      for (const intent of INTENTS) {
        const res = updateIntentSchema.safeParse({ active_intent: intent });
        assert.equal(res.success, true, `Expected ${intent} to be valid`);
        assert.equal(res.data.active_intent, intent);
      }
    });

    it('rejects invalid intent strings in updateIntentSchema', () => {
      const invalidIntents = ['romance', 'hookup', 'business', '', 123, null];
      for (const bad of invalidIntents) {
        const res = updateIntentSchema.safeParse({ active_intent: bad });
        assert.equal(res.success, false, `Expected ${bad} to fail validation`);
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
      assert.equal(res.data.active_intent, 'activity');
      assert.deepEqual(res.data.activity_tags, ['Gym', 'Badminton']);
    });

    it('swipeSchema accepts optional intent param for all 5 intents', () => {
      for (const intent of INTENTS) {
        const res = swipeSchema.safeParse({
          swiped_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
          action: 'like',
          intent,
        });
        assert.equal(res.success, true);
        assert.equal(res.data.intent, intent);
      }
    });
  });

  describe('2. Course Compatibility Logic (areCoursesCompatible)', () => {
    it('returns true for exact matching courses', () => {
      assert.equal(areCoursesCompatible('B.Tech CSE', 'B.Tech CSE'), true);
      assert.equal(areCoursesCompatible('MBA', 'MBA'), true);
    });

    it('returns true for compatible engineering/tech course groups', () => {
      assert.equal(areCoursesCompatible('B.Tech Computer Science', 'B.E. Information Technology'), true);
      assert.equal(areCoursesCompatible('BCA', 'MCA'), true);
    });

    it('returns true for compatible management/commerce groups', () => {
      assert.equal(areCoursesCompatible('BBA', 'MBA'), true);
      assert.equal(areCoursesCompatible('B.Com', 'M.Com'), true);
    });

    it('returns false for unrelated courses', () => {
      assert.equal(areCoursesCompatible('B.Tech Civil', 'BA History'), false);
      assert.equal(areCoursesCompatible('MBBS', 'LLB'), false);
    });

    it('handles empty or missing courses gracefully', () => {
      assert.equal(areCoursesCompatible('', 'B.Tech'), false);
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
      const targetWith4 = {
        interests: ['Coding/Tech', 'Music', 'Gaming', 'Reading', 'Travel'],
      };
      const targetWith3 = {
        interests: ['Coding/Tech', 'Music', 'Gaming'],
      };

      const result4 = canSuperLike('dating', baseUser, targetWith4);
      assert.equal(result4.allowed, true);

      const result3 = canSuperLike('dating', baseUser, targetWith3);
      assert.equal(result3.allowed, false);
      assert.match(result3.reason, /4 or more/);
    });

    it('Friendship intent requires >= 4 shared interests', () => {
      const target = {
        interests: ['Coding/Tech', 'Music', 'Gaming', 'Reading'],
      };
      const result = canSuperLike('friendship', baseUser, target);
      assert.equal(result.allowed, true);
    });

    it('Study intent allows Super Like for compatible course and adjacent year', () => {
      const studyPartner = {
        interests: ['Art'],
        branch: 'Information Technology', // compatible with Computer Science
        year: 4, // adjacent to year 3
      };
      const result = canSuperLike('study', baseUser, studyPartner);
      assert.equal(result.allowed, true);
    });

    it('Study intent blocks Super Like when graduation years are far apart (> 1 year)', () => {
      const studyPartner = {
        interests: ['Coding/Tech'],
        branch: 'Computer Science',
        year: 1, // |3 - 1| = 2 > 1
      };
      const result = canSuperLike('study', baseUser, studyPartner);
      assert.equal(result.allowed, false);
      assert.match(result.reason, /same or adjacent graduation year/);
    });

    it('Study intent blocks Super Like when courses are incompatible', () => {
      const studyPartner = {
        interests: ['Music'],
        branch: 'Law',
        year: 3,
      };
      const result = canSuperLike('study', baseUser, studyPartner);
      assert.equal(result.allowed, false);
      assert.match(result.reason, /compatible course/);
    });

    it('Activity intent allows Super Like if >= 2 shared activity tags', () => {
      const target = {
        activity_tags: ['Badminton', 'Gym'],
      };
      const result = canSuperLike('activity', baseUser, target);
      assert.equal(result.allowed, true);
    });

    it('Activity intent blocks Super Like if fewer than 2 shared activity tags', () => {
      const target = {
        activity_tags: ['Gym', 'Yoga'], // only 1 shared ('Gym')
      };
      const result = canSuperLike('activity', baseUser, target);
      assert.equal(result.allowed, false);
      assert.match(result.reason, /2 or more activity tags/);
    });

    it('Networking intent allows Super Like for cross-branch connections', () => {
      const crossBranchUser = {
        branch: 'Mechanical Engineering',
        interests: ['Reading'],
      };
      const result = canSuperLike('networking', baseUser, crossBranchUser);
      assert.equal(result.allowed, true);
    });

    it('Networking intent allows Super Like with shared career interest', () => {
      const sameBranchWithCareer = {
        branch: 'Computer Science',
        interests: ['Coding/Tech'],
      };
      const result = canSuperLike('networking', baseUser, sameBranchWithCareer);
      assert.equal(result.allowed, true);
    });

    it('Networking intent blocks Super Like when same branch and no shared career interests', () => {
      const sameBranchNoCareer = {
        branch: 'Computer Science',
        interests: ['Music'], // not in CAREER_INTERESTS
      };
      const result = canSuperLike('networking', baseUser, sameBranchNoCareer);
      assert.equal(result.allowed, false);
      assert.match(result.reason, /cross-branch connections or shared career-oriented interests/);
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

    it('Dating scoring respects compatibility_score or shared interests fallback', () => {
      const candidate1 = {
        id: 'c1',
        interests: ['Coding/Tech', 'Gaming'],
        compatibility_score: 85,
      };
      const candidate2 = {
        id: 'c2',
        interests: ['Coding/Tech', 'Gaming'],
        compatibility_score: 45,
      };

      const score1 = scoreCandidateForIntent('dating', viewer, candidate1);
      const score2 = scoreCandidateForIntent('dating', viewer, candidate2);

      assert.equal(score1, 85);
      assert.equal(score2, 45);
      assert.ok(score1 > score2);
    });

    it('Friendship scoring is gender-neutral and heavily weights shared interests', () => {
      const femaleFriend = {
        id: 'f1',
        gender: 'female',
        year: 3,
        interests: ['Coding/Tech', 'Entrepreneurship', 'Gaming'],
      };
      const maleFriend = {
        id: 'f2',
        gender: 'male',
        year: 3,
        interests: ['Coding/Tech', 'Entrepreneurship', 'Gaming'],
      };

      const scoreFemale = scoreCandidateForIntent('friendship', viewer, femaleFriend);
      const scoreMale = scoreCandidateForIntent('friendship', viewer, maleFriend);

      assert.equal(scoreFemale, scoreMale, 'Friendship score should be gender-neutral');
      assert.ok(scoreFemale > 60);
    });

    it('Study scoring prioritizes course/branch match and year similarity', () => {
      const sameBatchCS = {
        id: 's1',
        branch: 'Computer Science',
        year: 3,
        interests: ['Coding/Tech'],
      };
      const diffCourseFirstYear = {
        id: 's2',
        branch: 'Fine Arts',
        year: 1,
        interests: [],
      };

      const scoreCS = scoreCandidateForIntent('study', viewer, sameBatchCS);
      const scoreArts = scoreCandidateForIntent('study', viewer, diffCourseFirstYear);

      assert.ok(scoreCS > scoreArts, `CS study buddy (${scoreCS}) must outrank unrelated 1st year (${scoreArts})`);
    });

    it('Activity scoring heavily rewards shared activity tags', () => {
      const activityBuddy = {
        id: 'a1',
        activity_tags: ['Gym', 'Badminton'],
        interests: [],
      };
      const nonActivityPeer = {
        id: 'a2',
        activity_tags: ['Yoga'],
        interests: [],
      };

      const scoreBuddy = scoreCandidateForIntent('activity', viewer, activityBuddy);
      const scorePeer = scoreCandidateForIntent('activity', viewer, nonActivityPeer);

      assert.ok(scoreBuddy > scorePeer, `Activity partner with shared tags (${scoreBuddy}) must outrank (${scorePeer})`);
    });

    it('Networking scoring gives cross-branch diversity bonus and career interest points', () => {
      const crossBranchEntrepreneur = {
        id: 'n1',
        branch: 'Business Administration', // Cross-branch (+50)
        interests: ['Entrepreneurship'], // Career interest (+25)
      };
      const sameBranchNoCareer = {
        id: 'n2',
        branch: 'Computer Science', // Same branch (+15)
        interests: ['Gaming'],
      };

      const scoreCross = scoreCandidateForIntent('networking', viewer, crossBranchEntrepreneur);
      const scoreSame = scoreCandidateForIntent('networking', viewer, sameBranchNoCareer);

      assert.ok(scoreCross > scoreSame, `Cross-branch entrepreneur (${scoreCross}) must outrank same-branch gamer (${scoreSame})`);
    });
  });

  describe('5. Predefined Activity Tags Consistency', () => {
    it('contains expected categories and popular campus sports/activities', () => {
      assert.ok(PREDEFINED_ACTIVITY_TAGS.length >= 10);
      assert.ok(PREDEFINED_ACTIVITY_TAGS.includes('Gym'));
      assert.ok(PREDEFINED_ACTIVITY_TAGS.includes('Badminton'));
      assert.ok(PREDEFINED_ACTIVITY_TAGS.includes('Football'));
      assert.ok(PREDEFINED_ACTIVITY_TAGS.includes('Chess'));
    });
  });
});
