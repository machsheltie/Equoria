/**
 * starterHorseTemperament.integration.test.mjs
 *
 * Equoria-f5372 — the registration starter horse must arrive with a
 * temperament populated (not NULL). Before the fix authController.register
 * created the starter horse with no temperament, so the frontend showed
 * 'not recorded'. The starter horse has no breed, so generation falls back to
 * the default breed's weights (generateTemperamentWithDefault).
 *
 * Sentinel-positive: fails if the temperament wiring is removed from
 * authController.register.
 *
 * NO MOCKS — real app, real Prisma, real auth + CSRF flow, real DB.
 */

import { describe, it, expect, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { TEMPERAMENT_TYPES } from '../../horses/data/breedGeneticProfiles.mjs';

const ORIGIN = 'http://localhost:3000';

function uniq(prefix) {
  return `${prefix}${randomBytes(6).toString('hex')}`;
}

function dobYearsAgo(years) {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - years);
  return d.toISOString().slice(0, 10);
}

describe('INTEGRATION: starter horse temperament (Equoria-f5372)', () => {
  const createdUserIds = [];
  const createdHorseIds = [];
  const cleanup = createCleanupTracker();

  // Scoped, fail-loud cleanup (Equoria-jgnqr). Callbacks close over the id
  // arrays (read at run() time); FK order preserved (horses, then user-owned
  // children, then users). A failed delete fails the suite instead of leaking
  // fixtures into the canonical DB.
  cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: createdHorseIds } } }), 'horse');
  cleanup.add(
    () => prisma.refreshToken.deleteMany({ where: { userId: { in: createdUserIds } } }),
    'refreshToken',
  );
  cleanup.add(
    () => prisma.emailVerificationToken.deleteMany({ where: { userId: { in: createdUserIds } } }),
    'emailVerificationToken',
  );
  cleanup.add(() => prisma.auditLog.deleteMany({ where: { userId: { in: createdUserIds } } }), 'auditLog');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: createdUserIds } } }), 'user');

  afterAll(() => cleanup.run(), 60000);

  it('creates the starter horse with a non-null temperament from the 11 canonical types', async () => {
    const { csrfToken, cookieHeader } = await fetchCsrf(app, { origin: ORIGIN });
    const username = uniq('starttemp');
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
        lastName: 'Temp',
        dateOfBirth: dobYearsAgo(25),
      });

    expect(res.status).toBe(201);
    const userId = res.body?.data?.user?.id;
    expect(userId).toBeTruthy();
    createdUserIds.push(userId);

    const horse = await prisma.horse.findFirst({
      where: { userId, name: { endsWith: 'First Horse' } },
      select: { id: true, temperament: true },
    });
    expect(horse).toBeTruthy();
    createdHorseIds.push(horse.id);

    expect(horse.temperament).toBeTruthy();
    expect(TEMPERAMENT_TYPES).toContain(horse.temperament);
  }, 60000);
});
