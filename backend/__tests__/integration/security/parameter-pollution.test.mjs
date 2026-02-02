/**
 * 🔒 INTEGRATION TESTS: Parameter Pollution Attacks
 *
 * Tests for preventing parameter pollution attacks including:
 * - HTTP Parameter Pollution (HPP)
 * - JSON parameter pollution
 * - Array parameter manipulation
 * - Query string pollution
 * - Content-Type manipulation
 * - Nested object pollution
 * - Type coercion attacks
 * - Mass assignment vulnerabilities
 *
 * @module __tests__/integration/security/parameter-pollution
 */

import { describe, it, expect, beforeEach, afterAll, jest } from '@jest/globals';
import request from 'supertest';
import app from '../../../app.mjs';
import { createMockUser, createMockToken, createMockHorse } from '../../factories/index.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';

describe('Parameter Pollution Attack Integration Tests', () => {
  let testUser;
  let validToken;
  let testHorse;

  beforeEach(async () => {
    // Create test user in database
    testUser = await prisma.user.create({
      data: {
        email: `test-${Date.now()}@example.com`,
        username: `testuser-${Date.now()}`,
        password: 'hashedPassword123',
        firstName: 'Test',
        lastName: 'User',
        emailVerified: true,
      },
    });

    validToken = createMockToken(testUser.id);

    // Create test horse owned by user
    testHorse = await prisma.horse.create({
      data: {
        name: `TestHorse-${Date.now()}`,
        sex: 'mare',
        dateOfBirth: new Date('2015-01-01'),
        userId: testUser.id, // Matches schema field (line 144)
        age: 5,
      },
    });
  });

  afterAll(async () => {
    // Clean up test data
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

  describe('HTTP Parameter Pollution (HPP)', () => {
    it('should reject duplicate id parameters in query string', async () => {
      const response = await request(app)
        .get(`/api/horses/${testHorse.id}?id=${testHorse.id}&id=999`)
        .set('Authorization', `Bearer ${validToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid');
    });

    it('should reject duplicate id parameters in different positions', async () => {
      const response = await request(app)
        .get(`/api/horses?id=1&id=2&id=3`)
        .set('Authorization', `Bearer ${validToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should use first parameter value when duplicates present', async () => {
      // Test that server takes first value, not last or concatenated
      const response = await request(app)
        .get(`/api/horses/${testHorse.id}?sort=name&sort=age`)
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      // Should use first 'sort=name' parameter
      expect(response.body.success).toBe(true);
    });

    it('should reject array-syntax parameters where not expected', async () => {
      const response = await request(app)
        .put(`/api/horses/${testHorse.id}`)
        .set('Authorization', `Bearer ${validToken}`)
        .set('X-Test-Skip-Csrf', 'true')
        .send({
          name: ['HorseName1', 'HorseName2'], // Array where string expected
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid');
    });

    it('should reject mixed type parameters', async () => {
      const response = await request(app)
        .put(`/api/horses/${testHorse.id}`)
        .set('Authorization', `Bearer ${validToken}`)
        .set('X-Test-Skip-Csrf', 'true')
        .send({
          age: '5', // String where number expected
          name: 123, // Number where string expected
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('JSON Parameter Pollution', () => {
    it('should reject duplicate keys in JSON payload', async () => {
      // Express typically takes last value for duplicate keys
      // We should validate and reject
      const maliciousPayload = '{"name":"ValidName","name":"HackedName"}';

      const response = await request(app)
        .put(`/api/horses/${testHorse.id}`)
        .set('Authorization', `Bearer ${validToken}`)
        .set('X-Test-Skip-Csrf', 'true')
        .set('Content-Type', 'application/json')
        .send(maliciousPayload)
        .expect(400);

      expect(response.body.success).toBe(false);

      // Verify horse was not modified
      const horse = await prisma.horse.findUnique({ where: { id: testHorse.id } });
      expect(horse.name).toBe(testHorse.name);
    });

    it('should reject nested parameter pollution', async () => {
      const response = await request(app)
        .put(`/api/horses/${testHorse.id}`)
        .set('Authorization', `Bearer ${validToken}`)
        .set('X-Test-Skip-Csrf', 'true')
        .send({
          name: 'ValidName',
          traits: {
            strength: 50,
            strength: 100, // Duplicate nested key
          },
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should reject prototype pollution attempts', async () => {
      const response = await request(app)
        .put(`/api/horses/${testHorse.id}`)
        .set('Authorization', `Bearer ${validToken}`)
        .set('X-Test-Skip-Csrf', 'true')
        .send({
          name: 'ValidName',
          __proto__: {
            isAdmin: true,
          },
        })
        .expect(400);

      expect(response.body.success).toBe(false);

      // Verify no prototype pollution occurred
      expect(testUser.isAdmin).toBeUndefined();
    });

    it('should reject constructor pollution attempts', async () => {
      const response = await request(app)
        .put(`/api/horses/${testHorse.id}`)
        .set('Authorization', `Bearer ${validToken}`)
        .set('X-Test-Skip-Csrf', 'true')
        .send({
          name: 'ValidName',
          constructor: {
            prototype: {
              isAdmin: true,
            },
          },
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should sanitize JSON keys with special characters', async () => {
      const response = await request(app)
        .put(`/api/horses/${testHorse.id}`)
        .set('Authorization', `Bearer ${validToken}`)
        .set('X-Test-Skip-Csrf', 'true')
        .send({
          'name<script>': 'HackedName',
          'color\x00': 'HackedColor',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Array Parameter Manipulation', () => {
    it('should reject oversized arrays in batch operations', async () => {
      const largeArray = Array(1001)
        .fill(1)
        .map((_, i) => i);

      const response = await request(app)
        .post('/api/horses/batch-update')
        .set('Authorization', `Bearer ${validToken}`)
        .set('X-Test-Skip-Csrf', 'true')
        .send({
          horseIds: largeArray,
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Too many');
    });

    it('should reject mixed-type arrays', async () => {
      const response = await request(app)
        .post('/api/horses/batch-update')
        .set('Authorization', `Bearer ${validToken}`)
        .set('X-Test-Skip-Csrf', 'true')
        .send({
          horseIds: [1, '2', null, undefined, {}, []],
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should reject negative indices in array parameters', async () => {
      const response = await request(app)
        .post('/api/horses/batch-update')
        .set('Authorization', `Bearer ${validToken}`)
        .set('X-Test-Skip-Csrf', 'true')
        .send({
          horseIds: [1, 2, -1], // Negative index
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should reject sparse arrays with undefined holes', async () => {
      const sparseArray = [1, , , 4]; // Has undefined holes

      const response = await request(app)
        .post('/api/horses/batch-update')
        .set('Authorization', `Bearer ${validToken}`)
        .set('X-Test-Skip-Csrf', 'true')
        .send({
          horseIds: sparseArray,
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should enforce maximum array nesting depth', async () => {
      const deeplyNested = [[[[[[[[[[1]]]]]]]]]]; // 10 levels deep

      const response = await request(app)
        .post('/api/horses/batch-update')
        .set('Authorization', `Bearer ${validToken}`)
        .set('X-Test-Skip-Csrf', 'true')
        .send({
          data: deeplyNested,
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('nested');
    });
  });

  describe('Query String Pollution', () => {
    it('should reject SQL injection in query parameters', async () => {
      const response = await request(app)
        .get(`/api/horses?breed=Thoroughbred' OR '1'='1`)
        .set('Authorization', `Bearer ${validToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should reject NoSQL injection in query parameters', async () => {
      const response = await request(app)
        .get('/api/horses?name[$ne]=null')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should reject encoded special characters in parameters', async () => {
      const response = await request(app)
        .get('/api/horses?name=%3Cscript%3Ealert(1)%3C/script%3E')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should reject null bytes in query strings', async () => {
      const response = await request(app)
        .get('/api/horses?name=Horse\x00Admin')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should enforce query string length limits', async () => {
      const longQuery = 'a'.repeat(10000);

      const response = await request(app)
        .get(`/api/horses?name=${longQuery}`)
        .set('Authorization', `Bearer ${validToken}`)
        .expect(414); // URI Too Long

      expect(response.body.success).toBe(false);
    });
  });

  describe('Content-Type Manipulation', () => {
    it('should reject mismatched Content-Type and body format', async () => {
      const response = await request(app)
        .put(`/api/horses/${testHorse.id}`)
        .set('Authorization', `Bearer ${validToken}`)
        .set('X-Test-Skip-Csrf', 'true')
        .set('Content-Type', 'application/json')
        .send('name=HackedName') // Form-urlencoded body with JSON content-type
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should reject Content-Type charset manipulation', async () => {
      const response = await request(app)
        .put(`/api/horses/${testHorse.id}`)
        .set('Authorization', `Bearer ${validToken}`)
        .set('X-Test-Skip-Csrf', 'true')
        .set('Content-Type', 'application/json; charset=utf-7')
        .send({ name: 'HackedName' })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should reject multipart/form-data without proper boundaries', async () => {
      const response = await request(app)
        .put(`/api/horses/${testHorse.id}`)
        .set('Authorization', `Bearer ${validToken}`)
        .set('X-Test-Skip-Csrf', 'true')
        .set('Content-Type', 'multipart/form-data')
        .send('name=HackedName') // sending plain string to avoid implicit boundary handling
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should accept only allowed Content-Types', async () => {
      const response = await request(app)
        .put(`/api/horses/${testHorse.id}`)
        .set('Authorization', `Bearer ${validToken}`)
        .set('X-Test-Skip-Csrf', 'true')
        .set('Content-Type', 'application/xml') // Not allowed
        .send('<name>HackedName</name>')
        .expect(415); // Unsupported Media Type

      expect(response.body.success).toBe(false);
    });
  });

  describe('Nested Object Pollution', () => {
    it('should reject excessive nesting depth', async () => {
      const deepObject = { a: { b: { c: { d: { e: { f: { g: { h: { i: { j: { k: 1 } } } } } } } } } } };

      const response = await request(app)
        .put(`/api/horses/${testHorse.id}`)
        .set('Authorization', `Bearer ${validToken}`)
        .set('X-Test-Skip-Csrf', 'true')
        .send(deepObject)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('nested');
    });

    it('should reject circular references in objects', async () => {
      const circularObj = { name: 'Horse' };
      circularObj.self = circularObj;

      const response = await request(app)
        .put(`/api/horses/${testHorse.id}`)
        .set('Authorization', `Bearer ${validToken}`)
        .set('X-Test-Skip-Csrf', 'true')
        .send(circularObj)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should sanitize nested object keys', async () => {
      const response = await request(app)
        .put(`/api/horses/${testHorse.id}`)
        .set('Authorization', `Bearer ${validToken}`)
        .set('X-Test-Skip-Csrf', 'true')
        .send({
          traits: {
            __proto__: { isAdmin: true },
            constructor: { prototype: { isAdmin: true } },
            strength: 50,
          },
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should reject objects with numeric string keys', async () => {
      const response = await request(app)
        .put(`/api/horses/${testHorse.id}`)
        .set('Authorization', `Bearer ${validToken}`)
        .set('X-Test-Skip-Csrf', 'true')
        .send({
          traits: {
            0: 'value1',
            1: 'value2',
          },
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Type Coercion Attacks', () => {
    it('should reject boolean as string', async () => {
      const response = await request(app)
        .put(`/api/horses/${testHorse.id}`)
        .set('Authorization', `Bearer ${validToken}`)
        .set('X-Test-Skip-Csrf', 'true')
        .send({
          name: true, // Boolean where string expected
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should reject object as number', async () => {
      const response = await request(app)
        .put(`/api/horses/${testHorse.id}`)
        .set('Authorization', `Bearer ${validToken}`)
        .set('X-Test-Skip-Csrf', 'true')
        .send({
          age: { value: 5 }, // Object where number expected
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should reject array as string', async () => {
      const response = await request(app)
        .put(`/api/horses/${testHorse.id}`)
        .set('Authorization', `Bearer ${validToken}`)
        .set('X-Test-Skip-Csrf', 'true')
        .send({
          name: ['H', 'o', 'r', 's', 'e'], // Array where string expected
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should reject numeric string with leading zeros', async () => {
      const response = await request(app)
        .put(`/api/horses/${testHorse.id}`)
        .set('Authorization', `Bearer ${validToken}`)
        .set('X-Test-Skip-Csrf', 'true')
        .send({
          age: '005', // Leading zeros
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should reject scientific notation where integers expected', async () => {
      const response = await request(app)
        .put(`/api/horses/${testHorse.id}`)
        .set('Authorization', `Bearer ${validToken}`)
        .set('X-Test-Skip-Csrf', 'true')
        .send({
          age: 5e1, // Scientific notation (50)
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should reject Infinity and NaN values', async () => {
      const response = await request(app)
        .put(`/api/horses/${testHorse.id}`)
        .set('Authorization', `Bearer ${validToken}`)
        .set('X-Test-Skip-Csrf', 'true')
        .send({
          age: Infinity,
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Mass Assignment Vulnerabilities', () => {
    it('should reject attempts to modify protected fields', async () => {
      const response = await request(app)
        .put(`/api/horses/${testHorse.id}`)
        .set('Authorization', `Bearer ${validToken}`)
        .set('X-Test-Skip-Csrf', 'true')
        .send({
          name: 'ValidName',
          userId: 99999, // Attempting to change owner
          id: 88888, // Attempting to change ID
        })
        .expect(400);

      expect(response.body.success).toBe(false);

      // Verify protected fields were not modified
      const horse = await prisma.horse.findUnique({ where: { id: testHorse.id } });
      expect(horse.userId).toBe(testUser.id);
      expect(horse.id).toBe(testHorse.id);
    });

    it('should reject attempts to set createdAt/updatedAt manually', async () => {
      const response = await request(app)
        .put(`/api/horses/${testHorse.id}`)
        .set('Authorization', `Bearer ${validToken}`)
        .set('X-Test-Skip-Csrf', 'true')
        .send({
          name: 'ValidName',
          createdAt: new Date('2020-01-01'),
          updatedAt: new Date('2020-01-01'),
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should only allow whitelisted fields in updates', async () => {
      const response = await request(app)
        .put(`/api/horses/${testHorse.id}`)
        .set('Authorization', `Bearer ${validToken}`)
        .set('X-Test-Skip-Csrf', 'true')
        .send({
          name: 'ValidName',
          unexpectedField: 'HackedValue',
          anotherBadField: 'AnotherHack',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('unexpected');
    });

    it('should reject attempts to add new fields', async () => {
      const response = await request(app)
        .put(`/api/horses/${testHorse.id}`)
        .set('Authorization', `Bearer ${validToken}`)
        .set('X-Test-Skip-Csrf', 'true')
        .send({
          name: 'ValidName',
          newCustomField: 'HackedValue',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Parameter Injection via Headers', () => {
    it('should reject parameter injection via custom headers', async () => {
      const response = await request(app)
        .get(`/api/horses/${testHorse.id}`)
        .set('Authorization', `Bearer ${validToken}`)
        .set('X-Horse-Id', '999') // Attempting to override ID via header
        .expect(200); // Should use URL param, not header

      expect(response.body.data.id).toBe(testHorse.id);
      expect(response.body.data.id).not.toBe(999);
    });

    it('should reject SQL injection in custom headers', async () => {
      const response = await request(app)
        .get('/api/horses')
        .set('Authorization', `Bearer ${validToken}`)
        .set('X-Filter-Breed', "' OR '1'='1")
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should reject malicious values in Accept header', async () => {
      const response = await request(app)
        .get(`/api/horses/${testHorse.id}`)
        .set('Authorization', `Bearer ${validToken}`)
        .set('Accept', 'text/html<script>alert(1)</script>')
        .expect(406); // Not Acceptable

      expect(response.body.success).toBe(false);
    });
  });

  describe('Race Condition via Parameter Timing', () => {
    it('should prevent race conditions in concurrent updates', async () => {
      const originalName = testHorse.name;

      // Send two concurrent update requests
      const [response1, response2] = await Promise.all([
        request(app)
          .put(`/api/horses/${testHorse.id}`)
          .set('Authorization', `Bearer ${validToken}`)
          .set('X-Test-Skip-Csrf', 'true')
          .send({ name: 'Update1' }),
        request(app)
          .put(`/api/horses/${testHorse.id}`)
          .set('Authorization', `Bearer ${validToken}`)
          .set('X-Test-Skip-Csrf', 'true')
          .send({ name: 'Update2' }),
      ]);

      // Both should succeed (200 OK) or gracefully conflict
      expect([200, 409, 400]).toContain(response1.status);
      expect([200, 409, 400]).toContain(response2.status);

      // Verify final state persisted without conflict
      const horse = await prisma.horse.findUnique({ where: { id: testHorse.id } });
      expect([originalName, 'Update1', 'Update2']).toContain(horse.name);
    });
  });
});
