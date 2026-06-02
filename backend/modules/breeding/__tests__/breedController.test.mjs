/**
 * breedController integration tests (Equoria-rr7 coverage sprint).
 *
 * Breed routes are public (no auth, no CSRF) — mounted ONLY at
 * /api/v1/breeds (backend/app.mjs). The legacy unversioned /api/breeds
 * mount was removed (Equoria-4bs3s); calls to it now 404. This suite
 * therefore drives every assertion through the canonical /api/v1/breeds
 * prefix (Equoria-24ghi).
 *
 * Real DB, no bypass headers. The public mount runs createBreed/getAllBreeds/
 * getBreedById/getConformationAverages without authenticateToken or
 * csrfProtection (it is registered before app.use('/api/v1', authRouter)),
 * so these GET assertions need neither a token nor a CSRF pair.
 *
 * Cleanup is fail-loud + scoped (Equoria-0y9f5): the breed fixture is removed
 * via createCleanupTracker so a delete failure turns the suite RED instead of
 * leaking a row into the canonical DB (CLAUDE.md §2).
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const ORIGIN = 'http://localhost:3000';

// Test fixture breed — cleaned up after all tests in this file
let testBreedId;
const TEST_BREED_NAME = `TestFixture-Breed-${Date.now()}`;
const cleanup = createCleanupTracker();

describe('breedController integration', () => {
  beforeAll(async () => {
    const breed = await prisma.breed.create({
      data: { name: TEST_BREED_NAME, description: 'Integration test breed' },
    });
    testBreedId = breed.id;
    // Scoped, fail-loud cleanup (Equoria-0y9f5): id-scoped deleteMany so a
    // delete failure surfaces as a RED suite instead of a swallowed
    // empty-arm catch that leaks the fixture into the canonical DB.
    cleanup.add(
      () => prisma.breed.deleteMany({ where: { id: { in: [testBreedId] } } }),
      'breed fixture',
    );
  }, 30000);

  afterAll(() => cleanup.run(), 30000);

  // ─── GET /api/v1/breeds (getAllBreeds) ────────────────────────────────────

  describe('GET /api/v1/breeds', () => {
    it('returns 200 with an array of breeds', async () => {
      const res = await request(app).get('/api/v1/breeds').set('Origin', ORIGIN);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(typeof res.body.count).toBe('number');
    });

    it('includes the test fixture breed in the results', async () => {
      const res = await request(app).get('/api/v1/breeds').set('Origin', ORIGIN);

      const names = res.body.data.map(b => b.name);
      expect(names).toContain(TEST_BREED_NAME);
    });

    it('returns breeds sorted by name ascending', async () => {
      const res = await request(app).get('/api/v1/breeds').set('Origin', ORIGIN);

      const names = res.body.data.map(b => b.name);
      const sorted = [...names].sort((a, b) => a.localeCompare(b));
      expect(names).toEqual(sorted);
    });
  });

  // ─── GET /api/v1/breeds/:id (getBreedById) ────────────────────────────────

  describe('GET /api/v1/breeds/:id', () => {
    it('returns 200 with the breed when given a valid existing ID', async () => {
      const res = await request(app).get(`/api/v1/breeds/${testBreedId}`).set('Origin', ORIGIN);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(testBreedId);
      expect(res.body.data.name).toBe(TEST_BREED_NAME);
    });

    it('returns 400 for a non-numeric ID', async () => {
      const res = await request(app).get('/api/v1/breeds/notanumber').set('Origin', ORIGIN);

      expect(res.status).toBe(400);
    });

    it('returns 404 for a valid integer that does not exist', async () => {
      const res = await request(app).get('/api/v1/breeds/999999999').set('Origin', ORIGIN);

      expect(res.status).toBe(404);
    });
  });

  // ─── GET /api/v1/breeds/:id/conformation-averages ─────────────────────────

  describe('GET /api/v1/breeds/:id/conformation-averages', () => {
    it('returns 200 with zero averages when no horses of this breed exist', async () => {
      const res = await request(app).get(`/api/v1/breeds/${testBreedId}/conformation-averages`).set('Origin', ORIGIN);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.breedId).toBe(String(testBreedId));
      expect(res.body.data.horseCount).toBe(0);
      expect(res.body.data.averages).toHaveProperty('head');
      expect(res.body.data.averages.head).toBe(0);
    });

    it('returns 404 for a breed ID that does not exist', async () => {
      const res = await request(app).get('/api/v1/breeds/999999999/conformation-averages').set('Origin', ORIGIN);

      expect(res.status).toBe(404);
    });

    it('returns 400 for a non-numeric breed ID', async () => {
      const res = await request(app).get('/api/v1/breeds/bad/conformation-averages').set('Origin', ORIGIN);

      expect(res.status).toBe(400);
    });
  });
});
