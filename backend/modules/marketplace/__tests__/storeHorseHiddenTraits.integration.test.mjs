/**
 * Horse Trader horses carry hidden traits (Equoria-i366a).
 *
 * Owner rulings: a store horse is bought at age 3 with a real carried trait
 * roster, every trait hidden (2026-10-22); a random number of them, up to 5,
 * from the twenty-trait roster (2026-10-28, q174). The player may know HOW
 * MANY hidden traits the horse carries, never which ones.
 *
 * Before the fix, buyStoreHorse passed no traits to createHorse, so every
 * store horse was stored with { positive: [], negative: [], hidden: [] }.
 *
 * This buys horses through the real POST /api/v1/marketplace/store/buy route
 * and checks (1) the stored row carries 1..5 distinct, non-conflicting roster
 * traits, all hidden; (2) neither the purchase response nor the owner's
 * horse reads name any of them, while the hidden count is sent.
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
import { checkTraitConflict, isRosterTrait } from '../../../utils/epigeneticTraits.mjs';

const ORIGIN = 'http://localhost:3000';
const PURCHASES = 4;

describe('POST /marketplace/store/buy: the horse carries hidden roster traits (Equoria-i366a, q174)', () => {
  const cleanup = createCleanupTracker();
  const createdHorseIds = [];
  const purchases = [];
  let user;
  let token;

  beforeAll(async () => {
    const breed = await prisma.breed.findUnique({ where: { name: 'Morgan USA' }, select: { id: true } });
    if (!breed) {
      throw new Error('Seeded breed "Morgan USA" is missing; run npm run seed:breeds.');
    }
    const tag = randomBytes(6).toString('hex');
    user = await prisma.user.create({
      data: {
        emailVerified: true,
        email: `i366a-${tag}@test.com`,
        username: `i366a${tag}`,
        password: 'irrelevant-hash',
        firstName: 'Store',
        lastName: 'Traits',
        money: 50000,
        settings: {},
      },
    });
    token = generateTestToken({ id: user.id, email: user.email, role: 'user' });
    const userId = user.id;
    // FK order: horses before their owner (Horse.userId is onDelete: Restrict).
    cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: createdHorseIds } } }), 'horses');
    cleanup.add(() => prisma.user.deleteMany({ where: { id: userId } }), 'user');

    for (let i = 0; i < PURCHASES; i++) {
      const csrf = await fetchCsrf(app);
      const res = await request(app)
        .post('/api/v1/marketplace/store/buy')
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${token}`)
        .set('Cookie', csrf.cookieHeader)
        .set('X-CSRF-Token', csrf.csrfToken)
        .send({ breedId: breed.id, sex: i % 2 ? 'Stallion' : 'Mare' });
      expect(res.status).toBe(201);
      createdHorseIds.push(res.body.data.horse.id);
      const stored = await prisma.horse.findUnique({
        where: { id: res.body.data.horse.id },
        select: { epigeneticModifiers: true },
      });
      purchases.push({ res, stored: stored.epigeneticModifiers });
    }
  }, 120000);

  afterAll(() => cleanup.run(), 30000);

  it('stores 1 to 5 distinct, non-conflicting roster traits, every one hidden', () => {
    for (const { stored } of purchases) {
      expect(stored.positive).toEqual([]);
      expect(stored.negative).toEqual([]);
      expect(stored.hidden.length).toBeGreaterThanOrEqual(1);
      expect(stored.hidden.length).toBeLessThanOrEqual(5);
      expect(new Set(stored.hidden).size).toBe(stored.hidden.length);
      for (const trait of stored.hidden) {
        expect(isRosterTrait(trait)).toBe(true);
      }
      for (const a of stored.hidden) {
        for (const b of stored.hidden) {
          expect(checkTraitConflict(a, b)).toBe(false);
        }
      }
    }
  });

  it('the purchase response sends the hidden count and names no hidden trait', () => {
    for (const { res, stored } of purchases) {
      const body = JSON.stringify(res.body);
      for (const trait of stored.hidden) {
        expect(body).not.toContain(`"${trait}"`);
      }
      expect(res.body.data.horse.epigeneticModifiers).toEqual({
        positive: [],
        negative: [],
        hiddenCount: stored.hidden.length,
      });
    }
  });

  it.each([
    ['GET /horses/:id', id => `/api/v1/horses/${id}`],
    ['GET /traits/horse/:id', id => `/api/v1/traits/horse/${id}`],
    ['GET /traits/discovery-status/:id', id => `/api/v1/traits/discovery-status/${id}`],
    ['GET /horses/:id/breeding-data', id => `/api/v1/horses/${id}/breeding-data`],
  ])("the owner's %s names no hidden trait", async (_label, path) => {
    for (const [i, id] of createdHorseIds.entries()) {
      const res = await request(app).get(path(id)).set('Origin', ORIGIN).set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      const body = JSON.stringify(res.body);
      for (const trait of purchases[i].stored.hidden) {
        expect(body).not.toContain(`"${trait}"`);
      }
    }
  });
});
