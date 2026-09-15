/**
 * Equoria-maeba — the confirmed aging criteria, with the old system retired.
 *
 * OWNER RULING (2026-09-14 10:23, verbatim, via the decision register):
 *   "I am confirming the new specified aging criteria. Retire any reference to
 *    the old system."
 *
 * The new criteria (already live since Equoria-ypb7d.1): a groom's age is
 * `startAge + careerWeeks`, it advances a year per weekly pass, and the game
 * retires the groom when that AGE reaches a hidden value drawn from 50..65.
 * What this file pins is the second half of the ruling — that nothing the game
 * still SAYS describes the retired career-weeks reading:
 *
 *   1. The retirement notice — the player's only word about the event — reports
 *      the groom's AGE IN YEARS. It used to carry `careerWeeks`, a number that
 *      under the old reading WAS the age and under the new one is a bare counter
 *      of weekly passes with no meaning to a player.
 *   2. `getRetirementStatistics` reports `averageCareerYears`. It used to report
 *      `averageCareerLength`, whose unit was weeks-since-hire.
 *
 * Both are player-facing contract changes and the implementation changes with
 * them, which is why they are asserted here rather than by relaxing an old
 * assertion somewhere else.
 *
 * Real DB, no mocks. Cleanup is id- and prefix-scoped through the fail-loud
 * tracker.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { processRetirement, getRetirementStatistics } from '../services/groomRetirementService.mjs';
import { ensureRetirementSchedule } from '../services/groomRetirementScheduleService.mjs';

const FIXTURE_PREFIX = 'TestFixture-maeba-age';
const FIXTURE_START_AGE = 20;
const tag = () => randomBytes(6).toString('hex');

async function makeUser(label, money = 20000) {
  const suffix = tag();
  return prisma.user.create({
    data: {
      username: `${FIXTURE_PREFIX}-${label}-${suffix}`,
      email: `${FIXTURE_PREFIX}-${label}-${suffix}@example.com`,
      password: 'irrelevant-not-a-login-test',
      firstName: 'Maeba',
      lastName: label,
      money,
      settings: {},
    },
  });
}

async function makeGroom(userId, label, extra = {}) {
  return prisma.groom.create({
    data: {
      name: `${FIXTURE_PREFIX}-${label}-${tag()}`,
      speciality: 'general',
      personality: 'gentle',
      skillLevel: 'novice',
      startAge: FIXTURE_START_AGE,
      userId,
      ...extra,
    },
  });
}

describe('Equoria-maeba — the game speaks in YEARS, not career weeks', () => {
  let user;
  const cleanup = createCleanupTracker();

  beforeAll(async () => {
    user = await makeUser('notice');
    cleanup.add(() => prisma.notification.deleteMany({ where: { userId: user.id } }), 'notifications');
    cleanup.add(() => prisma.groom.deleteMany({ where: { userId: user.id } }), 'grooms');
    cleanup.add(() => prisma.user.delete({ where: { id: user.id } }), 'user');
  }, 30000);

  afterAll(() => cleanup.run(), 30000);

  it('the retirement notice reports the age in years, and no career-weeks field', async () => {
    const groom = await makeGroom(user.id, 'retiree');
    const retirementAge = await ensureRetirementSchedule(prisma, groom.id);
    await prisma.groom.update({
      where: { id: groom.id },
      data: { careerWeeks: retirementAge - FIXTURE_START_AGE },
    });

    const result = await processRetirement(groom.id);
    const [[, payload]] = result.notificationPayloadsByRecipient;

    // The groom retired AT its drawn age, and the notice says so in years.
    expect(payload.ageYears).toBe(retirementAge);
    expect(payload).not.toHaveProperty('careerWeeks');

    // And the stored row the player actually reads carries the same field.
    const stored = await prisma.notification.findUnique({
      where: { id: result.notificationIds[0] },
      select: { payload: true },
    });
    expect(stored.payload.ageYears).toBe(retirementAge);
    expect(stored.payload).not.toHaveProperty('careerWeeks');
  }, 30000);

  it('retirement statistics report an average career length in YEARS, named as such', async () => {
    const stats = await getRetirementStatistics(user.id);

    expect(typeof stats.averageCareerYears).toBe('number');
    expect(stats).not.toHaveProperty('averageCareerLength');
  }, 30000);
});
