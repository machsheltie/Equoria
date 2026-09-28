/**
 * horseUpdateSexDobMassAssign — sentinel (Equoria-bvddn.2)
 *
 * Sentinel coverage for the sex/gender/dateOfBirth mass-assignment
 * vulnerability on PUT /horses/:id. Pre-fix: _validators.mjs's
 * `validateHorseUpdatePayload` allowlist included `sex`, `gender` and
 * `dateOfBirth` with no value validation, and the body went straight to
 * `prisma.horse.update({ data })`. `dateOfBirth` drives age everywhere (foal
 * stages, milestones, training eligibility), so a player could instantly age
 * a newborn foal into an adult. `sex` had no value validation at all, so a
 * player could reverse a gelding or flip a mare/stallion at will.
 *
 * Same shape and precedent as Equoria-tmyd2 (breedId) and Equoria-4fnro
 * (name): drop the fields from the PUT allowlist entirely. No legitimate
 * in-game mechanic re-ages or re-sexes a horse after birth.
 *
 * sireId/damId are DELIBERATELY untouched by this fix — see OPEN QUESTIONS in
 * the task report. This file does not exercise them.
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

describe('PUT /horses/:id — sex/gender/dateOfBirth mass-assignment guard (Equoria-bvddn.2)', () => {
  let __csrf__;
  let user;
  let token;
  let foal; // newly "born" horse — the un-ageing target
  // The game's canonical sex values are Stallion/Mare/Colt/Filly/Rig (no
  // distinct "Gelding" value — see packages/database/horseSexCanonical.mjs).
  // 'Rig' is the closest real analogue to the issue's "un-gelding" scenario:
  // a male horse NOT presented as a breeding stallion, which the pre-fix
  // route let a player silently flip to 'Stallion'.
  let rig; // a Rig — the un-gelding-equivalent target
  const createdHorseIds = [];
  const createdUserIds = [];

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-for-testing-only-32chars';

    const suffix = randomBytes(6).toString('hex');

    user = await prisma.user.create({
      data: {
        email: `bvddn2-${suffix}@test.invalid`,
        username: `bvddn2-${suffix}`,
        password: 'hashed',
        firstName: 'SexDob',
        lastName: 'Test',
        emailVerified: true,
      },
    });
    createdUserIds.push(user.id);

    token = createMockToken(user.id, {
      payload: { email: user.email, role: user.role || 'user' },
    });

    __csrf__ = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });

    const newborn = new Date();

    foal = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-bvddn2-foal-${suffix}`,
        userId: user.id,
        sex: 'Filly',
        dateOfBirth: newborn,
      },
    });
    rig = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-bvddn2-rig-${suffix}`,
        userId: user.id,
        sex: 'Rig',
        dateOfBirth: new Date('2018-01-01'),
      },
    });
    createdHorseIds.push(foal.id, rig.id);
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
  }, 120000);

  it('rejects PUT { dateOfBirth } — 400, newborn foal cannot be instantly aged (sentinel-positive)', async () => {
    // Sentinel: the exact failure scenario bvddn.2 describes. Pre-fix this
    // returned 200 and the foal's dateOfBirth silently became 2020-01-01,
    // skipping all foal development.
    const response = await request(app)
      .put(`/api/v1/horses/${foal.id}`)
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', __csrf__.cookieHeader)
      .set('X-CSRF-Token', __csrf__.csrfToken)
      .send({ dateOfBirth: new Date('2020-01-01').toISOString() });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toMatch(/unexpected field|invalid/i);

    const after = await prisma.horse.findUnique({
      where: { id: foal.id },
      select: { dateOfBirth: true },
    });
    expect(after.dateOfBirth.toISOString()).toBe(foal.dateOfBirth.toISOString());
  });

  it('rejects PUT { sex } — 400, a Rig cannot be flipped to Stallion (sentinel-positive)', async () => {
    // Sentinel: pre-fix this returned 200 with no value validation at all —
    // any string was accepted and silently written to the sex column.
    const response = await request(app)
      .put(`/api/v1/horses/${rig.id}`)
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', __csrf__.cookieHeader)
      .set('X-CSRF-Token', __csrf__.csrfToken)
      .send({ sex: 'Stallion' });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toMatch(/unexpected field|invalid/i);

    const after = await prisma.horse.findUnique({
      where: { id: rig.id },
      select: { sex: true },
    });
    expect(after.sex).toBe('Rig');
  });

  it('rejects PUT { gender } — 400, gender is off the allowlist too', async () => {
    const response = await request(app)
      .put(`/api/v1/horses/${rig.id}`)
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', __csrf__.cookieHeader)
      .set('X-CSRF-Token', __csrf__.csrfToken)
      .send({ gender: 'Stallion' });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toMatch(/unexpected field|invalid/i);
  });
});
