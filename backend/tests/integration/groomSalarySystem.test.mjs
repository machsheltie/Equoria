/**
 * Groom Salary System Integration Tests
 *
 * Tests the weekly salary automation system
 */

import request from 'supertest';
import { randomBytes } from 'node:crypto';
import app from '../../app.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../helpers/authHelper.mjs';
import { processWeeklySalaries } from '../../modules/grooms/index.mjs';
import { calculateWeeklyFee } from '../../modules/grooms/services/groomFeeBasisService.mjs';
import { calculateUserSalaryCost } from '../../modules/grooms/services/groomSalaryReadService.mjs';

// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../helpers/fixtureColor.mjs';
import { gameCalendarDate } from '../../utils/gameTime.mjs';
import { testHorseData } from '../../__tests__/helpers/createTestHorse.mjs';

describe('Groom Salary System', () => {
  let testUser;
  let testGroom;
  let testHorse;
  let authToken;
  // Randomized, TestFixture-scoped names so parallel/real-DB runs never collide
  // on a fixed string and so cleanup/assertions key off a unique value.
  let groomName;

  beforeEach(async () => {
    const testSuffix = `${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}_${Math.random().toString(16).slice(2, 8)}`;
    groomName = `TestFixture-SalaryGroom-${testSuffix}`;

    testUser = await prisma.user.create({
      data: {
        emailVerified: true,
        username: `salaryTestUser_${testSuffix}`,
        email: `salary_${testSuffix}@test.com`,
        password: 'hashedPassword',
        firstName: 'Salary',
        lastName: 'Test',
        money: 1000,
      },
    });

    authToken = generateTestToken({ id: testUser.id });

    // Create test horse
    testHorse = await prisma.horse.create({
      data: await testHorseData(prisma, {
        ...fixtureColor(),
        name: `TestFixture-SalaryHorse-${testSuffix}`,
        userId: testUser.id,
        dateOfBirth: gameCalendarDate(new Date(), -5 * 365), // 5 years old
        age: 5,
        sex: 'Stallion',
        healthStatus: 'Excellent',
        speed: 50,
        agility: 50,
        stamina: 50,
        temperament: 'calm',
      }),
    });

    // Create test groom
    testGroom = await prisma.groom.create({
      data: {
        name: groomName,
        skillLevel: 'expert',
        starLevel: 'rookie',
        speciality: 'showHandling',
        personality: 'gentle',
        experience: 50,
        userId: testUser.id,
      },
    });

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

  afterEach(async () => {
    await prisma.groomSalaryPayment.deleteMany({
      where: { userId: testUser?.id },
    });
    await prisma.groomAssignment.deleteMany({
      where: { userId: testUser?.id },
    });
    await prisma.groom.deleteMany({
      where: { userId: testUser?.id },
    });
    await prisma.horse.deleteMany({
      where: { userId: testUser?.id },
    });
    await prisma.user.deleteMany({
      where: { id: testUser?.id },
    });
  });

  describe('Salary Calculation', () => {
    // Owner ruling 2026-10-28 (q228) replaced the 70-per-horse fee (Equoria-95yrv):
    // a groom costs their star level's price per week, however many horses.
    it("should charge the groom's star level price per week", () => {
      expect(calculateWeeklyFee({ starLevel: 'intermediate' })).toBe(300);
      expect(calculateWeeklyFee({ starLevel: 'expert' })).toBe(500);
    });

    it('should calculate user total salary cost', async () => {
      const salaryCost = await calculateUserSalaryCost(testUser.id);

      // Owner ruling q228: one Rookie groom = 100/week, however many horses.
      expect(salaryCost.totalWeeklyCost).toBe(100);
      expect(salaryCost.groomCount).toBe(1);
      expect(salaryCost.breakdown).toHaveLength(1);
      expect(salaryCost.breakdown[0].groomName).toBe(groomName);
      expect(salaryCost.breakdown[0].assignedHorses).toBe(1);
      expect(salaryCost.breakdown[0].weeklyFee).toBe(100);
    });
  });

  describe('API Endpoints', () => {
    it('should get user salary cost', async () => {
      const response = await request(app)
        .get('/api/v1/groom-salaries/cost')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.totalWeeklyCost).toBe(100);
      expect(response.body.data.groomCount).toBe(1);
      expect(response.body.data).not.toHaveProperty('feePerHorsePerWeek');
      // Owner ruling 2026-10-26 (q68): twenty horses per groom (was ten).
      expect(response.body.data.maxHorsesPerGroom).toBe(20);
    });

    // GET /summary and GET /status were removed (owner ruling 2026-10-28, q151,
    // Equoria-a7f1p); their absence is pinned in groomSalaryController.test.mjs and
    // duplicateLookupsRetired.sentinel.test.mjs.
  });

  // Equoria-ypb7d.3 — BOTH CALLS BELOW ARE SCOPED TO `testUser`.
  //
  // The coordinator's list named the two suites in modules/grooms/__tests__; this is a
  // third file with the same hazard, found by grepping every caller. Before
  // Equoria-ypb7d.3 an unscoped pass was merely wasteful (it debited real wallets;
  // `terminateGroomsForNonPayment` threw on a non-existent column and swallowed it, so
  // nothing was taken away). It can now put every underfunded player's grooms into the
  // one-week grace period and RELEASE the ones already in it, and this database holds
  // real player data. `groomSalaryPassScoped.sentinel.test.mjs` guards it.
  describe('Salary Processing', () => {
    it('should process weekly salaries successfully', async () => {
      const results = await processWeeklySalaries(undefined, { userId: testUser.id });

      // Exact, not `> 0`: the pass is scoped to this suite's own user, so that user IS
      // the whole population. The `> 0` existed only to tolerate every other row.
      expect(results.processed).toBe(1);
      expect(results.successful).toBe(1);
      expect(results.totalAmount).toBe(100);

      // Check that payment was recorded
      const payments = await prisma.groomSalaryPayment.findMany({
        where: { userId: testUser.id },
      });

      expect(payments.length).toBeGreaterThan(0);
      expect(payments[0].amount).toBe(100);
      expect(payments[0].status).toBe('paid');
    });

    it('should handle insufficient funds', async () => {
      // Set user money to insufficient amount
      await prisma.user.update({
        where: { id: testUser.id },
        data: { money: 50 }, // Less than the 100-coin weekly fee
      });

      const results = await processWeeklySalaries(undefined, { userId: testUser.id });

      expect(results.failed).toBe(1);
      expect(results.errors.length).toBe(1);

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

    // Old contract: an admin token triggered an unscoped payday at
    // POST /api/v1/groom-salaries/process. Owner ruling 2026-10-28 (q262,
    // Equoria-opdt7): only the Owner runs it, behind the emailed staff check-in, at
    // POST /api/v1/staff/payroll/grooms/run; its guard is pinned in
    // modules/staff/__tests__/staffPayrollRunAuthz.integration.test.mjs.
  });

  describe('Authentication', () => {
    it('should require authentication for GET /api/groom-salaries/cost', async () => {
      const response = await request(app).get('/api/v1/groom-salaries/cost').set('Origin', 'http://localhost:3000');
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });
});
