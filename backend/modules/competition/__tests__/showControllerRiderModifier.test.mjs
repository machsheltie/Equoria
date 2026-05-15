/**
 * Rider modifier integration test for showController.executeClosedShows
 *
 * Bug fix for Equoria-5bkh: prior code computed
 *   `score = Math.round(base + luck)`
 * with NO RiderAssignment lookup affecting the score — only post-hoc
 * stat tracking. This test creates two horses with identical stats, assigns
 * an elite Rider to one, runs `executeClosedShows`, and asserts the
 * rider-assigned horse's score is higher than the unassigned horse's score
 * averaged across multiple runs (the ±9% luck noise washes out at N runs).
 *
 * Failing-test-first per .claude/rules/EDGE_CASE_FIX_DISCIPLINE.md §1:
 *   Before the fix, the rider-assigned horse scores no better than the
 *   unassigned horse — luck dominates entirely. After the fix, the elite
 *   rider's ~9% bonus shifts win frequency materially above 50%.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { executeClosedShows } from '../shows/showController.mjs';

const TAG = `RiderModFix-${randomBytes(4).toString('hex')}`;

let user;
let horseWithRider;
let horseWithoutRider;
let elitRider;
const createdShowIds = [];

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      email: `${TAG}@test.local`,
      username: `${TAG}-user`.slice(0, 30),
      password: 'irrelevant-hash',
      firstName: 'RiderMod',
      lastName: 'Test',
      money: 0,
    },
  });

  // Two horses with IDENTICAL stats so any score delta is rider-attributable
  const horseStats = {
    sex: 'Mare',
    dateOfBirth: new Date('2018-01-01'),
    age: 7,
    userId: user.id,
    healthStatus: 'healthy',
    speed: 70,
    stamina: 70,
    agility: 70,
    balance: 70,
    precision: 70,
    boldness: 70,
  };

  horseWithRider = await prisma.horse.create({
    data: { ...horseStats, name: `TestFixture-${TAG}-WithRider` },
  });
  horseWithoutRider = await prisma.horse.create({
    data: { ...horseStats, name: `TestFixture-${TAG}-NoRider` },
  });

  // Create an elite rider: experienced + max level/prestige + matching discipline
  elitRider = await prisma.rider.create({
    data: {
      firstName: 'TestFixture',
      lastName: `${TAG}-EliteRider`,
      personality: 'methodical', // Dressage affinity = high (+2%)
      skillLevel: 'experienced', // +3%
      speciality: 'Dressage',
      level: 10, // +3.6%
      prestige: 100, // +4%
      userId: user.id,
    },
  });

  await prisma.riderAssignment.create({
    data: {
      riderId: elitRider.id,
      horseId: horseWithRider.id,
      userId: user.id,
      isActive: true,
    },
  });
}, 30000);

afterAll(async () => {
  await prisma.competitionResult.deleteMany({ where: { showId: { in: createdShowIds } } }).catch(() => {});
  await prisma.showEntry.deleteMany({ where: { showId: { in: createdShowIds } } }).catch(() => {});
  await prisma.show.deleteMany({ where: { id: { in: createdShowIds } } }).catch(() => {});
  await prisma.riderAssignment
    .deleteMany({ where: { horseId: { in: [horseWithRider.id, horseWithoutRider.id] } } })
    .catch(() => {});
  if (elitRider) {
    await prisma.rider.delete({ where: { id: elitRider.id } }).catch(() => {});
  }
  if (horseWithRider) {
    await prisma.horse.delete({ where: { id: horseWithRider.id } }).catch(() => {});
  }
  if (horseWithoutRider) {
    await prisma.horse.delete({ where: { id: horseWithoutRider.id } }).catch(() => {});
  }
  if (user) {
    await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
  }
}, 30000);

describe('executeClosedShows — RiderAssignment modifier (Equoria-5bkh)', () => {
  it('elite rider wins majority of head-to-head runs vs no-rider horse', async () => {
    const RUNS = 20;
    let riderWins = 0;
    let totalRiderScore = 0;
    let totalNoRiderScore = 0;

    for (let i = 0; i < RUNS; i++) {
      const pastDate = new Date(Date.now() - 60 * 60 * 1000);
      const show = await prisma.show.create({
        data: {
          name: `TestFixture-${TAG}-Show-${i}-${Date.now()}`,
          discipline: 'Dressage',
          entryFee: 0,
          levelMin: 1,
          levelMax: 999,
          prize: 0,
          runDate: pastDate,
          status: 'open',
          openDate: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
          closeDate: pastDate,
          createdByUserId: user.id,
        },
      });
      createdShowIds.push(show.id);

      await prisma.showEntry.createMany({
        data: [
          { showId: show.id, horseId: horseWithRider.id, userId: user.id, feePaid: 0 },
          { showId: show.id, horseId: horseWithoutRider.id, userId: user.id, feePaid: 0 },
        ],
      });

      await executeClosedShows(null, null);

      const results = await prisma.competitionResult.findMany({
        where: { showId: show.id },
        orderBy: { horseId: 'asc' },
      });
      expect(results.length).toBe(2);

      const riderResult = results.find(r => r.horseId === horseWithRider.id);
      const noRiderResult = results.find(r => r.horseId === horseWithoutRider.id);

      const riderScore = Number(riderResult.score);
      const noRiderScore = Number(noRiderResult.score);

      totalRiderScore += riderScore;
      totalNoRiderScore += noRiderScore;
      if (riderScore > noRiderScore) {
        riderWins++;
      }
    }

    const avgRider = totalRiderScore / RUNS;
    const avgNoRider = totalNoRiderScore / RUNS;

    // Elite rider provides ~9-12% effective bonus. With ±9% luck on BOTH horses
    // (independent rolls), the rider-assigned horse should win the head-to-head
    // a comfortable majority of the time. Threshold 13/20 (65%) is well above
    // the 50% null hypothesis but loose enough to avoid flake.
    expect(riderWins).toBeGreaterThanOrEqual(13);

    // Average advantage should be materially positive — luck is symmetric so
    // averages converge to the rider's bonus contribution.
    expect(avgRider).toBeGreaterThan(avgNoRider);
  }, 120000);
});
