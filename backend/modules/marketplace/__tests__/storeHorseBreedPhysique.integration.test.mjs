/**
 * Horse Trader horses carry conformation and gaits from their breed's ranges
 * (Equoria-vqz4b, Equoria-17zgu; owner request 2026-10-28).
 *
 * Before the fix, buyStoreHorse passed no conformation and no gaits to createHorse,
 * so every store horse got the flat-20 placeholder in all 8 regions and NULL gaits
 * ("No gait scores available for this horse"). This buys one gaited and one
 * non-gaited breed through the real POST /api/v1/marketplace/store/buy route and
 * checks the stored row: regions not all equal, each inside its own breed range,
 * every standard gait present, and the gaited breed's named special gaits present.
 *
 * Owner ruling 2026-10-28 (q211): a breed with no conformation or gait ranges is
 * refused (422, nothing charged, no horse), never given fallback scores. Before, the
 * purchase failed later with a 500 (no starter stats) or wrote the flat-20 fallback.
 *
 * Real app, real DB, no mocks. Cleanup is scoped to the rows this file creates.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { expectBreedPhysique } from '../../../__tests__/helpers/expectBreedPhysique.mjs';

const ORIGIN = 'http://localhost:3000';

describe('POST /marketplace/store/buy: conformation and gaits from the breed (Equoria-vqz4b, Equoria-17zgu)', () => {
  const cleanup = createCleanupTracker();
  const createdHorseIds = [];
  let user;
  let token;
  const breedIds = {};
  let rangelessBreedId;

  beforeAll(async () => {
    for (const name of ['American Saddlebred', 'Morgan USA']) {
      const breed = await prisma.breed.findUnique({ where: { name }, select: { id: true } });
      if (!breed) {
        throw new Error(`Seeded breed "${name}" is missing; run npm run seed:breeds.`);
      }
      breedIds[name] = breed.id;
    }
    const tag = randomBytes(6).toString('hex');
    user = await prisma.user.create({
      data: {
        emailVerified: true,
        email: `vqz4b-${tag}@test.com`,
        username: `vqz4b${tag}`,
        password: 'irrelevant-hash',
        firstName: 'Store',
        lastName: 'Physique',
        money: 5000,
        settings: {},
      },
    });
    token = generateTestToken({ id: user.id, email: user.email, role: 'user' });
    const userId = user.id;
    // A breed row with no ranges anywhere (no JSON profile, no breedGeneticProfile).
    const rangeless = await prisma.breed.create({ data: { name: `No Ranges q211 ${tag}` } });
    rangelessBreedId = rangeless.id;
    cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: createdHorseIds } } }), 'horses');
    cleanup.add(() => prisma.horse.deleteMany({ where: { breedId: rangeless.id } }), 'rangeless horses');
    cleanup.add(() => prisma.breed.deleteMany({ where: { id: rangeless.id } }), 'rangeless breed');
    cleanup.add(() => prisma.user.deleteMany({ where: { id: userId } }), 'user');
  }, 30000);

  afterAll(() => cleanup.run(), 30000);

  it.each([
    ['American Saddlebred', 'Mare'],
    ['Morgan USA', 'Stallion'],
  ])(
    '%s store horse is rolled from its breed ranges',
    async (breedName, sex) => {
      const csrf = await fetchCsrf(app);
      const res = await request(app)
        .post('/api/v1/marketplace/store/buy')
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${token}`)
        .set('Cookie', csrf.cookieHeader)
        .set('X-CSRF-Token', csrf.csrfToken)
        .send({ breedId: breedIds[breedName], sex });

      expect(res.status).toBe(201);
      const horseId = res.body.data?.horse?.id;
      expect(horseId).toBeTruthy();
      createdHorseIds.push(horseId);

      const stored = await prisma.horse.findUnique({
        where: { id: horseId },
        select: { conformationScores: true, gaitScores: true, breedId: true },
      });
      expect(stored.breedId).toBe(breedIds[breedName]);
      expectBreedPhysique(stored, breedName);
    },
    60000,
  );

  it('a breed with no ranges is refused: 422, no charge, no horse (q211)', async () => {
    const before = await prisma.user.findUnique({ where: { id: user.id }, select: { money: true } });
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/v1/marketplace/store/buy')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ breedId: rangelessBreedId, sex: 'Mare' });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    const after = await prisma.user.findUnique({ where: { id: user.id }, select: { money: true } });
    expect(after.money).toBe(before.money);
    expect(await prisma.horse.count({ where: { breedId: rangelessBreedId } })).toBe(0);
  }, 60000);
});
