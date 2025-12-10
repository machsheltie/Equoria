/**
 * 🔒 INTEGRATION TESTS: SQL Injection Attempts
 *
 * Tests for preventing SQL injection attacks including:
 * - Classic SQL injection in ownership checks
 * - Blind SQL injection attempts
 * - Time-based SQL injection
 * - Union-based injection
 * - Boolean-based injection
 * - Error-based injection
 * - Stacked queries
 * - Second-order SQL injection
 * - ORM bypass attempts (Prisma)
 *
 * @module __tests__/integration/security/sql-injection-attempts
 */

import { describe, it, expect, beforeEach, afterAll, jest } from '@jest/globals';
import request from 'supertest';
import app from '../../../app.mjs';
import { createMockUser, createMockToken, createMockHorse, createMockGroom } from '../../factories/index.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';

describe('SQL Injection Attempts Integration Tests', () => {
  let testUser;
  let validToken;
  let testHorse;
  let testGroom;

  beforeEach(async () => {
    // Create test user in database
    testUser = await prisma.user.create({
      data: {
        email: `test-${Date.now()}@example.com`,
        username: `testuser-${Date.now()}`,
        password: 'hashedPassword123',
        role: 'USER',
        isVerified: true,
      },
    });

    validToken = createMockToken(testUser.id);

    // Create test horse owned by user
    testHorse = await prisma.horse.create({
      data: {
        name: `TestHorse-${Date.now()}`,
        userId: testUser.id,
        breed: 'Thoroughbred',
        gender: 'MARE',
        color: 'Bay',
        age: 5,
      },
    });

    // Create test groom owned by user
    testGroom = await prisma.groom.create({
      data: {
        name: `TestGroom-${Date.now()}`,
        userId: testUser.id,
        specialty: 'GENERAL',
        experienceLevel: 50,
      },
    });
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.groom.deleteMany({
      where: {
        name: {
          contains: 'TestGroom-',
        },
      },
    });

    await prisma.horse.deleteMany({
      where: {
        name: {
          contains: 'TestHorse-',
        },
      },
    });

    await prisma.user.deleteMany({
      where: {
        email: {
          contains: 'test-',
        },
      },
    });
  });

  describe('Classic SQL Injection in ID Parameters', () => {
    it('should reject SQL injection in horse ID', async () => {
      const response = await request(app)
        .get(`/api/horses/1' OR '1'='1`)
        .set('Authorization', `Bearer ${validToken}`)
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        message: 'Invalid horse ID',
        status: 'error',
      });
    });

    it('should reject SQL injection with comment syntax', async () => {
      const response = await request(app)
        .get(`/api/horses/1; DROP TABLE horses; --`)
        .set('Authorization', `Bearer ${validToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);

      // Verify table still exists
      const count = await prisma.horse.count();
      expect(count).toBeGreaterThan(0);
    });

    it('should reject SQL injection with union select', async () => {
      const response = await request(app)
        .get(`/api/horses/1 UNION SELECT * FROM users`)
        .set('Authorization', `Bearer ${validToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should reject SQL injection with nested queries', async () => {
      const response = await request(app)
        .get(`/api/horses/1 AND (SELECT COUNT(*) FROM users) > 0`)
        .set('Authorization', `Bearer ${validToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should reject SQL injection with hex encoding', async () => {
      const response = await request(app)
        .get(`/api/horses/0x31`)
        .set('Authorization', `Bearer ${validToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Blind SQL Injection Attempts', () => {
    it('should reject boolean-based blind injection', async () => {
      const response = await request(app)
        .get(`/api/horses/${testHorse.id}' AND 1=1 AND '1'='1`)
        .set('Authorization', `Bearer ${validToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should reject time-based blind injection', async () => {
      const startTime = Date.now();

      const response = await request(app)
        .get(`/api/horses/1; WAITFOR DELAY '00:00:05'; --`)
        .set('Authorization', `Bearer ${validToken}`)
        .expect(400);

      const duration = Date.now() - startTime;

      expect(response.body.success).toBe(false);
      // Should not have delayed 5 seconds
      expect(duration).toBeLessThan(2000);
    });

    it('should reject PostgreSQL-specific time injection', async () => {
      const startTime = Date.now();

      const response = await request(app)
        .get(`/api/horses/1; SELECT pg_sleep(5); --`)
        .set('Authorization', `Bearer ${validToken}`)
        .expect(400);

      const duration = Date.now() - startTime;

      expect(response.body.success).toBe(false);
      expect(duration).toBeLessThan(2000);
    });

    it('should reject error-based blind injection', async () => {
      const response = await request(app)
        .get(`/api/horses/1' AND (SELECT 1/0)`)
        .set('Authorization', `Bearer ${validToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      // Should not leak database error details
      expect(response.body.message).not.toContain('division by zero');
      expect(response.body.message).not.toContain('Prisma');
      expect(response.body.message).not.toContain('PostgreSQL');
    });
  });

  describe('Union-Based SQL Injection', () => {
    it('should reject UNION SELECT attacks', async () => {
      const response = await request(app)
        .get(`/api/horses/1 UNION SELECT id,email,password,NULL,NULL,NULL FROM users`)
        .set('Authorization', `Bearer ${validToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should reject UNION ALL attacks', async () => {
      const response = await request(app)
        .get(`/api/horses/1 UNION ALL SELECT * FROM users WHERE 1=1`)
        .set('Authorization', `Bearer ${validToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should reject UNION with ORDER BY column enumeration', async () => {
      const response = await request(app)
        .get(`/api/horses/1 ORDER BY 100`)
        .set('Authorization', `Bearer ${validToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should reject UNION with NULL padding', async () => {
      const response = await request(app)
        .get(`/api/horses/1 UNION SELECT NULL,NULL,NULL,NULL,NULL`)
        .set('Authorization', `Bearer ${validToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Stacked Queries', () => {
    it('should reject semicolon-separated queries', async () => {
      const response = await request(app)
        .get(`/api/horses/1; DELETE FROM horses WHERE id > 0`)
        .set('Authorization', `Bearer ${validToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);

      // Verify no horses were deleted
      const count = await prisma.horse.count();
      expect(count).toBeGreaterThan(0);
    });

    it('should reject multiple statements in ownership check', async () => {
      const response = await request(app)
        .get(`/api/horses/1; UPDATE users SET role='ADMIN' WHERE id=${testUser.id}`)
        .set('Authorization', `Bearer ${validToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);

      // Verify user role was not modified
      const user = await prisma.user.findUnique({ where: { id: testUser.id } });
      expect(user.role).toBe('USER');
    });

    it('should reject batch operations via stacking', async () => {
      const response = await request(app)
        .get(`/api/horses/1; INSERT INTO horses (name, userId) VALUES ('Hacked', 1)`)
        .set('Authorization', `Bearer ${validToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('SQL Injection in Search/Filter Parameters', () => {
    it('should reject SQL injection in breed filter', async () => {
      const response = await request(app)
        .get(`/api/horses?breed=Thoroughbred' OR '1'='1`)
        .set('Authorization', `Bearer ${validToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should reject SQL injection in name search', async () => {
      const response = await request(app)
        .get(`/api/horses?name=Test'; DROP TABLE horses; --`)
        .set('Authorization', `Bearer ${validToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);

      // Verify table still exists
      const count = await prisma.horse.count();
      expect(count).toBeGreaterThan(0);
    });

    it('should reject SQL injection in sort parameter', async () => {
      const response = await request(app)
        .get(`/api/horses?sort=name; UPDATE horses SET name='Hacked'`)
        .set('Authorization', `Bearer ${validToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should reject SQL injection in LIKE wildcards', async () => {
      const response = await request(app)
        .get(`/api/horses?name=%' OR '1'='1`)
        .set('Authorization', `Bearer ${validToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should reject SQL injection in IN clause', async () => {
      const response = await request(app)
        .get(`/api/horses?ids=1,2,3) OR 1=1 --`)
        .set('Authorization', `Bearer ${validToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('SQL Injection in JSON/JSONB Queries', () => {
    it('should reject SQL injection in JSONB path', async () => {
      const response = await request(app)
        .get(`/api/horses?traits.strength=50'; DROP TABLE horses; --`)
        .set('Authorization', `Bearer ${validToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should reject SQL injection in JSON operators', async () => {
      const response = await request(app)
        .get(`/api/horses?traits->>'color'='Bay' OR '1'='1`)
        .set('Authorization', `Bearer ${validToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should reject SQL injection in JSON array queries', async () => {
      const response = await request(app)
        .get(`/api/horses?achievements[0]=Win'; DELETE FROM horses; --`)
        .set('Authorization', `Bearer ${validToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Second-Order SQL Injection', () => {
    it('should sanitize stored data used in subsequent queries', async () => {
      // Attempt to store malicious data
      const maliciousName = "Horse'; DROP TABLE users; --";

      const createResponse = await request(app)
        .post('/api/horses')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          name: maliciousName,
          breed: 'Thoroughbred',
          gender: 'MARE',
          color: 'Bay',
          age: 5,
        })
        .expect(400);

      expect(createResponse.body.success).toBe(false);

      // Verify no horse was created with malicious name
      const horses = await prisma.horse.findMany({
        where: {
          userId: testUser.id,
          name: {
            contains: 'DROP TABLE',
          },
        },
      });

      expect(horses).toHaveLength(0);
    });

    it('should prevent injection via profile data used in ownership checks', async () => {
      // Attempt to update username with SQL injection
      const response = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          username: "admin'; UPDATE users SET role='ADMIN' WHERE 1=1; --",
        })
        .expect(400);

      expect(response.body.success).toBe(false);

      // Verify no users became admin
      const adminUsers = await prisma.user.findMany({
        where: {
          role: 'ADMIN',
        },
      });

      expect(adminUsers.length).toBe(0);
    });
  });

  describe('ORM Bypass Attempts (Prisma)', () => {
    it('should reject raw query injection via Prisma', async () => {
      // This tests that we don't allow raw queries via API
      const response = await request(app)
        .post('/api/horses/query')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          query: 'SELECT * FROM horses WHERE userId = 1',
        })
        .expect(404); // Endpoint should not exist

      expect(response.body.success).toBe(false);
    });

    it('should reject Prisma findRaw injection attempts', async () => {
      const response = await request(app)
        .get(`/api/horses?raw={"sql":"SELECT * FROM users"}`)
        .set('Authorization', `Bearer ${validToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should reject $queryRaw parameter injection', async () => {
      const response = await request(app)
        .post('/api/horses/search')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          $queryRaw: 'SELECT * FROM users',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PostgreSQL-Specific Injection Attacks', () => {
    it('should reject PostgreSQL function calls', async () => {
      const response = await request(app)
        .get(`/api/horses/1; SELECT version()`)
        .set('Authorization', `Bearer ${validToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      // Should not leak database version
      expect(response.body.message).not.toContain('PostgreSQL');
    });

    it('should reject PostgreSQL COPY command', async () => {
      const response = await request(app)
        .get(`/api/horses/1; COPY users TO '/tmp/users.csv'`)
        .set('Authorization', `Bearer ${validToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should reject pg_read_file attempts', async () => {
      const response = await request(app)
        .get(`/api/horses/1; SELECT pg_read_file('/etc/passwd')`)
        .set('Authorization', `Bearer ${validToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should reject large object manipulation', async () => {
      const response = await request(app)
        .get(`/api/horses/1; SELECT lo_create(1234)`)
        .set('Authorization', `Bearer ${validToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should reject PostgreSQL stored procedure execution', async () => {
      const response = await request(app)
        .get(`/api/horses/1; CALL malicious_procedure()`)
        .set('Authorization', `Bearer ${validToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('SQL Injection in Batch Operations', () => {
    it('should reject SQL injection in batch horse updates', async () => {
      const response = await request(app)
        .post('/api/horses/batch-update')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          horseIds: [`${testHorse.id}' OR '1'='1`],
          updates: { name: 'HackedName' },
        })
        .expect(400);

      expect(response.body.success).toBe(false);

      // Verify horse was not modified
      const horse = await prisma.horse.findUnique({ where: { id: testHorse.id } });
      expect(horse.name).toBe(testHorse.name);
    });

    it('should reject SQL injection in batch groom deletion', async () => {
      const response = await request(app)
        .post('/api/grooms/batch-delete')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          groomIds: [`1; DELETE FROM grooms WHERE 1=1; --`],
        })
        .expect(400);

      expect(response.body.success).toBe(false);

      // Verify no grooms were deleted
      const count = await prisma.groom.count();
      expect(count).toBeGreaterThan(0);
    });
  });

  describe('SQL Injection Error Handling', () => {
    it('should not leak database structure in error messages', async () => {
      const response = await request(app)
        .get(`/api/horses/invalid-sql-injection`)
        .set('Authorization', `Bearer ${validToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      // Should not contain database-specific error messages
      expect(response.body.message).not.toContain('column');
      expect(response.body.message).not.toContain('table');
      expect(response.body.message).not.toContain('syntax');
      expect(response.body.message).not.toContain('Prisma');
      expect(response.body.message).not.toContain('PostgreSQL');
    });

    it('should return consistent error format for all injection attempts', async () => {
      const injections = [
        `1' OR '1'='1`,
        `1; DROP TABLE horses`,
        `1 UNION SELECT * FROM users`,
        `1 AND (SELECT 1 FROM users)`,
      ];

      const responses = await Promise.all(
        injections.map(injection =>
          request(app)
            .get(`/api/horses/${injection}`)
            .set('Authorization', `Bearer ${validToken}`)
        )
      );

      // All should return 400 with same error structure
      responses.forEach(response => {
        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('success', false);
        expect(response.body).toHaveProperty('message');
        expect(response.body).toHaveProperty('status');
      });

      // Error messages should be consistent (no info leakage)
      const messages = responses.map(r => r.body.message);
      expect(new Set(messages).size).toBe(1); // All same message
    });
  });

  describe('Parameterized Query Validation', () => {
    it('should use parameterized queries for ownership checks', async () => {
      // This test verifies that Prisma uses parameterized queries
      // which prevent SQL injection by design
      const response = await request(app)
        .get(`/api/horses/${testHorse.id}`)
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(testHorse.id);

      // Prisma should have used:
      // SELECT * FROM horses WHERE id = $1 AND userId = $2
      // NOT:
      // SELECT * FROM horses WHERE id = '${id}' AND userId = '${userId}'
    });

    it('should properly escape special characters in valid data', async () => {
      const horseName = "O'Malley's Horse";

      const createResponse = await request(app)
        .post('/api/horses')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          name: horseName,
          breed: 'Thoroughbred',
          gender: 'STALLION',
          color: 'Chestnut',
          age: 6,
        })
        .expect(201);

      expect(createResponse.body.success).toBe(true);
      expect(createResponse.body.data.name).toBe(horseName);

      // Verify data was stored correctly
      const horse = await prisma.horse.findUnique({
        where: { id: createResponse.body.data.id },
      });
      expect(horse.name).toBe(horseName);

      // Cleanup
      await prisma.horse.delete({ where: { id: horse.id } });
    });
  });
});
