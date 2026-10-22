/**
 * Integration test (Equoria-r1nr): rider + trainer prestige/careerWeeks fields
 * actually get mutated by the service helpers.
 *
 * Owner ruling 2026-10-21 (Equoria-dea06): trainers, riders and grooms are fixed
 * NPCs — no XP, generated level kept. Old contract: this suite pinned
 * awardRiderCompetitionXP (rider XP by placement + level recompute + prestige),
 * awardTrainerSessionXP (trainer session XP) and calculateLevel (the XP curve).
 * The XP awards and the curve were removed with the ruling. The rider's
 * prestige bump for 1st/2nd is not XP and stays unchanged pending an owner
 * answer; it now lives in awardRiderCompetitionPrestige, pinned below with
 * experience and level asserted untouched.
 *
 * Real DB. Covers:
 *   - awardRiderCompetitionPrestige for 1st/2nd/3rd/no-placement: prestige
 *     (1st +2, 2nd +1, cap 100) only; experience and level never change
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
import { awardRiderCompetitionPrestige, incrementWeeklyCareerWeeks } from '../modules/trainers/index.mjs';
import { RIDER_PRESTIGE_BUMPS } from '../modules/trainers/services/riderTrainerProgressionService.mjs';
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

  it('accumulates rider prestige across 1st and 2nd places; experience and level never change', async () => {
    // One fresh local rider, steps in order (Equoria-klq4v pattern).
    const rider = await makeRider();
    const before = await prisma.rider.findUnique({ where: { id: rider.id } });

    const after1st = await awardRiderCompetitionPrestige(rider.id, 1);
    expect(after1st).not.toBeNull();
    expect(after1st.prestige).toBe(before.prestige + RIDER_PRESTIGE_BUMPS.placement_1st); // +2

    for (let i = 0; i < 4; i++) {
      await awardRiderCompetitionPrestige(rider.id, 2);
    }
    const after = await prisma.rider.findUnique({ where: { id: rider.id } });
    expect(after.prestige).toBe(
      before.prestige + RIDER_PRESTIGE_BUMPS.placement_1st + 4 * RIDER_PRESTIGE_BUMPS.placement_2nd,
    ); // 2 + 4*1 = 6
    // Fixed NPC (Equoria-dea06): old contract 5+25 then 4x20 XP → 110 XP, level 2.
    expect(after.experience).toBe(before.experience);
    expect(after.level).toBe(before.level);
  });

  it('awardRiderCompetitionPrestige adds nothing for 3rd place or worse', async () => {
    const rider = await makeRider();
    const before = await prisma.rider.findUnique({ where: { id: rider.id } });
    await awardRiderCompetitionPrestige(rider.id, 3);
    await awardRiderCompetitionPrestige(rider.id, 99);
    const after = await prisma.rider.findUnique({ where: { id: rider.id } });
    expect(after.prestige).toBe(before.prestige);
    expect(after.experience).toBe(before.experience);
    expect(after.level).toBe(before.level);
  });

  it('awardRiderCompetitionPrestige caps prestige at 100', async () => {
    const rider = await makeRider();
    await prisma.rider.update({ where: { id: rider.id }, data: { prestige: 99 } });
    const updated = await awardRiderCompetitionPrestige(rider.id, 1);
    expect(updated.prestige).toBe(100);
  });

  it('awardRiderCompetitionPrestige returns null for a missing rider', async () => {
    expect(await awardRiderCompetitionPrestige(2147483000, 1)).toBeNull();
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
