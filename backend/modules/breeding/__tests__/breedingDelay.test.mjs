/**
 * Integration test — delayed pregnancy / foaling (B3, parent Equoria-3gqg).
 *
 * Spec §8 (feed-system redesign 2026-04-29): breeding no longer creates a foal
 * row immediately. POST /api/v1/horses/foals must:
 *   1. Validate sire/dam (existence, sex, ownership-of-mare semantics).
 *   2. Set the mare's `inFoalSinceDate = now`, `pregnancySireId = sireId`,
 *      `pregnancyFeedingsByTier = {}`, and `lastBredDate = now`.
 *   3. NOT create a foal Horse row — that happens 7 days later via the
 *      foaling job (B5) which calls `createFoalFromPregnancy()`.
 *   4. Return 200 with `{ success: true, data: { pregnancyStarted: true,
 *      damId, sireId, foalDueDate } }`.
 *
 * A second breed attempt on a mare already in-foal must be rejected (400).
 *
 * Real DB, real auth, real CSRF — no bypass headers, no API mocks.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
// Equoria-1ohys: fail-loud, scoped cleanup — a failed delete reds afterEach
// instead of being swallowed (the leak class that trips horseColorNullSentinel).
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

describe('createFoal — delayed pregnancy (B3)', () => {
  let csrf;
  let user;
  let token;
  let breed;
  let sireId;
  let damId;

  beforeEach(async () => {
    const ts = `${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}`;
    const hashed = await bcrypt.hash('TestPassword123!', 1);
    user = await prisma.user.create({
      data: {
        username: `b3_${ts}`,
        email: `b3_${ts}@test.com`,
        password: hashed,
        firstName: 'Pregnancy',
        lastName: 'Tester',
        money: 10000,
      },
    });
    token = generateTestToken({ id: user.id, email: user.email, role: 'user' });

    // Per-user CSRF binding (Equoria-plw0h): the POST /api/v1/horses/foals
    // mutations authenticate via `token`, so their sessionIdentifier resolves
    // to user.id. Issue the CSRF token under the same identifier (pass the
    // access cookie) or doubleCsrf 403s the legitimate breeding requests.
    csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });

    breed = await prisma.breed.upsert({
      where: { name: 'Thoroughbred' },
      update: {},
      create: { name: 'Thoroughbred', description: 'Shared test breed' },
    });

    const fiveYearsAgo = new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000);
    const sire = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `B3Sire_${ts}`,
        sex: 'Stallion',
        dateOfBirth: fiveYearsAgo,
        age: 5,
        breedId: breed.id,
        userId: user.id,
        healthStatus: 'Good',
        lastFedDate: new Date(), // healthy so critical-health gate passes
      },
    });
    const dam = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `B3Dam_${ts}`,
        sex: 'Mare',
        dateOfBirth: fiveYearsAgo,
        age: 5,
        breedId: breed.id,
        userId: user.id,
        healthStatus: 'Good',
        lastFedDate: new Date(), // healthy so critical-health gate passes
      },
    });
    sireId = sire.id;
    damId = dam.id;
  });

  afterEach(async () => {
    if (!user) {
      return;
    }
    // Equoria-1ohys: scoped, fail-loud cleanup. sire+dam (and any foal that
    // would reference them) are removed in ONE id-scoped deleteMany — a single
    // multi-row DELETE removes the matching set as one statement, so the
    // lineage/pregnancy RESTRICT FKs (Horse.sireId/damId/pregnancySireId
    // onDelete:Restrict) do not fire for references among rows deleted
    // together. The owning user is deleted AFTER its horses (Horse.userId
    // onDelete:Restrict, schema:282). A real scope/FK failure now reds
    // afterEach instead of being swallowed.
    const cleanup = createCleanupTracker();
    cleanup.add(
      () => prisma.horse.deleteMany({ where: { OR: [{ damId }, { sireId }, { userId: user.id }] } }),
      'b3Horses',
    );
    cleanup.add(() => prisma.user.deleteMany({ where: { id: user.id } }), 'b3User');
    await cleanup.run();
  });

  it('breeding sets inFoalSinceDate and pregnancySireId; does NOT create a foal row', async () => {
    const before = await prisma.horse.count({ where: { damId } });
    expect(before).toBe(0);

    const res = await request(app)
      .post('/api/v1/horses/foals')
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({
        name: 'WillBeBornLater',
        breedId: breed.id,
        sireId,
        damId,
        sex: 'Filly',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeTruthy();
    expect(res.body.data.pregnancyStarted).toBe(true);
    expect(res.body.data.damId).toBe(damId);
    expect(res.body.data.sireId).toBe(sireId);
    expect(res.body.data.foalDueDate).toBeTruthy();

    // foalDueDate is exactly 7 days after inFoalSinceDate
    const due = new Date(res.body.data.foalDueDate).getTime();
    const now = Date.now();
    expect(due).toBeGreaterThan(now + 6.9 * 24 * 60 * 60 * 1000);
    expect(due).toBeLessThan(now + 7.1 * 24 * 60 * 60 * 1000);

    // DB: the mare is in foal, the columns are set, no foal row exists.
    const dam = await prisma.horse.findUnique({ where: { id: damId } });
    expect(dam.inFoalSinceDate).toBeTruthy();
    expect(dam.pregnancySireId).toBe(sireId);
    expect(dam.pregnancyFeedingsByTier).toEqual({});
    expect(dam.lastBredDate).toBeTruthy();

    const foalCount = await prisma.horse.count({ where: { damId } });
    expect(foalCount).toBe(0);
  });

  it('rejects a second breed attempt while the mare is already in foal', async () => {
    // First breed succeeds.
    const first = await request(app)
      .post('/api/v1/horses/foals')
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ name: 'First', breedId: breed.id, sireId, damId, sex: 'Filly' });
    expect(first.status).toBe(200);
    expect(first.body.data.pregnancyStarted).toBe(true);

    // Second breed on the same mare must be rejected.
    const second = await request(app)
      .post('/api/v1/horses/foals')
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ name: 'Second', breedId: breed.id, sireId, damId, sex: 'Filly' });

    expect(second.status).toBe(400);
    expect(second.body.success).toBe(false);
    expect(String(second.body.message || '').toLowerCase()).toContain('in foal');

    // Still no foal row.
    const foalCount = await prisma.horse.count({ where: { damId } });
    expect(foalCount).toBe(0);
  });

  it('still validates missing sire (404)', async () => {
    const res = await request(app)
      .post('/api/v1/horses/foals')
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({
        name: 'NoSireFoal',
        breedId: breed.id,
        sireId: 999_999,
        damId,
        sex: 'Filly',
      });
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
