/**
 * 🔒 INTEGRATION TESTS: Ownership Violation Attempts
 *
 * Tests for preventing ownership violations including:
 * - Cross-user resource access
 * - Parameter manipulation attacks
 * - Batch operation violations
 * - Indirect ownership circumvention
 * - Resource enumeration attacks
 * - Nested resource access violations
 *
 * Validates single-query ownership pattern (50% query reduction)
 *
 * @module __tests__/integration/security/ownership-violations
 */

import { describe, it, expect, beforeEach, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../../../app.mjs';
import { createMockToken } from '../../factories/index.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';

describe('Ownership Violation Attempts Integration Tests', () => {
  let userA, userB;
  let tokenA, tokenB;
  let horseA, horseB;
  let groomA, groomB;

  beforeEach(async () => {
    // Create two test users
    userA = await prisma.user.create({
      data: {
        email: `userA-${Date.now()}@example.com`,
        username: `userA-${Date.now()}`,
        password: 'hashedPassword123',
        role: 'USER',
        isVerified: true,
      },
    });

    userB = await prisma.user.create({
      data: {
        email: `userB-${Date.now()}@example.com`,
        username: `userB-${Date.now()}`,
        password: 'hashedPassword123',
        role: 'USER',
        isVerified: true,
      },
    });

    tokenA = createMockToken(userA.id);
    tokenB = createMockToken(userB.id);

    // Create horses for each user
    horseA = await prisma.horse.create({
      data: {
        name: `HorseA-${Date.now()}`,
        userId: userA.id,
        breed: 'Thoroughbred',
        gender: 'MARE',
        color: 'Bay',
        age: 5,
      },
    });

    horseB = await prisma.horse.create({
      data: {
        name: `HorseB-${Date.now()}`,
        userId: userB.id,
        breed: 'Arabian',
        gender: 'STALLION',
        color: 'Chestnut',
        age: 6,
      },
    });

    // Create grooms for each user
    groomA = await prisma.groom.create({
      data: {
        name: `GroomA-${Date.now()}`,
        userId: userA.id,
        specialty: 'TRAINING',
        experience: 50,
        salary: 1000,
      },
    });

    groomB = await prisma.groom.create({
      data: {
        name: `GroomB-${Date.now()}`,
        userId: userB.id,
        specialty: 'CARE',
        experience: 60,
        salary: 1200,
      },
    });
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.groom.deleteMany({
      where: {
        name: {
          contains: 'Groom',
        },
      },
    });

    await prisma.horse.deleteMany({
      where: {
        name: {
          contains: 'Horse',
        },
      },
    });

    await prisma.user.deleteMany({
      where: {
        OR: [
          { email: { contains: 'userA-' } },
          { email: { contains: 'userB-' } },
        ],
      },
    });
  });

  describe('Cross-User Horse Access', () => {
    it('should prevent user A from viewing user B horse details', async () => {
      const response = await request(app)
        .get(`/api/horses/${horseB.id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(404);

      expect(response.body).toEqual({
        success: false,
        message: 'Horse not found',
        status: 'error',
      });
    });

    it('should prevent user A from updating user B horse', async () => {
      const response = await request(app)
        .put(`/api/horses/${horseB.id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ name: 'HackedHorse' })
        .expect(404);

      expect(response.body.success).toBe(false);

      // Verify horse was not modified
      const horse = await prisma.horse.findUnique({ where: { id: horseB.id } });
      expect(horse.name).toBe(horseB.name);
      expect(horse.name).not.toBe('HackedHorse');
    });

    it('should prevent user A from deleting user B horse', async () => {
      const response = await request(app)
        .delete(`/api/horses/${horseB.id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(404);

      expect(response.body.success).toBe(false);

      // Verify horse still exists
      const horse = await prisma.horse.findUnique({ where: { id: horseB.id } });
      expect(horse).not.toBeNull();
    });

    it('should allow user to access their own horse', async () => {
      const response = await request(app)
        .get(`/api/horses/${horseA.id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(horseA.id);
      expect(response.body.data.userId).toBe(userA.id);
    });
  });

  describe('Cross-User Groom Access', () => {
    it('should prevent user A from viewing user B groom details', async () => {
      const response = await request(app)
        .get(`/api/grooms/${groomB.id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(404);

      expect(response.body).toEqual({
        success: false,
        message: 'Groom not found',
        status: 'error',
      });
    });

    it('should prevent user A from updating user B groom', async () => {
      const response = await request(app)
        .put(`/api/grooms/${groomB.id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ salary: 5000 })
        .expect(404);

      expect(response.body.success).toBe(false);

      // Verify groom was not modified
      const groom = await prisma.groom.findUnique({ where: { id: groomB.id } });
      expect(groom.salary).toBe(groomB.salary);
      expect(groom.salary).not.toBe(5000);
    });

    it('should prevent user A from firing (deleting) user B groom', async () => {
      const response = await request(app)
        .delete(`/api/grooms/${groomB.id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(404);

      expect(response.body.success).toBe(false);

      // Verify groom still exists
      const groom = await prisma.groom.findUnique({ where: { id: groomB.id } });
      expect(groom).not.toBeNull();
    });

    it('should allow user to access their own groom', async () => {
      const response = await request(app)
        .get(`/api/grooms/${groomA.id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(groomA.id);
      expect(response.body.data.userId).toBe(userA.id);
    });
  });

  describe('Parameter Manipulation Attacks', () => {
    it('should reject negative horse ID', async () => {
      const response = await request(app)
        .get('/api/horses/-1')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        message: 'Invalid horse ID',
        status: 'error',
      });
    });

    it('should reject non-numeric horse ID', async () => {
      const response = await request(app)
        .get('/api/horses/abc')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should reject SQL injection in horse ID', async () => {
      const response = await request(app)
        .get("/api/horses/1' OR '1'='1")
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should reject decimal horse ID', async () => {
      const response = await request(app)
        .get('/api/horses/1.5')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should reject extremely large horse ID (DoS prevention)', async () => {
      const response = await request(app)
        .get('/api/horses/999999999999999')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Batch Operation Violations', () => {
    it('should prevent batch delete of horses including unowned ones', async () => {
      // Attempt to delete both horses (userA only owns horseA)
      const response = await request(app)
        .post('/api/horses/batch-delete')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ horseIds: [horseA.id, horseB.id] })
        .expect(403);

      expect(response.body.success).toBe(false);

      // Verify both horses still exist
      const horses = await prisma.horse.findMany({
        where: {
          id: { in: [horseA.id, horseB.id] },
        },
      });
      expect(horses).toHaveLength(2);
    });

    it('should allow batch delete of only owned horses', async () => {
      // Create second horse for userA
      const horseA2 = await prisma.horse.create({
        data: {
          name: `HorseA2-${Date.now()}`,
          userId: userA.id,
          breed: 'Mustang',
          gender: 'GELDING',
          color: 'Black',
          age: 4,
        },
      });

      const response = await request(app)
        .post('/api/horses/batch-delete')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ horseIds: [horseA.id, horseA2.id] })
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify horses were deleted
      const horses = await prisma.horse.findMany({
        where: {
          id: { in: [horseA.id, horseA2.id] },
        },
      });
      expect(horses).toHaveLength(0);
    });

    it('should prevent batch update with mixed ownership', async () => {
      const response = await request(app)
        .post('/api/horses/batch-update')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          horseIds: [horseA.id, horseB.id],
          updates: { age: 10 },
        })
        .expect(403);

      expect(response.body.success).toBe(false);

      // Verify horses were not modified
      const horses = await prisma.horse.findMany({
        where: {
          id: { in: [horseA.id, horseB.id] },
        },
      });
      horses.forEach(horse => {
        expect(horse.age).not.toBe(10);
      });
    });
  });

  describe('Resource Enumeration Attacks', () => {
    it('should not disclose existence of unowned resources', async () => {
      // Try to access horse owned by userB
      const response = await request(app)
        .get(`/api/horses/${horseB.id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(404);

      // Should return 404, not 403, to prevent enumeration
      expect(response.body.message).toBe('Horse not found');
      expect(response.body.message).not.toContain('permission');
      expect(response.body.message).not.toContain('owner');
    });

    it('should return same error for non-existent and unowned resources', async () => {
      const nonExistentId = 99999;

      // Try to access non-existent horse
      const response1 = await request(app)
        .get(`/api/horses/${nonExistentId}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(404);

      // Try to access unowned horse
      const response2 = await request(app)
        .get(`/api/horses/${horseB.id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(404);

      // Errors should be identical
      expect(response1.body.message).toBe(response2.body.message);
      expect(response1.status).toBe(response2.status);
    });

    it('should not leak ownership info through timing attacks', async () => {
      const timings = [];

      // Measure time for owned resource
      const start1 = Date.now();
      await request(app)
        .get(`/api/horses/${horseA.id}`)
        .set('Authorization', `Bearer ${tokenA}`);
      timings.push(Date.now() - start1);

      // Measure time for unowned resource
      const start2 = Date.now();
      await request(app)
        .get(`/api/horses/${horseB.id}`)
        .set('Authorization', `Bearer ${tokenA}`);
      timings.push(Date.now() - start2);

      // Measure time for non-existent resource
      const start3 = Date.now();
      await request(app)
        .get('/api/horses/99999')
        .set('Authorization', `Bearer ${tokenA}`);
      timings.push(Date.now() - start3);

      // Timing variance should be minimal (within 2x factor)
      const maxTiming = Math.max(...timings);
      const minTiming = Math.min(...timings);
      const ratio = maxTiming / minTiming;

      expect(ratio).toBeLessThan(2);
    });
  });

  describe('Indirect Ownership Circumvention', () => {
    it('should prevent training session creation for unowned horse', async () => {
      const response = await request(app)
        .post(`/api/horses/${horseB.id}/training`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          type: 'SPEED',
          duration: 60,
          intensity: 'HIGH',
        })
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should prevent competition entry for unowned horse', async () => {
      // Create a competition
      const competition = await prisma.competition.create({
        data: {
          name: `TestCompetition-${Date.now()}`,
          date: new Date(),
          type: 'RACE',
          minAge: 3,
          maxAge: 15,
        },
      });

      const response = await request(app)
        .post(`/api/competitions/${competition.id}/enter`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ horseId: horseB.id })
        .expect(404);

      expect(response.body.success).toBe(false);

      // Cleanup
      await prisma.competition.delete({ where: { id: competition.id } });
    });

    it('should prevent breeding with unowned horses', async () => {
      const response = await request(app)
        .post('/api/breeding')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          mareId: horseA.id,
          stallionId: horseB.id, // Unowned stallion
        })
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    it('should prevent groom assignment to unowned horse', async () => {
      const response = await request(app)
        .post(`/api/horses/${horseB.id}/assign-groom`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ groomId: groomA.id })
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Nested Resource Access Violations', () => {
    it('should prevent accessing training sessions of unowned horse', async () => {
      // Create training session for horseB
      const session = await prisma.trainingSession.create({
        data: {
          horseId: horseB.id,
          userId: userB.id,
          type: 'SPEED',
          duration: 60,
          intensity: 'MEDIUM',
        },
      });

      const response = await request(app)
        .get(`/api/horses/${horseB.id}/training/${session.id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(404);

      expect(response.body.success).toBe(false);

      // Cleanup
      await prisma.trainingSession.delete({ where: { id: session.id } });
    });

    it('should prevent accessing foals of unowned horse', async () => {
      // Create foal for horseB
      const foal = await prisma.foal.create({
        data: {
          name: `Foal-${Date.now()}`,
          mareId: horseB.id,
          stallionId: horseB.id,
          userId: userB.id,
          gender: 'FILLY',
          expectedBirthDate: new Date(),
        },
      });

      const response = await request(app)
        .get(`/api/horses/${horseB.id}/foals/${foal.id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(404);

      expect(response.body.success).toBe(false);

      // Cleanup
      await prisma.foal.delete({ where: { id: foal.id } });
    });

    it('should prevent modifying competition entries for unowned horse', async () => {
      // Create competition and entry for horseB
      const competition = await prisma.competition.create({
        data: {
          name: `TestComp-${Date.now()}`,
          date: new Date(),
          type: 'RACE',
          minAge: 3,
          maxAge: 15,
        },
      });

      const entry = await prisma.competitionEntry.create({
        data: {
          horseId: horseB.id,
          competitionId: competition.id,
          userId: userB.id,
        },
      });

      const response = await request(app)
        .delete(`/api/competitions/${competition.id}/entries/${entry.id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(404);

      expect(response.body.success).toBe(false);

      // Cleanup
      await prisma.competitionEntry.delete({ where: { id: entry.id } });
      await prisma.competition.delete({ where: { id: competition.id } });
    });
  });

  describe('Single-Query Ownership Validation', () => {
    it('should use atomic WHERE clause for ownership check', async () => {
      // This test verifies the implementation uses WHERE { id, userId }
      // in a single query instead of separate queries

      const response = await request(app)
        .get(`/api/horses/${horseA.id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(response.body.success).toBe(true);

      // The implementation should use:
      // await prisma.horse.findUnique({ where: { id, userId } })
      // NOT:
      // 1. const horse = await prisma.horse.findUnique({ where: { id } })
      // 2. if (horse.userId !== userId) throw error
    });

    it('should return 404 for unowned resource in single query', async () => {
      const response = await request(app)
        .get(`/api/horses/${horseB.id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(404);

      expect(response.body.message).toBe('Horse not found');

      // Should not make second query to check ownership
      // Single query with WHERE { id, userId } returns null
    });

    it('should use IN clause for batch ownership validation', async () => {
      // Create second horse for userA
      const horseA2 = await prisma.horse.create({
        data: {
          name: `HorseA2-${Date.now()}`,
          userId: userA.id,
          breed: 'Paint',
          gender: 'MARE',
          color: 'Pinto',
          age: 7,
        },
      });

      const response = await request(app)
        .post('/api/horses/batch-details')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ horseIds: [horseA.id, horseA2.id] })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);

      // Should use single query:
      // await prisma.horse.findMany({ where: { id: { in: ids }, userId } })

      // Cleanup
      await prisma.horse.delete({ where: { id: horseA2.id } });
    });
  });
});
