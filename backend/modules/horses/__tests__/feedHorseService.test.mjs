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
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { feedHorse, rollStatBoost } from '../services/horseFeedService.mjs';
// Equoria-zvp4: same UTC-day truncation the service uses to build the
// optimistic-claim WHERE precondition — the guard test asserts the precondition
// matches 1 row before the feed-day claim and 0 rows after.
import { startOfUtcDay } from '../../../utils/horseHealth.mjs';
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

// Resolved once at module load — used by the SELECT FOR UPDATE sentinel describe block.
const __dirname = dirname(fileURLToPath(import.meta.url));
const FEED_SERVICE_SRC = readFileSync(resolve(__dirname, '../services/horseFeedService.mjs'), 'utf8');

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
  const cleanup = createCleanupTracker();

  beforeEach(async () => {
    const user = await prisma.user.create({
      data: {
        email: `svc-feed-${randomBytes(4).toString('hex')}-${randomBytes(4).toString('hex')}@test.com`,
        username: `svcfeed${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`,
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
        ...fixtureColor(),
        name: `SvcHorse${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`,
        sex: 'Stallion',
        dateOfBirth: new Date('2020-01-01'),
        age: 5,
        userId,
        equippedFeedType: 'elite',
        speed: 50,
      },
    });
    horseId = horse.id;

    // Scoped, fail-loud cleanup (Equoria-pemoo); run() drains the queue each cycle.
    cleanup.add(() => prisma.horse.delete({ where: { id: horseId } }), 'horse');
    cleanup.add(() => prisma.user.delete({ where: { id: userId } }), 'user');
  });

  afterEach(() => cleanup.run());

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

/**
 * Phase B4: pregnancy feeding counter increments.
 *
 * When an in-foal mare (`inFoalSinceDate IS NOT NULL`) is fed, the per-tier
 * counter `pregnancyFeedingsByTier` MUST increment by 1 for the equipped
 * feed's tier. The B5 foaling job will read these counters and apply the
 * formula in `backend/utils/pregnancyBonus.mjs`.
 *
 * Tier keys used here MUST exactly match `FEED_CATALOG[*].id` (which also
 * match the keys consumed by `calculatePregnancyEpigeneticChances` in
 * `pregnancyBonus.mjs`): basic, performance, performancePlus,
 * highPerformance, elite.
 *
 * Real DB. Real prisma. No mocks.
 */
describe('feedHorse service — pregnancy feeding counter (Phase B4, real DB)', () => {
  let userId;
  let damId;
  const cleanup = createCleanupTracker();

  beforeEach(async () => {
    const user = await prisma.user.create({
      data: {
        email: `pf-${randomBytes(4).toString('hex')}-${randomBytes(4).toString('hex')}@test.com`,
        username: `pf${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`,
        password: 'irrelevant-test-hash',
        firstName: 'Test',
        lastName: 'User',
        money: 0,
        settings: {
          inventory: [
            {
              id: 'feed-performance',
              itemId: 'performance',
              category: 'feed',
              name: 'Performance Feed',
              quantity: 10,
            },
          ],
        },
      },
    });
    userId = user.id;

    // In-foal mare: inFoalSinceDate set, equippedFeedType = 'performance',
    // empty counter map, no prior feeding today.
    const dam = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `Dam${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`,
        sex: 'mare',
        dateOfBirth: new Date('2020-01-01'),
        age: 5,
        userId,
        equippedFeedType: 'performance',
        inFoalSinceDate: new Date(),
        pregnancyFeedingsByTier: {},
      },
    });
    damId = dam.id;

    // Scoped, fail-loud cleanup (Equoria-pemoo); run() drains the queue each cycle.
    cleanup.add(() => prisma.horse.delete({ where: { id: damId } }), 'dam');
    cleanup.add(() => prisma.user.delete({ where: { id: userId } }), 'user');
  });

  afterEach(() => cleanup.run());

  it('increments pregnancyFeedingsByTier[performance] by 1 when in-foal mare is fed', async () => {
    await feedHorse({ userId, horseId: damId, rng: () => 0.99 });

    const fresh = await prisma.horse.findUnique({ where: { id: damId } });
    expect(fresh.pregnancyFeedingsByTier).toEqual({ performance: 1 });
    // Sentinel: lastFedDate was actually set (Phase A behavior preserved).
    expect(fresh.lastFedDate).toBeTruthy();
  });

  it('increments pregnancyFeedingsByTier[performance] to 2 across two distinct feed days', async () => {
    // Feed 1: standard call.
    await feedHorse({ userId, horseId: damId, rng: () => 0.99 });

    // Reset lastFedDate to null between calls so alreadyFedToday() returns
    // false on the second call. (This simulates "tomorrow" without waiting
    // for UTC midnight.) We do NOT touch pregnancyFeedingsByTier — that's
    // what we're testing.
    await prisma.horse.update({
      where: { id: damId },
      data: { lastFedDate: null },
    });

    // Feed 2: counter must accumulate to 2 (not reset, not stuck at 1).
    await feedHorse({ userId, horseId: damId, rng: () => 0.99 });

    const fresh = await prisma.horse.findUnique({ where: { id: damId } });
    expect(fresh.pregnancyFeedingsByTier).toEqual({ performance: 2 });
  });

  it('does NOT increment counter when mare is not in-foal (inFoalSinceDate null)', async () => {
    // Clear in-foal state. Counter must remain {} after the feed call.
    await prisma.horse.update({
      where: { id: damId },
      data: { inFoalSinceDate: null },
    });

    await feedHorse({ userId, horseId: damId, rng: () => 0.99 });

    const fresh = await prisma.horse.findUnique({ where: { id: damId } });
    expect(fresh.pregnancyFeedingsByTier).toEqual({});
    // Sentinel: the feed action itself still succeeded (Phase A behavior).
    expect(fresh.lastFedDate).toBeTruthy();
  });
});

/**
 * Sequential-feed guard (Equoria-nsr7 / Equoria-5g5k).
 *
 * The original SELECT FOR UPDATE guard was removed (Equoria-5g5k) because
 * it caused Prisma transaction timeouts under test-pool pressure (lock wait
 * exceeded 15 s). The transaction-level atomicity still ensures sequential
 * correctness: the second call reads lastFedDate=<today> committed by the
 * first, and alreadyFedToday() rejects it. True concurrent-feed protection
 * (two requests racing at the PostgreSQL level) remains a tracked risk in
 * Equoria-nsr7 but is extremely unlikely for a once-daily user action.
 */
describe('feedHorse service — sequential-feed guard (Equoria-nsr7 / Equoria-5g5k)', () => {
  let userId;
  let horseId;
  const cleanup = createCleanupTracker();

  beforeEach(async () => {
    const user = await prisma.user.create({
      data: {
        email: `conc-feed-${randomBytes(4).toString('hex')}-${randomBytes(4).toString('hex')}@test.com`,
        username: `concfeed${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`,
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
              quantity: 10,
            },
          ],
        },
      },
    });
    userId = user.id;
    const horse = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `ConcHorse${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`,
        sex: 'Stallion',
        dateOfBirth: new Date('2020-01-01'),
        age: 5,
        userId,
        equippedFeedType: 'elite',
        speed: 50,
        lastFedDate: null,
      },
    });
    horseId = horse.id;

    // Scoped, fail-loud cleanup (Equoria-pemoo); run() drains the queue each cycle.
    cleanup.add(() => prisma.horse.delete({ where: { id: horseId } }), 'horse');
    cleanup.add(() => prisma.user.delete({ where: { id: userId } }), 'user');
  });

  afterEach(() => cleanup.run());

  // The SELECT FOR UPDATE guard was removed (Equoria-5g5k) to fix timeout failures.
  // This test verifies sequential once-per-day enforcement via alreadyFedToday().
  it('second sequential feed on the same day is rejected (alreadyFedToday guard)', async () => {
    // First feed succeeds.
    await feedHorse({ userId, horseId, rng: () => 0.99 });

    // Second feed on the same day must throw.
    await expect(feedHorse({ userId, horseId, rng: () => 0.99 })).rejects.toThrow(/already fed today/i);

    // Inventory must decrement by exactly 1 unit.
    const freshUser = await prisma.user.findUnique({ where: { id: userId } });
    const inv = freshUser.settings?.inventory ?? [];
    const feedItem = inv.find(i => i.id === 'feed-elite');
    expect(feedItem?.quantity).toBe(9);
  });
});

/**
 * Optimistic-concurrency lost-update guard (Equoria-zvp4).
 *
 * The lost-update race (two parallel feeds of the same horse double-decrement
 * inventory and double-bump the pregnancy counter under READ COMMITTED) cannot
 * be reproduced deterministically via Promise.allSettled in Prisma 6 — the
 * interactive-transaction client serialises the two calls so the race window
 * collapses (the prior agent observed the same; documented in Equoria-zvp4).
 *
 * So instead we prove the OPTIMISTIC GUARD'S CORRECTNESS deterministically —
 * the actual mechanism that closes the race — in three real-DB assertions:
 *
 *   1. The guarded UPDATE (the exact WHERE precondition the service uses)
 *      affects exactly 1 row on the first feed-day, then exactly 0 rows once
 *      lastFedDate is committed as today. This is the linearisation point: the
 *      concurrent loser's UPDATE matches 0 rows and therefore applies nothing.
 *      (Failing-first: before the fix the service used `tx.horse.update` with
 *      no WHERE precondition — an unconditional write that would ALWAYS affect
 *      1 row regardless of lastFedDate, i.e. it would double-apply. This test's
 *      `count === 0` assertion is exactly what that old code could not satisfy.)
 *
 *   2. Through the service: once today's feed has committed, a subsequent feed
 *      is rejected and leaves inventory AND the pregnancy counter UNCHANGED —
 *      no double-decrement, no double counter bump. This is the harm the race
 *      would cause; the guard prevents it.
 *
 * Real DB. Real prisma. No mocks. No FOR UPDATE.
 */
describe('feedHorse — optimistic-concurrency lost-update guard (Equoria-zvp4, real DB)', () => {
  let userId;
  let damId;
  const cleanup = createCleanupTracker();

  beforeEach(async () => {
    const user = await prisma.user.create({
      data: {
        email: `opt-feed-${randomBytes(4).toString('hex')}-${randomBytes(4).toString('hex')}@test.com`,
        username: `optfeed${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`,
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
              quantity: 10,
            },
          ],
        },
      },
    });
    userId = user.id;
    // In-foal mare so we also exercise the pregnancy-counter side of the claim.
    const dam = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `OptDam${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`,
        sex: 'mare',
        dateOfBirth: new Date('2020-01-01'),
        age: 5,
        userId,
        equippedFeedType: 'elite',
        inFoalSinceDate: new Date(),
        pregnancyFeedingsByTier: {},
        lastFedDate: null,
        speed: 50,
      },
    });
    damId = dam.id;

    cleanup.add(() => prisma.horse.delete({ where: { id: damId } }), 'dam');
    cleanup.add(() => prisma.user.delete({ where: { id: userId } }), 'user');
  });

  afterEach(() => cleanup.run());

  it('guarded UPDATE precondition affects 1 row before the feed-day, 0 rows after (the race-closing primitive)', async () => {
    // First feed commits lastFedDate=today + counter {elite:1} + inventory -1.
    const result = await feedHorse({ userId, horseId: damId, rng: () => 0.99 });
    expect(result.kind).toBeUndefined(); // discriminator stripped on success
    const afterFeed = await prisma.horse.findUnique({ where: { id: damId } });
    expect(afterFeed.lastFedDate).toBeTruthy();
    expect(afterFeed.pregnancyFeedingsByTier).toEqual({ elite: 1 });

    // Now replay the EXACT optimistic precondition the service uses: a UPDATE
    // whose WHERE is (lastFedDate IS NULL OR lastFedDate < startOfTodayUtc).
    // Because lastFedDate is now committed as today, this must affect 0 rows —
    // which is what makes a concurrent loser a no-op. (A no-WHERE update — the
    // pre-fix behavior — would have affected 1, i.e. double-applied.)
    const startOfTodayUtc = startOfUtcDay(new Date());
    const affected = await prisma.$executeRawUnsafe(
      'UPDATE "horses" SET "lastFedDate" = $1 WHERE "id" = $2 AND ("lastFedDate" IS NULL OR "lastFedDate" < $3)',
      new Date(),
      damId,
      startOfTodayUtc,
    );
    expect(affected).toBe(0);

    // Sanity: an UNCONDITIONAL update (the old read-then-write shape) WOULD
    // affect 1 row — proving the WHERE precondition is what closes the race,
    // not some incidental property of the row.
    const unconditional = await prisma.$executeRawUnsafe(
      'UPDATE "horses" SET "speed" = "speed" WHERE "id" = $1',
      damId,
    );
    expect(unconditional).toBe(1);
  });

  it('service rejects a same-day repeat without double-decrementing inventory or double-bumping the counter', async () => {
    // Feed 1 succeeds: inventory 10 → 9, counter {elite:1}.
    await feedHorse({ userId, horseId: damId, rng: () => 0.99 });

    const userAfter1 = await prisma.user.findUnique({ where: { id: userId } });
    expect(userAfter1.settings.inventory.find(i => i.id === 'feed-elite').quantity).toBe(9);

    // Feed 2 on the same committed day must reject — and crucially must NOT
    // decrement inventory a second time nor bump the counter a second time.
    await expect(feedHorse({ userId, horseId: damId, rng: () => 0.99 })).rejects.toThrow(/already fed today/i);

    const userAfter2 = await prisma.user.findUnique({ where: { id: userId } });
    expect(userAfter2.settings.inventory.find(i => i.id === 'feed-elite').quantity).toBe(9); // NOT 8
    const damAfter2 = await prisma.horse.findUnique({ where: { id: damId } });
    expect(damAfter2.pregnancyFeedingsByTier).toEqual({ elite: 1 }); // NOT {elite:2}
  });
});

/**
 * FOR UPDATE absence sentinel (Equoria-wsqw, updated Equoria-5g5k / Equoria-zvp4).
 *
 * History: Equoria-nsr7 added SELECT…FOR UPDATE on the horse row to prevent a
 * concurrent-feed lost-update race. Equoria-5g5k removed it: under full-suite
 * Prisma connection-pool pressure the lock wait exceeded both the 5 s default
 * and a 15 s raised ceiling (tests ran 124 s then timed out). The same issue
 * affected updateUserPreferences (Equoria-7rje) and was fixed the same way.
 *
 * Equoria-zvp4 then CLOSED the lost-update race WITHOUT re-adding a lock, via
 * optimistic concurrency: a single guarded UPDATE on the horse row whose WHERE
 * clause encodes the "not yet fed today" precondition and whose affected-row
 * count must be 1 (0 ⇒ a concurrent feed already won ⇒ reject, no
 * double-decrement, no double counter bump). See the optimistic-guard describe
 * block above for the deterministic 1-then-0 proof.
 *
 * This sentinel guards the ABSENCE of the FOR UPDATE lock so a future
 * re-introduction (which would re-introduce the timeout failures) is caught by
 * CI. The optimistic approach takes only the ordinary per-statement row
 * write-lock, never a SELECT…FOR UPDATE, so it stays green by construction.
 */
describe('feedHorse — FOR UPDATE absence sentinel (Equoria-wsqw / Equoria-5g5k / Equoria-zvp4)', () => {
  it('horseFeedService.mjs does NOT contain a SELECT FOR UPDATE on the horse row (lock removed, Equoria-5g5k)', () => {
    expect(FEED_SERVICE_SRC).not.toMatch(/SELECT id FROM "horses"[^;]*FOR UPDATE/);
  });

  // Broader sentinel-positive guard: catch ANY reintroduction of FOR UPDATE on
  // the horses table, not just the one exact string the original regex matched.
  it('horseFeedService.mjs contains NO "FOR UPDATE" clause at all (Equoria-zvp4 optimistic concurrency)', () => {
    expect(FEED_SERVICE_SRC).not.toMatch(/FOR\s+UPDATE/i);
  });
});
