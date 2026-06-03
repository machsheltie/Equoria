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

describe('Enhanced Groom Assignment System Integration Tests', () => {
  // Equoria-2gqir: per-user CSRF (Equoria-plw0h) — the CSRF token MUST be
  // bound to the same user the mutation authenticates as, so it is fetched
  // AFTER testUser exists (in the user-setup beforeAll below) with that
  // user's accessToken cookie. Declared here, populated there.
  let __csrf__;

  let authToken;
  let testUser;
  let testGroom1;
  let testGroom2;
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
      data: {
        ...fixtureColor(),
        name: 'Assignment Test Horse 1',
        sex: 'Stallion',
        dateOfBirth: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // 1 year old
        userId: testUser.id,
        bondScore: 30,
        stressLevel: 40,
      },
    });

    testHorse2 = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: 'Assignment Test Horse 2',
        sex: 'Mare',
        dateOfBirth: new Date(Date.now() - 730 * 24 * 60 * 60 * 1000), // 2 years old
        userId: testUser.id,
        bondScore: 45,
        stressLevel: 25,
      },
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

    testGroom2 = await prisma.groom.create({
      data: {
        name: 'Assignment Test Groom 2',
        userId: testUser.id,
        speciality: 'training',
        skillLevel: 'expert',
        personality: 'energetic',
        experience: 8,
        sessionRate: 35.0,
        bio: 'Expert test groom for assignment system',
      },
    });
  });

  // Equoria-enles: reset MUTABLE assignment state between tests so the suite
  // is order-independent. The fixture ROWS (user, horse, testGroom1,
  // testGroom2) survive across tests for performance; what gets wiped is
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
    it('should create a new groom assignment', async () => {
      const assignmentData = {
        groomId: testGroom1.id,
        horseId: testHorse1.id,
        priority: 1,
        notes: 'Primary assignment for foal care',
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
      expect(assignment.priority).toBe(1);
      expect(assignment.isActive).toBe(true);
      expect(assignment.notes).toBe('Primary assignment for foal care');
    });

    it('should create multiple assignments for different horses', async () => {
      const assignmentData = {
        groomId: testGroom1.id,
        horseId: testHorse2.id,
        priority: 2,
        notes: 'Secondary assignment',
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
        priority: 1,
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
          username: `TestFixture-jjzem-assignment-other-${otherSuffix}`,
          email: `testfixture-jjzem-assignment-other-${otherSuffix}@example.com`,
          password: 'hashedpassword',
          firstName: 'Other',
          lastName: 'User',
        },
      });

      const otherHorse = await prisma.horse.create({
        data: {
          ...fixtureColor(),
          name: 'Other User Horse',
          sex: 'Stallion',
          dateOfBirth: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
          userId: otherUser.id,
        },
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
        .send({ groomId: testGroom1.id, horseId: testHorse1.id, priority: 1 });
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

    it('should get assignment dashboard', async () => {
      const response = await request(app)
        .get('/api/v1/groom-assignments/dashboard')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('assignments');
      expect(response.body.data).toHaveProperty('salaryCosts');
      expect(response.body.data).toHaveProperty('groomLimits');
      expect(response.body.data).toHaveProperty('summary');

      const { summary, salaryCosts } = response.body.data;
      expect(summary.totalActiveAssignments).toBeGreaterThan(0);
      expect(salaryCosts.totalWeeklyCost).toBeGreaterThan(0);
    });
  });

  describe('3. Assignment Limits', () => {
    it('should get groom assignment limits', async () => {
      const response = await request(app)
        .get(`/api/v1/groom-assignments/groom/${testGroom1.id}/limits`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('groom');
      expect(response.body.data).toHaveProperty('limits');

      const { limits } = response.body.data;
      expect(limits).toHaveProperty('maxAssignments');
      expect(limits).toHaveProperty('currentAssignments');
      expect(limits).toHaveProperty('availableSlots');
      expect(limits).toHaveProperty('canTakeMore');
      expect(limits.maxAssignments).toBe(3); // intermediate skill level
    });

    it('should enforce assignment limits', async () => {
      // Equoria-2gqir: real contract for testGroom1 is intermediate skill →
      // MAX_ASSIGNMENTS_BY_SKILL.intermediate = 3 (groomAssignmentService.mjs).
      // The Equoria-enles beforeEach wipes ALL of this user's assignments
      // before EVERY test, so testGroom1 starts this test with ZERO active
      // assignments — NOT the "already has 2" state the original assertion
      // assumed (that state was a leftover from section 1's assignments,
      // which the beforeEach reset now removes). Fresh start + 5 candidate
      // horses → the first 3 succeed (fill the cap), the remaining 2 are
      // rejected with the 'maximum assignments' message. Asserting against the
      // real cap (3 successes / 2 fails) is the genuine limit-enforcement
      // contract, not a force-green relaxation.
      const horses = [];
      for (let i = 0; i < 5; i++) {
        const horse = await prisma.horse.create({
          data: {
            ...fixtureColor(),
            // Scoped fixture name (CLAUDE.md §2): the suite's cleanup sweep is
            // userId-scoped, but the TestFixture- prefix keeps these honest if
            // a future sweep is name-based, and the suffix avoids collisions.
            name: `TestFixture-jjzem-limit-${suffix}-${i + 1}`,
            sex: 'Stallion',
            dateOfBirth: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
            userId: testUser.id,
          },
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
            expect(response.body.message).toContain('maximum assignments');
          }
        }

        // intermediate = 3 max, starting from 0 active → 3 succeed, 2 rejected.
        expect(successfulAssignments).toBe(3);
        expect(failedAssignments).toBe(2);
      } finally {
        // Clean up — scoped to the ids this test created.
        for (const horse of horses) {
          await prisma.horse.deleteMany({ where: { id: horse.id } });
        }
      }
    });
  });

  describe('4. Salary Calculations', () => {
    // Equoria-2gqir: salary cost is derived from ACTIVE assignments. The
    // Equoria-enles beforeEach wipes all of this user's assignments before
    // each test, so seed one active assignment (real POST) to produce a
    // non-zero weekly cost for the assertions below.
    beforeEach(async () => {
      const seed = await request(app)
        .post('/api/v1/groom-assignments')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({ groomId: testGroom1.id, horseId: testHorse1.id, priority: 1 });
      expect(seed.status).toBe(201);
    });

    it('should calculate weekly salary costs', async () => {
      const response = await request(app)
        .get('/api/v1/groom-assignments/salary-costs')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalWeeklyCost');
      expect(response.body.data).toHaveProperty('groomCosts');
      expect(response.body.data).toHaveProperty('summary');

      const { totalWeeklyCost, groomCosts } = response.body.data;
      expect(totalWeeklyCost).toBeGreaterThan(0);
      expect(Array.isArray(groomCosts)).toBe(true);
      expect(groomCosts.length).toBeGreaterThan(0);

      // Check groom cost structure
      groomCosts.forEach(groomCost => {
        expect(groomCost).toHaveProperty('groom');
        expect(groomCost).toHaveProperty('assignmentCount');
        expect(groomCost).toHaveProperty('baseSalary');
        expect(groomCost).toHaveProperty('totalSalary');
        expect(groomCost.totalSalary).toBeGreaterThan(0);
      });
    });
  });

  describe('5. Assignment Validation', () => {
    it('should validate assignment eligibility', async () => {
      const response = await request(app)
        .post('/api/v1/groom-assignments/validate')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({
          groomId: testGroom2.id,
          horseId: testHorse1.id,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('valid');
      expect(response.body.data).toHaveProperty('errors');
      expect(response.body.data).toHaveProperty('groom');
      expect(response.body.data).toHaveProperty('horse');

      const { valid, groom, horse } = response.body.data;
      expect(typeof valid).toBe('boolean');
      expect(groom.id).toBe(testGroom2.id);
      expect(horse.id).toBe(testHorse1.id);
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
        .send({ groomId: testGroom1.id, horseId: testHorse1.id, priority: 1 });
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

  describe('7. Configuration and Statistics', () => {
    it('should get assignment configuration', async () => {
      const response = await request(app)
        .get('/api/v1/groom-assignments/config')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('maxAssignmentsBySkill');
      expect(response.body.data).toHaveProperty('weeklySalaryBySkill');
      expect(response.body.data).toHaveProperty('salaryMultipliers');
      expect(response.body.data).toHaveProperty('skillLevels');
    });

    it('should get assignment statistics', async () => {
      const response = await request(app)
        .get('/api/v1/groom-assignments/statistics')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('summary');
      expect(response.body.data).toHaveProperty('distributions');
      expect(response.body.data).toHaveProperty('trends');

      const { summary, distributions } = response.body.data;
      expect(summary).toHaveProperty('totalAssignments');
      expect(distributions).toHaveProperty('skillLevels');
      expect(distributions).toHaveProperty('specialities');
    });
  });

  describe('8. Authentication and Authorization', () => {
    it('should require authentication for all endpoints', async () => {
      const endpoints = [
        { method: 'get', path: '/api/v1/groom-assignments' },
        { method: 'post', path: '/api/v1/groom-assignments' },
        { method: 'get', path: '/api/v1/groom-assignments/dashboard' },
        { method: 'get', path: '/api/v1/groom-assignments/salary-costs' },
      ];

      for (const endpoint of endpoints) {
        const response = await request(app)[endpoint.method](endpoint.path).set('Origin', 'http://localhost:3000');
        expect(response.status).toBe(401);
      }
    });
  });
});
