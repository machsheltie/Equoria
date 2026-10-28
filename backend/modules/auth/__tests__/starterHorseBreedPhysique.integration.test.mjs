/**
 * Onboarding starter horses carry conformation and gaits from their breed's ranges
 * (Equoria-vqz4b, Equoria-17zgu; owner request 2026-10-28).
 *
 * Before the fix, registration created the starter horse with a raw create that set
 * no conformation (column default: flat 20 in every region) and no gaits (NULL), and
 * the onboarding breed step changed the breed without touching either. This drives
 * the real routes:
 *   1. POST /auth/register: the placeholder starter is rolled from the starter breed;
 *   2. POST /auth/advance-onboarding on that horse with a gaited breed: the scores are
 *      re-rolled for the chosen breed (update branch);
 *   3. POST /auth/advance-onboarding for a player with no horse and a non-gaited
 *      breed: the new horse is rolled from that breed (create branch).
 *
 *   4. Owner ruling 2026-10-28 (q211): the breed step for a breed with no ranges is
 *      refused (422) and creates no horse; before, it created one with the column
 *      defaults (flat-20 conformation, no gaits).
 *
 * Real app, real DB, real CSRF, no mocks. Cleanup is scoped to this file's rows.
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
// Registration seeds the placeholder starter with the default breed (onboardingService).
const starterBreedName = 'Thoroughbred';
const physiqueSelect = { id: true, breedId: true, conformationScores: true, gaitScores: true };

function uniq(prefix) {
  return `${prefix}${randomBytes(6).toString('hex')}`;
}

function dobYearsAgo(years) {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - years);
  return d.toISOString().slice(0, 10);
}

describe('Onboarding starter horse: conformation and gaits from the breed (Equoria-vqz4b, Equoria-17zgu)', () => {
  const createdUserIds = [];
  const cleanup = createCleanupTracker();
  const breedIds = {};
  const createdBreedIds = [];

  cleanup.add(() => prisma.horse.deleteMany({ where: { userId: { in: createdUserIds } } }), 'horse');
  cleanup.add(() => prisma.refreshToken.deleteMany({ where: { userId: { in: createdUserIds } } }), 'refreshToken');
  cleanup.add(
    () => prisma.emailVerificationToken.deleteMany({ where: { userId: { in: createdUserIds } } }),
    'emailVerificationToken',
  );
  cleanup.add(() => prisma.auditLog.deleteMany({ where: { userId: { in: createdUserIds } } }), 'auditLog');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: createdUserIds } } }), 'user');
  cleanup.add(() => prisma.breed.deleteMany({ where: { id: { in: createdBreedIds } } }), 'breed');

  beforeAll(async () => {
    for (const name of [starterBreedName, 'American Saddlebred', 'Morgan USA']) {
      const breed = await prisma.breed.findUnique({ where: { name }, select: { id: true } });
      if (!breed) {
        throw new Error(`Seeded breed "${name}" is missing; run npm run seed:breeds.`);
      }
      breedIds[name] = breed.id;
    }
  }, 60000);

  afterAll(() => cleanup.run(), 60000);

  async function advanceAs(user, body) {
    const token = generateTestToken({ id: user.id, email: user.email, role: 'user' });
    const csrf = await fetchCsrf(app, { origin: ORIGIN, extraCookies: [`accessToken=${token}`] });
    return request(app)
      .post('/api/v1/auth/advance-onboarding')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send(body);
  }

  it('registration rolls the starter from its breed; the breed step re-rolls it for a gaited breed', async () => {
    const { csrfToken, cookieHeader } = await fetchCsrf(app, { origin: ORIGIN });
    const username = uniq('vqz4bonb');
    const res = await request(app)
      .post('/api/v1/auth/register')
      .set('Origin', ORIGIN)
      .set('Cookie', cookieHeader)
      .set('X-CSRF-Token', csrfToken)
      .send({
        username,
        email: `${username}@test.com`,
        password: 'StrongP@ssw0rd!23',
        firstName: 'Starter',
        lastName: 'Physique',
        dateOfBirth: dobYearsAgo(25),
      });
    expect(res.status).toBe(201);
    const userId = res.body?.data?.user?.id;
    expect(userId).toBeTruthy();
    createdUserIds.push(userId);

    const starter = await prisma.horse.findFirst({ where: { userId }, select: physiqueSelect });
    expect(starter).toBeTruthy();
    expect(starter.breedId).toBe(breedIds[starterBreedName]);
    expectBreedPhysique(starter, starterBreedName);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });
    const advanced = await advanceAs(user, {
      horseName: 'Physique Star',
      breedId: breedIds['American Saddlebred'],
      gender: 'Mare',
    });
    expect(advanced.status).toBe(200);

    const rerolled = await prisma.horse.findUnique({
      where: { id: starter.id },
      select: physiqueSelect,
    });
    expect(rerolled.breedId).toBe(breedIds['American Saddlebred']);
    // Thoroughbred has no special gaits, so Rack and Slow Gait prove the re-roll.
    expectBreedPhysique(rerolled, 'American Saddlebred');
  }, 60000);

  it('the breed step creates a missing starter rolled from the chosen non-gaited breed', async () => {
    const suffix = randomBytes(6).toString('hex');
    const user = await prisma.user.create({
      data: {
        email: `vqz4b-onb-${suffix}@test.invalid`,
        username: `vqz4bonb${suffix}`,
        password: 'irrelevant-hash',
        firstName: 'Onboard',
        lastName: 'Physique',
        emailVerified: true,
        settings: { completedOnboarding: false, onboardingStep: 0 },
      },
      select: { id: true, email: true },
    });
    createdUserIds.push(user.id);

    const res = await advanceAs(user, {
      horseName: 'Physique Morgan',
      breedId: breedIds['Morgan USA'],
      gender: 'Stallion',
    });
    expect(res.status).toBe(200);

    const created = await prisma.horse.findMany({ where: { userId: user.id }, select: physiqueSelect });
    expect(created).toHaveLength(1);
    expect(created[0].breedId).toBe(breedIds['Morgan USA']);
    expectBreedPhysique(created[0], 'Morgan USA');
  }, 60000);

  it('the breed step refuses a breed with no ranges and creates no horse (q211)', async () => {
    const suffix = randomBytes(6).toString('hex');
    const rangeless = await prisma.breed.create({ data: { name: `No Ranges q211 ${suffix}` } });
    createdBreedIds.push(rangeless.id);
    const user = await prisma.user.create({
      data: {
        email: `q211-onb-${suffix}@test.invalid`,
        username: `q211onb${suffix}`,
        password: 'irrelevant-hash',
        firstName: 'Onboard',
        lastName: 'Refused',
        emailVerified: true,
        settings: { completedOnboarding: false, onboardingStep: 0 },
      },
      select: { id: true, email: true },
    });
    createdUserIds.push(user.id);

    const res = await advanceAs(user, {
      horseName: 'Rangeless Star',
      breedId: rangeless.id,
      gender: 'Mare',
    });
    expect(res.status).toBe(422);
    expect(await prisma.horse.count({ where: { userId: user.id } })).toBe(0);
  }, 60000);
});
