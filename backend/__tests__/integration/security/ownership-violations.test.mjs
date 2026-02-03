import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import app from '../../../app.mjs';
import { createMockToken } from '../../factories/index.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';

/**
 * Integration tests to verify ownership enforcement for core resources.
 * Focuses on realistic, supported endpoints (horses, grooms) and ensures
 * cross-user access is denied while owners retain full access.
 */

describe('Ownership Violation Attempts Integration Tests', () => {
  let userA;
  let userB;
  let tokenA;
  let _tokenB;
  let horseA;
  let horseB;
  let groomA;
  let groomB;

  beforeEach(async () => {
    // Extra cleanup to avoid FK issues if a prior test aborts early
    await prisma.refreshToken.deleteMany({});
    await prisma.groom.deleteMany({});
    await prisma.horse.deleteMany({});
    await prisma.user.deleteMany({});

    // Ensure auth middleware and tokens share the same secret in test runs
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-for-testing-only-32chars';

    userA = await prisma.user.create({
      data: {
        email: `userA-${Date.now()}@example.com`,
        username: `userA-${Date.now()}`,
        password: 'hashedPassword123',
        firstName: 'User',
        lastName: 'A',
        emailVerified: true,
      },
    });

    userB = await prisma.user.create({
      data: {
        email: `userB-${Date.now()}@example.com`,
        username: `userB-${Date.now()}`,
        password: 'hashedPassword123',
        firstName: 'User',
        lastName: 'B',
        emailVerified: true,
      },
    });

    tokenA = createMockToken(userA.id);
    _tokenB = createMockToken(userB.id);

    horseA = await prisma.horse.create({
      data: {
        name: `HorseA-${Date.now()}`,
        userId: userA.id, // Matches schema field (line 144)
        sex: 'mare',
        dateOfBirth: new Date(),
      },
    });

    horseB = await prisma.horse.create({
      data: {
        name: `HorseB-${Date.now()}`,
        userId: userB.id, // Matches schema field (line 144)
        sex: 'stallion',
        dateOfBirth: new Date(),
      },
    });

    groomA = await prisma.groom.create({
      data: {
        name: `GroomA-${Date.now()}`,
        userId: userA.id,
        speciality: 'TRAINING',
        personality: 'diligent',
      },
    });

    groomB = await prisma.groom.create({
      data: {
        name: `GroomB-${Date.now()}`,
        userId: userB.id,
        speciality: 'CARE',
        personality: 'calm',
      },
    });
  });

  afterEach(async () => {
    await prisma.refreshToken.deleteMany({});
    await prisma.groom.deleteMany({
      where: { id: { in: [groomA?.id, groomB?.id].filter(Boolean) } },
    });
    await prisma.horse.deleteMany({
      where: { id: { in: [horseA?.id, horseB?.id].filter(Boolean) } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [userA?.id, userB?.id].filter(Boolean) } },
    });
  });

  describe('Cross-user horse access', () => {
    it('denies access to an unowned horse', async () => {
      const response = await request(app)
        .get(`/api/horses/${horseB.id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Horse not found');
    });

    it('allows owners to fetch their own horse', async () => {
      const response = await request(app)
        .get(`/api/horses/${horseA.id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(horseA.id);
      expect(response.body.data.userId).toBe(userA.id); // Matches schema field
    });

    it('blocks cross-user updates and preserves data integrity', async () => {
      const response = await request(app)
        .put(`/api/horses/${horseB.id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .set('x-test-skip-csrf', 'true')
        .send({ name: 'HackedHorse' })
        .expect(404);

      expect(response.body.success).toBe(false);

      const horse = await prisma.horse.findUnique({ where: { id: horseB.id } });
      expect(horse.name).toBe(horseB.name);
    });

    it('allows owners to update their horse with a valid payload', async () => {
      const newName = 'Updated Horse Name';

      const response = await request(app)
        .put(`/api/horses/${horseA.id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .set('x-test-skip-csrf', 'true')
        .send({
          name: newName,
          sex: 'mare',
          dateOfBirth: new Date().toISOString(),
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(newName);

      const horse = await prisma.horse.findUnique({ where: { id: horseA.id } });
      expect(horse.name).toBe(newName);
    });

    it('blocks cross-user deletes and allows owner deletes', async () => {
      const blockResponse = await request(app)
        .delete(`/api/horses/${horseB.id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .set('x-test-skip-csrf', 'true')
        .expect(404);

      expect(blockResponse.body.success).toBe(false);

      const allowResponse = await request(app)
        .delete(`/api/horses/${horseA.id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .set('x-test-skip-csrf', 'true')
        .expect(200);

      expect(allowResponse.body.success).toBe(true);

      const horse = await prisma.horse.findUnique({ where: { id: horseA.id } });
      expect(horse).toBeNull();
      // Prevent cleanup from double-deleting the record we just removed
      horseA = null;
    });
  });

  describe('Groom ownership', () => {
    it('denies access to an unowned groom profile', async () => {
      const response = await request(app)
        .get(`/api/grooms/${groomB.id}/profile`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Groom not found');
    });

    it('allows owners to view their groom profile', async () => {
      const response = await request(app)
        .get(`/api/grooms/${groomA.id}/profile`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.groom?.id || response.body.data?.id).toBe(groomA.id);
    });
  });

  describe('Parameter validation and enumeration safety', () => {
    it('rejects invalid horse identifiers', async () => {
      const response = await request(app).get('/api/horses/abc').set('Authorization', `Bearer ${tokenA}`).expect(400);

      expect(response.body.success).toBe(false);
    });

    it('returns the same 404 for missing and unowned horses', async () => {
      const missing = await request(app).get('/api/horses/999999').set('Authorization', `Bearer ${tokenA}`).expect(404);

      const unowned = await request(app)
        .get(`/api/horses/${horseB.id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(404);

      expect(missing.body.message).toBe(unowned.body.message);
      expect(missing.body.success).toBe(false);
      expect(unowned.body.success).toBe(false);
    });
  });
});
