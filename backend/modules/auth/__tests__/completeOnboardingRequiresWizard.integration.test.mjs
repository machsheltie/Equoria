/**
 * Onboarding cannot be ended before the welcome wizard (Equoria-mif2g).
 *
 * OLD CONTRACT: `POST /auth/complete-onboarding` set completedOnboarding true
 * for any account. A brand-new player (onboardingStep 0, not completed) could
 * call it directly; OnboardingGuard then never showed the wizard again and she
 * kept the registration stand-in starter horse she never chose.
 *
 * NEW CONTRACT: an account that has not finished the wizard (step 0 and not
 * completed) is refused with 409 `onboardingWizardNotFinished` and nothing is
 * written. Once the wizard has been posted (step >= 1) the tour's Skip ends
 * onboarding as before, and an already-finished player gets the same 200. The
 * gate is read and the flag written in one transaction under the User row lock,
 * so a wizard post racing a complete call can never leave a completed account
 * at step 0.
 *
 * Real database, real HTTP, real CSRF. No mocks. Fixtures removed by id.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { randomBytes } from 'node:crypto';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';

const ORIGIN = 'http://localhost:3000';
const MARKER = '2026-10-19T00:00:00.000Z';

describe('POST /auth/complete-onboarding — only after the welcome wizard (Equoria-mif2g)', () => {
  const userIds = [];
  let breedId;

  beforeAll(async () => {
    const breed = await prisma.breed.findFirst({ select: { id: true } });
    if (!breed) {
      throw new Error('completeOnboardingRequiresWizard needs a seeded breed; refusing to skip.');
    }
    breedId = breed.id;
  });

  afterAll(async () => {
    await prisma.horse.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.refreshToken.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  });

  async function playerWith(settings) {
    const suffix = randomBytes(6).toString('hex');
    const user = await prisma.user.create({
      data: {
        email: `mif2g-onb-${suffix}@test.invalid`,
        username: `mif2gonb${suffix}`,
        password: 'irrelevant-hash',
        firstName: 'Onboard',
        lastName: 'Gate',
        emailVerified: true,
        settings,
      },
    });
    userIds.push(user.id);
    const token = generateTestToken({ id: user.id, email: user.email, role: 'user' });
    const csrf = await fetchCsrf(app, { origin: ORIGIN, extraCookies: [`accessToken=${token}`] });
    const post = (path, body = {}) =>
      request(app)
        .post(path)
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${token}`)
        .set('Cookie', csrf.cookieHeader)
        .set('X-CSRF-Token', csrf.csrfToken)
        .send(body);
    return {
      user,
      complete: () => post('/api/v1/auth/complete-onboarding'),
      wizard: horseName => post('/api/v1/auth/advance-onboarding', { horseName, breedId, gender: 'Mare' }),
    };
  }

  const settingsOf = async userId =>
    (await prisma.user.findUnique({ where: { id: userId }, select: { settings: true } })).settings;

  it.each([
    ['a fresh account (step 0, not completed)', { completedOnboarding: false, onboardingStep: 0 }],
    ['an account with no onboarding keys yet', {}],
  ])('refuses %s with 409 onboardingWizardNotFinished and writes nothing', async (_label, onboarding) => {
    const settings = { ...onboarding, lastWeeklyClaimDate: MARKER };
    const { user, complete } = await playerWith(settings);

    const res = await complete();

    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ success: false, code: 'onboardingWizardNotFinished' });
    expect(await settingsOf(user.id)).toEqual(settings);
  });

  it('ends onboarding once the wizard has been posted (the tour Skip path)', async () => {
    const { user, complete, wizard } = await playerWith({
      completedOnboarding: false,
      onboardingStep: 0,
      lastWeeklyClaimDate: MARKER,
    });

    const wizardRes = await wizard('Gate Star');
    expect(wizardRes.status).toBe(200);
    expect(wizardRes.body.data).toMatchObject({ step: 1, completed: false });

    const res = await complete();

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ completedOnboarding: true });
    expect(await settingsOf(user.id)).toEqual({
      completedOnboarding: true,
      onboardingStep: 1,
      lastWeeklyClaimDate: MARKER,
    });
  });

  it('still answers 200 for a player who already finished onboarding', async () => {
    const settings = { completedOnboarding: true, onboardingStep: 10, lastWeeklyClaimDate: MARKER };
    const { user, complete } = await playerWith(settings);

    const res = await complete();

    expect(res.status).toBe(200);
    expect(await settingsOf(user.id)).toEqual(settings);
  });

  it('simultaneous Skip presses mid-tour all succeed and leave one consistent record', async () => {
    const { user, complete } = await playerWith({
      completedOnboarding: false,
      onboardingStep: 3,
      lastWeeklyClaimDate: MARKER,
    });

    const results = await Promise.all([complete(), complete(), complete(), complete()]);

    expect(results.map(r => r.status)).toEqual([200, 200, 200, 200]);
    expect(await settingsOf(user.id)).toEqual({
      completedOnboarding: true,
      onboardingStep: 3,
      lastWeeklyClaimDate: MARKER,
    });
  });

  it('a wizard post racing complete calls never leaves a completed account at step 0', async () => {
    const { user, complete, wizard } = await playerWith({
      completedOnboarding: false,
      onboardingStep: 0,
    });

    const [wizardRes, ...completes] = await Promise.all([wizard('Race Star'), complete(), complete(), complete()]);

    expect(wizardRes.status).toBe(200);
    for (const res of completes) {
      if (res.status === 409) {
        expect(res.body.code).toBe('onboardingWizardNotFinished');
      } else {
        expect(res.status).toBe(200);
      }
    }
    const after = await settingsOf(user.id);
    expect(after.onboardingStep).toBe(1);
    // Completed exactly when some complete call was accepted, and an accepted
    // call can only have run after the wizard committed step 1.
    expect(after.completedOnboarding).toBe(completes.some(r => r.status === 200));
  });
});
