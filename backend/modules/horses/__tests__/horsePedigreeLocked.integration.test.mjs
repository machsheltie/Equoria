/**
 * horsePedigreeLocked — integration tests (Equoria-bvddn.2, owner ruling 2026-09-30)
 *
 * OWNER RULING 2026-09-30: a horse's sire and dam can NEVER be edited. Pedigree
 * is fixed by breeding. Players may only rename horses they own, on that horse's
 * own page (PATCH /horses/:id/name). Players have zero control over pedigree.
 *
 * PUT /horses/:id's allow-list is now EMPTY: sireId/damId are refused like any
 * other unexpected field (400). The route is not closed with 410 because the
 * generic security suites (parameter-pollution, owasp, ownership) use it as
 * their validator vehicle and assert its 400/404 contract.
 *
 * The regression case is the one that used to SUCCEED: PUT of a same-owner
 * Stallion as sire and Mare as dam (valid sexes, valid ownership) returned 200
 * and rewrote the horse's parents.
 *
 * Real-DB integration. No mocks. Scoped cleanup by id.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { randomBytes } from 'node:crypto';
import app from '../../../app.mjs';
import { createMockToken } from '../../../__tests__/factories/index.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';

describe('PUT /horses/:id — pedigree is locked (Equoria-bvddn.2, owner ruling 2026-09-30)', () => {
  let csrf;
  let user;
  let token;
  let horse;
  let stallion;
  let mare;
  const createdHorseIds = [];
  const createdUserIds = [];

  const put = body =>
    request(app)
      .put(`/api/v1/horses/${horse.id}`)
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send(body);

  const pedigree = () =>
    prisma.horse.findUnique({
      where: { id: horse.id },
      select: { sireId: true, damId: true, name: true },
    });

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-for-testing-only-32chars';
    const suffix = randomBytes(6).toString('hex');

    user = await prisma.user.create({
      data: {
        email: `pedlock-${suffix}@test.invalid`,
        username: `pedlock-${suffix}`,
        password: 'hashed',
        firstName: 'Pedigree',
        lastName: 'Lock',
        emailVerified: true,
      },
    });
    createdUserIds.push(user.id);
    token = createMockToken(user.id, { payload: { email: user.email, role: user.role || 'user' } });

    const dob = new Date();
    dob.setUTCFullYear(dob.getUTCFullYear() - 5);
    const make = (label, sex) =>
      prisma.horse.create({
        data: {
          ...fixtureColor(),
          name: `TestFixture-pedlock-${label}-${suffix}`,
          userId: user.id,
          sex,
          dateOfBirth: dob,
        },
      });
    horse = await make('target', 'Mare');
    stallion = await make('stallion', 'Stallion');
    mare = await make('mare', 'Mare');
    createdHorseIds.push(horse.id, stallion.id, mare.id);

    csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
  }, 120000);

  afterAll(async () => {
    if (createdHorseIds.length > 0) {
      await prisma.horse.deleteMany({ where: { id: { in: createdHorseIds } } });
    }
    if (createdUserIds.length > 0) {
      await prisma.refreshToken.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
  }, 120000);

  it('refuses sireId + damId pointing at owned horses of the right sex, parents unchanged', async () => {
    const before = await pedigree();

    const response = await put({ sireId: stallion.id, damId: mare.id });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toMatch(/unexpected field/i);

    const after = await pedigree();
    expect(after.sireId).toBe(before.sireId);
    expect(after.damId).toBe(before.damId);
    expect(after.sireId).toBeNull();
    expect(after.damId).toBeNull();
  });

  it('refuses a sireId alone and a damId alone, parents unchanged', async () => {
    const sireOnly = await put({ sireId: stallion.id });
    const damOnly = await put({ damId: mare.id });

    expect(sireOnly.status).toBe(400);
    expect(damOnly.status).toBe(400);
    const after = await pedigree();
    expect(after.sireId).toBeNull();
    expect(after.damId).toBeNull();
  });

  it('an empty PUT changes nothing (no field is editable here)', async () => {
    const before = await pedigree();
    const response = await put({});
    expect(response.status).toBe(200);
    const after = await pedigree();
    expect(after).toEqual(before);
  });

  it('still answers 401 to an anonymous caller', async () => {
    const anonCsrf = await fetchCsrf(app);
    const response = await request(app)
      .put(`/api/v1/horses/${horse.id}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', anonCsrf.cookieHeader)
      .set('X-CSRF-Token', anonCsrf.csrfToken)
      .send({ sireId: stallion.id });
    expect(response.status).toBe(401);
  });
});
