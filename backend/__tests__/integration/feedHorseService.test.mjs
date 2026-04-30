/**
 * feedHorse service — deterministic stat-boost roll tests (Equoria-zzj0,
 * parent: Equoria-3gqg).
 *
 * `rollStatBoost(tier, rng)` and `feedHorse({ ..., rng })` accept an
 * injectable rng so the stat-boost outcome is testable without flake.
 *
 * Block 1 (rollStatBoost): pure-function unit tests; no DB.
 * Block 2 (feedHorse): real-DB integration tests proving the service
 *   actually applies the rolled boost to the horse's stat column via
 *   Prisma `{ increment: 1 }`.
 *
 * No mocks, no bypass headers. Real DB.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import prisma from '../../../packages/database/prismaClient.mjs';
import { feedHorse, rollStatBoost } from '../../modules/horses/services/horseFeedService.mjs';

// 12 stats matching backend/modules/horses/services/horseFeedService.mjs STATS array.
const EXPECTED_STATS = [
  'precision',
  'strength',
  'speed',
  'agility',
  'endurance',
  'intelligence',
  'stamina',
  'balance',
  'boldness',
  'flexibility',
  'obedience',
  'focus',
];

/**
 * Build a deterministic rng that returns values from `seq` in order, cycling.
 * The service calls `rng()` once for the threshold check and (on success)
 * once for the stat selection — so a 2-element seq drives one full call.
 */
function seqRng(seq) {
  let i = 0;
  return () => seq[i++ % seq.length];
}

describe('rollStatBoost (deterministic via injected rng)', () => {
  it('basic tier never rolls (statRollPct = 0)', () => {
    expect(rollStatBoost('basic', () => 0)).toBeNull();
    expect(rollStatBoost('basic', () => 0.5)).toBeNull();
    expect(rollStatBoost('basic', () => 0.99)).toBeNull();
  });

  it('elite tier rolls when rng < 0.25 (statRollPct = 25)', () => {
    const result = rollStatBoost('elite', seqRng([0.1, 0]));
    expect(result).not.toBeNull();
    expect(result.amount).toBe(1);
    expect(EXPECTED_STATS).toContain(result.stat);
  });

  it('elite tier does NOT roll when rng >= 0.25', () => {
    expect(rollStatBoost('elite', () => 0.25)).toBeNull();
    expect(rollStatBoost('elite', () => 0.3)).toBeNull();
    expect(rollStatBoost('elite', () => 0.99)).toBeNull();
  });

  it('elite tier boundary: rng exactly at 0.25 does NOT roll (use < not <=)', () => {
    // Sentinel for boundary semantics: 25% must mean rng < 0.25, not <= 0.25.
    // rng() * 100 >= 25 → return null. So 0.25 → 25 >= 25 → null.
    expect(rollStatBoost('elite', () => 0.25)).toBeNull();
  });

  it('performance tier rolls only when rng < 0.10 (statRollPct = 10)', () => {
    expect(rollStatBoost('performance', () => 0.05)).not.toBeNull();
    expect(rollStatBoost('performance', () => 0.099)).not.toBeNull();
    expect(rollStatBoost('performance', () => 0.1)).toBeNull();
    expect(rollStatBoost('performance', () => 0.2)).toBeNull();
  });

  it('performancePlus tier rolls only when rng < 0.15 (statRollPct = 15)', () => {
    expect(rollStatBoost('performancePlus', () => 0.149)).not.toBeNull();
    expect(rollStatBoost('performancePlus', () => 0.15)).toBeNull();
  });

  it('highPerformance tier rolls only when rng < 0.20 (statRollPct = 20)', () => {
    expect(rollStatBoost('highPerformance', () => 0.199)).not.toBeNull();
    expect(rollStatBoost('highPerformance', () => 0.2)).toBeNull();
  });

  it('returns null for unknown tier', () => {
    expect(rollStatBoost('platinum', () => 0)).toBeNull();
    expect(rollStatBoost('', () => 0)).toBeNull();
    expect(rollStatBoost(undefined, () => 0)).toBeNull();
  });

  it('stat-picker maps rng to the 12-stat list correctly (sentinel-positive)', () => {
    // For each of the 12 indices, force rng = [thresholdSucceeds, i/12]
    // and verify the picked stat matches EXPECTED_STATS[i] AND is never
    // 'coordination' (recon Finding 1 → B: coordination removed from
    // boost pool when the column was dropped in Phase A).
    for (let i = 0; i < EXPECTED_STATS.length; i++) {
      const rng = seqRng([0.001, i / 12]);
      const result = rollStatBoost('elite', rng);
      expect(result).not.toBeNull();
      expect(result.stat).toBe(EXPECTED_STATS[i]);
      expect(result.stat).not.toBe('coordination');
    }
  });

  it('does not pick `coordination` for any rng value (recon Finding 1 → B)', () => {
    // Sweep rng across [0, 1) at fine granularity. Even if the STATS
    // array were inadvertently extended to 13+ entries with coordination
    // appended, this would catch it.
    for (let r = 0; r < 1; r += 0.01) {
      const rng = seqRng([0.001, r]);
      const result = rollStatBoost('elite', rng);
      if (result) {
        expect(result.stat).not.toBe('coordination');
      }
    }
  });
});

describe('feedHorse service — stat-boost integration (real DB)', () => {
  let userId;
  let horseId;

  beforeEach(async () => {
    const user = await prisma.user.create({
      data: {
        email: `svc-feed-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.com`,
        username: `svcfeed${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
        password: 'irrelevant-test-hash',
        firstName: 'Test',
        lastName: 'User',
        money: 0,
        settings: {
          inventory: [
            {
              id: 'feed-elite',
              itemId: 'elite',
              category: 'feed',
              name: 'Elite Feed',
              quantity: 5,
            },
          ],
        },
      },
    });
    userId = user.id;
    const horse = await prisma.horse.create({
      data: {
        name: `SvcHorse${Date.now()}${Math.random().toString(36).slice(2, 5)}`,
        sex: 'gelding',
        dateOfBirth: new Date('2020-01-01'),
        age: 5,
        userId,
        equippedFeedType: 'elite',
        speed: 50,
      },
    });
    horseId = horse.id;
  });

  afterEach(async () => {
    await prisma.horse.delete({ where: { id: horseId } }).catch(() => {});
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  });

  it('applies stat boost (speed +1) to the horse when rng forces speed selection', async () => {
    // Force speed: seq = [0.01 (threshold succeeds), 2/12 (picks index 2 = 'speed')]
    const rng = seqRng([0.01, 2 / 12]);
    const result = await feedHorse({ userId, horseId, rng });

    expect(result.statBoost).toEqual({ stat: 'speed', amount: 1 });

    // DB read-back: speed must be incremented from 50 → 51, atomic with the txn.
    const fresh = await prisma.horse.findUnique({ where: { id: horseId } });
    expect(fresh.speed).toBe(51);
    // lastFedDate was set; inventory was decremented.
    expect(fresh.lastFedDate).toBeTruthy();
  });

  it('applies stat boost to a different stat when rng forces it (sentinel-positive)', async () => {
    // Force endurance: seq = [0.01, 4/12 (picks index 4 = 'endurance')]
    const rng = seqRng([0.01, 4 / 12]);
    const result = await feedHorse({ userId, horseId, rng });

    expect(result.statBoost.stat).toBe('endurance');
    const fresh = await prisma.horse.findUnique({ where: { id: horseId } });
    // endurance has @default(0) in schema, so 0 → 1 is the expected delta.
    expect(fresh.endurance).toBe(1);
    // The unrelated stat (speed) must NOT have been bumped.
    expect(fresh.speed).toBe(50);
  });

  it('does not apply stat boost when rng misses threshold', async () => {
    const result = await feedHorse({ userId, horseId, rng: () => 0.99 });

    expect(result.statBoost).toBeNull();

    const fresh = await prisma.horse.findUnique({ where: { id: horseId } });
    // No stat changed from baseline.
    expect(fresh.speed).toBe(50);
    // But lastFedDate WAS set (the feed action itself succeeded).
    expect(fresh.lastFedDate).toBeTruthy();
  });

  it('does not apply stat boost on basic feed (statRollPct = 0)', async () => {
    // Switch to basic feed: replace inventory and equippedFeedType.
    await prisma.user.update({
      where: { id: userId },
      data: {
        settings: {
          inventory: [
            {
              id: 'feed-basic',
              itemId: 'basic',
              category: 'feed',
              name: 'Basic Feed',
              quantity: 5,
            },
          ],
        },
      },
    });
    await prisma.horse.update({
      where: { id: horseId },
      data: { equippedFeedType: 'basic' },
    });

    // Even with an rng that would succeed for any non-zero tier, basic returns null.
    const result = await feedHorse({ userId, horseId, rng: () => 0 });

    expect(result.statBoost).toBeNull();

    const fresh = await prisma.horse.findUnique({ where: { id: horseId } });
    expect(fresh.speed).toBe(50);
  });
});
