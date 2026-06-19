/**
 * Integration test — in-foal feed conservation, EXACT equality (Equoria-qi1ns,
 * real DB, no mocks).
 *
 * WHY THIS EXISTS (the k6 gap it fills):
 *   The concurrent-feed-breed-foal k6 harness teardown wanted to assert the
 *   atomic-triple conservation invariant: for the window the mare was in-foal,
 *   inventory_units_consumed == pregnancyFeedingsByTier delta (each in-foal feed
 *   commits -1 inventory AND +1 counter in one tx). PROBLEM (Equoria-qi1ns): the
 *   atomic foal-now claim (createFoalFromPregnancy / runFoalingJob) sets
 *   `pregnancyFeedingsByTier: {}` when the foal is created. So once the harness's
 *   foal_race scenario fires and a foal materialises, the pregnancy counter is
 *   RESET to {} and the teardown reads pregDelta=0 — the in-foal feed-conservation
 *   signal is destroyed. The harness compensates by branching on foalsCreated:
 *   when a foal was created it only asserts the WEAKER one-sided inventory >= delta
 *   instead of EXACT equality. Net effect: the strong exact-conservation check
 *   only runs on a NO-foal run, but foal_race fires every run, so the strong check
 *   rarely (if ever) runs in the combined harness.
 *
 *   This Jest test runs the STRONG exact-equality assertion against the real DB
 *   while the mare stays in-foal the ENTIRE time — no foaling reset can interfere,
 *   because this test never foals her. It calls the feed service directly
 *   (no HTTP rate limiter, mirroring foalNowConcurrentClaim.test.mjs's direct
 *   service drive) so every successful in-foal feed is observed.
 *
 * THE INVARIANT (horseFeedService.mjs:271-300):
 *   While inFoalSinceDate is set, each successful feed commits — in ONE
 *   transaction guarded by a single optimistic UPDATE — both:
 *     inventory[tier].quantity -= 1   AND   pregnancyFeedingsByTier[tier] += 1
 *   Therefore, across the whole in-foal window:
 *       inventory_units_consumed  ==  pregnancyFeedingsByTier_delta   (EXACTLY)
 *
 * SENTINEL-POSITIVE PROOF (this test is NOT vacuous):
 *   - Test 1 feeds the mare across D distinct feed-days while in-foal and asserts
 *     EXACT equality (unitsConsumed === counterDelta === D) AFTER EVERY feed, not
 *     just at the end. If the counter bump were lost on any single feed (a torn
 *     triple) the running equality would break on that step and fail RED. We also
 *     assert the multi-tier sum is tracked per-tier correctly by feeding TWO tiers.
 *   - Test 2 is the explicit qi1ns demonstration: it proves WHY the k6 harness's
 *     exact check is unreliable. It (a) feeds the in-foal mare and confirms the
 *     counter is non-zero, then (b) foals her via createFoalFromPregnancy and
 *     confirms the counter is RESET to {} (delta reads 0) — i.e. once foaling
 *     fires, the exact in-foal conservation signal is destroyed. This is the
 *     documented reason the strong assertion is moved here (where no foaling
 *     interferes) and the k6 harness is scoped to the foal-race gate only.
 *   - Test 3 asserts the bump is gated on inFoalSinceDate: a feed AFTER the
 *     pregnancy is cleared consumes inventory but does NOT bump the counter —
 *     proving the +1 is genuinely pregnancy-scoped, so the equality in test 1 is
 *     measuring the real in-foal coupling, not an unconditional increment.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { feedHorse } from '../services/horseFeedService.mjs';
import { createFoalFromPregnancy } from '../services/foalingService.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const START_UNITS = 100;

function sumCounters(obj) {
  if (!obj || typeof obj !== 'object') {
    return 0;
  }
  return Object.values(obj).reduce((a, b) => a + (Number(b) || 0), 0);
}

describe('feedHorse — in-foal feed conservation, exact equality (Equoria-qi1ns, real DB)', () => {
  let user;
  let breed;
  let mareId;

  async function userInventory() {
    const u = await prisma.user.findUnique({ where: { id: user.id }, select: { settings: true } });
    return Array.isArray(u?.settings?.inventory) ? u.settings.inventory : [];
  }

  async function unitsRemaining(tier) {
    const inv = await userInventory();
    const row = inv.find(i => i.id === `feed-${tier}`);
    return row ? Number(row.quantity) || 0 : 0;
  }

  async function pregCounter() {
    const m = await prisma.horse.findUnique({
      where: { id: mareId },
      select: { pregnancyFeedingsByTier: true, inFoalSinceDate: true },
    });
    return m;
  }

  /** Advance the same-day gate AND equip a (possibly different) tier. */
  async function prepareNextFeed(tier) {
    await prisma.horse.update({
      where: { id: mareId },
      data: {
        lastFedDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        equippedFeedType: tier,
      },
    });
  }

  beforeEach(async () => {
    const ts = `${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}`;
    const hashed = await bcrypt.hash('TestPassword123!', 1);
    // Two tiers in inventory so we can prove per-tier counter tracking sums right.
    user = await prisma.user.create({
      data: {
        username: `qi1ns_${ts}`,
        email: `qi1ns_${ts}@test.com`,
        password: hashed,
        firstName: 'Conserve',
        lastName: 'Feed',
        money: 10000,
        settings: {
          inventory: [
            { id: 'feed-basic', itemId: 'basic', category: 'feed', name: 'Basic Feed', quantity: START_UNITS },
            {
              id: 'feed-performance',
              itemId: 'performance',
              category: 'feed',
              name: 'Performance Feed',
              quantity: START_UNITS,
            },
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
        name: `TestFixture-Qi1nsSire_${ts}`,
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
        name: `TestFixture-Qi1nsMare_${ts}`,
        sex: 'Mare',
        dateOfBirth: fiveYearsAgo,
        age: 5,
        breedId: breed.id,
        userId: user.id,
        healthStatus: 'Good',
        equippedFeedType: 'basic',
        inFoalSinceDate: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
        pregnancySireId: sire.id,
        pendingFoalName: `TestFixture-Qi1nsFoal_${ts}`,
        pendingFoalBreedId: breed.id,
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
    cleanup.add(() => prisma.horse.deleteMany({ where: { userId: user.id } }), 'qi1nsHorses');
    cleanup.add(() => prisma.user.deleteMany({ where: { id: user.id } }), 'qi1nsUser');
    await cleanup.run();
  });

  it('feeding across the in-foal window keeps inventory-consumed EXACTLY equal to the pregnancy-counter delta (after every feed)', async () => {
    // Alternate tiers across days to prove per-tier jsonb_set sums correctly and
    // total conservation holds regardless of which tier was fed.
    const plan = ['basic', 'performance', 'basic', 'performance', 'basic'];
    let fed = 0;

    for (let day = 0; day < plan.length; day++) {
      const tier = plan[day];
      await prepareNextFeed(tier);
      const res = await feedHorse({ userId: user.id, horseId: mareId });
      expect(res.feed?.tier).toBe(tier); // the feed actually committed for this tier
      fed += 1;

      // EXACT equality must hold after EVERY feed, not only at the end. A single
      // torn triple (lost counter bump or lost inventory decrement) breaks it here.
      const consumed =
        START_UNITS - (await unitsRemaining('basic')) + (START_UNITS - (await unitsRemaining('performance')));
      const { pregnancyFeedingsByTier, inFoalSinceDate } = await pregCounter();
      const counterDelta = sumCounters(pregnancyFeedingsByTier); // baseline {} → 0

      expect(inFoalSinceDate).not.toBeNull(); // mare stays in-foal the whole window
      expect(consumed).toBe(fed);
      expect(counterDelta).toBe(fed);
      expect(consumed).toBe(counterDelta); // the strong exact-conservation check
    }

    // Per-tier breakdown sanity: 3 basic + 2 performance feeds.
    const { pregnancyFeedingsByTier } = await pregCounter();
    expect(pregnancyFeedingsByTier.basic).toBe(3);
    expect(pregnancyFeedingsByTier.performance).toBe(2);
  });

  it('demonstrates the qi1ns gap: foaling RESETS pregnancyFeedingsByTier to {}, destroying the exact in-foal signal', async () => {
    // Feed the in-foal mare a few times → counter accrues.
    for (let day = 0; day < 3; day++) {
      await prepareNextFeed('basic');
      await feedHorse({ userId: user.id, horseId: mareId });
    }
    const beforeFoaling = await pregCounter();
    expect(sumCounters(beforeFoaling.pregnancyFeedingsByTier)).toBe(3);
    expect(beforeFoaling.inFoalSinceDate).not.toBeNull();

    // Foal her — the atomic claim clears the pregnancy AND zeroes the counter.
    const { foal } = await createFoalFromPregnancy({ damId: mareId });
    expect(foal?.id).toBeTruthy();

    const afterFoaling = await pregCounter();
    // THIS is the qi1ns problem: the in-foal feed-conservation delta now reads 0,
    // even though 3 in-foal feeds genuinely happened. A teardown that reads the
    // counter AFTER foaling (as the k6 harness does, because foal_race fires every
    // run) sees pregDelta=0 and cannot run the exact-equality check — which is why
    // that strong assertion lives in test 1 above (no foaling interferes) and the
    // k6 harness is scoped to the foal-race double-create gate only.
    expect(sumCounters(afterFoaling.pregnancyFeedingsByTier)).toBe(0);
    expect(afterFoaling.inFoalSinceDate).toBeNull();
  });

  it('the counter bump is pregnancy-scoped: a feed AFTER the pregnancy is cleared consumes inventory but does NOT bump the counter', async () => {
    // Clear the pregnancy WITHOUT foaling (so the mare is simply no longer in-foal).
    await prisma.horse.update({
      where: { id: mareId },
      data: { inFoalSinceDate: null, pregnancySireId: null, pregnancyFeedingsByTier: {} },
    });
    await prepareNextFeed('basic');

    const basicBefore = await unitsRemaining('basic');
    await feedHorse({ userId: user.id, horseId: mareId });
    const basicAfter = await unitsRemaining('basic');

    // Inventory decremented (the feed happened) ...
    expect(basicBefore - basicAfter).toBe(1);
    // ... but the pregnancy counter did NOT move (mare not in-foal). This proves
    // the +1 in test 1 is genuinely coupled to inFoalSinceDate, so the equality
    // there measures real in-foal conservation, not an unconditional increment.
    const { pregnancyFeedingsByTier } = await pregCounter();
    expect(sumCounters(pregnancyFeedingsByTier)).toBe(0);
  });
});
