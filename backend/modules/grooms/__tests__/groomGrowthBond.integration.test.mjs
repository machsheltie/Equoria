/**
 * A groom's hidden items change the bond a grooming earns (Equoria-xlw03).
 *
 * Owner ruling q331, 2026-11-18: a groom's + temperament item or favorite breed gives +1
 * extra bond per grooming for a horse of that temperament or breed; a - temperament item
 * gives -1. Hidden and revealed alike (owner ruling 10-28). Bond otherwise grows by 5 a
 * grooming (owner ruling 2026-10-26, q87). Traits and disciplines do nothing for a groom.
 *
 * Real DB, real "groom horse" action; no mocks.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { createTestHorse } from '../../../__tests__/helpers/createTestHorse.mjs';
import { birthDateForAge } from '../../../utils/horseAge.mjs';
import { horseTemperamentValues } from '../../../constants/schema.mjs';
import { groomHorse } from '../services/groomCareService.mjs';

const fixturePrefix = 'TestFixture-xlw03-groombond';
const tag = () => randomBytes(4).toString('hex');
const item = (kind, value, sign = 'positive', revealed = false) => ({ kind, value, sign, revealed });

describe("a groom's hidden items at grooming", () => {
  const cleanup = createCleanupTracker();
  const horseIds = [];
  const groomIds = [];
  let user;
  let breedId;
  let otherBreedId;
  const horseTemperament = horseTemperamentValues[0];
  const otherTemperament = horseTemperamentValues[1];

  beforeAll(async () => {
    cleanup.add(() => prisma.groomInteraction.deleteMany({ where: { groomId: { in: groomIds } } }), 'interactions');
    cleanup.add(() => prisma.foalActivity.deleteMany({ where: { foalId: { in: horseIds } } }), 'activities');
    cleanup.add(() => prisma.groomAssignment.deleteMany({ where: { groomId: { in: groomIds } } }), 'assignments');
    cleanup.add(() => prisma.groomHorseSynergy.deleteMany({ where: { groomId: { in: groomIds } } }), 'synergies');
    cleanup.add(() => prisma.groom.deleteMany({ where: { id: { in: groomIds } } }), 'grooms');
    cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: horseIds } } }), 'horses');
    cleanup.add(() => prisma.user.delete({ where: { id: user.id } }), 'user');
    const t = tag();
    user = await prisma.user.create({
      data: {
        emailVerified: true,
        username: `${fixturePrefix}-${t}`,
        email: `${fixturePrefix}-${t}@example.com`,
        password: 'irrelevant-not-a-login-test',
        firstName: 'Groom',
        lastName: 'Bond',
        settings: {},
      },
    });
    const breeds = await prisma.breed.findMany({ select: { id: true }, orderBy: { id: 'asc' }, take: 2 });
    [{ id: breedId }, { id: otherBreedId }] = breeds;
  }, 60000);

  afterAll(() => cleanup.run(), 60000);

  /** Groom a fresh adult horse (bond 40) with a groom holding `items`; returns the bond gained. */
  async function bondGainedWith(items) {
    const horse = await createTestHorse(
      prisma,
      {
        name: `${fixturePrefix}-horse-${tag()}`,
        sex: 'Mare',
        dateOfBirth: birthDateForAge(5),
        userId: user.id,
        breedId,
        temperament: horseTemperament,
        healthStatus: 'Excellent',
        bondScore: 40,
      },
      horseIds,
    );
    const groom = await prisma.groom.create({
      data: {
        name: `${fixturePrefix}-groom-${tag()}`,
        speciality: 'general',
        personality: 'gentle',
        skillLevel: 'expert',
        sessionRate: 40,
        startAge: 20,
        userId: user.id,
      },
    });
    groomIds.push(groom.id);
    if (items !== null) {
      await prisma.groomGrowthProfile.create({ data: { groomId: groom.id, items } });
    }
    await prisma.groomAssignment.create({
      data: { groomId: groom.id, foalId: horse.id, userId: user.id, isActive: true },
    });
    await groomHorse({ horseId: horse.id });
    const after = await prisma.horse.findUnique({ where: { id: horse.id }, select: { bondScore: true } });
    const interaction = await prisma.groomInteraction.findFirst({ where: { groomId: groom.id } });
    expect(interaction.bondingChange).toBe(after.bondScore - 40);
    return after.bondScore - 40;
  }

  it('with nothing matching, a grooming adds the plain 5', async () => {
    expect(await bondGainedWith([])).toBe(5);
    expect(
      await bondGainedWith([
        item('temperament', otherTemperament),
        item('temperament', otherTemperament, 'negative'),
        item('breed', otherBreedId),
        item('trait', 'brave'),
        item('discipline', 'Dressage'),
      ]),
    ).toBe(5);
  }, 60000);

  it('a + temperament item adds 1 and a - one takes 1, hidden or revealed', async () => {
    expect(await bondGainedWith([item('temperament', horseTemperament)])).toBe(6);
    expect(await bondGainedWith([item('temperament', horseTemperament, 'positive', true)])).toBe(6);
    expect(await bondGainedWith([item('temperament', horseTemperament, 'negative')])).toBe(4);
    expect(await bondGainedWith([item('temperament', horseTemperament, 'negative', true)])).toBe(4);
  }, 60000);

  it('a favorite breed adds 1 for a horse of that breed', async () => {
    expect(await bondGainedWith([item('breed', breedId)])).toBe(6);
    expect(await bondGainedWith([item('breed', breedId, 'positive', true)])).toBe(6);
  }, 60000);

  it('a + temperament and a favorite breed together add 2', async () => {
    expect(await bondGainedWith([item('temperament', horseTemperament), item('breed', breedId)])).toBe(7);
  }, 60000);
});
