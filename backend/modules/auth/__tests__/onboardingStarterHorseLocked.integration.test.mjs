/**
 * The onboarding wizard cannot be replayed to re-roll a horse (Equoria-gu8jk).
 *
 * OWNER RULING 2026-10-20: players must NEVER be able to write traits for
 * themselves, by any path. Temperament is one of those stores.
 *
 * OLD CONTRACT: `POST /auth/advance-onboarding` with a horse payload
 * (horseName/breedId/gender) rewrote the player's OLDEST horse — name, breed,
 * sex, starter stats — and drew a fresh temperament every time it was called,
 * at any onboarding step and after onboarding had finished. A player could
 * call it in a loop until the temperament (and breed) she wanted came up.
 *
 * NEW CONTRACT: the starter horse is chosen once, in the wizard, while the
 * account is still at onboarding step 0 and not completed (the only state in
 * which the frontend's OnboardingGuard shows the wizard). Any later horse
 * payload is refused with 409 and nothing changes. The tour's own advances
 * (no horse payload) are untouched.
 *
 * The body is allow-listed to { horseName, breedId, gender } (fix round 1 of
 * the task review; brief step 3: "allow-list; reject with 400"). OLD: protected
 * trait fields in the wizard body were silently ignored and the wizard still
 * answered 200. NEW: any other field, every protected trait field included, is
 * refused with 400 and no horse is written.
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
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { TEMPERAMENT_TYPES } from '../../horses/index.mjs';

const ORIGIN = 'http://localhost:3000';
const PLANTED_TEMPERAMENT = 'TestFixture-planted-temperament';

describe('POST /auth/advance-onboarding — starter horse is chosen once (Equoria-gu8jk)', () => {
  const userIds = [];
  let breeds;

  beforeAll(async () => {
    breeds = await prisma.breed.findMany({ select: { id: true, name: true }, take: 2 });
    if (breeds.length < 2) {
      throw new Error('onboardingStarterHorseLocked needs two seeded breeds; refusing to skip.');
    }
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
        email: `gu8jk-onb-${suffix}@test.invalid`,
        username: `gu8jkonb${suffix}`,
        password: 'irrelevant-hash',
        firstName: 'Onboard',
        lastName: 'Locked',
        emailVerified: true,
        settings,
      },
    });
    userIds.push(user.id);
    const token = generateTestToken({ id: user.id, email: user.email, role: 'user' });
    const csrf = await fetchCsrf(app, { origin: ORIGIN, extraCookies: [`accessToken=${token}`] });
    const advance = body =>
      request(app)
        .post('/api/v1/auth/advance-onboarding')
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${token}`)
        .set('Cookie', csrf.cookieHeader)
        .set('X-CSRF-Token', csrf.csrfToken)
        .send(body);
    return { user, advance };
  }

  async function plantedStarter(userId) {
    return prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: 'TestFixture-Kept Starter',
        userId,
        breedId: breeds[0].id,
        sex: 'Mare',
        age: 3,
        dateOfBirth: new Date(2023, 0, 1),
        temperament: PLANTED_TEMPERAMENT,
        speed: 11,
      },
    });
  }

  const ROW = {
    name: true,
    breedId: true,
    sex: true,
    temperament: true,
    speed: true,
    epigeneticModifiers: true,
  };

  it.each([
    ['mid-tour (step 1, not completed)', { completedOnboarding: false, onboardingStep: 1 }],
    ['finished (step 10, completed)', { completedOnboarding: true, onboardingStep: 10 }],
  ])('refuses a horse payload once the wizard is done: %s', async (_label, settings) => {
    const { user, advance } = await playerWith(settings);
    const horse = await plantedStarter(user.id);
    const before = await prisma.horse.findUnique({ where: { id: horse.id }, select: ROW });

    const res = await advance({ horseName: 'Rerolled', breedId: breeds[1].id, gender: 'Stallion' });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(await prisma.horse.findUnique({ where: { id: horse.id }, select: ROW })).toEqual(before);
    expect(await prisma.horse.count({ where: { userId: user.id } })).toBe(1);
    const after = await prisma.user.findUnique({ where: { id: user.id }, select: { settings: true } });
    expect(after.settings).toMatchObject(settings);
  });

  it('still lets the tour advance with no horse payload after the wizard', async () => {
    const { user, advance } = await playerWith({ completedOnboarding: false, onboardingStep: 1 });
    await plantedStarter(user.id);

    const res = await advance({});

    expect(res.status).toBe(200);
    expect(res.body.data.step).toBe(2);
  });

  it.each([
    ['temperament', PLANTED_TEMPERAMENT],
    ['personality', 'TestFixture-planted-personality'],
    ['epigeneticModifiers', { positive: ['legendaryBloodline'], negative: [], hidden: [] }],
    ['epigeneticFlags', ['brave']],
    ['temporaryEpigeneticFlags', [{ flag: 'brave', expiresAt: '2099-01-01', source: 'player' }]],
    ['ultraRareTraits', { ultraRare: [{ name: 'phoenixBorn' }], exotic: [] }],
  ])('refuses { %s } in the wizard body (step 0) with 400 and writes no horse', async (field, value) => {
    const settings = { completedOnboarding: false, onboardingStep: 0 };
    const { user, advance } = await playerWith(settings);

    const res = await advance({
      horseName: 'Wizard Star',
      breedId: breeds[0].id,
      gender: 'Mare',
      [field]: value,
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(await prisma.horse.count({ where: { userId: user.id } })).toBe(0);
    const after = await prisma.user.findUnique({ where: { id: user.id }, select: { settings: true } });
    expect(after.settings).toMatchObject(settings);
  });

  it('still accepts the frontend wizard body { horseName, breedId, gender } at step 0 (control)', async () => {
    const { user, advance } = await playerWith({ completedOnboarding: false, onboardingStep: 0 });

    const res = await advance({ horseName: 'Wizard Star', breedId: breeds[0].id, gender: 'Mare' });

    expect(res.status).toBe(200);
    const horse = await prisma.horse.findFirst({
      where: { userId: user.id },
      select: { temperament: true, epigeneticModifiers: true, epigeneticFlags: true },
    });
    expect(TEMPERAMENT_TYPES).toContain(horse.temperament);
    expect(horse.epigeneticModifiers).toEqual({ positive: [], negative: [], hidden: [] });
    expect(horse.epigeneticFlags).toEqual([]);
  });
});
