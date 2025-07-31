/**
 * Enhanced Groom Assignment System Integration Tests
 * Tests the advanced groom-horse assignment management system
 */

import request from 'supertest';
import app from '../../app.mjs';
import prisma from '../../db/index.mjs';
import { generateTestToken } from '../helpers/authHelper.mjs';

describe('Enhanced Groom Assignment System Integration Tests', () => {
  let authToken;
  let testUser;
  let testGroom1;
  let testGroom2;
  let testHorse1;
  let testHorse2;

  beforeAll(async () => {
    // Create test user
    testUser = await prisma.user.create({
      data: {
        username: 'assignment-test-user',
        email: 'assignment-test@example.com',
        password: 'hashedpassword',
        firstName: 'Assignment',
        lastName: 'TestUser',
        money: 10000
      }
    });

    authToken = generateTestToken({ id: testUser.id, username: testUser.username });

    // Create test horses
    testHorse1 = await prisma.horse.create({
      data: {
        name: 'Assignment Test Horse 1',
        sex: 'male',
        dateOfBirth: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // 1 year old
        ownerId: testUser.id,
        bondScore: 30,
        stressLevel: 40
      }
    });

    testHorse2 = await prisma.horse.create({
      data: {
        name: 'Assignment Test Horse 2',
        sex: 'female',
        dateOfBirth: new Date(Date.now() - 730 * 24 * 60 * 60 * 1000), // 2 years old
        ownerId: testUser.id,
        bondScore: 45,
        stressLevel: 25
      }
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
        sessionRate: 25.00,
        bio: 'Test groom for assignment system'
      }
    });

    testGroom2 = await prisma.groom.create({
      data: {
        name: 'Assignment Test Groom 2',
        userId: testUser.id,
        speciality: 'training',
        skillLevel: 'expert',
        personality: 'energetic',
        experience: 8,
        sessionRate: 35.00,
        bio: 'Expert test groom for assignment system'
      }
    });
  });

  afterAll(async () => {
    // Clean up test data
    if (testUser?.id) {
      await prisma.groomAssignment.deleteMany({
        where: { userId: testUser.id }
      });
      await prisma.groom.deleteMany({
        where: { userId: testUser.id }
      });
      await prisma.horse.deleteMany({
        where: { ownerId: testUser.id }
      });
      await prisma.user.delete({
        where: { id: testUser.id }
      });
    }
  });

  describe('1. Assignment Creation', () => {
    it('should create a new groom assignment', async () => {
      const assignmentData = {
        groomId: testGroom1.id,
        horseId: testHorse1.id,
        priority: 1,
        notes: 'Primary assignment for foal care'
      };

      const response = await request(app)
        .post('/api/groom-assignments')
        .set('Authorization', `Bearer ${authToken}`)
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
        notes: 'Secondary assignment'
      };

      const response = await request(app)
        .post('/api/groom-assignments')
        .set('Authorization', `Bearer ${authToken}`)
        .send(assignmentData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });

    it('should prevent duplicate assignments', async () => {
      const assignmentData = {
        groomId: testGroom1.id,
        horseId: testHorse1.id,
        priority: 1
      };

      const response = await request(app)
        .post('/api/groom-assignments')
        .set('Authorization', `Bearer ${authToken}`)
        .send(assignmentData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('already assigned');
    });

    it('should validate required fields', async () => {
      const invalidData = {
        groomId: testGroom1.id
        // Missing horseId
      };

      const response = await request(app)
        .post('/api/groom-assignments')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed');
    });

    it('should prevent assignment to non-owned horses', async () => {
      // Create another user's horse
      const otherUser = await prisma.user.create({
        data: {
          username: 'other-assignment-user',
          email: 'other-assignment@example.com',
          password: 'hashedpassword',
          firstName: 'Other',
          lastName: 'User'
        }
      });

      const otherHorse = await prisma.horse.create({
        data: {
          name: 'Other User Horse',
          sex: 'male',
          dateOfBirth: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
          ownerId: otherUser.id
        }
      });

      try {
        const assignmentData = {
          groomId: testGroom1.id,
          horseId: otherHorse.id
        };

        const response = await request(app)
          .post('/api/groom-assignments')
          .set('Authorization', `Bearer ${authToken}`)
          .send(assignmentData);

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('do not own this horse');
      } finally {
        // Clean up
        await prisma.horse.delete({ where: { id: otherHorse.id } });
        await prisma.user.delete({ where: { id: otherUser.id } });
      }
    });
  });

  describe('2. Assignment Retrieval', () => {
    it('should get all assignments for user', async () => {
      const response = await request(app)
        .get('/api/groom-assignments')
        .set('Authorization', `Bearer ${authToken}`);

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
        .get(`/api/groom-assignments?groomId=${testGroom1.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      const { assignments } = response.body.data;
      assignments.forEach(assignment => {
        expect(assignment.groomId).toBe(testGroom1.id);
      });
    });

    it('should get assignment dashboard', async () => {
      const response = await request(app)
        .get('/api/groom-assignments/dashboard')
        .set('Authorization', `Bearer ${authToken}`);

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
        .get(`/api/groom-assignments/groom/${testGroom1.id}/limits`)
        .set('Authorization', `Bearer ${authToken}`);

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
      // Create additional horses to test limits
      const horses = [];
      for (let i = 0; i < 5; i++) {
        const horse = await prisma.horse.create({
          data: {
            name: `Limit Test Horse ${i + 1}`,
            sex: 'male',
            dateOfBirth: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
            ownerId: testUser.id
          }
        });
        horses.push(horse);
      }

      try {
        // Try to assign groom to more horses than allowed
        let successfulAssignments = 0;
        let failedAssignments = 0;

        for (const horse of horses) {
          const response = await request(app)
            .post('/api/groom-assignments')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              groomId: testGroom1.id,
              horseId: horse.id
            });

          if (response.status === 201) {
            successfulAssignments++;
          } else {
            failedAssignments++;
            expect(response.body.message).toContain('maximum assignments');
          }
        }

        // Should have hit the limit (intermediate = 3 max, already has 2)
        expect(successfulAssignments).toBe(1);
        expect(failedAssignments).toBe(4);
      } finally {
        // Clean up
        for (const horse of horses) {
          await prisma.horse.delete({ where: { id: horse.id } });
        }
      }
    });
  });

  describe('4. Salary Calculations', () => {
    it('should calculate weekly salary costs', async () => {
      const response = await request(app)
        .get('/api/groom-assignments/salary-costs')
        .set('Authorization', `Bearer ${authToken}`);

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
        .post('/api/groom-assignments/validate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          groomId: testGroom2.id,
          horseId: testHorse1.id
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
      // First get an assignment to remove
      const assignmentsResponse = await request(app)
        .get('/api/groom-assignments')
        .set('Authorization', `Bearer ${authToken}`);

      const assignment = assignmentsResponse.body.data.assignments.find(a => a.isActive);
      expect(assignment).toBeDefined();

      // Remove the assignment
      const response = await request(app)
        .delete(`/api/groom-assignments/${assignment.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          reason: 'Test removal'
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
        .delete('/api/groom-assignments/99999')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          reason: 'Test removal'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('not found');
    });
  });

  describe('7. Configuration and Statistics', () => {
    it('should get assignment configuration', async () => {
      const response = await request(app)
        .get('/api/groom-assignments/config')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('maxAssignmentsBySkill');
      expect(response.body.data).toHaveProperty('weeklySalaryBySkill');
      expect(response.body.data).toHaveProperty('salaryMultipliers');
      expect(response.body.data).toHaveProperty('skillLevels');
    });

    it('should get assignment statistics', async () => {
      const response = await request(app)
        .get('/api/groom-assignments/statistics')
        .set('Authorization', `Bearer ${authToken}`);

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
        { method: 'get', path: '/api/groom-assignments' },
        { method: 'post', path: '/api/groom-assignments' },
        { method: 'get', path: '/api/groom-assignments/dashboard' },
        { method: 'get', path: '/api/groom-assignments/salary-costs' }
      ];

      for (const endpoint of endpoints) {
        const response = await request(app)[endpoint.method](endpoint.path);
        expect(response.status).toBe(401);
      }
    });
  });
});
