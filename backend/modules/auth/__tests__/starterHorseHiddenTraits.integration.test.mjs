/**
 * A new player's starter horse carries hidden traits, rolled the way the Horse
 * Trader rolls them (Equoria-q4uem.17).
 *
 * OWNER RULING q308 (2026-10-29): the starter horse rolls hidden traits the
 * same way a Horse Trader horse does. Old contract: registration created the
 * starter horse with no traits at all, and the onboarding wizard's brand-new
 * horse (no registration horse to fill) had none either.
 *
 * The roll happens once, when the starter horse is created: at registration,
 * or in the wizard only when registration made no horse. The wizard's fill of
 * the registration horse (name, breed, sex) keeps the roll; the store roster
 * does not depend on breed, so a breed change has nothing to re-roll.
 *
 * The player learns how many hidden traits the horse carries, never which;
 * the owner role sees them by name (Equoria-w4bvy).
 *
 * Real app, real HTTP, real CSRF, real database. No mocks. Fixtures removed by id.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { checkTraitConflict, isRosterTrait } from '../../../utils/epigeneticTraits.mjs';

const ORIGIN = 'http://localhost:3000';

const createdUserIds = [];
const cleanup = createCleanupTracker();
cleanup.add(() => prisma.horse.deleteMany({ where: { userId: { in: createdUserIds } } }), 'horses');
cleanup.add(() => prisma.refreshToken.deleteMany({ where: { userId: { in: createdUserIds } } }), 'refreshTokens');
cleanup.add(
  () => prisma.emailVerificationToken.deleteMany({ where: { userId: { in: createdUserIds } } }),
  'emailVerificationTokens',
);
cleanup.add(() => prisma.auditLog.deleteMany({ where: { userId: { in: createdUserIds } } }), 'auditLogs');
cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: createdUserIds } } }), 'users');

let wizardBreed;

function dobYearsAgo(years) {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - years);
  return d.toISOString().slice(0, 10);
}

function expectStoreRoster(modifiers) {
  expect(modifiers.positive).toEqual([]);
  expect(modifiers.negative).toEqual([]);
  expect(modifiers.hidden.length).toBeGreaterThanOrEqual(1);
  expect(modifiers.hidden.length).toBeLessThanOrEqual(5);
  expect(new Set(modifiers.hidden).size).toBe(modifiers.hidden.length);
  for (const trait of modifiers.hidden) {
    expect(isRosterTrait(trait)).toBe(true);
  }
  for (const a of modifiers.hidden) {
    for (const b of modifiers.hidden) {
      expect(checkTraitConflict(a, b)).toBe(false);
    }
  }
}

function expectNoHiddenNames(res, hidden) {
  const body = JSON.stringify(res.body);
  for (const trait of hidden) {
    expect(body).not.toContain(`"${trait}"`);
  }
}

async function register(label) {
  const { csrfToken, cookieHeader } = await fetchCsrf(app, { origin: ORIGIN });
  const username = `q308${label}${randomBytes(5).toString('hex')}`;
  const res = await request(app)
    .post('/api/v1/auth/register')
    .set('Origin', ORIGIN)
    .set('Cookie', cookieHeader)
    .set('X-CSRF-Token', csrfToken)
    .send({
      username,
      email: `${username}@test.com`,
      password: 'StrongP@ssw0rd!23',
      firstName: 'Starter',
      lastName: 'Traits',
      dateOfBirth: dobYearsAgo(25),
    });
  expect(res.status).toBe(201);
  const userId = res.body?.data?.user?.id;
  expect(userId).toBeTruthy();
  createdUserIds.push(userId);
  return { res, userId };
}

async function storedModifiers(userId) {
  const horses = await prisma.horse.findMany({
    where: { userId },
    select: { id: true, epigeneticModifiers: true },
  });
  expect(horses).toHaveLength(1);
  return horses[0];
}

async function advanceWizard(token, body) {
  const csrf = await fetchCsrf(app, { origin: ORIGIN, extraCookies: [`accessToken=${token}`] });
  return request(app)
    .post('/api/v1/auth/advance-onboarding')
    .set('Origin', ORIGIN)
    .set('Authorization', `Bearer ${token}`)
    .set('Cookie', csrf.cookieHeader)
    .set('X-CSRF-Token', csrf.csrfToken)
    .send(body);
}

beforeAll(async () => {
  wizardBreed = await prisma.breed.findUnique({ where: { name: 'Morgan USA' }, select: { id: true } });
  if (!wizardBreed) {
    throw new Error('Seeded breed "Morgan USA" is missing; run npm run seed:breeds.');
  }
}, 30000);

afterAll(() => cleanup.run(), 60000);

describe('starter horse hidden traits (Equoria-q4uem.17, owner ruling q308)', () => {
  describe('registration, then the wizard fills the same horse', () => {
    let registered;
    let horse;
    let token;

    beforeAll(async () => {
      registered = await register('reg');
      // The wizard and horse reads need a verified email; this row is the test's own.
      await prisma.user.update({ where: { id: registered.userId }, data: { emailVerified: true } });
      horse = await storedModifiers(registered.userId);
      token = generateTestToken({ id: registered.userId, role: 'user' });
    }, 60000);

    it('the registration starter horse carries 1 to 5 hidden roster traits and no visible ones', () => {
      expectStoreRoster(horse.epigeneticModifiers);
    });

    it('the registration response names no hidden trait', () => {
      expectNoHiddenNames(registered.res, horse.epigeneticModifiers.hidden);
    });

    it('the wizard (new name, breed and sex) keeps the same hidden traits, and its response names none', async () => {
      const res = await advanceWizard(token, {
        horseName: 'Quiet Lantern',
        breedId: wizardBreed.id,
        gender: 'Stallion',
      });
      expect(res.status).toBe(200);
      expect(res.body.data.horse.id).toBe(horse.id);
      expectNoHiddenNames(res, horse.epigeneticModifiers.hidden);

      const after = await storedModifiers(registered.userId);
      expect(after.id).toBe(horse.id);
      expect(after.epigeneticModifiers).toEqual(horse.epigeneticModifiers);
    }, 60000);

    it.each([
      ['GET /horses/:id', id => `/api/v1/horses/${id}`],
      ['GET /traits/horse/:id', id => `/api/v1/traits/horse/${id}`],
    ])('the player’s %s sends the hidden count, never a name', async (_label, path) => {
      const res = await request(app).get(path(horse.id)).set('Origin', ORIGIN).set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expectNoHiddenNames(res, horse.epigeneticModifiers.hidden);
    });

    it('the player’s horse read carries hiddenCount only', async () => {
      const res = await request(app)
        .get(`/api/v1/horses/${horse.id}`)
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.epigeneticModifiers).toEqual({
        positive: [],
        negative: [],
        hiddenCount: horse.epigeneticModifiers.hidden.length,
      });
    });
  });

  it('the owner role sees her own starter horse’s hidden traits by name', async () => {
    const { userId } = await register('own');
    await prisma.user.update({ where: { id: userId }, data: { emailVerified: true, role: 'owner' } });
    const horse = await storedModifiers(userId);
    expectStoreRoster(horse.epigeneticModifiers);

    const ownerToken = generateTestToken({ id: userId, role: 'owner' });
    const res = await request(app)
      .get(`/api/v1/horses/${horse.id}`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.epigeneticModifiers).toEqual({
      positive: [],
      negative: [],
      hiddenCount: horse.epigeneticModifiers.hidden.length,
      hidden: horse.epigeneticModifiers.hidden,
    });
  }, 60000);

  it('the wizard’s brand-new horse (registration made none) rolls the store roster once', async () => {
    const suffix = randomBytes(5).toString('hex');
    const user = await prisma.user.create({
      data: {
        email: `q308-onb-${suffix}@test.invalid`,
        username: `q308onb${suffix}`,
        password: 'irrelevant-hash',
        firstName: 'Starter',
        lastName: 'Traits',
        emailVerified: true,
        settings: { completedOnboarding: false, onboardingStep: 0 },
      },
    });
    createdUserIds.push(user.id);
    const token = generateTestToken({ id: user.id, email: user.email, role: 'user' });

    const res = await advanceWizard(token, { horseName: 'Evening Lantern', breedId: wizardBreed.id, gender: 'Mare' });
    expect(res.status).toBe(200);

    const horse = await storedModifiers(user.id);
    expectStoreRoster(horse.epigeneticModifiers);
    expectNoHiddenNames(res, horse.epigeneticModifiers.hidden);
  }, 60000);
});
