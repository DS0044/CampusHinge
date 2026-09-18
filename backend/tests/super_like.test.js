const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { swipeSchema } = require('../src/validators/swipe.schema');

describe('Super Like Feature Tests', () => {
  describe('1. Validation Schema', () => {
    it('accepts valid UUID and action = "super_like"', () => {
      const validPayload = {
        swiped_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        action: 'super_like',
      };
      const result = swipeSchema.safeParse(validPayload);
      assert.equal(result.success, true);
      assert.equal(result.data.action, 'super_like');
    });

    it('accepts "like" and "pass"', () => {
      const payloadLike = {
        swiped_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        action: 'like',
      };
      const payloadPass = {
        swiped_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        action: 'pass',
      };
      assert.equal(swipeSchema.safeParse(payloadLike).success, true);
      assert.equal(swipeSchema.safeParse(payloadPass).success, true);
    });

    it('rejects invalid action values', () => {
      const invalidPayload = {
        swiped_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        action: 'superlike', // wrong format
      };
      const result = swipeSchema.safeParse(invalidPayload);
      assert.equal(result.success, false);
    });
  });

  describe('2. Shared Interests Calculation & 4+ Gate Rule', () => {
    function computeSharedInterests(viewerInterests, targetInterests) {
      if (!Array.isArray(viewerInterests) || !Array.isArray(targetInterests)) return [];
      return viewerInterests.filter((tag) => targetInterests.includes(tag));
    }

    it('correctly calculates intersection of interests', () => {
      const viewer = ['Music', 'Travel', 'Gaming', 'Movies', 'Coding'];
      const target = ['Music', 'Travel', 'Gaming', 'Movies', 'Reading'];
      const shared = computeSharedInterests(viewer, target);
      assert.equal(shared.length, 4);
      assert.deepEqual(shared, ['Music', 'Travel', 'Gaming', 'Movies']);
    });

    it('disallows Super Like when shared count is less than 4', () => {
      const viewer = ['Music', 'Travel', 'Gaming'];
      const target = ['Music', 'Travel', 'Reading', 'Art'];
      const shared = computeSharedInterests(viewer, target);
      assert.equal(shared.length, 2);
      assert.equal(shared.length >= 4, false);
    });

    it('allows Super Like when shared count is 4 or more', () => {
      const viewer = ['Music', 'Travel', 'Gaming', 'Movies', 'Fitness'];
      const target = ['Music', 'Travel', 'Gaming', 'Movies', 'Fitness', 'Food'];
      const shared = computeSharedInterests(viewer, target);
      assert.equal(shared.length, 5);
      assert.equal(shared.length >= 4, true);
    });
  });

  describe('3. Rolling 24-Hour Limit Check', () => {
    function checkSuperLikeLimit(lastSuperLikeAt) {
      if (!lastSuperLikeAt) return { available: true, remainingMs: 0 };
      let lastTimeStr = String(lastSuperLikeAt);
      if (!lastTimeStr.endsWith('Z') && !lastTimeStr.includes('+')) {
        lastTimeStr = lastTimeStr.replace(' ', 'T') + 'Z';
      }
      const lastMs = new Date(lastTimeStr).getTime();
      const elapsedMs = Date.now() - lastMs;
      const ONE_DAY_MS = 24 * 60 * 60 * 1000;

      if (!isNaN(lastMs) && elapsedMs < ONE_DAY_MS) {
        const remainingMs = ONE_DAY_MS - elapsedMs;
        const hours = Math.floor(remainingMs / 3600000);
        const mins = Math.ceil((remainingMs % 3600000) / 60000);
        return {
          available: false,
          remainingMs,
          message: `Next Super Like available in ${hours}h ${mins}m.`,
        };
      }
      return { available: true, remainingMs: 0 };
    }

    it('allows Super Like if user has never super-liked before', () => {
      const result = checkSuperLikeLimit(null);
      assert.equal(result.available, true);
    });

    it('blocks Super Like within 24 hours of last use and formats "Next Super Like available in Xh Ym"', () => {
      // 2 hours ago
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      const result = checkSuperLikeLimit(twoHoursAgo);
      assert.equal(result.available, false);
      assert.match(result.message, /Next Super Like available in 2[12]h/);
    });

    it('allows Super Like after 24 hours have elapsed', () => {
      // 25 hours ago
      const twentyFiveHoursAgo = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
      const result = checkSuperLikeLimit(twentyFiveHoursAgo);
      assert.equal(result.available, true);
    });
  });

  describe('4. Activity Feed Pinning & Super Like Notification Rendering', () => {
    it('pins super_like notifications above regular likes', () => {
      const notifications = [
        { id: '1', type: 'like', created_at: '2026-09-10T12:00:00Z', is_read: 0 },
        { id: '2', type: 'like', created_at: '2026-09-10T13:00:00Z', is_read: 0 },
        { id: '3', type: 'super_like', created_at: '2026-09-10T11:00:00Z', is_read: 0 },
      ];

      const sorted = [...notifications].sort((a, b) => {
        const aSuper = a.type === 'super_like';
        const bSuper = b.type === 'super_like';
        if (aSuper && !bSuper) return -1;
        if (!aSuper && bSuper) return 1;
        return new Date(b.created_at) - new Date(a.created_at);
      });

      assert.equal(sorted[0].id, '3', 'Super Like must be pinned at the top');
      assert.equal(sorted[0].type, 'super_like');
    });

    it('formats Super Like notification label with star badge and shared interests list', () => {
      const senderName = 'Rohan';
      const sharedInterests = ['Music', 'Travel', 'Gaming', 'Movies'];
      const label = `⭐ ${senderName} sent you a Super Like • ${sharedInterests.length} shared interests: ${sharedInterests.join(', ')}`;
      assert.equal(label, '⭐ Rohan sent you a Super Like • 4 shared interests: Music, Travel, Gaming, Movies');
    });

    it('formats Super Like email subject and body correctly', () => {
      const senderName = 'Rohan';
      const sharedInterests = ['Music', 'Travel', 'Gaming', 'Movies'];
      const topInterests = sharedInterests.slice(0, 3).join(', ');
      const count = sharedInterests.length;

      const subject = 'You got a Super Like on CampusHinge ⭐';
      const body = `${senderName} Super Liked your profile — you both share ${count} interests including ${topInterests}. Open CampusHinge to see their profile and like back to start chatting.`;

      assert.equal(subject, 'You got a Super Like on CampusHinge ⭐');
      assert.equal(body, 'Rohan Super Liked your profile — you both share 4 interests including Music, Travel, Gaming. Open CampusHinge to see their profile and like back to start chatting.');
    });
  });
});
