/**
 * Equoria-tfo3c — caring for a horse costs nothing.
 *
 * OWNER RULING (2026-09-14 10:23, via the decision register):
 *   "Care itself does not cost money. Costs are: grooms per week; training per
 *    session; feed at purchase of the bag; farrier per use; veterinarian per use;
 *    riders per week."
 *
 * WHAT THAT REPLACES. Both interaction paths computed a per-session price from the
 * groom's `sessionRate` and duration, wrote it to `groom_interactions.cost`, and
 * debited NOBODY. Care was free while appearing to have a price — an unfinished
 * sink that would mislead the next reader into "wiring it up" against the ruling.
 *
 * WHAT IS ASSERTED, AND WHY EACH FAILS ON THE PRE-RULING CODE:
 *   1. Neither effects calculator returns a `cost`     -> both did
 *   2. `getAvailableInteractions` quotes no `estimatedCost` per variation
 *                                                      -> every variation did
 *   3. A real interaction writes NO cost: the column stays at its 0.0 default,
 *      and the player's wallet is untouched            -> the row carried a price
 *
 * THE COLUMN STAYS. `groom_interactions.cost` is left in place (no schema change
 * here); nothing writes it any more, so every new row takes the 0.0 default. Dropping
 * it is a migration for a later task — noted in the commit, not smuggled in.
 *
 * Real DB, no mocks. The interaction is driven through the controller with a fake
 * req/res, the Equoria-otii0 pattern in this directory.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { calculateGroomInteractionEffects } from '../../../utils/groomSystem.mjs';
import { calculateEnhancedEffects, getAvailableInteractions } from '../services/enhancedGroomInteractions.mjs';
import { recordInteraction } from '../controllers/groomInteractionController.mjs';

const FIXTURE_PREFIX = 'TestFixture-tfo3c-free';
const tag = () => randomBytes(6).toString('hex');

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

describe('Equoria-tfo3c — the care calculators quote no price', () => {
  const groom = {
    id: 1,
    name: 'Fixture Groom',
    speciality: 'general',
    skillLevel: 'expert',
    personality: 'gentle',
    experience: 10,
    sessionRate: 40,
    level: 3,
  };
  const horse = { id: 1, name: 'Fixture Horse', bondScore: 50, stressLevel: 10, age: 4 };

  it('calculateGroomInteractionEffects returns no cost', () => {
    const effects = calculateGroomInteractionEffects(groom, horse, 'daily_care', 60);
    expect(effects).not.toHaveProperty('cost');
    expect(typeof effects.bondingChange).toBe('number');
  });

  it('calculateEnhancedEffects returns no cost', () => {
    const effects = calculateEnhancedEffects(groom, horse, 'DAILY_CARE', 'Morning Routine', 60);
    expect(effects).not.toHaveProperty('cost');
    expect(typeof effects.bondingChange).toBe('number');
  });

  it('the available-interactions menu quotes no estimated cost', () => {
    const available = getAvailableInteractions(groom, horse);
    expect(available.length).toBeGreaterThan(0);
    for (const interaction of available) {
      for (const variation of interaction.variations) {
        expect(variation).not.toHaveProperty('estimatedCost');
      }
    }
  });
});

describe('Equoria-tfo3c — a real grooming session writes no price and takes no money', () => {
  let user;
  let horse;
  let groom;
  const cleanup = createCleanupTracker();

  beforeAll(async () => {
    const suffix = tag();
    user = await prisma.user.create({
      data: {
        username: `${FIXTURE_PREFIX}-${suffix}`.slice(0, 30),
        email: `${FIXTURE_PREFIX}-${suffix}@example.com`,
        password: 'irrelevant-not-a-login-test',
        firstName: 'Free',
        lastName: 'Care',
        money: 5000,
        settings: {},
      },
    });
    horse = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `${FIXTURE_PREFIX}-horse-${suffix}`,
        sex: 'Filly',
        dateOfBirth: new Date('2026-08-20'), // a foal, so enrichment tasks apply
        age: 0,
        userId: user.id,
        healthStatus: 'Excellent',
        bondScore: 40,
        stressLevel: 10,
      },
    });
    groom = await prisma.groom.create({
      data: {
        name: `${FIXTURE_PREFIX}-groom-${suffix}`,
        speciality: 'foalCare',
        personality: 'gentle',
        skillLevel: 'expert',
        sessionRate: 40,
        startAge: 20,
        userId: user.id,
      },
    });
    await prisma.groomAssignment.create({
      data: { groomId: groom.id, foalId: horse.id, userId: user.id, isActive: true },
    });

    cleanup.add(() => prisma.groomInteraction.deleteMany({ where: { groomId: groom.id } }), 'interactions');
    cleanup.add(() => prisma.foalActivity.deleteMany({ where: { foalId: horse.id } }), 'activities');
    cleanup.add(() => prisma.groomAssignment.deleteMany({ where: { userId: user.id } }), 'assignments');
    cleanup.add(() => prisma.groomHorseSynergy.deleteMany({ where: { groomId: groom.id } }), 'synergies');
    cleanup.add(() => prisma.groom.deleteMany({ where: { userId: user.id } }), 'grooms');
    cleanup.add(() => prisma.horse.deleteMany({ where: { userId: user.id } }), 'horses');
    cleanup.add(() => prisma.user.delete({ where: { id: user.id } }), 'user');
  }, 60000);

  afterAll(() => cleanup.run(), 60000);

  it('records the interaction with no cost, and the player pays nothing', async () => {
    const moneyBefore = Number(
      (await prisma.user.findUnique({ where: { id: user.id }, select: { money: true } })).money,
    );

    const res = fakeRes();
    await recordInteraction(
      {
        user: { id: user.id },
        body: {
          foalId: horse.id,
          groomId: groom.id,
          interactionType: 'trust_building',
          duration: 30,
        },
      },
      res,
    );
    expect(res.statusCode).toBe(200);

    const rows = await prisma.groomInteraction.findMany({
      where: { groomId: groom.id, foalId: horse.id },
      select: { cost: true },
    });
    expect(rows).toHaveLength(1);
    // The column still exists and takes its 0.0 default; nothing writes a price.
    expect(Number(rows[0].cost)).toBe(0);

    const moneyAfter = Number(
      (await prisma.user.findUnique({ where: { id: user.id }, select: { money: true } })).money,
    );
    expect(moneyAfter).toBe(moneyBefore);
  }, 60000);
});
