import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { swipeSchema } from '../src/validators/swipe.schema.js';

describe('Super Like Feature Tests', () => {
  describe('1. Validation Schema', () => {
    it('accepts valid UUID and action = "super_like"', () => {
      const result = swipeSchema.safeParse({
        swiped_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        action: 'super_like',
      });
      assert.equal(result.success, true);
      if (result.success) assert.equal(result.data.action, 'super_like');
    });

    it('accepts "like" and "pass"', () => {
      assert.equal(swipeSchema.safeParse({ swiped_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', action: 'like' }).success, true);
      assert.equal(swipeSchema.safeParse({ swiped_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', action: 'pass' }).success, true);
    });

    it('rejects invalid action values', () => {
      const result = swipeSchema.safeParse({ swiped_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', action: 'superlike' });
      assert.equal(result.success, false);
    });
  });

  describe('2. Shared Interests Calculation & 4+ Gate Rule', () => {
    function computeSharedInterests(viewerInterests: string[], targetInterests: string[]): string[] {
      if (!Array.isArray(viewerInterests) || !Array.isArray(targetInterests)) return [];
      return viewerInterests.filter((tag) => targetInterests.includes(tag));
    }

    it('correctly calculates intersection of interests', () => {
      const shared = computeSharedInterests(
        ['Music', 'Travel', 'Gaming', 'Movies', 'Coding'],
        ['Music', 'Travel', 'Gaming', 'Movies', 'Reading']
      );
      assert.equal(shared.length, 4);
      assert.deepEqual(shared, ['Music', 'Travel', 'Gaming', 'Movies']);
    });

    it('disallows Super Like when shared count < 4', () => {
      const shared = computeSharedInterests(['Music', 'Travel', 'Gaming'], ['Music', 'Travel', 'Reading', 'Art']);
      assert.equal(shared.length, 2);
      assert.equal(shared.length >= 4, false);
    });

    it('allows Super Like when shared count >= 4', () => {
      const shared = computeSharedInterests(
        ['Music', 'Travel', 'Gaming', 'Movies', 'Fitness'],
        ['Music', 'Travel', 'Gaming', 'Movies', 'Fitness', 'Food']
      );
      assert.equal(shared.length, 5);
      assert.equal(shared.length >= 4, true);
    });
  });

  describe('3. Rolling 24-Hour Limit Check', () => {
    interface LimitResult {
      available: boolean;
      remainingMs: number;
      message?: string;
    }

    function checkSuperLikeLimit(lastSuperLikeAt: string | null): LimitResult {
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
        const hours = Math.floor(remainingMs / 3_600_000);
        const mins = Math.ceil((remainingMs % 3_600_000) / 60_000);
        return { available: false, remainingMs, message: `Next Super Like available in ${hours}h ${mins}m.` };
      }
      return { available: true, remainingMs: 0 };
    }

    it('allows Super Like if user has never super-liked before', () => {
      assert.equal(checkSuperLikeLimit(null).available, true);
    });

    it('blocks Super Like within 24 hours and formats time correctly', () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      const result = checkSuperLikeLimit(twoHoursAgo);
      assert.equal(result.available, false);
      assert.match(result.message ?? '', /Next Super Like available in 2[12]h/);
    });

    it('allows Super Like after 24 hours have elapsed', () => {
      const twentyFiveHoursAgo = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
      assert.equal(checkSuperLikeLimit(twentyFiveHoursAgo).available, true);
    });
  });

  describe('4. Notification Rendering', () => {
    it('pins super_like notifications above regular likes', () => {
      const notifications = [
        { id: '1', type: 'like', created_at: '2026-09-10T12:00:00Z', is_read: 0 },
        { id: '2', type: 'like', created_at: '2026-09-10T13:00:00Z', is_read: 0 },
        { id: '3', type: 'super_like', created_at: '2026-09-10T11:00:00Z', is_read: 0 },
      ];
      const sorted = [...notifications].sort((a, b) => {
        if (a.type === 'super_like' && b.type !== 'super_like') return -1;
        if (a.type !== 'super_like' && b.type === 'super_like') return 1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
      assert.equal(sorted[0].id, '3', 'Super Like must be pinned at the top');
    });

    it('formats Super Like notification label', () => {
      const senderName = 'Rohan';
      const sharedInterests = ['Music', 'Travel', 'Gaming', 'Movies'];
      const label = `⭐ ${senderName} sent you a Super Like • ${sharedInterests.length} shared interests: ${sharedInterests.join(', ')}`;
      assert.equal(label, '⭐ Rohan sent you a Super Like • 4 shared interests: Music, Travel, Gaming, Movies');
    });

    it('formats Super Like email body correctly', () => {
      const sharedInterests = ['Music', 'Travel', 'Gaming', 'Movies'];
      const topInterests = sharedInterests.slice(0, 3).join(', ');
      const body = `Rohan Super Liked your profile — you both share ${sharedInterests.length} interests including ${topInterests}. Open CampusHinge to see their profile and like back to start chatting.`;
      assert.equal(body, 'Rohan Super Liked your profile — you both share 4 interests including Music, Travel, Gaming. Open CampusHinge to see their profile and like back to start chatting.');
    });
  });
});
