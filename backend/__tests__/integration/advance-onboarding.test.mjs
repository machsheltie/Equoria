/**
 * Integration Tests: POST /api/auth/advance-onboarding
 *
 * Tests the advance-onboarding endpoint which increments User.settings.onboardingStep
 * and sets completedOnboarding: true when step 10 is reached.
 *
 * Story 17-1: Hybrid Onboarding Tutorial
 */

import request from 'supertest';
import app from '../../app.mjs';
import prisma from '../../db/index.mjs';
import bcrypt from 'bcryptjs';

describe('POST /api/auth/advance-onboarding', () => {
  let server;
  let cookieHeader;
  let testUser;
  const rateLimitBypassHeader = { 'X-Test-Bypass-Rate-Limit': 'true' };
  const testUserData = {
    username: `advanceonboard_${Date.now()}`,
    email: `advanceonboard_${Date.now()}@example.com`,
    password: 'TestPassword123!',
    firstName: 'Advance',
    lastName: 'Onboard',
  };

  beforeAll(async () => {
    server = app.listen(0);

    const hashedPassword = await bcrypt.hash(testUserData.password, 10);
    testUser = await prisma.user.create({
      data: {
        username: testUserData.username,
        email: testUserData.email,
        password: hashedPassword,
        firstName: testUserData.firstName,
        lastName: testUserData.lastName,
        settings: { completedOnboarding: false, onboardingStep: 0 },
      },
    });

    const loginResponse = await request(app)
      .post('/api/auth/login')
      .set(rateLimitBypassHeader)
      .set('X-Test-Bypass-Auth', 'true')
      .send({ email: testUserData.email, password: testUserData.password })
      .expect(200);

    cookieHeader = loginResponse.headers['set-cookie'];
  });

  afterAll(async () => {
    await prisma.refreshToken.deleteMany({ where: { userId: testUser.id } });
    await prisma.user.deleteMany({ where: { id: testUser.id } });
    if (server) await new Promise(resolve => server.close(resolve));
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Reset onboarding state before each test
    await prisma.user.update({
      where: { id: testUser.id },
      data: { settings: { completedOnboarding: false, onboardingStep: 0 } },
    });
  });

  it('should advance onboarding step from 0 to 1', async () => {
    const response = await request(app)
      .post('/api/auth/advance-onboarding')
      .set('Cookie', cookieHeader)
      .set('X-Test-Bypass-Auth', 'true')
      .set('X-Test-Email', testUserData.email)
      .set(rateLimitBypassHeader)
      .expect(200);

    expect(response.body.status).toBe('success');
    expect(response.body.data.step).toBe(1);
    expect(response.body.data.completed).toBe(false);

    const updated = await prisma.user.findUnique({ where: { id: testUser.id } });
    expect(updated.settings.onboardingStep).toBe(1);
    expect(updated.settings.completedOnboarding).toBe(false);
  });

  it('should advance onboarding step sequentially (step 5 → 6)', async () => {
    // Set user to step 5
    await prisma.user.update({
      where: { id: testUser.id },
      data: { settings: { completedOnboarding: false, onboardingStep: 5 } },
    });

    const response = await request(app)
      .post('/api/auth/advance-onboarding')
      .set('Cookie', cookieHeader)
      .set('X-Test-Bypass-Auth', 'true')
      .set('X-Test-Email', testUserData.email)
      .set(rateLimitBypassHeader)
      .expect(200);

    expect(response.body.data.step).toBe(6);
    expect(response.body.data.completed).toBe(false);
  });

  it('should set completedOnboarding: true when reaching step 10', async () => {
    // Set user to step 9 (one before final)
    await prisma.user.update({
      where: { id: testUser.id },
      data: { settings: { completedOnboarding: false, onboardingStep: 9 } },
    });

    const response = await request(app)
      .post('/api/auth/advance-onboarding')
      .set('Cookie', cookieHeader)
      .set('X-Test-Bypass-Auth', 'true')
      .set('X-Test-Email', testUserData.email)
      .set(rateLimitBypassHeader)
      .expect(200);

    expect(response.body.data.step).toBe(10);
    expect(response.body.data.completed).toBe(true);
    expect(response.body.message).toBe('Onboarding complete');

    const updated = await prisma.user.findUnique({ where: { id: testUser.id } });
    expect(updated.settings.onboardingStep).toBe(10);
    expect(updated.settings.completedOnboarding).toBe(true);
  });

  it('should return 401 when not authenticated', async () => {
    await request(app).post('/api/auth/advance-onboarding').set('X-Test-Require-Auth', 'true').expect(401);
  });

  it('should expose onboardingStep in profile response', async () => {
    await prisma.user.update({
      where: { id: testUser.id },
      data: { settings: { completedOnboarding: false, onboardingStep: 3 } },
    });

    const response = await request(app)
      .get('/api/auth/profile')
      .set('Cookie', cookieHeader)
      .set('X-Test-Bypass-Auth', 'true')
      .set('X-Test-Email', testUserData.email)
      .set(rateLimitBypassHeader)
      .expect(200);

    expect(response.body.data.user.onboardingStep).toBe(3);
    expect(response.body.data.user.completedOnboarding).toBe(false);
  });

  it('should default onboardingStep to 0 when not set in settings', async () => {
    // User with no onboardingStep in settings (legacy state)
    await prisma.user.update({
      where: { id: testUser.id },
      data: { settings: { completedOnboarding: false } },
    });

    const response = await request(app)
      .get('/api/auth/profile')
      .set('Cookie', cookieHeader)
      .set('X-Test-Bypass-Auth', 'true')
      .set('X-Test-Email', testUserData.email)
      .set(rateLimitBypassHeader)
      .expect(200);

    expect(response.body.data.user.onboardingStep).toBe(0);
  });
});
