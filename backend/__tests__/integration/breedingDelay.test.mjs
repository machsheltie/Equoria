/**
 * Integration test — delayed pregnancy / foaling (B3, parent Equoria-3gqg).
 *
 * Spec §8 (feed-system redesign 2026-04-29): breeding no longer creates a foal
 * row immediately. POST /api/horses/foals must:
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
import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../../app.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../tests/helpers/csrfHelper.mjs';

describe('createFoal — delayed pregnancy (B3)', () => {
  let csrf;
  let user;
  let token;
  let breed;
  let sireId;
  let damId;

  beforeEach(async () => {
    csrf = await fetchCsrf(app);

    const ts = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
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

    breed = await prisma.breed.upsert({
      where: { name: 'Thoroughbred' },
      update: {},
      create: { name: 'Thoroughbred', description: 'Shared test breed' },
    });

    const fiveYearsAgo = new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000);
    const sire = await prisma.horse.create({
      data: {
        name: `B3Sire_${ts}`,
        sex: 'Stallion',
        dateOfBirth: fiveYearsAgo,
        age: 5,
        breedId: breed.id,
        userId: user.id,
        healthStatus: 'Good',
      },
    });
    const dam = await prisma.horse.create({
      data: {
        name: `B3Dam_${ts}`,
        sex: 'Mare',
        dateOfBirth: fiveYearsAgo,
        age: 5,
        breedId: breed.id,
        userId: user.id,
        healthStatus: 'Good',
      },
    });
    sireId = sire.id;
    damId = dam.id;
  });

  afterEach(async () => {
    if (user) {
      await prisma.horse.deleteMany({ where: { OR: [{ damId }, { sireId }, { userId: user.id }] } }).catch(() => {});
      await prisma.user.deleteMany({ where: { id: user.id } }).catch(() => {});
    }
  });

  it('breeding sets inFoalSinceDate and pregnancySireId; does NOT create a foal row', async () => {
    const before = await prisma.horse.count({ where: { damId } });
    expect(before).toBe(0);

    const res = await request(app)
      .post('/api/horses/foals')
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
      .post('/api/horses/foals')
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ name: 'First', breedId: breed.id, sireId, damId, sex: 'Filly' });
    expect(first.status).toBe(200);
    expect(first.body.data.pregnancyStarted).toBe(true);

    // Second breed on the same mare must be rejected.
    const second = await request(app)
      .post('/api/horses/foals')
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
      .post('/api/horses/foals')
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
