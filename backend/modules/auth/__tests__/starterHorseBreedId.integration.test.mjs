/**
 * starterHorseBreedId.integration.test.mjs
 *
 * Equoria-b9zgr — the registration starter horse must arrive with a breedId
 * populated (not NULL). Before the fix, authController.register created the
 * starter horse via a raw prisma.horse.create() that set name/sex/age/stats but
 * NO breed connection, so every registration starter horse was born breedless
 * (the canonical DB had 0/3334 horses with breedId set). The fix resolves the
 * canonical default breed (DEFAULT_TEMPERAMENT_BREED = 'Thoroughbred') and
 * connects it at creation; the onboarding breed-selection step later UPDATES
 * breedId to the player's chosen breed.
 *
 * Sentinel-positive: this FAILS against the pre-fix code (starter horse has
 * breedId === null) and PASSES after the fix.
 *
 * NO MOCKS — real app, real Prisma, real auth + CSRF flow, real DB.
 * Scoped cleanup — deletes only the ids this suite collected.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { DEFAULT_TEMPERAMENT_BREED } from '../../horses/services/temperamentService.mjs';

const ORIGIN = 'http://localhost:3000';

function uniq(prefix) {
  return `${prefix}${randomBytes(6).toString('hex')}`;
}

function dobYearsAgo(years) {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - years);
  return d.toISOString().slice(0, 10);
}

describe('INTEGRATION: starter horse breedId (Equoria-b9zgr)', () => {
  const createdUserIds = [];
  const createdHorseIds = [];
  let defaultBreedId = null;

  beforeAll(async () => {
    // The fix seeds the starter horse with the canonical default breed. That
    // breed row must exist in the canonical DB for this path to assign a
    // breedId (it is seeded everywhere — Thoroughbred). Resolve its id so the
    // assertion can prove the starter horse links to the CORRECT breed, not
    // merely some non-null value.
    const breed = await prisma.breed.findUnique({
      where: { name: DEFAULT_TEMPERAMENT_BREED },
      select: { id: true },
    });
    defaultBreedId = breed?.id ?? null;
  }, 60000);

  afterAll(async () => {
    if (createdHorseIds.length) {
      await prisma.horse.deleteMany({ where: { id: { in: createdHorseIds } } }).catch(() => {});
    }
    if (createdUserIds.length) {
      await prisma.refreshToken.deleteMany({ where: { userId: { in: createdUserIds } } }).catch(() => {});
      await prisma.emailVerificationToken.deleteMany({ where: { userId: { in: createdUserIds } } }).catch(() => {});
      await prisma.auditLog.deleteMany({ where: { userId: { in: createdUserIds } } }).catch(() => {});
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } }).catch(() => {});
    }
  }, 60000);

  it('creates the starter horse with a non-null breedId equal to the default breed', async () => {
    // Guard: the canonical default breed must exist for this assertion to be
    // meaningful. If it is missing the environment is misconfigured (seed not
    // run), which is a separate problem from the bug under test.
    expect(defaultBreedId).not.toBeNull();

    const { csrfToken, cookieHeader } = await fetchCsrf(app, { origin: ORIGIN });
    const username = uniq('startbreed');
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
        lastName: 'Breed',
        dateOfBirth: dobYearsAgo(25),
      });

    expect(res.status).toBe(201);
    const userId = res.body?.data?.user?.id;
    expect(userId).toBeTruthy();
    createdUserIds.push(userId);

    const horse = await prisma.horse.findFirst({
      where: { userId, name: { endsWith: 'First Horse' } },
      select: { id: true, breedId: true },
    });
    expect(horse).toBeTruthy();
    createdHorseIds.push(horse.id);

    // SENTINEL: pre-fix this was null (0/3334 rows had breedId). Post-fix the
    // starter horse must persist a breedId, and it must be the default breed.
    expect(horse.breedId).not.toBeNull();
    expect(horse.breedId).toBe(defaultBreedId);
  }, 60000);
});
