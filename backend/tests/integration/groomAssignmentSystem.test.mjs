/**
 * Enhanced Groom Assignment System Integration Tests
 * Tests the advanced groom-horse assignment management system
 */

import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../app.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../helpers/authHelper.mjs';

import { fetchCsrf } from '../helpers/csrfHelper.mjs';
import { createCleanupTracker } from '../../__tests__/helpers/failLoudCleanup.mjs';
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../helpers/fixtureColor.mjs';
import { testHorseData } from '../../__tests__/helpers/createTestHorse.mjs';
import { birthDateForAge } from '../../utils/horseAge.mjs';

describe('Enhanced Groom Assignment System Integration Tests', () => {
  // Equoria-2gqir: per-user CSRF (Equoria-plw0h) — the CSRF token MUST be
  // bound to the same user the mutation authenticates as, so it is fetched
  // AFTER testUser exists (in the user-setup beforeAll below) with that
  // user's accessToken cookie. Declared here, populated there.
  let __csrf__;

  let authToken;
  let testUser;
  let testGroom1;
  let testHorse1;
  let testHorse2;
  // Equoria-jjzem: randomize fixture identifiers so a crashed prior run's
  // partial cleanup cannot collide with the next run's beforeAll on the
  // User.username / User.email unique constraints. Cleanup scopes by
  // `startsWith: 'TestFixture-jjzem-'` to catch any stale rows.
  const suffix = randomBytes(6).toString('hex');
  const username = `TestFixture-jjzem-assignment-${suffix}`;
  const email = `testfixture-jjzem-assignment-${suffix}@example.com`;

  beforeAll(async () => {
    // Sweep any stale TestFixture-jjzem- rows from crashed prior runs
    const staleUsers = await prisma.user.findMany({
      where: { username: { startsWith: 'TestFixture-jjzem-assignment-' } },
      select: { id: true },
    });
    if (staleUsers.length > 0) {
      const staleIds = staleUsers.map(u => u.id);
      await prisma.groomAssignment.deleteMany({ where: { userId: { in: staleIds } } });
      await prisma.groom.deleteMany({ where: { userId: { in: staleIds } } });
      await prisma.horse.deleteMany({ where: { userId: { in: staleIds } } });
      await prisma.user.deleteMany({ where: { id: { in: staleIds } } });
    }

    // Create test user
    testUser = await prisma.user.create({
      data: {
        emailVerified: true,
        username,
        email,
        password: 'hashedpassword',
        firstName: 'Assignment',
        lastName: 'TestUser',
        money: 10000,
      },
    });

    authToken = generateTestToken({ id: testUser.id, username: testUser.username });

    // Bind the CSRF token to this user (per-user CSRF, Equoria-plw0h).
    __csrf__ = await fetchCsrf(app, { extraCookies: [`accessToken=${authToken}`] });

    // Create test horses
    testHorse1 = await prisma.horse.create({
      data: await testHorseData(prisma, {
        ...fixtureColor(),
        name: 'Assignment Test Horse 1',
        sex: 'Stallion',
        dateOfBirth: birthDateForAge(1), // 1 game year old
        userId: testUser.id,
        bondScore: 30,
      }),
    });

    testHorse2 = await prisma.horse.create({
      data: await testHorseData(prisma, {
        ...fixtureColor(),
        name: 'Assignment Test Horse 2',
        sex: 'Mare',
        dateOfBirth: birthDateForAge(2), // 2 game years old
        userId: testUser.id,
        bondScore: 45,
      }),
    });

    // Create test grooms
    testGroom1 = await prisma.groom.create({
      data: {
        name: 'Assignment Test Groom 1',
        userId: testUser.id,
        speciality: 'foalCare',
        skillLevel: 'intermediate',
        personality: 'gentle',
        experience: 5,
        sessionRate: 25.0,
        bio: 'Test groom for assignment system',
      },
    });
  });

  // Equoria-enles: reset MUTABLE assignment state between tests so the suite
  // is order-independent. The fixture ROWS (user, horse, testGroom1) survive
  // across tests for performance (testGroom2 went with the removed /validate
  // case, Equoria-a7f1p q151); what gets wiped is
  // the groomAssignment table for THIS user. Previously, tests in section
  // 1 (Assignment Creation) created assignments that section 6 (Assignment
  // Removal) later deleted, with sections 2-5 silently depending on
  // section 1's assignments being present. A future jest reordering would
  // fail those silent dependencies. Each test that needs a pre-existing
  // assignment now creates it inside its own it()-body. Tests that ONLY
  // care about creating/listing assignments don't need any pre-state.
  beforeEach(async () => {
    if (testUser?.id) {
      await prisma.groomAssignment
        .deleteMany({ where: { userId: testUser.id } })
        .catch(err => console.warn(`[cleanup] ${err.message}`));
    }
  });

  afterAll(async () => {
    // FK-ordered, scoped, fail-loud teardown (Equoria-2gqir, mirrors rnbzn).
    //
    // Order: groomAssignment → groom → horse → user.
    //   - Horse.userId is onDelete: Restrict, so the user CANNOT be deleted
    //     while it owns a horse → delete the user's horse(s) BEFORE the user.
    //   - grooms.userId is onDelete: SET NULL; delete grooms (and the
    //     assignments that FK to them) explicitly, scoped to userId.
    //   - This suite creates the user via a direct prisma.user.create (no
    //     register-flow starter horse), so the only horses are the suite's own.
    //
    // createCleanupTracker runs every task even if one throws, then throws ONE
    // aggregated error so a leak into the canonical DB (CLAUDE.md §2) fails the
    // suite loudly instead of resolving quietly.
    const cleanup = createCleanupTracker();
    cleanup.add(() => {
      if (testUser?.id) {
        return prisma.groomAssignment.deleteMany({ where: { userId: testUser.id } });
      }
    }, 'testUser groom assignments');
    cleanup.add(() => {
      if (testUser?.id) {
        return prisma.groom.deleteMany({ where: { userId: testUser.id } });
      }
    }, 'testUser grooms');
    cleanup.add(() => {
      if (testUser?.id) {
        return prisma.horse.deleteMany({ where: { userId: testUser.id } });
      }
    }, 'testUser horses');
    cleanup.add(() => {
      if (testUser?.id) {
        return prisma.user.deleteMany({ where: { id: testUser.id } });
      }
    }, 'testUser');
    await cleanup.run();
  });

  describe('1. Assignment Creation', () => {
    // Owner ruling 2026-10-28 (Equoria-ekrab): an assignment has no priority
    // level and no notes. Old contract: the request carried both and the
    // assignment stored and returned them.
    it('should create a new groom assignment, with no priority level or notes', async () => {
      const assignmentData = {
        groomId: testGroom1.id,
        horseId: testHorse1.id,
      };

      const response = await request(app)
        .post('/api/v1/groom-assignments')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send(assignmentData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('assignment');

      const { assignment } = response.body.data;
      expect(assignment.groomId).toBe(testGroom1.id);
      expect(assignment.foalId).toBe(testHorse1.id);
      expect(assignment.isActive).toBe(true);
      expect(assignment).not.toHaveProperty('priority');
      expect(assignment).not.toHaveProperty('notes');
    });

    it('should create multiple assignments for different horses', async () => {
      const assignmentData = {
        groomId: testGroom1.id,
        horseId: testHorse2.id,
      };

      const response = await request(app)
        .post('/api/v1/groom-assignments')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send(assignmentData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });

    it('should prevent duplicate assignments', async () => {
      // Equoria-2gqir: this test previously relied on the FIRST test in this
      // describe block having already created the groom1->horse1 assignment.
      // The Equoria-enles beforeEach now wipes ALL of this user's assignments
      // before EVERY test, so that silent cross-test dependency is gone. The
      // test must establish its own pre-state: create the assignment, THEN
      // attempt the duplicate. (Service duplicate-guard:
      // groomAssignmentService.validateAssignmentEligibility — the existing
      // active assignment for the same (groomId, foalId) pair pushes
      // 'Groom is already assigned to this horse', surfaced as 400.)
      const assignmentData = {
        groomId: testGroom1.id,
        horseId: testHorse1.id,
      };

      const firstResponse = await request(app)
        .post('/api/v1/groom-assignments')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send(assignmentData);
      expect(firstResponse.status).toBe(201);

      // Same groom -> same horse again must be rejected.
      const response = await request(app)
        .post('/api/v1/groom-assignments')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send(assignmentData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('already assigned');
    });

    it('should validate required fields', async () => {
      const invalidData = {
        groomId: testGroom1.id,
        // Missing horseId
      };

      const response = await request(app)
        .post('/api/v1/groom-assignments')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed');
    });

    it('should prevent assignment to non-owned horses', async () => {
      // Create another user's horse
      const otherSuffix = randomBytes(6).toString('hex');
      const otherUser = await prisma.user.create({
        data: {
          emailVerified: true,
          username: `TestFixture-jjzem-assignment-other-${otherSuffix}`,
          email: `testfixture-jjzem-assignment-other-${otherSuffix}@example.com`,
          password: 'hashedpassword',
          firstName: 'Other',
          lastName: 'User',
        },
      });

      const otherHorse = await prisma.horse.create({
        data: await testHorseData(prisma, {
          ...fixtureColor(),
          name: 'Other User Horse',
          sex: 'Stallion',
          dateOfBirth: birthDateForAge(1),
          userId: otherUser.id,
        }),
      });

      try {
        const assignmentData = {
          groomId: testGroom1.id,
          horseId: otherHorse.id,
        };

        const response = await request(app)
          .post('/api/v1/groom-assignments')
          .set('Authorization', `Bearer ${authToken}`)
          .set('Origin', 'http://localhost:3000')
          .set('Cookie', __csrf__.cookieHeader)
          .set('X-CSRF-Token', __csrf__.csrfToken)
          .send(assignmentData);

        // CWE-639 disclosure resistance: createAssignment service throws
        // NotFoundError('Horse') when validateAssignmentEligibility's
        // user-scoped horse query returns null — same response for "horse
        // doesn't exist" and "horse exists but is owned by another user."
        // Surfaces as 404 "Horse not found" (not 400 "do not own this
        // horse" — the descriptive message would enable ID enumeration).
        // See backend/modules/grooms/services/groomAssignmentService.mjs
        // createAssignment (throws NotFoundError('Horse') when validation.horse is null).
        expect(response.status).toBe(404);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('Horse not found');
      } finally {
        // Clean up
        await prisma.horse.deleteMany({ where: { id: otherHorse.id } });
        await prisma.user.deleteMany({ where: { id: otherUser.id } });
      }
    });
  });

  describe('2. Assignment Retrieval', () => {
    // Equoria-2gqir: the outer Equoria-enles beforeEach wipes ALL of this
    // user's assignments before EVERY test, so the retrieval tests below can
    // no longer lean on assignments created by section 1 (that silent
    // cross-test dependency is exactly what enles set out to remove). Seed a
    // real assignment through the live POST endpoint so each retrieval test
    // has >0 active assignments to find. Jest runs the parent beforeEach
    // (wipe) BEFORE this nested beforeEach (seed), so ordering is correct.
    beforeEach(async () => {
      const seed = await request(app)
        .post('/api/v1/groom-assignments')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({ groomId: testGroom1.id, horseId: testHorse1.id });
      // Fail loud if the seed itself broke — otherwise the assertions below
      // would falsely fail on a setup defect rather than a retrieval defect.
      expect(seed.status).toBe(201);
    });

    it('should get all assignments for user', async () => {
      const response = await request(app)
        .get('/api/v1/groom-assignments')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('assignments');
      expect(response.body.data).toHaveProperty('assignmentsByGroom');
      expect(response.body.data).toHaveProperty('statistics');

      const { assignments, statistics } = response.body.data;
      expect(Array.isArray(assignments)).toBe(true);
      expect(assignments.length).toBeGreaterThan(0);
      expect(statistics.activeAssignments).toBeGreaterThan(0);
    });

    it('should filter assignments by groom', async () => {
      const response = await request(app)
        .get(`/api/v1/groom-assignments?groomId=${testGroom1.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      const { assignments } = response.body.data;
      assignments.forEach(assignment => {
        expect(assignment.groomId).toBe(testGroom1.id);
      });
    });
  });

  describe('3. Assignment Limits', () => {
    it('should enforce assignment limits', async () => {
      // Equoria-95yrv (owner ruling, 2026-09-14): one groom cares for at most TEN
      // horses, whatever their skill — the per-skill ladder (2/3/4/5) this case
      // used to walk contradicted that ruling and made the cap unreachable. The
      // Equoria-enles beforeEach wipes this user's assignments before every test,
      // so testGroom1 starts at zero: twenty-two candidate horses → the first twenty
      // succeed and the last two are refused (the owner ruling 2026-10-26 (q68) raised the cap from ten to twenty).
      const horses = [];
      for (let i = 0; i < 22; i++) {
        const horse = await prisma.horse.create({
          data: await testHorseData(prisma, {
            ...fixtureColor(),
            // Scoped fixture name (CLAUDE.md §2): the suite's cleanup sweep is
            // userId-scoped, but the TestFixture- prefix keeps these honest if
            // a future sweep is name-based, and the suffix avoids collisions.
            name: `TestFixture-jjzem-limit-${suffix}-${i + 1}`,
            sex: 'Stallion',
            dateOfBirth: birthDateForAge(1),
            userId: testUser.id,
          }),
        });
        horses.push(horse);
      }

      try {
        // Try to assign groom to more horses than allowed
        let successfulAssignments = 0;
        let failedAssignments = 0;

        for (const horse of horses) {
          const response = await request(app)
            .post('/api/v1/groom-assignments')
            .set('Authorization', `Bearer ${authToken}`)
            .set('Origin', 'http://localhost:3000')
            .set('Cookie', __csrf__.cookieHeader)
            .set('X-CSRF-Token', __csrf__.csrfToken)
            .send({
              groomId: testGroom1.id,
              horseId: horse.id,
            });

          if (response.status === 201) {
            successfulAssignments++;
          } else {
            failedAssignments++;
            expect(response.body.message).toMatch(/already caring for 20 horses/i);
          }
        }

        // Twenty is the cap, starting from 0 active → 20 succeed, 2 rejected.
        expect(successfulAssignments).toBe(20);
        expect(failedAssignments).toBe(2);
      } finally {
        // Clean up — scoped to the ids this test created.
        for (const horse of horses) {
          await prisma.horse.deleteMany({ where: { id: horse.id } });
        }
      }
    });
  });

  describe('6. Assignment Removal', () => {
    it('should remove an assignment', async () => {
      // Equoria-2gqir: the Equoria-enles beforeEach wipes all assignments
      // before this test, so there is no longer a section-1 assignment to
      // remove. Create one through the live POST endpoint first (the real
      // create→remove flow this test is meant to exercise), then locate it.
      const created = await request(app)
        .post('/api/v1/groom-assignments')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({ groomId: testGroom1.id, horseId: testHorse1.id });
      expect(created.status).toBe(201);

      // Fetch the active assignment to remove
      const assignmentsResponse = await request(app)
        .get('/api/v1/groom-assignments')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken);

      const assignment = assignmentsResponse.body.data.assignments.find(a => a.isActive);
      expect(assignment).toBeDefined();

      // Remove the assignment
      const response = await request(app)
        .delete(`/api/v1/groom-assignments/${assignment.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({
          reason: 'Test removal',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('assignment');

      const { assignment: removedAssignment } = response.body.data;
      expect(removedAssignment.isActive).toBe(false);
      expect(removedAssignment.endDate).toBeTruthy();
    });

    it('should validate assignment ownership for removal', async () => {
      const response = await request(app)
        .delete('/api/v1/groom-assignments/99999')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({
          reason: 'Test removal',
        });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('not found');
    });
  });

  describe('7. Configuration and Statistics', () => {});

  describe('8. Authentication and Authorization', () => {
    it('should require authentication for all endpoints', async () => {
      const endpoints = [
        { method: 'get', path: '/api/v1/groom-assignments' },
        { method: 'post', path: '/api/v1/groom-assignments' },
      ];

      for (const endpoint of endpoints) {
        const response = await request(app)[endpoint.method](endpoint.path).set('Origin', 'http://localhost:3000');
        expect(response.status).toBe(401);
      }
    });
  });
});
