/**
 * The groom profile keeps the game's numbers to itself (Equoria-2wdp8).
 *
 * Owner ruling 2026-10-28 (q164): "We want to hide anything a player might be
 * able to use to abuse the game and create loopholes." GET /grooms/:id/profile
 * sent, for every foal the groom looks after, the full personality-to-temperament
 * table (every ideal temperament for that personality, the bond modifier, the
 * trait-development bonus) plus the trait modifier score and the bond threshold
 * flag, and the groom's internal epigenetic influence code. No screen reads any
 * of it (frontend GroomProfile type), so it was pure hand-out.
 *
 * What stays: who the foal is and whether the pairing suits, in authored words.
 *
 * Real DB, no mocks; the controller driven with a plain req/res (the pattern in
 * groomAgeVisible.integration.test.mjs).
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { gameCalendarDate } from '../../../utils/gameTime.mjs';
import { getGroomProfile } from '../controllers/groomRosterController.mjs';

// A calm groom suits a reactive foal (utils/groomPersonalityTraitBonus.mjs).
const calmGroom = 'Calm';
const reactiveFoal = 'Reactive';
const fixturePrefix = 'TestFixture-2wdp8-profile';

function fakeRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      res.statusCode = code;
      return res;
    },
    json(body) {
      res.body = body;
      return res;
    },
  };
  return res;
}

describe('GET /grooms/:id/profile sends no compatibility numbers or tables', () => {
  let user;
  let groom;
  let foal;
  const cleanup = createCleanupTracker();

  beforeAll(async () => {
    const suffix = randomBytes(6).toString('hex');
    // Children before parents: the user row is referenced by the foal (RESTRICT).
    cleanup.add(() => (foal ? prisma.groomAssignment.deleteMany({ where: { foalId: foal.id } }) : null), 'assignment');
    cleanup.add(() => (foal ? prisma.horse.deleteMany({ where: { id: foal.id } }) : null), 'foal');
    cleanup.add(() => (groom ? prisma.groom.deleteMany({ where: { id: groom.id } }) : null), 'groom');
    cleanup.add(() => (user ? prisma.user.delete({ where: { id: user.id } }) : null), 'user');
    user = await prisma.user.create({
      data: {
        emailVerified: true,
        username: `${fixturePrefix}-${suffix}`.slice(0, 30),
        email: `${fixturePrefix}-${suffix}@example.com`,
        password: 'irrelevant-not-a-login-test',
        firstName: 'Profile',
        lastName: 'Numbers',
        money: 1000,
        settings: {},
      },
    });
    groom = await prisma.groom.create({
      data: {
        name: `${fixturePrefix}-groom-${suffix}`,
        speciality: 'foalCare',
        personality: calmGroom,
        skillLevel: 'novice',
        userId: user.id,
      },
    });
    foal = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `${fixturePrefix}-foal-${suffix}`,
        sex: 'Filly',
        dateOfBirth: gameCalendarDate(new Date(), -3),
        age: 0,
        userId: user.id,
        temperament: reactiveFoal,
        bondScore: 80,
      },
    });
    await prisma.groomAssignment.create({
      data: { groomId: groom.id, foalId: foal.id, userId: user.id, isActive: true },
    });
  }, 60000);

  afterAll(() => cleanup.run(), 60000);

  it('names the foal and whether the pairing suits, and nothing of the formula', async () => {
    const res = fakeRes();
    await getGroomProfile({ params: { id: String(groom.id) }, user: { id: user.id } }, res);
    expect(res.statusCode).toBe(200);

    const { groom: profile } = res.body;
    expect(profile).not.toHaveProperty('epigeneticInfluenceType');
    expect(profile.personalityCompatibility).toHaveLength(1);

    const [entry] = profile.personalityCompatibility;
    expect(entry).toEqual({
      foalId: foal.id,
      foalName: foal.name,
      foalTemperament: reactiveFoal,
      suitsFoal: true,
    });

    const wire = JSON.stringify(res.body);
    for (const internal of ['idealMatches', 'traitDevBonus', 'bondModifier', 'traitModifierScore', 'isStrongMatch']) {
      expect({ internal, sent: wire.includes(internal) }).toEqual({ internal, sent: false });
    }
  }, 30000);
});
