/**
 * Equoria-9rhf6 — a bond milestone a foal earns by grooming is recorded when
 * the groom happens, not on the next read of its development.
 *
 * Bond is earned by grooming (+5 a day, owner ruling 2026-10-26, q87) and the
 * bond-25/50/75/100 milestones are kept (ruling F6 2026-10-16). Before this
 * fix "groom horse" wrote Horse.bondScore and nothing else recorded the
 * milestone: FoalDevelopment.completedMilestones only gained the key when
 * GET /foals/:id/development lazily ran the detector.
 *
 * Asserted:
 *   1. A groom that lifts a foal's bond from 20 to 25 stores bond-25 with the
 *      groom's own timestamp, with no development read in between.
 *   2. The next day's groom (bond 30) adds nothing and keeps that timestamp.
 *   3. A grown horse groomed across 25 gets no foal development row.
 *
 * Real DB, no mocks.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { testHorseData } from '../../../__tests__/helpers/createTestHorse.mjs';
import { groomHorse } from '../services/groomCareService.mjs';
import { foalCareToday } from '../services/foalCareSchedule.mjs';

const fixturePrefix = 'TestFixture-9rhf6';
const dayMs = 24 * 60 * 60 * 1000;

describe('Equoria-9rhf6 — groom horse records the foal bond milestone it crosses', () => {
  const cleanup = createCleanupTracker();
  const now = new Date();
  let user;
  let foal;
  let grown;
  let groom;

  beforeAll(async () => {
    const suffix = randomBytes(6).toString('hex');
    cleanup.add(() => prisma.groomInteraction.deleteMany({ where: { groomId: groom.id } }), 'interactions');
    cleanup.add(() => prisma.foalActivity.deleteMany({ where: { foalId: { in: [foal.id, grown.id] } } }), 'activities');
    cleanup.add(
      () => prisma.foalDevelopment.deleteMany({ where: { foalId: { in: [foal.id, grown.id] } } }),
      'development',
    );
    cleanup.add(() => prisma.groomAssignment.deleteMany({ where: { userId: user.id } }), 'assignments');
    cleanup.add(() => prisma.groomHorseSynergy.deleteMany({ where: { groomId: groom.id } }), 'synergies');
    cleanup.add(() => prisma.groom.deleteMany({ where: { userId: user.id } }), 'grooms');
    cleanup.add(() => prisma.horse.deleteMany({ where: { userId: user.id } }), 'horses');
    cleanup.add(() => prisma.user.delete({ where: { id: user.id } }), 'user');

    user = await prisma.user.create({
      data: {
        emailVerified: true,
        username: `${fixturePrefix}-${suffix}`.slice(0, 30),
        email: `${fixturePrefix}-${suffix}@example.com`,
        password: 'irrelevant-not-a-login-test',
        firstName: 'Bond',
        lastName: 'Milestone',
        money: 5000,
        settings: {},
      },
    });
    foal = await prisma.horse.create({
      data: await testHorseData(prisma, {
        ...fixtureColor(),
        name: `${fixturePrefix}-foal-${suffix}`,
        sex: 'Filly',
        dateOfBirth: new Date(now.getTime() - 2 * dayMs),
        age: 0,
        userId: user.id,
        healthStatus: 'Excellent',
        bondScore: 20,
      }),
    });
    grown = await prisma.horse.create({
      data: await testHorseData(prisma, {
        ...fixtureColor(),
        name: `${fixturePrefix}-grown-${suffix}`,
        sex: 'Mare',
        dateOfBirth: new Date(now.getTime() - 200 * dayMs),
        age: 5,
        userId: user.id,
        healthStatus: 'Excellent',
        bondScore: 20,
      }),
    });
    groom = await prisma.groom.create({
      data: {
        name: `${fixturePrefix}-groom-${suffix}`,
        speciality: 'foalCare',
        personality: 'gentle',
        skillLevel: 'expert',
        sessionRate: 40,
        startAge: 20,
        userId: user.id,
      },
    });
    for (const horse of [foal, grown]) {
      await prisma.groomAssignment.create({
        data: { groomId: groom.id, foalId: horse.id, userId: user.id, isActive: true },
      });
    }
  }, 60000);

  afterAll(() => cleanup.run(), 60000);

  const storedMilestones = async horseId =>
    (
      await prisma.foalDevelopment.findUnique({
        where: { foalId: horseId },
        select: { completedMilestones: true },
      })
    )?.completedMilestones;

  it('stores bond-25 at the moment the groom lifts the foal to 25', async () => {
    const activity = foalCareToday(foal.dateOfBirth, now).activities[0].id;
    const status = await groomHorse({ horseId: foal.id, activity, now });
    expect(status.bond).toBe(25);

    const store = await storedMilestones(foal.id);
    expect(store).toEqual({ 'bond-25': now.toISOString() });
  }, 60000);

  it('adds nothing on the next groom and keeps the first timestamp', async () => {
    const tomorrow = new Date(now.getTime() + dayMs);
    const activity = foalCareToday(foal.dateOfBirth, tomorrow).activities[0].id;
    const status = await groomHorse({ horseId: foal.id, activity, now: tomorrow });
    expect(status.bond).toBe(30);

    const store = await storedMilestones(foal.id);
    expect(store).toEqual({ 'bond-25': now.toISOString() });
  }, 60000);

  it('gives a grown horse no foal development row', async () => {
    const status = await groomHorse({ horseId: grown.id, now });
    expect(status.bond).toBe(25);

    expect(await storedMilestones(grown.id)).toBeUndefined();
  }, 60000);
});
