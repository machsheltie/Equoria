/**
 * Integration Tests: POST /api/v1/auth/advance-onboarding
 *
 * Tests the advance-onboarding endpoint which increments User.settings.onboardingStep
 * and sets completedOnboarding: true when step 10 is reached.
 *
 * Story 17-1: Hybrid Onboarding Tutorial
 */

import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import bcrypt from 'bcryptjs';

import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { randomBytes } from 'node:crypto';
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';

describe('POST /api/v1/auth/advance-onboarding', () => {
  // Equoria-plw0h: CSRF is per-user-session-bound. The mutations below
  // authenticate via the httpOnly accessToken COOKIE, so validation resolves
  // the sessionIdentifier to req.user.id — the CSRF pair must therefore be
  // issued under that same identity (fetched AFTER login with the accessToken
  // cookie forwarded), not under the anonymous salt.
  let __csrf__;

  let server;
  let cookieHeader;
  let testUser;
  // Rate-limit bypass header removed in Workstream 4; keep empty for chain
  // compatibility with existing .set(rateLimitBypassHeader) call sites.
  const rateLimitBypassHeader = {};
  const testUserData = {
    username: `advanceonboard_${randomBytes(8).toString('hex')}`,
    email: `advanceonboard_${randomBytes(8).toString('hex')}@example.com`,
    password: 'TestPassword123!',
    firstName: 'Advance',
    lastName: 'Onboard',
  };

  beforeAll(async () => {
    server = app.listen(0);

    const hashedPassword = await bcrypt.hash(testUserData.password, 1);
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
      .post('/api/v1/auth/login')
      .set('Origin', 'http://localhost:3000')
      .set(rateLimitBypassHeader)
      .send({ email: testUserData.email, password: testUserData.password })
      .expect(200);

    const loginCookies = loginResponse.headers['set-cookie'] || [];
    // 21R-AUTH-3: login ALSO seeds a CSRF cookie. Strip it so the
    // identity-bound __csrf__ pair fetched below stays authoritative —
    // duplicate _csrf cookies make the cookie parser pick the first one,
    // which would not match the X-CSRF-Token header on the mutations.
    const sessionCookies = loginCookies
      .map(c => c.split(';')[0])
      .filter(c => !c.startsWith('_csrf=') && !c.startsWith('__Host-csrf='));
    const accessCookie = sessionCookies.find(c => c.startsWith('accessToken='));
    expect(accessCookie).toBeTruthy();

    // Equoria-plw0h: issue the CSRF token bound to the logged-in identity by
    // forwarding the accessToken cookie on GET /auth/csrf-token. fetchCsrf
    // returns cookieHeader = [accessCookie, csrfCookie]; merge the remaining
    // session cookies (refreshToken) so the mutation carries everything.
    __csrf__ = await fetchCsrf(app, { extraCookies: [accessCookie] });
    cookieHeader = [...sessionCookies.filter(c => !c.startsWith('accessToken=')), ...__csrf__.cookieHeader];
  });

  afterAll(async () => {
    await prisma.refreshToken.deleteMany({ where: { userId: testUser.id } });
    await prisma.horse.deleteMany({ where: { userId: testUser.id } });
    await prisma.user.deleteMany({ where: { id: testUser.id } });
    if (server) {
      await new Promise(resolve => server.close(resolve));
    }
    // prisma.$disconnect() removed — global teardown handles disconnection
  });

  beforeEach(async () => {
    // Reset onboarding state before each test
    await prisma.user.update({
      where: { id: testUser.id },
      data: { settings: { completedOnboarding: false, onboardingStep: 0 } },
    });
    await prisma.horse.deleteMany({ where: { userId: testUser.id } });
  });

  it('should advance onboarding step from 0 to 1', async () => {
    const response = await request(app)
      .post('/api/v1/auth/advance-onboarding')
      .set('Origin', 'http://localhost:3000')
      .set('X-CSRF-Token', __csrf__.csrfToken)
      .set('Cookie', cookieHeader)
      .set('X-Test-Email', testUserData.email)
      .set(rateLimitBypassHeader)
      .expect(200);

    expect(response.body.success).toBe(true);
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
      .post('/api/v1/auth/advance-onboarding')
      .set('Origin', 'http://localhost:3000')
      .set('X-CSRF-Token', __csrf__.csrfToken)
      .set('Cookie', cookieHeader)
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
      .post('/api/v1/auth/advance-onboarding')
      .set('Origin', 'http://localhost:3000')
      .set('X-CSRF-Token', __csrf__.csrfToken)
      .set('Cookie', cookieHeader)
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

  it('should persist selected starter horse data transactionally and create no duplicate starter horses', async () => {
    const breed = await prisma.breed.findFirst({ select: { id: true, name: true } });
    expect(breed).toBeTruthy();

    await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: 'Uncustomized Starter',
        sex: 'Mare',
        age: 3,
        dateOfBirth: new Date(2023, 0, 1),
        userId: testUser.id,
        healthStatus: 'Excellent',
      },
    });

    const response = await request(app)
      .post('/api/v1/auth/advance-onboarding')
      .set('Origin', 'http://localhost:3000')
      .set('X-CSRF-Token', __csrf__.csrfToken)
      .set('Cookie', cookieHeader)
      .set('X-Test-Email', testUserData.email)
      .set(rateLimitBypassHeader)
      .send({ horseName: 'Beta Star', breedId: breed.id, gender: 'Stallion' })
      .expect(200);

    expect(response.body.data.completed).toBe(true);
    expect(response.body.data.horse).toMatchObject({
      name: 'Beta Star',
      breedId: breed.id,
      breed: breed.name,
      gender: 'Stallion',
    });

    const horses = await prisma.horse.findMany({
      where: { userId: testUser.id },
      include: { breed: true },
    });
    expect(horses).toHaveLength(1);
    expect(horses[0]).toMatchObject({
      name: 'Beta Star',
      breedId: breed.id,
      sex: 'Stallion',
    });

    const updated = await prisma.user.findUnique({ where: { id: testUser.id } });
    expect(updated.settings.completedOnboarding).toBe(true);
    expect(updated.settings.onboardingStep).toBe(10);
  });

  // Equoria-f5372 — the onboarding starter-horse paths must never leave the
  // temperament column NULL (the frontend would show 'not recorded').
  it('fills a NULL temperament on the existing starter horse during onboarding customization', async () => {
    const { TEMPERAMENT_TYPES } = await import('../../horses/data/breedGeneticProfiles.mjs');
    const breed = await prisma.breed.findFirst({ select: { id: true, name: true } });
    expect(breed).toBeTruthy();

    // Existing starter horse with NULL temperament (fixtureColor spreads color
    // only — temperament is deliberately absent, reproducing register output).
    await prisma.horse.deleteMany({ where: { userId: testUser.id } });
    await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: 'Uncustomized Starter',
        sex: 'Mare',
        age: 3,
        dateOfBirth: new Date(2023, 0, 1),
        userId: testUser.id,
        healthStatus: 'Excellent',
      },
    });

    await request(app)
      .post('/api/v1/auth/advance-onboarding')
      .set('Origin', 'http://localhost:3000')
      .set('X-CSRF-Token', __csrf__.csrfToken)
      .set('Cookie', cookieHeader)
      .set('X-Test-Email', testUserData.email)
      .set(rateLimitBypassHeader)
      .send({ horseName: 'Temperament Star', breedId: breed.id, gender: 'Mare' })
      .expect(200);

    const horse = await prisma.horse.findFirst({ where: { userId: testUser.id } });
    expect(horse.temperament).toBeTruthy();
    expect(TEMPERAMENT_TYPES).toContain(horse.temperament);
  });

  // Equoria-8vwly — temperament permanence boundary is BREED FINALIZATION
  // (onboarding), not registration. The register-time placeholder is replaced
  // with the user's chosen breed's weighted distribution at onboarding.
  it('SENTINEL: REASSIGNS the temperament from the chosen breed at onboarding (not preserved as the register-time placeholder, Equoria-8vwly)', async () => {
    const { TEMPERAMENT_TYPES } = await import('../../horses/data/breedGeneticProfiles.mjs');
    const breed = await prisma.breed.findFirst({ select: { id: true, name: true } });
    expect(breed).toBeTruthy();

    // Plant a SENTINEL placeholder temperament that simulates a register-time
    // value the user never saw. If onboarding correctly reassigns from the
    // chosen breed, this sentinel string MUST be replaced; under the pre-8vwly
    // conditional ("preserve any existing temperament") it would survive.
    const SENTINEL_PLACEHOLDER = 'REGISTER_TIME_PLACEHOLDER_8VWLY';
    await prisma.horse.deleteMany({ where: { userId: testUser.id } });
    await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: 'Pre-Onboarding Starter',
        sex: 'Mare',
        age: 3,
        dateOfBirth: new Date(2023, 0, 1),
        userId: testUser.id,
        healthStatus: 'Excellent',
        temperament: SENTINEL_PLACEHOLDER,
      },
    });

    await request(app)
      .post('/api/v1/auth/advance-onboarding')
      .set('Origin', 'http://localhost:3000')
      .set('X-CSRF-Token', __csrf__.csrfToken)
      .set('Cookie', cookieHeader)
      .set('X-Test-Email', testUserData.email)
      .set(rateLimitBypassHeader)
      .send({ horseName: 'Reassigned Star', breedId: breed.id, gender: 'Mare' })
      .expect(200);

    const horse = await prisma.horse.findFirst({ where: { userId: testUser.id } });
    // The placeholder MUST be gone — proves reassignment happened.
    expect(horse.temperament).not.toBe(SENTINEL_PLACEHOLDER);
    // And the replacement value is from the canonical breed-weighted set.
    expect(TEMPERAMENT_TYPES).toContain(horse.temperament);
  });

  it('sets a temperament when onboarding creates the starter horse (no prior horse)', async () => {
    const { TEMPERAMENT_TYPES } = await import('../../horses/data/breedGeneticProfiles.mjs');
    const breed = await prisma.breed.findFirst({ select: { id: true, name: true } });
    expect(breed).toBeTruthy();

    // No prior horse → onboarding hits the tx.horse.create branch.
    await prisma.horse.deleteMany({ where: { userId: testUser.id } });

    await request(app)
      .post('/api/v1/auth/advance-onboarding')
      .set('Origin', 'http://localhost:3000')
      .set('X-CSRF-Token', __csrf__.csrfToken)
      .set('Cookie', cookieHeader)
      .set('X-Test-Email', testUserData.email)
      .set(rateLimitBypassHeader)
      .send({ horseName: 'Created Star', breedId: breed.id, gender: 'Stallion' })
      .expect(200);

    const horse = await prisma.horse.findFirst({ where: { userId: testUser.id } });
    expect(horse).toBeTruthy();
    expect(horse.temperament).toBeTruthy();
    expect(TEMPERAMENT_TYPES).toContain(horse.temperament);
  });

  // Equoria-vbrc4 — the tx.horse.create branch (no prior starter horse) must
  // produce a horse born with a valid colorGenotype + phenotype using the SAME
  // generator chain createHorse uses (generateGenotype → calculatePhenotype →
  // generateMarkings). Before the fix, this branch omitted the color fields and
  // the row was born phenotype = NULL, tripping horseColorNullSentinel.test.mjs.
  // SENTINEL-POSITIVE: this test FAILS against the buggy code (NULL phenotype)
  // and PASSES after the fix.
  it('creates the starter horse with a non-NULL, well-formed colorGenotype + phenotype (no prior horse)', async () => {
    const breed = await prisma.breed.findFirst({ select: { id: true, name: true } });
    expect(breed).toBeTruthy();

    // No prior horse → onboarding hits the tx.horse.create branch.
    await prisma.horse.deleteMany({ where: { userId: testUser.id } });

    await request(app)
      .post('/api/v1/auth/advance-onboarding')
      .set('Origin', 'http://localhost:3000')
      .set('X-CSRF-Token', __csrf__.csrfToken)
      .set('Cookie', cookieHeader)
      .set('X-Test-Email', testUserData.email)
      .set(rateLimitBypassHeader)
      .send({ horseName: 'Color Star', breedId: breed.id, gender: 'Mare' })
      .expect(200);

    const horse = await prisma.horse.findFirst({
      where: { userId: testUser.id },
      select: { id: true, colorGenotype: true, phenotype: true },
    });
    expect(horse).toBeTruthy();

    // colorGenotype must be a well-formed JSONB object of allele pairs.
    expect(horse.colorGenotype).not.toBeNull();
    expect(typeof horse.colorGenotype).toBe('object');
    expect(Array.isArray(horse.colorGenotype)).toBe(false);
    expect(Object.keys(horse.colorGenotype).length).toBeGreaterThan(0);

    // phenotype must be a well-formed JSONB object that carries a color.
    expect(horse.phenotype).not.toBeNull();
    expect(typeof horse.phenotype).toBe('object');
    expect(Array.isArray(horse.phenotype)).toBe(false);
    // calculatePhenotype returns { colorName, ... }; that is the load-bearing
    // field the frontend renders. It must be a non-empty string.
    expect(typeof horse.phenotype.colorName).toBe('string');
    expect(horse.phenotype.colorName.length).toBeGreaterThan(0);
  });

  it('should return 401 when not authenticated', async () => {
    await request(app)
      .post('/api/v1/auth/advance-onboarding')
      .set('Origin', 'http://localhost:3000')
      .set('X-CSRF-Token', __csrf__.csrfToken)
      .set('X-Test-Require-Auth', 'true')
      .expect(401);
  });

  it('should expose onboardingStep in profile response', async () => {
    await prisma.user.update({
      where: { id: testUser.id },
      data: { settings: { completedOnboarding: false, onboardingStep: 3 } },
    });

    const response = await request(app)
      .get('/api/v1/auth/profile')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', cookieHeader)
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
      .get('/api/v1/auth/profile')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', cookieHeader)
      .set('X-Test-Email', testUserData.email)
      .set(rateLimitBypassHeader)
      .expect(200);

    expect(response.body.data.user.onboardingStep).toBe(0);
  });
});
