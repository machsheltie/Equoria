/**
 * Groom Salary System Integration Tests
 *
 * Tests the weekly salary automation system
 */

import request from 'supertest';
import app from '../../app.mjs';
import prisma from '../../db/index.mjs';
import { generateTestToken } from '../helpers/authHelper.mjs';
import {
  calculateWeeklySalary,
  processWeeklySalaries,
  calculateUserSalaryCost,
} from '../../services/groomSalaryService.mjs';

describe('Groom Salary System', () => {
  let testUser;
  let testGroom;
  let testHorse;
  let authToken;

  beforeAll(async () => {
    // Create test user
    testUser = await prisma.user.create({
      data: {
        username: 'salaryTestUser',
        email: 'salary@test.com',
        password: 'hashedPassword',
        firstName: 'Salary',
        lastName: 'Test',
        money: 1000,
      },
    });

    authToken = generateTestToken(testUser.id);

    // Create test horse
    testHorse = await prisma.horse.create({
      data: {
        name: 'Salary Test Horse',
        ownerId: testUser.id,
        age: 5,
        sex: 'male',
        breed: 'Thoroughbred',
        color: 'Bay',
        health: 'Excellent',
        speed: 50,
        agility: 50,
        stamina: 50,
        temperament: 'calm',
      },
    });

    // Create test groom
    testGroom = await prisma.groom.create({
      data: {
        name: 'Salary Test Groom',
        skillLevel: 'expert',
        speciality: 'showHandling',
        personality: 'gentle',
        experience: 50,
        userId: testUser.id,
      },
    });

    // Create groom assignment
    await prisma.groomAssignment.create({
      data: {
        groomId: testGroom.id,
        foalId: testHorse.id,
        userId: testUser.id,
        isActive: true,
        bondScore: 75,
      },
    });
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.groomSalaryPayment.deleteMany({
      where: { userId: testUser.id },
    });
    await prisma.groomAssignment.deleteMany({
      where: { userId: testUser.id },
    });
    await prisma.groom.deleteMany({
      where: { userId: testUser.id },
    });
    await prisma.horse.deleteMany({
      where: { ownerId: testUser.id },
    });
    await prisma.user.delete({
      where: { id: testUser.id },
    });
  });

  describe('Salary Calculation', () => {
    it('should calculate correct weekly salary for expert groom with specialty', () => {
      const salary = calculateWeeklySalary(testGroom);

      // Expert: $100 base + $15 showHandling specialty = $115
      expect(salary).toBe(115);
    });

    it('should calculate correct salary for novice groom', () => {
      const noviceGroom = {
        skillLevel: 'novice',
        speciality: 'general',
      };

      const salary = calculateWeeklySalary(noviceGroom);

      // Novice: $50 base + $0 general = $50
      expect(salary).toBe(50);
    });

    it('should calculate user total salary cost', async () => {
      const salaryCost = await calculateUserSalaryCost(testUser.id);

      expect(salaryCost.totalWeeklyCost).toBe(115);
      expect(salaryCost.groomCount).toBe(1);
      expect(salaryCost.breakdown).toHaveLength(1);
      expect(salaryCost.breakdown[0].groomName).toBe('Salary Test Groom');
      expect(salaryCost.breakdown[0].weeklySalary).toBe(115);
    });
  });

  describe('API Endpoints', () => {
    it('should get user salary cost', async () => {
      const response = await request(app)
        .get('/api/groom-salaries/cost')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.totalWeeklyCost).toBe(115);
      expect(response.body.data.groomCount).toBe(1);
    });

    it('should get salary summary', async () => {
      const response = await request(app)
        .get('/api/groom-salaries/summary')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('currentCost');
      expect(response.body.data).toHaveProperty('currentMoney');
      expect(response.body.data).toHaveProperty('weeksAffordable');
      expect(response.body.data).toHaveProperty('nextPaymentDate');

      // User has $1000, weekly cost is $115, so can afford 8 weeks
      expect(response.body.data.weeksAffordable).toBe(8);
    });

    it('should get groom salary', async () => {
      const response = await request(app)
        .get(`/api/groom-salaries/groom/${testGroom.id}/salary`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.weeklySalary).toBe(115);
      expect(response.body.data.groom.name).toBe('Salary Test Groom');
    });

    it('should get salary payment history', async () => {
      const response = await request(app)
        .get('/api/groom-salaries/history')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('payments');
      expect(response.body.data).toHaveProperty('count');
      expect(Array.isArray(response.body.data.payments)).toBe(true);
    });

    it('should get cron job status', async () => {
      const response = await request(app)
        .get('/api/groom-salaries/status')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalJobs');
      expect(response.body.data).toHaveProperty('jobs');
    });

    it('should validate groom ownership', async () => {
      // Create another user's groom
      const otherUser = await prisma.user.create({
        data: {
          username: 'otherSalaryUser',
          email: 'othersalary@test.com',
          password: 'hashedPassword',
          firstName: 'Other',
          lastName: 'User',
        },
      });

      const otherGroom = await prisma.groom.create({
        data: {
          name: 'Other User Groom',
          skillLevel: 'novice',
          speciality: 'general',
          personality: 'gentle',
          userId: otherUser.id,
        },
      });

      const response = await request(app)
        .get(`/api/groom-salaries/groom/${otherGroom.id}/salary`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('You do not own this groom');

      // Clean up
      await prisma.groom.delete({ where: { id: otherGroom.id } });
      await prisma.user.delete({ where: { id: otherUser.id } });
    });
  });

  describe('Salary Processing', () => {
    it('should process weekly salaries successfully', async () => {
      const results = await processWeeklySalaries();

      expect(results.processed).toBeGreaterThan(0);
      expect(results.successful).toBeGreaterThan(0);
      expect(results.totalAmount).toBeGreaterThan(0);

      // Check that payment was recorded
      const payments = await prisma.groomSalaryPayment.findMany({
        where: { userId: testUser.id },
      });

      expect(payments.length).toBeGreaterThan(0);
      expect(payments[0].amount).toBe(115);
      expect(payments[0].status).toBe('paid');
    });

    it('should handle insufficient funds', async () => {
      // Set user money to insufficient amount
      await prisma.user.update({
        where: { id: testUser.id },
        data: { money: 50 }, // Less than $115 needed
      });

      const results = await processWeeklySalaries();

      expect(results.failed).toBeGreaterThan(0);
      expect(results.errors.length).toBeGreaterThan(0);

      // Check that user is in grace period
      const updatedUser = await prisma.user.findUnique({
        where: { id: testUser.id },
      });

      expect(updatedUser.groomSalaryGracePeriod).not.toBeNull();

      // Reset user money for other tests
      await prisma.user.update({
        where: { id: testUser.id },
        data: { money: 1000, groomSalaryGracePeriod: null },
      });
    });

    it('should trigger salary processing via API', async () => {
      const response = await request(app)
        .post('/api/groom-salaries/process')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('processed');
      expect(response.body.data).toHaveProperty('successful');
      expect(response.body.data).toHaveProperty('totalAmount');
    });
  });

  describe('Authentication', () => {
    it('should require authentication for GET /api/groom-salaries/cost', async () => {
      const response = await request(app).get('/api/groom-salaries/cost');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should require authentication for GET /api/groom-salaries/summary', async () => {
      const response = await request(app).get('/api/groom-salaries/summary');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should require authentication for GET /api/groom-salaries/history', async () => {
      const response = await request(app).get('/api/groom-salaries/history');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should require authentication for GET /api/groom-salaries/groom/:groomId/salary', async () => {
      const response = await request(app).get(`/api/groom-salaries/groom/${testGroom.id}/salary`);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should require authentication for GET /api/groom-salaries/status', async () => {
      const response = await request(app).get('/api/groom-salaries/status');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should require authentication for POST /api/groom-salaries/process', async () => {
      const response = await request(app).post('/api/groom-salaries/process');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });
});
