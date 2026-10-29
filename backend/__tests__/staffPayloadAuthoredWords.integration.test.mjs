/**
 * Staff reads send authored words and only what the screens read (Equoria-no441).
 *
 * Owner rulings 2026-10-28 q164/q165: the data a player receives carries names,
 * not stored codes, and nothing a player could use to find loopholes.
 *
 * - Every groom, rider and trainer row and marketplace offer carries
 *   skillLevelLabel, personalityLabel and specialityLabel beside the stored
 *   values (which stay: the screens filter and hire by them).
 * - GET /trainers/user/:id sent the whole trainer row, including discoverySlots:
 *   every hidden trait a trainer has, before the player discovers any of them.
 * - GET /riders/user/:id sent the whole rider row, including startAge.
 * - The marketplaces sent each stored offer verbatim, so any field stored on an
 *   offer reached the browser. An offer is now copied through an allow-list.
 * - The groom hire answered with the whole groom row (epigeneticInfluenceType,
 *   bonusTraitMap, rareTraitPerks, showHandlingSkill).
 *
 * Real DB, no mocks; controllers driven with a plain req/res (the pattern in
 * modules/grooms/__tests__/groomProfileNoHiddenNumbers.integration.test.mjs).
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../packages/database/prismaClient.mjs';
import { createCleanupTracker } from './helpers/failLoudCleanup.mjs';
import { getUserTrainers } from '../modules/trainers/controllers/trainerController.mjs';
import { getTrainerMarketplace } from '../modules/trainers/controllers/trainerMarketplaceController.mjs';
import { getUserRiders } from '../modules/riders/controllers/riderController.mjs';
import { getRiderMarketplace } from '../modules/riders/controllers/riderMarketplaceController.mjs';
import { getMarketplace, hireFromMarketplace } from '../modules/grooms/controllers/groomMarketplaceController.mjs';
import { getUserGrooms } from '../modules/grooms/controllers/groomRosterController.mjs';

const fixturePrefix = 'TestFixture-no441-staff';
// A field stored on an offer that no screen reads, standing in for any hidden value.
const hiddenOfferField = 'hiddenAptitude';

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

async function call(handler, req) {
  const res = fakeRes();
  await handler(req, res);
  return res;
}

const labelsOf = row => ({
  skillLevelLabel: row.skillLevelLabel,
  personalityLabel: row.personalityLabel,
  specialityLabel: row.specialityLabel,
});

describe('staff reads send authored words, never hidden fields', () => {
  let user;
  let trainer;
  let rider;
  let groom;
  const hiredGroomIds = [];
  const cleanup = createCleanupTracker();
  const suffix = randomBytes(6).toString('hex');
  const groomOfferId = `mkt_groom_${fixturePrefix}-${suffix}`;

  beforeAll(async () => {
    // Children before parents.
    cleanup.add(
      () => (user ? prisma.staffMarketplaceState.deleteMany({ where: { userId: user.id } }) : null),
      'marketplace state',
    );
    // The hire writes the player's ledger row; its engagement and retirement
    // schedule go with the groom (onDelete: Cascade).
    cleanup.add(() => (user ? prisma.userTransaction.deleteMany({ where: { userId: user.id } }) : null), 'ledger rows');
    cleanup.add(
      () => (hiredGroomIds.length ? prisma.groom.deleteMany({ where: { id: { in: hiredGroomIds } } }) : null),
      'hired grooms',
    );
    cleanup.add(() => (groom ? prisma.groom.deleteMany({ where: { id: groom.id } }) : null), 'groom');
    cleanup.add(() => (rider ? prisma.rider.deleteMany({ where: { id: rider.id } }) : null), 'rider');
    cleanup.add(() => (trainer ? prisma.trainer.deleteMany({ where: { id: trainer.id } }) : null), 'trainer');
    cleanup.add(() => (user ? prisma.user.delete({ where: { id: user.id } }) : null), 'user');

    user = await prisma.user.create({
      data: {
        emailVerified: true,
        username: `${fixturePrefix}-${suffix}`.slice(0, 30),
        email: `${fixturePrefix}-${suffix}@example.com`,
        password: 'irrelevant-not-a-login-test',
        firstName: 'Staff',
        lastName: 'Words',
        money: 100000,
        settings: {},
      },
    });
    trainer = await prisma.trainer.create({
      data: {
        firstName: 'Tess',
        lastName: `${fixturePrefix}-${suffix}`,
        personality: 'encouraging',
        skillLevel: 'developing',
        speciality: 'Dressage',
        discoverySlots: [{ slotIndex: 0, category: 'secretBonus', label: 'Hidden knack', strength: 'strong' }],
        userId: user.id,
      },
    });
    rider = await prisma.rider.create({
      data: {
        firstName: 'Rae',
        lastName: `${fixturePrefix}-${suffix}`,
        personality: 'daring',
        skillLevel: 'experienced',
        speciality: 'Show Jumping',
        startAge: 22,
        userId: user.id,
      },
    });
    groom = await prisma.groom.create({
      data: {
        name: `${fixturePrefix}-groom-${suffix}`,
        speciality: 'foalCare',
        personality: 'patient',
        skillLevel: 'expert',
        userId: user.id,
      },
    });

    const fresh = new Date();
    const offer = {
      firstName: 'Ola',
      lastName: `${fixturePrefix}-${suffix}`,
      skillLevel: 'intermediate',
      starLevel: 'rookie',
      personality: 'gentle',
      experience: 0,
      sessionRate: 15,
      bio: 'A quiet hand with young horses.',
      availability: true,
      [hiddenOfferField]: 9,
    };
    await prisma.staffMarketplaceState.createMany({
      data: [
        {
          userId: user.id,
          staffType: 'groom',
          lastRefresh: fresh,
          offers: [{ ...offer, specialty: 'medical', marketplaceId: groomOfferId }],
        },
        {
          userId: user.id,
          staffType: 'rider',
          lastRefresh: fresh,
          offers: [
            {
              ...offer,
              skillLevel: 'rookie',
              personality: 'methodical',
              speciality: 'Dressage',
              weeklyRate: 100,
              startAge: 19,
              knownAffinities: [],
              marketplaceId: `mkt_rider_${suffix}`,
            },
          ],
        },
        {
          userId: user.id,
          staffType: 'trainer',
          lastRefresh: fresh,
          offers: [
            {
              ...offer,
              skillLevel: 'expert',
              // An Expert offer: its speciality is sent (q278).
              starLevel: 'expert',
              personality: 'technical',
              speciality: 'Eventing',
              marketplaceId: `mkt_trainer_${suffix}`,
            },
          ],
        },
      ],
    });
  }, 60000);

  afterAll(() => cleanup.run(), 60000);

  it("a trainer row carries labels and none of the trainer's undiscovered traits", async () => {
    const res = await call(getUserTrainers, { user: { id: user.id }, params: { userId: user.id } });
    expect(res.statusCode).toBe(200);
    const row = res.body.data.find(t => t.id === trainer.id);
    expect(row).not.toHaveProperty('discoverySlots');
    expect(JSON.stringify(res.body)).not.toContain('Hidden knack');
    // Owner ruling 2026-10-29 (q278, Equoria-45u5g): this trainer is below Expert (the
    // starLevel default, Rookie), so its speciality is not sent. Old contract: every
    // trainer row carried specialityLabel.
    expect(labelsOf(row)).toEqual({
      skillLevelLabel: 'Developing',
      personalityLabel: 'Encouraging',
      specialityLabel: undefined,
    });
    expect(row).not.toHaveProperty('speciality');
    expect(row.personality).toBe('encouraging');
  });

  it('a rider row carries labels and not the start age', async () => {
    const res = await call(getUserRiders, { user: { id: user.id }, params: { userId: user.id } });
    expect(res.statusCode).toBe(200);
    const row = res.body.data.find(r => r.id === rider.id);
    expect(row).not.toHaveProperty('startAge');
    expect(labelsOf(row)).toEqual({
      skillLevelLabel: 'Experienced',
      personalityLabel: 'Daring',
      specialityLabel: 'Show Jumping',
    });
    expect(row.skillLevel).toBe('experienced');
  });

  it('a groom roster row carries labels', async () => {
    const res = await call(getUserGrooms, { user: { id: user.id }, params: { userId: user.id }, query: {} });
    expect(res.statusCode).toBe(200);
    const row = res.body.grooms.find(g => g.id === groom.id);
    expect(labelsOf(row)).toEqual({
      skillLevelLabel: 'Expert',
      personalityLabel: 'Patient',
      specialityLabel: 'Foal Care',
    });
  });

  it.each([
    [
      'groom',
      getMarketplace,
      'grooms',
      { skillLevelLabel: 'Intermediate', personalityLabel: 'Gentle', specialityLabel: 'Medical Care' },
    ],
    [
      'rider',
      getRiderMarketplace,
      'riders',
      { skillLevelLabel: 'Rookie', personalityLabel: 'Methodical', specialityLabel: 'Dressage' },
    ],
    [
      'trainer',
      getTrainerMarketplace,
      'trainers',
      { skillLevelLabel: 'Expert', personalityLabel: 'Technical', specialityLabel: 'Eventing' },
    ],
  ])(
    'a %s marketplace offer carries labels and no field the screens do not read',
    async (_kind, handler, key, labels) => {
      const res = await call(handler, { user: { id: user.id } });
      expect(res.statusCode).toBe(200);
      const [offer] = res.body.data[key];
      expect(offer).not.toHaveProperty(hiddenOfferField);
      expect(offer).not.toHaveProperty('startAge');
      expect(labelsOf(offer)).toEqual(labels);
      expect(offer.marketplaceId).toMatch(/^mkt_/);
    },
  );

  it('a groom hire answers with the public groom, not its hidden tables', async () => {
    const res = await call(hireFromMarketplace, { user: { id: user.id }, body: { marketplaceId: groomOfferId } });
    expect(res.statusCode).toBe(201);
    const hired = res.body.data.groom;
    hiredGroomIds.push(hired.id);
    for (const hidden of [
      'epigeneticInfluenceType',
      'bonusTraitMap',
      'rareTraitPerks',
      'showHandlingSkill',
      'startAge',
      hiddenOfferField,
    ]) {
      expect({ hidden, sent: Object.hasOwn(hired, hidden) }).toEqual({ hidden, sent: false });
    }
    expect(labelsOf(hired)).toEqual({
      skillLevelLabel: 'Intermediate',
      personalityLabel: 'Gentle',
      specialityLabel: 'Medical Care',
    });
  });
});
