/**
 * Integration test (Equoria-r1nr): rider + trainer XP/level/prestige/careerWeeks
 * fields actually get mutated by the service helpers.
 *
 * Pre-fix: experience, level, careerWeeks, prestige were always 0 — no code path
 * ever incremented them.
 *
 * Real DB. Covers:
 *   - awardRiderCompetitionXP for 1st/2nd/3rd/top10/no-placement
 *     bumps experience, prestige (1st/2nd only), and recomputes level
 *   - awardTrainerSessionXP for plain session vs stat-gain session
 *   - incrementWeeklyCareerWeeks ticks all active riders + trainers
 *
 * Test-order independence (Equoria-klq4v):
 *   The original suite accumulated XP across it()s onto a SHARED rider/trainer
 *   row — a later it() asserted absolute XP values (e.g. `30 + 4*20`) that only
 *   held if the earlier it()s had already run, in order. Under Jest test-order
 *   randomization that coupling breaks.
 *
 *   Fix: NO it() depends on another it()'s mutable state.
 *     (a) The inherently-sequential rider XP-accumulation chain (1st place →
 *         four 2nd places → level-up) is consolidated into ONE atomic it() that
 *         runs the steps in order against a LOCAL fresh rider inside the it().
 *     (b) Every other scenario creates its OWN freshly-named TestFixture rider
 *         and/or trainer (via makeRider/makeTrainer), so its absolute/delta
 *         assertions are valid regardless of which other it() ran before it.
 *   Each fresh fixture registers a scoped, fail-loud cleanup callback.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../packages/database/prismaClient.mjs';
import {
  awardRiderCompetitionXP,
  awardTrainerSessionXP,
  incrementWeeklyCareerWeeks,
  calculateLevel,
  RIDER_XP_REWARDS,
  RIDER_PRESTIGE_BUMPS,
  TRAINER_XP_REWARDS,
} from '../modules/trainers/index.mjs';
// Equoria-1ohys: fail-loud, scoped cleanup. The prior silent no-op catch arms
// kept the suite green even if a rider/trainer/user delete failed, leaking
// fixtures into the canonical DB (CLAUDE.md §2).
import { createCleanupTracker } from './helpers/failLoudCleanup.mjs';

const TAG = `r1nr-${randomBytes(4).toString('hex')}`;

describe('Equoria-r1nr: rider/trainer progression service', () => {
  const cleanup = createCleanupTracker();
  let user;

  // Equoria-klq4v: monotonically-unique suffix so every fresh rider/trainer
  // fixture gets a distinct TestFixture name even within one millisecond.
  let fixtureSeq = 0;
  const uniq = () => `${TAG}-${(fixtureSeq += 1)}`;

  /**
   * Create a fresh, scoped-cleanup rider owned by the suite user, starting at
   * the schema defaults (experience/level/prestige/careerWeeks = 0/1/0/0).
   * Each fixture is independent — no it() shares a rider row with another.
   */
  async function makeRider() {
    const id = uniq();
    const created = await prisma.rider.create({
      data: {
        firstName: `TestFixture-${id}-First`,
        lastName: 'Rider',
        personality: 'competitive',
        skillLevel: 'rookie',
        speciality: 'Show Jumping',
        weeklyRate: 200,
        userId: user.id,
      },
    });
    // Scoped, fail-loud cleanup for THIS rider only.
    cleanup.add(() => prisma.rider.deleteMany({ where: { id: created.id } }), `rider:${created.id}`);
    return created;
  }

  /**
   * Create a fresh, scoped-cleanup trainer owned by the suite user, starting at
   * the schema defaults. Independent per scenario.
   */
  async function makeTrainer() {
    const id = uniq();
    const created = await prisma.trainer.create({
      data: {
        firstName: `TestFixture-${id}-First`,
        lastName: 'Trainer',
        personality: 'focused',
        skillLevel: 'novice',
        speciality: 'Show Jumping',
        sessionRate: 150,
        userId: user.id,
      },
    });
    cleanup.add(() => prisma.trainer.deleteMany({ where: { id: created.id } }), `trainer:${created.id}`);
    return created;
  }

  beforeAll(async () => {
    user = await prisma.user.create({
      data: {
        email: `${TAG}@test.com`,
        username: TAG,
        password: 'irrelevant',
        firstName: 'Test',
        lastName: 'R1NR',
        money: 5000,
      },
    });

    // Equoria-1ohys / Equoria-klq4v: scoped, FK-ordered, fail-loud cleanup.
    // Per-fixture rider/trainer deletes are registered by makeRider/makeTrainer
    // as they run; this catch-all (still scoped to userId) sweeps any rider/
    // trainer rows before the user row they reference is deleted, then deletes
    // the user. Cleanup callbacks run in registration order, so the per-fixture
    // deletes and these userId-scoped sweeps both precede the user delete.
    cleanup.add(() => prisma.rider.deleteMany({ where: { userId: user.id } }), 'rider-sweep');
    cleanup.add(() => prisma.trainer.deleteMany({ where: { userId: user.id } }), 'trainer-sweep');
    cleanup.add(() => prisma.user.delete({ where: { id: user.id } }), 'user');
  });

  afterAll(() => cleanup.run());

  it('calculateLevel: matches the same curve as groomProgressionService (100*level per level)', () => {
    expect(calculateLevel(0)).toBe(1);
    expect(calculateLevel(99)).toBe(1);
    expect(calculateLevel(100)).toBe(2);
    expect(calculateLevel(299)).toBe(2);
    expect(calculateLevel(300)).toBe(3);
    expect(calculateLevel(10000)).toBe(10); // capped at LEVEL_CAP
  });

  it('accumulates rider XP across a progression: 1st place, then podium repeats, then level-up', async () => {
    // Equoria-klq4v: this is the consolidated, atomic version of the old
    // two-it() accumulation chain ("1st place bumps experience/prestige/level"
    // + "accumulates and triggers level-up at 100 XP"). Every step runs in
    // order against ONE fresh local rider, so no other it() can interleave
    // and no later it() depends on the XP this leaves behind.
    const rider = await makeRider();

    // Step 1 (was: "awardRiderCompetitionXP(1st place) bumps experience,
    // prestige, and recomputes level"). Fresh rider starts at 0 XP.
    const after1st = await awardRiderCompetitionXP(rider.id, 1);
    expect(after1st).not.toBeNull();
    expect(after1st.experience).toBe(RIDER_XP_REWARDS.competition_entered + RIDER_XP_REWARDS.placement_1st); // 5 + 25 = 30
    expect(after1st.prestige).toBe(RIDER_PRESTIGE_BUMPS.placement_1st); // 2
    expect(after1st.level).toBe(1); // 30 XP is still level 1

    // Step 2 (was: "accumulates and triggers level-up at 100 XP"). Build up:
    // each 2nd = 5 (entered) + 15 (2nd) = 20 XP — 4 of those = 80 XP → 110 total.
    for (let i = 0; i < 4; i++) {
      await awardRiderCompetitionXP(rider.id, 2);
    }
    const afterPodiums = await prisma.rider.findUnique({ where: { id: rider.id } });
    expect(afterPodiums.experience).toBe(30 + 4 * 20); // 110
    expect(afterPodiums.level).toBe(2); // crossed 100 XP
    expect(afterPodiums.prestige).toBeGreaterThanOrEqual(
      RIDER_PRESTIGE_BUMPS.placement_1st + 4 * RIDER_PRESTIGE_BUMPS.placement_2nd,
    ); // 2 + 4*1 = 6
  });

  it('awardRiderCompetitionXP gives only base XP for placement > 10', async () => {
    // Own fresh rider — the before/after delta is valid regardless of order.
    const rider = await makeRider();
    const before = await prisma.rider.findUnique({ where: { id: rider.id } });
    await awardRiderCompetitionXP(rider.id, 99);
    const after = await prisma.rider.findUnique({ where: { id: rider.id } });
    expect(after.experience - before.experience).toBe(RIDER_XP_REWARDS.competition_entered);
    expect(after.prestige).toBe(before.prestige); // no prestige outside top-2
  });

  it('awardTrainerSessionXP(statGain=true) awards both session + stat-gain XP', async () => {
    // Own fresh trainer — absolute XP assertion is valid from a 0-XP start
    // regardless of which other it() ran first.
    const trainer = await makeTrainer();
    const updated = await awardTrainerSessionXP(trainer.id, true);
    expect(updated).not.toBeNull();
    expect(updated.experience).toBe(TRAINER_XP_REWARDS.session_completed + TRAINER_XP_REWARDS.stat_gain_session); // 5 + 10 = 15
    expect(updated.level).toBe(1);
  });

  it('awardTrainerSessionXP(statGain=false) awards only session XP', async () => {
    // Own fresh trainer — before/after delta is valid regardless of order.
    const trainer = await makeTrainer();
    const before = await prisma.trainer.findUnique({ where: { id: trainer.id } });
    await awardTrainerSessionXP(trainer.id, false);
    const after = await prisma.trainer.findUnique({ where: { id: trainer.id } });
    expect(after.experience - before.experience).toBe(TRAINER_XP_REWARDS.session_completed);
  });

  it('incrementWeeklyCareerWeeks ticks both rider and trainer', async () => {
    // Own fresh rider + trainer. incrementWeeklyCareerWeeks ticks ALL active
    // riders/trainers globally, so the per-row +1 delta is what we assert —
    // and that delta is order-independent (each row gets exactly one tick per
    // call, no matter its starting careerWeeks).
    const rider = await makeRider();
    const trainer = await makeTrainer();
    const beforeRider = await prisma.rider.findUnique({ where: { id: rider.id } });
    const beforeTrainer = await prisma.trainer.findUnique({ where: { id: trainer.id } });

    const result = await incrementWeeklyCareerWeeks();
    expect(result.ridersTicked).toBeGreaterThanOrEqual(1);
    expect(result.trainersTicked).toBeGreaterThanOrEqual(1);

    const afterRider = await prisma.rider.findUnique({ where: { id: rider.id } });
    const afterTrainer = await prisma.trainer.findUnique({ where: { id: trainer.id } });
    expect(afterRider.careerWeeks).toBe(beforeRider.careerWeeks + 1);
    expect(afterTrainer.careerWeeks).toBe(beforeTrainer.careerWeeks + 1);
  });
});
