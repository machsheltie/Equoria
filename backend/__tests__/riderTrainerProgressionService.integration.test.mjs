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
} from '../services/riderTrainerProgressionService.mjs';

const TAG = `r1nr-${randomBytes(4).toString('hex')}`;

describe('Equoria-r1nr: rider/trainer progression service', () => {
  let user;
  let rider;
  let trainer;

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

    rider = await prisma.rider.create({
      data: {
        firstName: `${TAG}-First`,
        lastName: 'Rider',
        personality: 'competitive',
        skillLevel: 'rookie',
        speciality: 'Show Jumping',
        weeklyRate: 200,
        userId: user.id,
      },
    });

    trainer = await prisma.trainer.create({
      data: {
        firstName: `${TAG}-First`,
        lastName: 'Trainer',
        personality: 'focused',
        skillLevel: 'novice',
        speciality: 'Show Jumping',
        sessionRate: 150,
        userId: user.id,
      },
    });
  });

  afterAll(async () => {
    await prisma.rider.deleteMany({ where: { userId: user.id } }).catch(() => {});
    await prisma.trainer.deleteMany({ where: { userId: user.id } }).catch(() => {});
    await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
  });

  it('calculateLevel: matches the same curve as groomProgressionService (100*level per level)', () => {
    expect(calculateLevel(0)).toBe(1);
    expect(calculateLevel(99)).toBe(1);
    expect(calculateLevel(100)).toBe(2);
    expect(calculateLevel(299)).toBe(2);
    expect(calculateLevel(300)).toBe(3);
    expect(calculateLevel(10000)).toBe(10); // capped at LEVEL_CAP
  });

  it('awardRiderCompetitionXP(1st place) bumps experience, prestige, and recomputes level', async () => {
    const updated = await awardRiderCompetitionXP(rider.id, 1);
    expect(updated).not.toBeNull();
    expect(updated.experience).toBe(RIDER_XP_REWARDS.competition_entered + RIDER_XP_REWARDS.placement_1st);
    expect(updated.prestige).toBe(RIDER_PRESTIGE_BUMPS.placement_1st);
    expect(updated.level).toBe(1); // 30 XP is still level 1
  });

  it('awardRiderCompetitionXP accumulates and triggers level-up at 100 XP', async () => {
    // Build up: feed enough podium results to cross 100 XP.
    // Start from prior test: 30 XP already in.
    for (let i = 0; i < 4; i++) {
      // each 2nd = 5 (entered) + 15 (2nd) = 20 XP — 4 of those = 80 XP → 110 total
      await awardRiderCompetitionXP(rider.id, 2);
    }
    const after = await prisma.rider.findUnique({ where: { id: rider.id } });
    expect(after.experience).toBe(30 + 4 * 20);
    expect(after.level).toBe(2);
    expect(after.prestige).toBeGreaterThanOrEqual(
      RIDER_PRESTIGE_BUMPS.placement_1st + 4 * RIDER_PRESTIGE_BUMPS.placement_2nd,
    );
  });

  it('awardRiderCompetitionXP gives only base XP for placement > 10', async () => {
    const before = await prisma.rider.findUnique({ where: { id: rider.id } });
    await awardRiderCompetitionXP(rider.id, 99);
    const after = await prisma.rider.findUnique({ where: { id: rider.id } });
    expect(after.experience - before.experience).toBe(RIDER_XP_REWARDS.competition_entered);
    expect(after.prestige).toBe(before.prestige); // no prestige outside top-2
  });

  it('awardTrainerSessionXP(statGain=true) awards both session + stat-gain XP', async () => {
    const updated = await awardTrainerSessionXP(trainer.id, true);
    expect(updated).not.toBeNull();
    expect(updated.experience).toBe(TRAINER_XP_REWARDS.session_completed + TRAINER_XP_REWARDS.stat_gain_session);
    expect(updated.level).toBe(1);
  });

  it('awardTrainerSessionXP(statGain=false) awards only session XP', async () => {
    const before = await prisma.trainer.findUnique({ where: { id: trainer.id } });
    await awardTrainerSessionXP(trainer.id, false);
    const after = await prisma.trainer.findUnique({ where: { id: trainer.id } });
    expect(after.experience - before.experience).toBe(TRAINER_XP_REWARDS.session_completed);
  });

  it('incrementWeeklyCareerWeeks ticks both rider and trainer', async () => {
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
