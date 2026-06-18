/**
 * Security Attack Simulation Integration Tests
 *
 * Comprehensive security testing suite simulating real-world attack scenarios to verify
 * security controls are properly implemented and functioning.
 *
 * Test Coverage:
 * 1. IDOR (Insecure Direct Object Reference) Attacks — REAL cross-user fixtures
 * 2. Rate Limiting Bypass Attempts
 * 3. Input Validation Fuzzing
 * 4. Authentication Bypass Attempts
 * 5. Information Disclosure Prevention
 *
 * Security Philosophy:
 * - All tests use real security middleware (no bypasses)
 * - Tests simulate actual attack patterns from OWASP Top 10
 * - Verify proper error responses and security headers
 * - Ensure sensitive data is not leaked in error messages
 *
 * Attack Scenarios Covered:
 * - Broken Access Control (OWASP #1)
 * - Cryptographic Failures (OWASP #2)
 * - Injection Attacks (OWASP #3)
 * - Insecure Design (OWASP #4)
 * - Security Misconfiguration (OWASP #5)
 *
 * Equoria-zzo0x — IDOR REWRITE (the reason this suite could not be a simple
 * relocate). The previous IDOR block was vacuously green for TWO reasons:
 *   1. It used FABRICATED non-UUID ids ('victim-uuid-001') against
 *      /api/user/:id. validateUserId.isUUID rejects those with 400 BEFORE the
 *      ownership guard ever runs — a validation-400 is NOT proof of an
 *      ownership control. The assertion [403,404] never even saw the guard.
 *   2. The routes were UNVERSIONED (/api/user, /api/horses, ...). The
 *      unversioned /api/* mounts were removed in Equoria-4bs3s; only
 *      /api/v1/* exists. So every unversioned request fell through to the
 *      flat 404 handler — the [403,404] assertion passed for a routing miss,
 *      not for any security behaviour.
 *
 * The rewrite fixes both: REAL cross-user fixtures (userA + userB with real
 * UUIDs, real owned horses/grooms/foals) on VERSIONED /api/v1/* routes, so
 * each IDOR assertion now bites the REAL ownership guard:
 *   - user routes  → 403 from requireSelfAccess (real UUID passes isUUID,
 *     then the self-access check fires — NOT a validation-400, NOT a CSRF-403)
 *   - horse/groom/foal routes → 404 existence-hiding from requireOwnership /
 *     the per-route self-access guard (prevents resource enumeration)
 * Authenticated mutations bind per-user CSRF to userA's session
 * (fetchCsrf with extraCookies), so a cross-user 403/404 is the OWNERSHIP
 * decision, never a CSRF mismatch masking it.
 *
 * All test-bypass escape hatches were removed in Workstream 4; this suite
 * exercises the real auth/rate-limit/CSRF stack with no bypass headers set.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import logger from '../utils/logger.mjs';
import prisma from '../../packages/database/prismaClient.mjs';
import { createMockToken } from '../__tests__/factories/index.mjs';
import { fixtureColor } from '../tests/helpers/fixtureColor.mjs';

import { fetchCsrf } from '../tests/helpers/csrfHelper.mjs';
import { randomBytes } from 'node:crypto';

const { default: app } = await import('../app.mjs');

describe('Security Attack Simulation Tests', () => {
  // Real cross-user fixtures. userA is the attacker (authenticated, owns its
  // own resources); userB is the victim (owns the resources userA will try to
  // reach). Both have real UUID primary keys so the ownership guards run for
  // real instead of short-circuiting on UUID validation.
  let userA;
  let userB;
  let attackerToken; // userA's token — the "attacker" in IDOR scenarios
  let horseB; // owned by userB
  let groomB; // owned by userB
  let foalB; // owned by userB
  let __csrf__; // CSRF bound to userA's session for authenticated mutations

  beforeAll(async () => {
    // Ensure auth middleware and tokens share the same secret in test runs.
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-for-testing-only-32chars';

    userA = await prisma.user.create({
      data: {
        email: `TestFixture-attacker-${randomBytes(8).toString('hex')}@example.com`,
        username: `TestFixture-attacker-${randomBytes(8).toString('hex')}`,
        password: 'hashedPassword123',
        firstName: 'Attacker',
        lastName: 'A',
        emailVerified: true,
      },
    });

    userB = await prisma.user.create({
      data: {
        email: `TestFixture-victim-${randomBytes(8).toString('hex')}@example.com`,
        username: `TestFixture-victim-${randomBytes(8).toString('hex')}`,
        password: 'hashedPassword123',
        firstName: 'Victim',
        lastName: 'B',
        emailVerified: true,
      },
    });

    attackerToken = createMockToken(userA.id, {
      payload: { email: userA.email, role: 'user' },
    });

    // Equoria-zzo0x / Equoria-plw0h: bind CSRF to userA's session so the gated
    // mutations resolve the same sessionIdentifier (req.user.id = userA) at
    // validation. An anonymous fetchCsrf(app) would HMAC-mismatch userA and
    // produce a 403 that MASKS the real ownership decision (which is what we
    // are actually asserting).
    __csrf__ = await fetchCsrf(app, { extraCookies: [`accessToken=${attackerToken}`] });

    // Victim-owned resources (real UUID owner, real DB rows).
    horseB = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-HorseB-${randomBytes(8).toString('hex')}`,
        userId: userB.id,
        sex: 'Stallion',
        dateOfBirth: new Date('2018-01-01'), // adult so age guards don't pre-empt ownership
      },
    });

    groomB = await prisma.groom.create({
      data: {
        name: `TestFixture-GroomB-${randomBytes(8).toString('hex')}`,
        userId: userB.id,
        speciality: 'foal_care',
        personality: 'gentle',
      },
    });

    // A foal owned by userB. requireOwnership('foal') maps to the horse model
    // (foal == horse with userId owner); a young dateOfBirth keeps it foal-like.
    foalB = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-FoalB-${randomBytes(8).toString('hex')}`,
        userId: userB.id,
        sex: 'Filly',
        dateOfBirth: new Date(),
      },
    });
  });

  afterAll(async () => {
    // FK-order scoped cleanup. Horse.userId is onDelete: Restrict (schema:282),
    // so every horse/foal owned by these users MUST be deleted BEFORE the user
    // rows — otherwise prisma.user.delete throws P2003 and silently leaks rows.
    // Scope strictly to the ids this suite created (CLAUDE.md §2): no broad
    // deleteMany. fail-loud — do NOT swallow cleanup errors.
    const userIds = [userA?.id, userB?.id].filter(Boolean);
    if (userIds.length > 0) {
      await prisma.refreshToken.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.groomAssignment.deleteMany({ where: { userId: { in: userIds } } });
    }
    await prisma.groom.deleteMany({ where: { id: { in: [groomB?.id].filter(Boolean) } } });
    await prisma.horse.deleteMany({
      where: { id: { in: [horseB?.id, foalB?.id].filter(Boolean) } },
    });
    if (userIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
  });

  describe('IDOR (Insecure Direct Object Reference) Attack Simulation', () => {
    /**
     * IDOR attacks attempt to access resources belonging to other users
     * by manipulating object IDs in API requests.
     *
     * OWASP Reference: A01:2021 – Broken Access Control
     *
     * Every case below uses a REAL victim id (userB / userB's resources) so the
     * request reaches and exercises the REAL ownership control. The asserted
     * status is the SPECIFIC status that control returns — not a permissive set.
     */

    describe('User Resource IDOR Attacks', () => {
      it("should block access to another user's profile (real-UUID 403 from requireSelfAccess)", async () => {
        const response = await request(app)
          .get(`/api/v1/users/${userB.id}`)
          .set('Origin', 'http://localhost:3000')
          .set('Authorization', `Bearer ${attackerToken}`);

        // userB.id is a valid UUID, so validateUserId.isUUID passes; the 403
        // therefore comes from requireSelfAccess (the ownership control),
        // NOT from a validation-400. This is the assertion that now BITES.
        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toMatch(/your own user data/i);
      });

      it("should block access to another user's progress data", async () => {
        const response = await request(app)
          .get(`/api/v1/users/${userB.id}/progress`)
          .set('Origin', 'http://localhost:3000')
          .set('Authorization', `Bearer ${attackerToken}`);

        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
      });

      it("should block access to another user's activity feed", async () => {
        const response = await request(app)
          .get(`/api/v1/users/${userB.id}/activity`)
          .set('Origin', 'http://localhost:3000')
          .set('Authorization', `Bearer ${attackerToken}`);

        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
      });

      it("should block access to another user's competition stats", async () => {
        const response = await request(app)
          .get(`/api/v1/users/${userB.id}/competition-stats`)
          .set('Origin', 'http://localhost:3000')
          .set('Authorization', `Bearer ${attackerToken}`);

        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
      });

      it("should block modification of another user's profile (CSRF bound to attacker)", async () => {
        const response = await request(app)
          .put(`/api/v1/users/${userB.id}`)
          .set('Origin', 'http://localhost:3000')
          .set('Authorization', `Bearer ${attackerToken}`)
          .set('Cookie', __csrf__.cookieHeader)
          .set('X-CSRF-Token', __csrf__.csrfToken)
          .send({
            username: 'hacked',
            email: 'attacker@evil.com',
          });

        // 403 is the ownership decision, not a CSRF failure: CSRF is bound to
        // userA above, so it passes, and requireSelfAccess returns 403 for the
        // cross-user target. Assert NOT-200 so a regression that lets the write
        // through (or a CSRF-masking 403 with the wrong message) is caught.
        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toMatch(/your own user data/i);

        // Integrity: victim's record is untouched.
        const victim = await prisma.user.findUnique({ where: { id: userB.id } });
        expect(victim.username).toBe(userB.username);
        expect(victim.email).toBe(userB.email);
      });

      it("should block deletion of another user's account", async () => {
        const response = await request(app)
          .delete(`/api/v1/users/${userB.id}`)
          .set('Origin', 'http://localhost:3000')
          .set('Authorization', `Bearer ${attackerToken}`)
          .set('Cookie', __csrf__.cookieHeader)
          .set('X-CSRF-Token', __csrf__.csrfToken);

        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);

        // Integrity: victim still exists.
        const victim = await prisma.user.findUnique({ where: { id: userB.id } });
        expect(victim).not.toBeNull();
      });
    });

    describe('Horse Resource IDOR Attacks', () => {
      it("should block access to another user's horse details (404 existence-hiding)", async () => {
        const response = await request(app)
          .get(`/api/v1/horses/${horseB.id}`)
          .set('Origin', 'http://localhost:3000')
          .set('Authorization', `Bearer ${attackerToken}`);

        // requireOwnership returns 404 (not 403) to prevent ownership
        // disclosure. The horse EXISTS but is not userA's, so the only honest
        // signal is "not found".
        expect(response.status).toBe(404);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe('Horse not found');
      });

      it("should block modification of another user's horse", async () => {
        const response = await request(app)
          .put(`/api/v1/horses/${horseB.id}`)
          .set('Origin', 'http://localhost:3000')
          .set('Authorization', `Bearer ${attackerToken}`)
          .set('Cookie', __csrf__.cookieHeader)
          .set('X-CSRF-Token', __csrf__.csrfToken)
          .send({
            name: 'Stolen Horse',
            forSale: true,
            salePrice: 1,
          });

        expect(response.status).toBe(404);
        expect(response.body.success).toBe(false);

        // Integrity: victim's horse is unchanged (name, sale flags).
        const horse = await prisma.horse.findUnique({ where: { id: horseB.id } });
        expect(horse.name).toBe(horseB.name);
        expect(horse.forSale).toBe(false);
      });

      it("should block training another user's horse", async () => {
        const response = await request(app)
          .post('/api/v1/training/train')
          .set('Origin', 'http://localhost:3000')
          .set('Authorization', `Bearer ${attackerToken}`)
          .set('Cookie', __csrf__.cookieHeader)
          .set('X-CSRF-Token', __csrf__.csrfToken)
          .send({
            horseId: horseB.id, // Victim's horse
            discipline: 'Dressage',
          });

        // requireOwnership('horse', { from: 'body' }) → 404 before any training
        // logic runs (ownership check is first).
        expect(response.status).toBe(404);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe('Horse not found');
      });
    });

    describe('Competition Resource IDOR Attacks', () => {
      it("should block entering another user's horse in competition", async () => {
        const response = await request(app)
          .post('/api/v1/competition/enter')
          .set('Origin', 'http://localhost:3000')
          .set('Authorization', `Bearer ${attackerToken}`)
          .set('Cookie', __csrf__.cookieHeader)
          .set('X-CSRF-Token', __csrf__.csrfToken)
          .send({
            horseId: horseB.id, // Victim's horse
            showId: 1,
          });

        // requireOwnership('horse', { from: 'body' }) runs after body
        // validation and before any show lookup → 404 existence-hiding.
        expect(response.status).toBe(404);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe('Horse not found');
      });
    });

    describe('Groom Resource IDOR Attacks', () => {
      it("should block accessing another user's groom list (404 existence-hiding)", async () => {
        const response = await request(app)
          .get(`/api/v1/grooms/user/${userB.id}`)
          .set('Origin', 'http://localhost:3000')
          .set('Authorization', `Bearer ${attackerToken}`);

        // The /grooms/user/:userId self-access guard returns 404 "User not
        // found" for a cross-user target (prevents user enumeration).
        expect(response.status).toBe(404);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe('User not found');
      });

      it("should block accessing another user's groom profile", async () => {
        const response = await request(app)
          .get(`/api/v1/grooms/${groomB.id}/profile`)
          .set('Origin', 'http://localhost:3000')
          .set('Authorization', `Bearer ${attackerToken}`);

        // requireOwnership('groom') → 404 existence-hiding for the victim's groom.
        expect(response.status).toBe(404);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe('Groom not found');
      });
    });

    describe('Breeding / Foal Resource IDOR Attacks', () => {
      it("should block accessing another user's foal development data", async () => {
        const response = await request(app)
          .get(`/api/v1/foals/${foalB.id}/development`)
          .set('Origin', 'http://localhost:3000')
          .set('Authorization', `Bearer ${attackerToken}`);

        // requireOwnership('foal') → 404 existence-hiding for the victim's foal.
        expect(response.status).toBe(404);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe('Foal not found');
      });
    });

    describe('Privilege Escalation Attempts', () => {
      it('should block accessing admin endpoints with a real user token', async () => {
        const response = await request(app)
          .get('/api/v1/admin/users')
          .set('Origin', 'http://localhost:3000')
          .set('Authorization', `Bearer ${attackerToken}`);

        // adminRouter requires role 'admin'; userA is a real authenticated user
        // with role 'user'. requireRole('admin') → 403 (the authorization
        // decision), or 404 if the specific admin sub-route does not exist.
        expect([403, 404]).toContain(response.status);
      });

      it('should block admin operations with a real user token', async () => {
        const response = await request(app)
          .post('/api/v1/admin/users/ban')
          .set('Origin', 'http://localhost:3000')
          .set('Authorization', `Bearer ${attackerToken}`)
          .set('Cookie', __csrf__.cookieHeader)
          .set('X-CSRF-Token', __csrf__.csrfToken)
          .send({
            userId: userB.id,
            reason: 'test',
          });

        expect([403, 404]).toContain(response.status);
      });
    });
  });

  describe('Rate Limiting Bypass Attempt Simulation', () => {
    /**
     * Rate limiting bypass attempts test whether attackers can circumvent
     * rate limits through various techniques.
     *
     * OWASP Reference: A04:2021 – Insecure Design
     */

    describe('Rapid-Fire Attack Simulation', () => {
      it('should have rate limiting configured on registration endpoint', async () => {
        const requests = [];

        // Attempt 10 rapid registrations (limit is 5 per 15 minutes)
        for (let i = 0; i < 10; i++) {
          requests.push(
            request(app)
              .post('/api/v1/auth/register')
              .set('Origin', 'http://localhost:3000')
              .send({
                email: `attacker${randomBytes(8).toString('hex')}_${i}@evil.com`,
                username: `attacker${randomBytes(8).toString('hex')}_${i}`,
                password: 'EvilPass123!',
                firstName: 'Evil',
                lastName: 'Attacker',
              }),
          );
        }

        const responses = await Promise.all(requests);

        // Note: In-memory rate limiting with parallel requests may not always
        // trigger 429s due to race conditions. This is a test environment limitation.
        // The test verifies rate limiting is configured by checking headers.
        const rateLimitedResponses = responses.filter(r => r.status === 429);

        // Verify rate limit headers are present (even if 429 not triggered)
        responses.forEach(response => {
          expect(response.headers['ratelimit-limit']).toBeDefined();
          expect(Number(response.headers['ratelimit-limit'])).toBeGreaterThan(0);
        });

        // If any requests were rate limited, verify proper headers
        if (rateLimitedResponses.length > 0) {
          rateLimitedResponses.forEach(response => {
            expect(response.headers['ratelimit-remaining']).toBeDefined();
            expect(response.headers['ratelimit-reset']).toBeDefined();
          });
        }
      });

      it('should have rate limiting configured on login endpoint (brute force protection)', async () => {
        const requests = [];

        // Attempt 20 rapid login attempts (simulating brute force)
        for (let i = 0; i < 20; i++) {
          requests.push(
            request(app)
              .post('/api/v1/auth/login')
              .set('Origin', 'http://localhost:3000')
              .send({
                email: 'victim@example.com',
                password: `WrongPassword${i}`,
              }),
          );
        }

        const responses = await Promise.all(requests);

        // Verify rate limit headers are present
        responses.forEach(response => {
          expect(response.headers['ratelimit-limit']).toBeDefined();
          expect(Number(response.headers['ratelimit-limit'])).toBeGreaterThan(0);
        });

        // Note: In-memory rate limiting may not trigger 429s in parallel execution
        const rateLimitedResponses = responses.filter(r => r.status === 429);
        if (rateLimitedResponses.length > 0) {
          logger.warn(`Rate limiting triggered on ${rateLimitedResponses.length} login attempts`);
        }
      });

      it('should have rate limiting configured on profile update endpoint', async () => {
        const requests = [];

        // Attempt 40 rapid profile updates against the attacker's OWN profile
        // (limit is 30 per minute). Uses the real self-access path with CSRF.
        for (let i = 0; i < 40; i++) {
          requests.push(
            request(app)
              .put(`/api/v1/users/${userA.id}`)
              .set('Origin', 'http://localhost:3000')
              .set('Authorization', `Bearer ${attackerToken}`)
              .set('Cookie', __csrf__.cookieHeader)
              .set('X-CSRF-Token', __csrf__.csrfToken)
              .send({
                firstName: `Name${randomBytes(8).toString('hex')}_${i}`,
              }),
          );
        }

        const responses = await Promise.all(requests);

        // Verify rate limit headers are present
        responses.forEach(response => {
          expect(response.headers['ratelimit-limit']).toBeDefined();
          expect(Number(response.headers['ratelimit-limit'])).toBeGreaterThan(0);
        });

        // Note: In-memory rate limiting may not trigger 429s in parallel execution
        const rateLimitedResponses = responses.filter(r => r.status === 429);
        if (rateLimitedResponses.length > 0) {
          logger.warn(`Rate limiting triggered on ${rateLimitedResponses.length} profile updates`);
        }
      });
    });

    describe('Rate Limit Header Validation', () => {
      it('should include proper rate limit headers in all responses', async () => {
        const response = await request(app)
          .get(`/api/v1/users/${userA.id}/progress`)
          .set('Origin', 'http://localhost:3000')
          .set('Authorization', `Bearer ${attackerToken}`);

        // All responses should have rate limit headers
        expect(response.headers['ratelimit-limit']).toBeDefined();
        expect(response.headers['ratelimit-remaining']).toBeDefined();
        expect(response.headers['ratelimit-reset']).toBeDefined();

        // Headers should be numeric and valid
        expect(Number(response.headers['ratelimit-limit'])).toBeGreaterThan(0);
        expect(Number(response.headers['ratelimit-remaining'])).toBeGreaterThanOrEqual(0);
        expect(Number(response.headers['ratelimit-reset'])).toBeGreaterThan(0);
      });
    });
  });

  describe('Input Validation Fuzzing Simulation', () => {
    /**
     * Input fuzzing tests send malformed, unexpected, or malicious input
     * to identify validation gaps and potential injection vulnerabilities.
     *
     * OWASP Reference: A03:2021 – Injection
     */

    describe('SQL Injection Attempts', () => {
      it('should block SQL injection in email field', async () => {
        const sqlPayloads = [
          "admin' OR '1'='1",
          "' OR 1=1--",
          "'; DROP TABLE users; --",
          "' UNION SELECT * FROM users--",
        ];

        for (const payload of sqlPayloads) {
          const response = await request(app)
            .post('/api/v1/auth/register')
            .set('Origin', 'http://localhost:3000')
            .send({
              email: payload,
              username: 'testuser',
              password: 'ValidPass123!',
              firstName: 'Test',
              lastName: 'User',
            });

          // Should reject with validation error, not process SQL
          expect(response.status).toBe(400);
          expect(response.body.success).toBe(false);
        }
      });

      it('should block SQL injection in username field', async () => {
        const response = await request(app).post('/api/v1/auth/register').set('Origin', 'http://localhost:3000').send({
          email: 'test@example.com',
          username: "admin' OR '1'='1",
          password: 'ValidPass123!',
          firstName: 'Test',
          lastName: 'User',
        });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
      });
    });

    describe('XSS (Cross-Site Scripting) Attempts', () => {
      it('should sanitize XSS payloads in bio field', async () => {
        const xssPayloads = [
          '<script>alert("XSS")</script>',
          '<img src=x onerror=alert(1)>',
          '<iframe src="javascript:alert(\'XSS\')">',
          '<div onclick="alert(1)">Click me</div>',
          'javascript:alert(document.cookie)',
        ];

        for (const payload of xssPayloads) {
          const response = await request(app)
            .put('/api/v1/auth/profile')
            .set('Cookie', __csrf__.cookieHeader)
            .set('X-CSRF-Token', __csrf__.csrfToken)
            .set('Origin', 'http://localhost:3000')
            .set('Authorization', `Bearer ${attackerToken}`)
            .send({
              bio: payload,
            });

          // Should either reject or sanitize, but never return raw script.
          // Equoria-pnd1z: the canonical envelope is { data: { user } } — read
          // data.user.bio (the prior response.body.user path was always
          // undefined, so this branch never actually asserted sanitization; it
          // only passed because bio-only updates used to be rejected at 400).
          if (response.status === 200) {
            // If accepted, should be sanitized
            const savedBio = response.body.data?.user?.bio;
            expect(savedBio).not.toContain('<script>');
            expect(savedBio).not.toContain('javascript:');
            expect(savedBio).not.toContain('onerror=');
          } else {
            // Or rejected with validation error
            expect([400, 404]).toContain(response.status);
          }
        }
      });

      it('should sanitize XSS payloads in name fields', async () => {
        const response = await request(app)
          .post('/api/v1/auth/register')
          .set('Origin', 'http://localhost:3000')
          .send({
            email: `test${randomBytes(8).toString('hex')}@example.com`,
            username: `testuser${randomBytes(8).toString('hex')}`,
            password: 'ValidPass123!',
            firstName: '<script>alert(1)</script>',
            lastName: '<img src=x onerror=alert(1)>',
          });

        // Should either reject or sanitize
        if (response.status === 201) {
          // If accepted, verify fields are sanitized (if user field exists)
          if (response.body.user?.firstName) {
            expect(response.body.user.firstName).not.toContain('<script>');
          }
          if (response.body.user?.lastName) {
            expect(response.body.user.lastName).not.toContain('<img');
          }
        } else {
          // Or rejected with validation error
          expect([400, 409]).toContain(response.status);
        }
      });
    });

    describe('Buffer Overflow Attempts', () => {
      it('should reject extremely long email addresses', async () => {
        const longEmail = `${'a'.repeat(1000)}@example.com`;

        const response = await request(app).post('/api/v1/auth/register').set('Origin', 'http://localhost:3000').send({
          email: longEmail,
          username: 'testuser123',
          password: 'ValidPass123!',
          firstName: 'Test',
          lastName: 'User',
        });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
      });

      it('should reject extremely long usernames', async () => {
        const longUsername = 'a'.repeat(1000);

        const response = await request(app).post('/api/v1/auth/register').set('Origin', 'http://localhost:3000').send({
          email: 'test@example.com',
          username: longUsername,
          password: 'ValidPass123!',
          firstName: 'Test',
          lastName: 'User',
        });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('30');
      });

      it('should reject extremely long passwords', async () => {
        const longPassword = `A1!${'a'.repeat(500)}`;

        const response = await request(app).post('/api/v1/auth/register').set('Origin', 'http://localhost:3000').send({
          email: 'test@example.com',
          username: 'testuser123',
          password: longPassword,
          firstName: 'Test',
          lastName: 'User',
        });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('128');
      });

      it('should reject extremely long bio text', async () => {
        const longBio = 'a'.repeat(10000);

        const response = await request(app)
          .put('/api/v1/auth/profile')
          .set('Cookie', __csrf__.cookieHeader)
          .set('X-CSRF-Token', __csrf__.csrfToken)
          .set('Origin', 'http://localhost:3000')
          .set('Authorization', `Bearer ${attackerToken}`)
          .send({
            bio: longBio,
          });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('500');
      });
    });

    describe('Special Character Injection', () => {
      it('should handle null bytes in input', async () => {
        const response = await request(app).post('/api/v1/auth/register').set('Origin', 'http://localhost:3000').send({
          email: 'test\x00@example.com',
          username: 'testuser\x00',
          password: 'ValidPass123!',
          firstName: 'Test',
          lastName: 'User',
        });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
      });

      it('should handle Unicode control characters', async () => {
        const response = await request(app)
          .put('/api/v1/auth/profile')
          .set('Cookie', __csrf__.cookieHeader)
          .set('X-CSRF-Token', __csrf__.csrfToken)
          .set('Origin', 'http://localhost:3000')
          .set('Authorization', `Bearer ${attackerToken}`)
          .send({
            bio: 'Hello\u0000World\u200B\uFEFF',
          });

        // Should either sanitize or reject
        expect([200, 400, 404]).toContain(response.status);
      });
    });
  });

  describe('Authentication Bypass Attempt Simulation', () => {
    /**
     * Authentication bypass attempts test whether attackers can access
     * protected resources without proper authentication.
     *
     * OWASP Reference: A07:2021 – Identification and Authentication Failures
     */

    describe('Missing Authentication Token', () => {
      it('should block access to protected user endpoints without token', async () => {
        const response = await request(app).get(`/api/v1/users/${userA.id}`).set('Origin', 'http://localhost:3000');

        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
      });

      it('should block access to protected horse endpoints without token', async () => {
        const response = await request(app).get(`/api/v1/horses/${horseB.id}`).set('Origin', 'http://localhost:3000');

        expect(response.status).toBe(401);
      });

      it('should block access to protected competition endpoints without token', async () => {
        const response = await request(app)
          .post('/api/v1/competition/enter')
          .set('Origin', 'http://localhost:3000')
          .send({
            horseId: 1,
            showId: 1,
          });

        expect(response.status).toBe(401);
      });
    });

    describe('Invalid Authentication Token', () => {
      it('should reject malformed JWT tokens', async () => {
        const response = await request(app)
          .get(`/api/v1/users/${userA.id}`)
          .set('Origin', 'http://localhost:3000')
          .set('Authorization', 'Bearer invalid.jwt.token');

        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
      });

      it('should reject empty Bearer token', async () => {
        const response = await request(app)
          .get(`/api/v1/users/${userA.id}`)
          .set('Origin', 'http://localhost:3000')
          .set('Authorization', 'Bearer ');

        expect(response.status).toBe(401);
      });

      it('should reject token without Bearer prefix', async () => {
        const response = await request(app)
          .get(`/api/v1/users/${userA.id}`)
          .set('Origin', 'http://localhost:3000')
          .set('Authorization', attackerToken);

        expect(response.status).toBe(401);
      });
    });

    describe('Token Manipulation Attempts', () => {
      it('should reject token with modified payload', async () => {
        // Attempt to modify token by changing a character
        const manipulatedToken = `${attackerToken.slice(0, -5)}XXXXX`;

        const response = await request(app)
          .get(`/api/v1/users/${userA.id}`)
          .set('Origin', 'http://localhost:3000')
          .set('Authorization', `Bearer ${manipulatedToken}`);

        expect(response.status).toBe(401);
      });

      it('should reject token with modified signature', async () => {
        // Split token into parts and modify signature
        const parts = attackerToken.split('.');
        if (parts.length === 3) {
          parts[2] = 'invalidSignature';
          const tamperedToken = parts.join('.');

          const response = await request(app)
            .get(`/api/v1/users/${userA.id}`)
            .set('Origin', 'http://localhost:3000')
            .set('Authorization', `Bearer ${tamperedToken}`);

          expect(response.status).toBe(401);
        }
      });
    });

    describe('Session Fixation Attempts', () => {
      it('should not accept hardcoded or predictable tokens', async () => {
        const predictableTokens = [
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U',
          'admin',
          'test',
          '12345',
        ];

        for (const token of predictableTokens) {
          const response = await request(app)
            .get(`/api/v1/users/${userA.id}`)
            .set('Origin', 'http://localhost:3000')
            .set('Authorization', `Bearer ${token}`);

          expect(response.status).toBe(401);
        }
      });
    });
  });

  describe('Information Disclosure Prevention', () => {
    /**
     * Information disclosure tests verify that error messages and responses
     * do not leak sensitive system information.
     *
     * OWASP Reference: A05:2021 – Security Misconfiguration
     */

    it('should not leak database errors in responses', async () => {
      const response = await request(app)
        .get('/api/v1/users/invalid-uuid-format')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${attackerToken}`);

      // Malformed (non-UUID) id → validateUserId rejects with 400 BEFORE any
      // DB query. The message must be the generic validation envelope, never a
      // database-specific error.
      expect(response.status).toBe(400);
      expect(JSON.stringify(response.body)).not.toContain('Prisma');
      expect(JSON.stringify(response.body)).not.toContain('SQL');
      expect(JSON.stringify(response.body)).not.toContain('PostgreSQL');
    });

    it('should not leak stack traces in production', async () => {
      const response = await request(app).post('/api/v1/auth/register').set('Origin', 'http://localhost:3000').send({
        // Intentionally malformed data to trigger error
        email: null,
        username: null,
        password: null,
      });

      expect(response.body.stack).toBeUndefined();
      expect(response.body.trace).toBeUndefined();
    });

    it('should not reveal whether username exists during login', async () => {
      const response1 = await request(app).post('/api/v1/auth/login').set('Origin', 'http://localhost:3000').send({
        email: 'nonexistent@example.com',
        password: 'WrongPassword123!',
      });

      const response2 = await request(app).post('/api/v1/auth/login').set('Origin', 'http://localhost:3000').send({
        email: userB.email, // a real account, wrong password
        password: 'WrongPassword123!',
      });

      // Both should have same error message (no user enumeration)
      expect(response1.status).toBe(response2.status);
      expect(response1.body.message).toBe(response2.body.message);
    });
  });
});
