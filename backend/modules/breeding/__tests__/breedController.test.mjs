/**
 * breedController integration tests (Equoria-rr7 coverage sprint).
 *
 * Breed routes are public (no auth) — mounted at both /api/breeds and
 * /api/v1/breeds. Uses the /api/breeds prefix throughout.
 *
 * Real DB, no bypass headers.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';

const ORIGIN = 'http://localhost:3000';

// Test fixture breed — cleaned up after all tests in this file
let testBreedId;
const TEST_BREED_NAME = `TestFixture-Breed-${Date.now()}`;

describe('breedController integration', () => {
  beforeAll(async () => {
    const breed = await prisma.breed.create({
      data: { name: TEST_BREED_NAME, description: 'Integration test breed' },
    });
    testBreedId = breed.id;
  }, 30000);

  afterAll(async () => {
    await prisma.breed.delete({ where: { id: testBreedId } }).catch(() => {});
  }, 30000);

  // ─── GET /api/breeds (getAllBreeds) ───────────────────────────────────────

  describe('GET /api/breeds', () => {
    it('returns 200 with an array of breeds', async () => {
      const res = await request(app).get('/api/breeds').set('Origin', ORIGIN);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(typeof res.body.count).toBe('number');
    });

    it('includes the test fixture breed in the results', async () => {
      const res = await request(app).get('/api/breeds').set('Origin', ORIGIN);

      const names = res.body.data.map(b => b.name);
      expect(names).toContain(TEST_BREED_NAME);
    });

    it('returns breeds sorted by name ascending', async () => {
      const res = await request(app).get('/api/breeds').set('Origin', ORIGIN);

      const names = res.body.data.map(b => b.name);
      const sorted = [...names].sort((a, b) => a.localeCompare(b));
      expect(names).toEqual(sorted);
    });
  });

  // ─── GET /api/breeds/:id (getBreedById) ───────────────────────────────────

  describe('GET /api/breeds/:id', () => {
    it('returns 200 with the breed when given a valid existing ID', async () => {
      const res = await request(app).get(`/api/breeds/${testBreedId}`).set('Origin', ORIGIN);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(testBreedId);
      expect(res.body.data.name).toBe(TEST_BREED_NAME);
    });

    it('returns 400 for a non-numeric ID', async () => {
      const res = await request(app).get('/api/breeds/notanumber').set('Origin', ORIGIN);

      expect(res.status).toBe(400);
    });

    it('returns 404 for a valid integer that does not exist', async () => {
      const res = await request(app).get('/api/breeds/999999999').set('Origin', ORIGIN);

      expect(res.status).toBe(404);
    });
  });

  // ─── GET /api/breeds/:id/conformation-averages ────────────────────────────

  describe('GET /api/breeds/:id/conformation-averages', () => {
    it('returns 200 with zero averages when no horses of this breed exist', async () => {
      const res = await request(app).get(`/api/breeds/${testBreedId}/conformation-averages`).set('Origin', ORIGIN);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.breedId).toBe(String(testBreedId));
      expect(res.body.data.horseCount).toBe(0);
      expect(res.body.data.averages).toHaveProperty('head');
      expect(res.body.data.averages.head).toBe(0);
    });

    it('returns 404 for a breed ID that does not exist', async () => {
      const res = await request(app).get('/api/breeds/999999999/conformation-averages').set('Origin', ORIGIN);

      expect(res.status).toBe(404);
    });

    it('returns 400 for a non-numeric breed ID', async () => {
      const res = await request(app).get('/api/breeds/bad/conformation-averages').set('Origin', ORIGIN);

      expect(res.status).toBe(400);
    });
  });
});
