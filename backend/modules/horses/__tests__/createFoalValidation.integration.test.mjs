/**
 * Integration Test: createFoal Biological Validation Guards (Equoria-mhdul)
 *
 * Validates the four guards added to createFoal per Equoria-mhdul:
 *   1. Self-cross: sireId === damId -> 400
 *   2. Sex: sire must be Stallion; dam must be Mare -> 400 if wrong
 *   3. Age: both must be >= 3 game-years (21 real days) -> 400 if underage
 *   4. Cooldown: dam.lastBredDate within 7 real days -> 400
 *
 * Each guard arm MUST fail BEFORE the fix and pass after. Real-DB, no mocks.
 */

import { describe, beforeAll, afterAll, beforeEach, expect, it } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import bcrypt from 'bcryptjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const app = (await import('../../../app.mjs')).default;
const rand = () => randomBytes(4).toString('hex');

function utcDaysAgo(n) {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

function dobForAgeYears(ageYears) {
  return utcDaysAgo(ageYears * 7);
}

describe('createFoal - biological validation guards (Equoria-mhdul)', () => {
  const cleanup = createCleanupTracker();
  const ts = `${rand()}_${rand()}`;

  let authToken, __csrf__, testUser, testBreed;
  let adultStallion, adultMare, anotherAdultMare, youngHorse;

  beforeAll(async () => {
    const hashedPassword = await bcrypt.hash('TestPw123!', 1);
    testUser = await prisma.user.create({
      data: {
        username: `mhdul_user_${ts}`,
        email: `mhdul_${ts}@example.com`,
        password: hashedPassword,
        firstName: 'Mhdul',
        lastName: 'Tester',
        money: 50000,
      },
    });

    authToken = generateTestToken({ id: testUser.id, role: 'user' });
    __csrf__ = await fetchCsrf(app, { extraCookies: [`accessToken=${authToken}`] });

    testBreed = await prisma.breed.upsert({
      where: { name: 'Thoroughbred' },
      update: {},
      create: { name: 'Thoroughbred', description: 'Shared integration-test breed' },
    });

    adultStallion = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-mhdul-Stallion_${ts}`,
        sex: 'Stallion',
        dateOfBirth: dobForAgeYears(5),
        age: 5,
        breedId: testBreed.id,
        userId: testUser.id,
        lastFedDate: new Date(),
      },
    });

    adultMare = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-mhdul-Mare_${ts}`,
        sex: 'Mare',
        dateOfBirth: dobForAgeYears(5),
        age: 5,
        breedId: testBreed.id,
        userId: testUser.id,
        lastFedDate: new Date(),
        lastBredDate: null,
      },
    });

    anotherAdultMare = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-mhdul-Mare2_${ts}`,
        sex: 'Mare',
        dateOfBirth: dobForAgeYears(5),
        age: 5,
        breedId: testBreed.id,
        userId: testUser.id,
        lastFedDate: new Date(),
        lastBredDate: null,
      },
    });

    youngHorse = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-mhdul-Young_${ts}`,
        sex: 'Stallion',
        dateOfBirth: dobForAgeYears(2),
        age: 2,
        breedId: testBreed.id,
        userId: testUser.id,
        lastFedDate: new Date(),
      },
    });

    const horseIds = () => [adultStallion?.id, adultMare?.id, anotherAdultMare?.id, youngHorse?.id].filter(Boolean);

    cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: horseIds() } } }), 'horses');
    cleanup.add(() => prisma.user.deleteMany({ where: { id: testUser.id } }), 'user');
  }, 120000);

  afterAll(() => cleanup.run(), 120000);

  beforeEach(async () => {
    for (const id of [adultMare?.id, anotherAdultMare?.id].filter(Boolean)) {
      await prisma.horse.update({
        where: { id },
        data: {
          inFoalSinceDate: null,
          pregnancySireId: null,
          pregnancyFeedingsByTier: {},
          lastBredDate: null,
          pendingFoalName: null,
          pendingFoalBreedId: null,
        },
      });
    }
  });

  function postFoals(body) {
    return request(app)
      .post('/api/v1/horses/foals')
      .set('Authorization', `Bearer ${authToken}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', __csrf__.cookieHeader)
      .set('X-CSRF-Token', __csrf__.csrfToken)
      .send(body);
  }

  it('rejects self-cross (sireId === damId) with 400', async () => {
    const res = await postFoals({
      name: `TestFixture-mhdul-SelfCross_${ts}`,
      breedId: testBreed.id,
      sireId: adultMare.id,
      damId: adultMare.id,
    });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/same horse/i);
    const dbDam = await prisma.horse.findUnique({ where: { id: adultMare.id } });
    expect(dbDam.inFoalSinceDate).toBeNull();
  });

  it('rejects when sire is a Mare (not a Stallion) with 400', async () => {
    const res = await postFoals({
      name: `TestFixture-mhdul-MareAsSire_${ts}`,
      breedId: testBreed.id,
      sireId: anotherAdultMare.id,
      damId: adultMare.id,
    });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/stallion/i);
    const dbDam = await prisma.horse.findUnique({ where: { id: adultMare.id } });
    expect(dbDam.inFoalSinceDate).toBeNull();
  });

  it('rejects when dam is not a Mare (Stallion used as dam) with 400', async () => {
    const res = await postFoals({
      name: `TestFixture-mhdul-StallionAsDam_${ts}`,
      breedId: testBreed.id,
      sireId: adultStallion.id,
      damId: youngHorse.id,
    });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    const dbYoung = await prisma.horse.findUnique({ where: { id: youngHorse.id } });
    expect(dbYoung.inFoalSinceDate).toBeNull();
  });

  it('rejects when sire is under 3 game-years with 400', async () => {
    const res = await postFoals({
      name: `TestFixture-mhdul-YoungSire_${ts}`,
      breedId: testBreed.id,
      sireId: youngHorse.id,
      damId: adultMare.id,
    });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/age|year|young|breed/i);
    const dbDam = await prisma.horse.findUnique({ where: { id: adultMare.id } });
    expect(dbDam.inFoalSinceDate).toBeNull();
  });

  it('rejects when dam is under 3 game-years with 400', async () => {
    const youngMare = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-mhdul-YoungMare_${ts}`,
        sex: 'Mare',
        dateOfBirth: dobForAgeYears(2),
        age: 2,
        breedId: testBreed.id,
        userId: testUser.id,
        lastFedDate: new Date(),
      },
    });
    try {
      const res = await postFoals({
        name: `TestFixture-mhdul-YoungDam_${ts}`,
        breedId: testBreed.id,
        sireId: adultStallion.id,
        damId: youngMare.id,
      });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/age|year|young|breed/i);
      const dbYoungMare = await prisma.horse.findUnique({ where: { id: youngMare.id } });
      expect(dbYoungMare.inFoalSinceDate).toBeNull();
    } finally {
      await prisma.horse
        .delete({ where: { id: youngMare.id } })
        .catch(err => console.warn(`[cleanup youngMare] ${err.message}`));
    }
  });

  it('rejects dam re-breed within 7-day cooldown (bred 3 days ago) with 400', async () => {
    await prisma.horse.update({
      where: { id: adultMare.id },
      data: { lastBredDate: utcDaysAgo(3) },
    });
    const res = await postFoals({
      name: `TestFixture-mhdul-Cooldown_${ts}`,
      breedId: testBreed.id,
      sireId: adultStallion.id,
      damId: adultMare.id,
    });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/cooldown|game year|day/i);
    const dbDam = await prisma.horse.findUnique({ where: { id: adultMare.id } });
    expect(dbDam.inFoalSinceDate).toBeNull();
  });

  it('allows breeding when lastBredDate is exactly 7 UTC calendar days ago', async () => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setUTCHours(23, 59, 59, 999);
    sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7);
    await prisma.horse.update({
      where: { id: adultMare.id },
      data: { lastBredDate: sevenDaysAgo },
    });
    const res = await postFoals({
      name: `TestFixture-mhdul-CooldownExpired_${ts}`,
      breedId: testBreed.id,
      sireId: adultStallion.id,
      damId: adultMare.id,
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('allows dam with null lastBredDate (never bred) to breed - null-check trap arm', async () => {
    const res = await postFoals({
      name: `TestFixture-mhdul-NullCooldown_${ts}`,
      breedId: testBreed.id,
      sireId: adultStallion.id,
      damId: adultMare.id,
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.pregnancyStarted).toBe(true);
  });

  it('happy path: adult stallion + adult mare + no cooldown returns 200', async () => {
    const res = await postFoals({
      name: `TestFixture-mhdul-HappyPath_${ts}`,
      breedId: testBreed.id,
      sireId: adultStallion.id,
      damId: adultMare.id,
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.pregnancyStarted).toBe(true);
    expect(res.body.data.damId).toBe(adultMare.id);
    expect(res.body.data.sireId).toBe(adultStallion.id);
    const dbDam = await prisma.horse.findUnique({ where: { id: adultMare.id } });
    expect(dbDam.inFoalSinceDate).toBeTruthy();
    expect(dbDam.pregnancySireId).toBe(adultStallion.id);
    expect(dbDam.lastBredDate).toBeTruthy();
  });
});
