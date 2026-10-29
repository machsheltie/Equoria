/**
 * trainerSpecialitySecretUntilExpert.integration.test.mjs (Equoria-45u5g)
 *
 * Owner ruling 2026-10-29 (q278): a trainer's speciality is a secret until the trainer
 * is an Expert. Below Expert the server sends no speciality, no speciality label and a
 * bio with the speciality taken out (server-side omission, not CSS). An Expert's
 * speciality is sent as before.
 *
 * Real DB, no mocks; the real controllers driven with a plain req/res.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { getUserTrainers } from '../controllers/trainerController.mjs';
import { getTrainerMarketplace } from '../controllers/trainerMarketplaceController.mjs';

const fixturePrefix = 'TestFixture-45u5g';
const suffix = randomBytes(6).toString('hex');

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

function expectSecret(row, speciality) {
  expect(row).not.toHaveProperty('speciality');
  expect(row).not.toHaveProperty('specialty');
  expect(row).not.toHaveProperty('specialityLabel');
  expect(JSON.stringify(row)).not.toContain(speciality);
}

describe('a trainer speciality is secret until Expert (Equoria-45u5g, q278)', () => {
  let user;
  const trainerIds = [];
  const cleanup = createCleanupTracker();

  beforeAll(async () => {
    cleanup.add(() => prisma.trainer.deleteMany({ where: { id: { in: trainerIds } } }), 'trainer');
    cleanup.add(
      () => (user ? prisma.staffMarketplaceState.deleteMany({ where: { userId: user.id } }) : null),
      'staffMarketplaceState',
    );
    cleanup.add(() => (user ? prisma.user.delete({ where: { id: user.id } }) : null), 'user');

    user = await prisma.user.create({
      data: {
        emailVerified: true,
        username: `${fixturePrefix}-${suffix}`,
        email: `${fixturePrefix}-${suffix}@example.com`,
        password: 'irrelevant-not-a-login-test',
        firstName: 'Secret',
        lastName: 'Speciality',
        money: 1000,
      },
    });
    const make = (starLevel, skillLevel, speciality, bio) =>
      prisma.trainer.create({
        data: {
          firstName: 'Tam',
          lastName: `${fixturePrefix}-${starLevel}-${suffix}`,
          personality: 'patient',
          skillLevel,
          starLevel,
          speciality,
          bio,
          userId: user.id,
        },
      });
    for (const t of [
      await make(
        'rookie',
        'novice',
        'Show Jumping',
        'Tam is a newer trainer building their reputation in Show Jumping.',
      ),
      await make(
        'advanced',
        'developing',
        'Reining',
        'Tam has several years of training experience focusing on Reining.',
      ),
      await make(
        'expert',
        'expert',
        'Dressage',
        'Tam is a highly sought-after Dressage trainer with a proven track record.',
      ),
    ]) {
      trainerIds.push(t.id);
    }

    await prisma.staffMarketplaceState.create({
      data: {
        userId: user.id,
        staffType: 'trainer',
        refreshCount: 0,
        offers: [
          {
            marketplaceId: `mid-novice-${suffix}`,
            firstName: 'Offer',
            lastName: 'Novice',
            skillLevel: 'novice',
            starLevel: 'novice',
            personality: 'focused',
            speciality: 'Endurance',
            sessionRate: 200,
            bio: 'Enthusiastic and dedicated, Offer brings fresh training methods to Endurance.',
            availability: true,
          },
          {
            marketplaceId: `mid-expert-${suffix}`,
            firstName: 'Offer',
            lastName: 'Expert',
            skillLevel: 'expert',
            starLevel: 'expert',
            personality: 'focused',
            speciality: 'Eventing',
            sessionRate: 500,
            bio: 'Renowned in the Eventing community, Offer has produced multiple champions.',
            availability: true,
          },
        ],
      },
    });
  }, 60000);

  afterAll(() => cleanup.run(), 60000);

  it('the roster sends no speciality below Expert and takes it out of the bio', async () => {
    const res = await call(getUserTrainers, { user: { id: user.id }, params: { userId: user.id } });
    expect(res.statusCode).toBe(200);
    const byId = new Map(res.body.data.map(t => [t.id, t]));
    const [rookie, advanced, expert] = trainerIds.map(id => byId.get(id));

    expectSecret(rookie, 'Show Jumping');
    expect(rookie.bio).toBe('Tam is a newer trainer building their reputation.');
    expectSecret(advanced, 'Reining');
    expect(advanced.bio).toBe('Tam has several years of training experience.');

    expect(expert.speciality).toBe('Dressage');
    expect(expert.specialityLabel).toBe('Dressage');
    expect(expert.bio).toContain('Dressage');
  });

  it('the marketplace sends no speciality on a below-Expert offer', async () => {
    const res = await call(getTrainerMarketplace, { user: { id: user.id } });
    expect(res.statusCode).toBe(200);
    const novice = res.body.data.trainers.find(t => t.marketplaceId === `mid-novice-${suffix}`);
    const expert = res.body.data.trainers.find(t => t.marketplaceId === `mid-expert-${suffix}`);

    expectSecret(novice, 'Endurance');
    expect(novice.bio).toBe('Enthusiastic and dedicated, Offer brings fresh training methods.');

    expect(expert.speciality).toBe('Eventing');
    expect(expert.specialityLabel).toBe('Eventing');
  });
});
