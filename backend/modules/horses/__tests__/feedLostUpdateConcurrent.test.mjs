/**
 * Integration test — feed atomic-triple lost-update guard under concurrency
 * (Equoria-kv2gz, real DB, no mocks).
 *
 * WHY THIS EXISTS (the k6 gap it fills):
 *   The concurrent-feed-breed-foal k6 harness was MEANT to surface the feed
 *   lost-update race: many parallel POST /horses/:id/feed at the SAME in-foal
 *   mare so inventory-decrement (-1 unit) and pregnancyFeedingsByTier-increment
 *   (+1 counter) can tear apart under READ COMMITTED. But every k6 VU logs in as
 *   the SAME fixture user, so all /feed mutations share ONE rl:mutation bucket
 *   (mutationRateLimiter, 30/min, keyed by user id). Under a burst the limiter
 *   429s most feeds, so feeds get SERIALIZED and the concurrent lost-update
 *   window the harness exists to open barely opens — lost_update_* metrics
 *   stayed 0 partly because contention never materialized, not solely because
 *   the code is correct (Equoria-kv2gz).
 *
 *   This Jest test bypasses the HTTP rate limiter entirely by calling the
 *   service layer (`feedHorse({ userId, horseId })`) directly — exactly how
 *   foalNowConcurrentClaim.test.mjs (Equoria-wgw5k) drives createFoalFromPregnancy
 *   directly — so the REAL transaction races against itself with no limiter
 *   masking the contention.
 *
 * THE INVARIANT (the atomic triple, horseFeedService.mjs:215-300):
 *   A successful IN-FOAL feed commits, in ONE transaction guarded by a single
 *   optimistic UPDATE (WHERE lastFedDate IS NULL OR lastFedDate < start-of-today):
 *     (a) inventory[tier].quantity -= 1
 *     (b) pregnancyFeedingsByTier[tier] += 1   (only while inFoalSinceDate set)
 *     (c) lastFedDate := now
 *   The guarded UPDATE is the linearisation point: the affected-row count is
 *   exactly 1 for the winner and 0 for every concurrent loser, and the inventory
 *   decrement is GATED on that count===1. So (a) and (b) can never tear apart:
 *   every winning feed contributes EXACTLY one unit consumed AND one counter
 *   increment; every loser contributes NEITHER.
 *
 *   Conservation, for the window the mare stays in-foal:
 *       successful_feeds == inventory_units_consumed == pregnancy_counter_delta
 *
 * SENTINEL-POSITIVE PROOF (this test is NOT vacuous):
 *   1. CONCURRENT SAME-DAY (test 1): N concurrent feeds on the SAME mare on the
 *      SAME feed-day. Exactly ONE wins; the rest reject "already fed today". We
 *      assert successes==1, unitsConsumed==1, counterDelta==1. The guarded WHERE
 *      is the ONLY thing making this hold — a split (counter bumped in a separate
 *      statement, or inventory decremented without the count===1 gate) would let
 *      losers ALSO decrement inventory or ALSO bump the counter, breaking the
 *      1==1==1 equality. We prove the guard is load-bearing in test 3 below by
 *      replaying the guarded WHERE as a raw UPDATE: it affects 1 row pre-feed and
 *      0 rows post-feed (an unconditional UPDATE affects 1) — the same
 *      race-closing-primitive proof foalNowConcurrentClaim uses.
 *   2. MULTI-DAY CONCURRENT (test 2): across D distinct feed-days, fire N
 *      concurrent feeds per day (resetting lastFedDate between days, mare stays
 *      in-foal). After all rounds: successes==D, unitsConsumed==D, counterDelta==D.
 *      This drives REAL transaction contention every round (N parallel feeds
 *      hitting one row) yet conservation holds exactly — the strong check the
 *      rate-limited k6 harness can't reliably run.
 *   3. SOURCE+PRIMITIVE SENTINEL (test 3): asserts the service performs the
 *      inventory decrement AFTER (gated on) a winning guarded claim — and proves
 *      the WHERE precondition is the race-closing element by replaying it as a
 *      raw UPDATE (1 row before today's claim, 0 after). A revert to a split /
 *      unguarded write fails this.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import bcrypt from 'bcryptjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { getPoolConfig } from '../../../../packages/database/dbPoolConfig.mjs';
import { feedHorse } from '../services/horseFeedService.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { startOfUtcDay } from '../../../utils/horseHealth.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const FEED_SERVICE_SRC = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../services/horseFeedService.mjs'),
  'utf8',
);

const FEED_TIER = 'basic';
const START_UNITS = 100;

// ── POOL-BUDGET-AWARE CONCURRENCY (Equoria-aq1nh) ───────────────────────────
// Each feedHorse() call opens an interactive `prisma.$transaction`, which holds
// ONE pooled connection for the whole callback. The shared production singleton
// runs with `connection_limit: 3` (packages/database/dbPoolConfig.mjs). If more
// than `connection_limit` feeds run truly simultaneously, the surplus must WAIT
// for a free connection and — under the 8-shard gate's CPU/IO pressure, where
// every in-flight transaction's internal queries run slower — can exceed the
// interactive `maxWait` (2000ms default) and reject with Prisma P2028 ("Unable
// to start a transaction in the given time"), which the feed service maps to a
// RetryableTransactionError (HTTP 503 "Feeding is busy right now").
//
// That 503 is a POOL-ACQUIRE artifact, NOT the lost-update outcome this suite
// asserts. The pre-fix N=6 / N=4 launches exceeded the 3-connection budget, so
// under shard pressure contenders died in the pool queue with a 503 instead of
// either winning or rejecting "already fed today" — flaking all three of this
// file's assertions (one winner / N-1 losers / "already fed" reason) even though
// the guard logic stayed correct (inventory consumed stayed 0 — no torn triple).
// Measured root cause: saturating the 3-connection pool turns ALL 6 concurrent
// feeds into 503s (fulfilled=0, alreadyFed=0) — see Equoria-aq1nh.
//
// The fix mirrors the fefh2.44 precedent (cronDistributedLock): DECOUPLE "is the
// lost-update guard correct?" from "can Prisma acquire a pooled connection under
// saturation?". We keep N logical contenders but never run more than the pool
// budget SIMULTANEOUSLY, so every in-flight feed can hold a connection and the
// race resolves at the guarded UPDATE (the linearisation point under test) —
// never in the pool queue. The non-flaky sibling foalNowConcurrentClaim.test.mjs
// already uses N=3 = pool budget for exactly this reason. No assertion is
// weakened: the first batch of `budget` feeds still races same-row (the real
// lost-update window), and the remaining feeds still see lastFedDate=today and
// reject "already fed". No timeout is inflated; no retry-as-fix is added.
const POOL_BUDGET = getPoolConfig(process.env)?.connection_limit ?? 3;

/**
 * Run `total` invocations of `makeTask()` against the same row with at most
 * `limit` in flight at once, so simultaneous interactive transactions never
 * exceed the connection-pool budget. Returns the same shape as
 * `Promise.allSettled` over `total` tasks. The first `limit` tasks are launched
 * together (the genuine same-row race); each completion launches the next, so
 * later tasks contend against the already-committed winner and reject cleanly
 * with "already fed" rather than dying in the pool-acquire queue.
 */
async function settleWithPoolBudget(total, limit, makeTask) {
  const results = new Array(total);
  let next = 0;
  async function worker() {
    while (next < total) {
      const i = next;
      next += 1;
      try {
        results[i] = { status: 'fulfilled', value: await makeTask() };
      } catch (reason) {
        results[i] = { status: 'rejected', reason };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, total) }, () => worker()));
  return results;
}

function sumCounters(obj) {
  if (!obj || typeof obj !== 'object') {
    return 0;
  }
  return Object.values(obj).reduce((a, b) => a + (Number(b) || 0), 0);
}

describe('feedHorse — atomic-triple lost-update under concurrency (Equoria-kv2gz, real DB)', () => {
  let user;
  let breed;
  let mareId;

  /**
   * Read the fed tier's remaining inventory quantity from the user's settings,
   * defaulting to 0 if the tier row was pruned (quantity hit 0).
   */
  async function remainingUnits() {
    const u = await prisma.user.findUnique({ where: { id: user.id }, select: { settings: true } });
    const inv = Array.isArray(u?.settings?.inventory) ? u.settings.inventory : [];
    const row = inv.find(i => i.id === `feed-${FEED_TIER}`);
    return row ? Number(row.quantity) || 0 : 0;
  }

  async function pregCounterTotal() {
    const m = await prisma.horse.findUnique({
      where: { id: mareId },
      select: { pregnancyFeedingsByTier: true },
    });
    return sumCounters(m?.pregnancyFeedingsByTier);
  }

  /** Rewind the same-day feed gate so the next feed isn't trivially rejected. */
  async function rewindLastFed() {
    await prisma.horse.update({
      where: { id: mareId },
      data: { lastFedDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) },
    });
  }

  beforeEach(async () => {
    const ts = `${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}`;
    const hashed = await bcrypt.hash('TestPassword123!', 1);
    // Seed a FULL feed inventory directly in settings (avoids the money/ledger
    // machinery of the feed-shop purchase path — irrelevant to this invariant).
    user = await prisma.user.create({
      data: {
        username: `kv2gz_${ts}`,
        email: `kv2gz_${ts}@test.com`,
        password: hashed,
        firstName: 'Feed',
        lastName: 'Racer',
        money: 10000,
        settings: {
          inventory: [
            { id: `feed-${FEED_TIER}`, itemId: FEED_TIER, category: 'feed', name: 'Basic Feed', quantity: START_UNITS },
          ],
        },
      },
    });

    breed = await prisma.breed.upsert({
      where: { name: 'Thoroughbred' },
      update: {},
      create: { name: 'Thoroughbred', description: 'Shared test breed' },
    });

    const fiveYearsAgo = new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000);
    const sire = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-Kv2gzSire_${ts}`,
        sex: 'Stallion',
        dateOfBirth: fiveYearsAgo,
        age: 5,
        breedId: breed.id,
        userId: user.id,
        healthStatus: 'Good',
      },
    });
    const mare = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-Kv2gzMare_${ts}`,
        sex: 'Mare',
        dateOfBirth: fiveYearsAgo,
        age: 5,
        breedId: breed.id,
        userId: user.id,
        healthStatus: 'Good',
        equippedFeedType: FEED_TIER,
        // In foal so each successful feed bumps pregnancyFeedingsByTier.
        inFoalSinceDate: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
        pregnancySireId: sire.id,
        pendingFoalName: `TestFixture-Kv2gzFoal_${ts}`,
        // Never fed → first feed is not gated by alreadyFedToday.
        lastFedDate: null,
        pregnancyFeedingsByTier: {},
      },
    });
    mareId = mare.id;
  });

  afterEach(async () => {
    if (!user) {
      return;
    }
    const cleanup = createCleanupTracker();
    cleanup.add(() => prisma.horse.deleteMany({ where: { userId: user.id } }), 'kv2gzHorses');
    cleanup.add(() => prisma.user.deleteMany({ where: { id: user.id } }), 'kv2gzUser');
    await cleanup.run();
  });

  it('N concurrent feeds on ONE in-foal mare (same day): EXACTLY ONE wins, and -1 unit pairs with +1 counter (no torn triple)', async () => {
    const N = 6;
    // At most POOL_BUDGET feeds hold an interactive-tx connection at once, so
    // the race resolves at the guarded UPDATE — never in the pool-acquire queue
    // (Equoria-aq1nh). The first batch genuinely contends same-row; later feeds
    // see lastFedDate=today and reject "already fed".
    const results = await settleWithPoolBudget(N, POOL_BUDGET, () => feedHorse({ userId: user.id, horseId: mareId }));

    const fulfilled = results.filter(r => r.status === 'fulfilled' && r.value?.feed);
    const rejected = results.filter(r => r.status === 'rejected');

    // The guarded UPDATE makes the feed-day claim a linearisation point: exactly
    // one concurrent caller wins; the rest reject with "already fed today".
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(N - 1);
    for (const r of rejected) {
      expect(String(r.reason?.message || '').toLowerCase()).toContain('already fed');
    }

    // ── The atomic triple held: ONE unit consumed AND ONE counter increment,
    //    paired. A torn triple would show e.g. unitsConsumed=1 but counterDelta=0
    //    (lost increment) or counterDelta>1 (loser double-bumped).
    const unitsConsumed = START_UNITS - (await remainingUnits());
    const counterDelta = await pregCounterTotal(); // baseline was {} → 0
    expect(unitsConsumed).toBe(1);
    expect(counterDelta).toBe(1);
    expect(unitsConsumed).toBe(counterDelta); // conservation: -1 unit == +1 counter
  });

  it('multi-day concurrent feeds (mare stays in-foal): successes == units consumed == counter delta, exactly', async () => {
    const DAYS = 5;
    const N = 4; // parallel feeds per day — real contention each round
    let totalSuccesses = 0;

    for (let day = 0; day < DAYS; day++) {
      if (day > 0) {
        // Advance to a NEW feed-day so the same-day gate reopens; mare stays
        // in-foal (we never clear inFoalSinceDate/pregnancySireId here).
        await rewindLastFed();
      }
      const round = await settleWithPoolBudget(N, POOL_BUDGET, () => feedHorse({ userId: user.id, horseId: mareId }));
      const wins = round.filter(r => r.status === 'fulfilled' && r.value?.feed).length;
      // Exactly one winner per day — the guarded claim serialises the feed-day.
      expect(wins).toBe(1);
      totalSuccesses += wins;
    }

    // Mare must still be in-foal the whole window (no foaling reset interfering).
    const mareAfter = await prisma.horse.findUnique({ where: { id: mareId } });
    expect(mareAfter.inFoalSinceDate).not.toBeNull();

    const unitsConsumed = START_UNITS - (await remainingUnits());
    const counterDelta = await pregCounterTotal();

    expect(totalSuccesses).toBe(DAYS);
    expect(unitsConsumed).toBe(DAYS);
    expect(counterDelta).toBe(DAYS);
    expect(unitsConsumed).toBe(counterDelta); // exact conservation across all rounds
  });

  describe('source + primitive sentinel — the inventory decrement is gated on a winning guarded claim', () => {
    it("the guarded WHERE precondition is the race-closing primitive: affects 1 row before today's claim, 0 after", async () => {
      // Before any feed today: the guarded WHERE matches (lastFedDate is NULL).
      const startOfTodayUtc = startOfUtcDay(new Date());
      const before = await prisma.$executeRawUnsafe(
        'UPDATE "horses" SET "id" = "id" WHERE "id" = $1 AND ("lastFedDate" IS NULL OR "lastFedDate" < $2)',
        mareId,
        startOfTodayUtc,
      );
      expect(before).toBe(1);

      // Feed once → the service's guarded claim flips lastFedDate to now.
      await feedHorse({ userId: user.id, horseId: mareId });

      // The SAME guarded precondition now affects 0 rows — that is exactly what
      // makes a concurrent loser a no-op (no double-decrement, no double-bump).
      const after = await prisma.$executeRawUnsafe(
        'UPDATE "horses" SET "id" = "id" WHERE "id" = $1 AND ("lastFedDate" IS NULL OR "lastFedDate" < $2)',
        mareId,
        startOfTodayUtc,
      );
      expect(after).toBe(0);

      // An UNCONDITIONAL update still affects 1 — proving the WHERE precondition,
      // not some incidental property of the row, is the race-closing element.
      const unconditional = await prisma.$executeRawUnsafe(
        'UPDATE "horses" SET "speed" = "speed" WHERE "id" = $1',
        mareId,
      );
      expect(unconditional).toBe(1);
    });

    it('source: inventory decrement runs only AFTER the guarded claim (affected===1 gate) and the counter bump rides the SAME UPDATE', () => {
      // The pregnancy counter is bumped INSIDE the single guarded UPDATE's SET
      // list (jsonb_set on pregnancyFeedingsByTier) — not a separate statement.
      expect(FEED_SERVICE_SRC).toMatch(/jsonb_set\(COALESCE\("pregnancyFeedingsByTier"/);
      // The loser (affected === 0) rejects BEFORE the inventory write.
      expect(FEED_SERVICE_SRC).toMatch(/if\s*\(affected\s*===\s*0\)/);
      // The inventory decrement (user.update settings) comes AFTER the affected===0
      // guard — i.e. it is gated on a winning claim.
      const guardIdx = FEED_SERVICE_SRC.search(/if\s*\(affected\s*===\s*0\)/);
      const invWriteIdx = FEED_SERVICE_SRC.search(/data:\s*\{\s*settings:\s*\{\s*\.\.\.settings,\s*inventory\s*\}/);
      expect(guardIdx).toBeGreaterThan(-1);
      expect(invWriteIdx).toBeGreaterThan(-1);
      expect(invWriteIdx).toBeGreaterThan(guardIdx);
    });
  });
});
