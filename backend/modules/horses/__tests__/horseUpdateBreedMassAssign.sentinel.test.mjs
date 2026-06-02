/**
 * horseUpdateBreedMassAssign — sentinel (Equoria-tmyd2)
 *
 * Sentinel coverage for the breedId mass-assignment vulnerability on
 * PUT /horses/:id. Pre-fix: horseRoutes.mjs:159-167 update allowlist
 * permitted `breedId`, so a user who bought a starter Thoroughbred could
 * PUT `{ breedId: <higher-tier-breed-id> }` and silently inherit a
 * different breed's stat ranges, color genetics, conformation, and gait
 * advantages — bypassing every starter / progression / paid-breed gate the
 * game enforces at creation time.
 *
 * Breed change is NOT a documented game mechanic (no paid endpoint, no
 * authorization flow, no cost). Per AC option (1): drop `breedId` from the
 * PUT allowlist entirely. A future explicit breed-change feature would
 * land as its own endpoint with its own authorization + cost logic.
 *
 * Real-DB integration. No mocks. Cleanup scoped by id.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { randomBytes } from 'node:crypto';
import app from '../../../app.mjs';
import { createMockToken } from '../../../__tests__/factories/index.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';

describe('PUT /horses/:id — breedId mass-assignment guard (Equoria-tmyd2)', () => {
  let __csrf__;
  let user;
  let token;
  let horse; // user's own horse
  let originalBreed; // the breed the horse starts as
  let targetBreed; // a different breed the user attempts to swap to
  const createdHorseIds = [];
  const createdUserIds = [];
  const createdBreedIds = [];

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-for-testing-only-32chars';

    const suffix = randomBytes(6).toString('hex');

    // Reuse existing breeds if available so we don't bloat the canonical DB
    // with throwaway breed rows. Fallback: create scoped test breeds.
    const existingBreeds = await prisma.breed.findMany({ take: 2 });
    if (existingBreeds.length >= 2) {
      originalBreed = existingBreeds[0];
      targetBreed = existingBreeds[1];
    } else {
      originalBreed = await prisma.breed.create({
        data: { name: `TestFixture-tmyd2-orig-${suffix}`, description: 'sentinel' },
      });
      targetBreed = await prisma.breed.create({
        data: { name: `TestFixture-tmyd2-target-${suffix}`, description: 'sentinel' },
      });
      createdBreedIds.push(originalBreed.id, targetBreed.id);
    }

    user = await prisma.user.create({
      data: {
        email: `tmyd2-${suffix}@test.invalid`,
        username: `tmyd2-${suffix}`,
        password: 'hashed',
        firstName: 'BreedMass',
        lastName: 'Test',
        emailVerified: true,
      },
    });
    createdUserIds.push(user.id);

    token = createMockToken(user.id, {
      payload: { email: user.email, role: user.role || 'user' },
    });

    // Per-user CSRF binding (Equoria-plw0h): the PUT /horses/:id mutation
    // authenticates via the Bearer token, so its sessionIdentifier resolves to
    // user.id. Issue the CSRF token under the same identifier (pass the access
    // cookie) or doubleCsrf 403s the legitimate request.
    __csrf__ = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });

    const dob = new Date();
    dob.setUTCFullYear(dob.getUTCFullYear() - 5);

    horse = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-tmyd2-${suffix}`,
        userId: user.id,
        sex: 'Mare',
        dateOfBirth: dob,
        breedId: originalBreed.id,
      },
    });
    createdHorseIds.push(horse.id);
  }, 120000);

  afterAll(async () => {
    if (createdHorseIds.length > 0) {
      await prisma.horse.deleteMany({ where: { id: { in: createdHorseIds } } });
    }
    if (createdUserIds.length > 0) {
      await prisma.refreshToken
        .deleteMany({ where: { userId: { in: createdUserIds } } })
        .catch(err => console.warn(`[cleanup] ${err.message}`));
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    if (createdBreedIds.length > 0) {
      await prisma.breed
        .deleteMany({ where: { id: { in: createdBreedIds } } })
        .catch(err => console.warn(`[cleanup] ${err.message}`));
    }
  }, 120000);

  it('rejects PUT with breedId in body — 400, breedId unchanged (sentinel-positive)', async () => {
    // Sentinel: this is the exact failure mode tmyd2 describes. Pre-fix,
    // the allowlist included `breedId` and the request returned 200 with
    // the horse silently re-pointed at targetBreed.
    const response = await request(app)
      .put(`/api/v1/horses/${horse.id}`)
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', __csrf__.cookieHeader)
      .set('X-CSRF-Token', __csrf__.csrfToken)
      .send({ breedId: targetBreed.id });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    // The 400 must come from the allowlist guard, with the "unexpected
    // field" message — confirms the rejection happened BEFORE any DB
    // touch (defence-in-depth: even if a future refactor moved the
    // prisma.update behind permission middleware, the field is still
    // not on the wire).
    expect(response.body.message).toMatch(/unexpected field|invalid/i);

    // BreedId must NOT have been mutated.
    const after = await prisma.horse.findUnique({
      where: { id: horse.id },
      select: { breedId: true },
    });
    expect(after.breedId).toBe(originalBreed.id);
  });

  it('still allows PUT with a permitted field (e.g. name) — sanity', async () => {
    // Regression guard: dropping breedId from the allowlist must not
    // break legitimate updates of other allowlisted fields.
    const newName = `TestFixture-tmyd2-renamed-${randomBytes(4).toString('hex')}`;
    const response = await request(app)
      .put(`/api/v1/horses/${horse.id}`)
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', __csrf__.cookieHeader)
      .set('X-CSRF-Token', __csrf__.csrfToken)
      .send({ name: newName });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    const after = await prisma.horse.findUnique({
      where: { id: horse.id },
      select: { name: true, breedId: true },
    });
    expect(after.name).toBe(newName);
    expect(after.breedId).toBe(originalBreed.id);
  });
});
