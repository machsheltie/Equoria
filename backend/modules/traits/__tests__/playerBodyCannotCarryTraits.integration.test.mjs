/**
 * Player create/update bodies cannot carry trait fields (Equoria-gu8jk).
 *
 * OWNER RULING 2026-10-20: players must NEVER be able to write traits for
 * themselves, by any path. This file covers the player routes that create or
 * update a horse or groom from a request body:
 *
 *   - PUT  /horses/:id                     req.body is the Prisma `data`; the
 *                                          allow-list is empty, so every
 *                                          protected field is refused with 400.
 *   - POST /marketplace/store/buy          reads only { breedId, sex }; a body
 *                                          carrying trait fields buys an
 *                                          ordinary store horse.
 *   - POST /grooms/:id/legacy/create       reads only the protégé's own
 *                                          profile fields; bonusTraitMap is the
 *                                          game's legacy perk and rareTraitPerks
 *                                          stays empty whatever the body says.
 *
 * (POST /auth/advance-onboarding is covered by
 * modules/auth/__tests__/onboardingStarterHorseLocked.integration.test.mjs.)
 *
 * These routes were already closed to these fields before Equoria-gu8jk; the
 * file is the regression guard the ruling asks for, one per route.
 *
 * Real database, real HTTP, real CSRF. No mocks. Fixtures removed by id.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';

const ORIGIN = 'http://localhost:3000';
const __dirname = dirname(fileURLToPath(import.meta.url));

const PROTECTED_HORSE_FIELDS = {
  epigeneticModifiers: { positive: ['legendaryBloodline'], negative: [], hidden: [] },
  epigeneticFlags: ['brave'],
  temporaryEpigeneticFlags: [{ flag: 'brave', expiresAt: '2099-01-01', source: 'player' }],
  ultraRareTraits: { ultraRare: [{ name: 'phoenixBorn' }], exotic: [] },
  temperament: 'TestFixture-planted-temperament',
  personality: 'TestFixture-planted-personality',
};

describe('Player bodies cannot carry trait fields (Equoria-gu8jk)', () => {
  let player;
  let token;
  let csrf;
  let horse;
  let storeBreedId;
  const userIds = [];
  const groomIds = [];

  beforeAll(async () => {
    const statsPath = resolve(__dirname, '../../../data/breedStarterStats.json');
    const validBreedNames = Object.keys(JSON.parse(readFileSync(statsPath, 'utf8')));
    const breed = await prisma.breed.findFirst({
      where: { name: { in: validBreedNames } },
      select: { id: true },
    });
    if (!breed?.id) {
      throw new Error('playerBodyCannotCarryTraits needs a seeded breed; refusing to skip.');
    }
    storeBreedId = breed.id;

    const suffix = randomBytes(6).toString('hex');
    player = await prisma.user.create({
      data: {
        email: `gu8jk-body-${suffix}@test.invalid`,
        username: `gu8jkbody${suffix}`,
        password: 'irrelevant-hash',
        firstName: 'Body',
        lastName: 'Player',
        emailVerified: true,
        money: 5000,
      },
    });
    userIds.push(player.id);
    token = generateTestToken({ id: player.id, email: player.email, role: 'user' });
    csrf = await fetchCsrf(app, { origin: ORIGIN, extraCookies: [`accessToken=${token}`] });

    horse = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-gu8jk-body-${suffix}`,
        userId: player.id,
        sex: 'Mare',
        age: 5,
        dateOfBirth: new Date('2020-01-01'),
        temperament: 'Calm',
      },
    });
  }, 60000);

  afterAll(async () => {
    await prisma.groomLegacyLog.deleteMany({
      where: { OR: [{ retiredGroomId: { in: groomIds } }, { legacyGroomId: { in: groomIds } }] },
    });
    const staffGrooms = await prisma.groom.findMany({
      where: { userId: { in: userIds } },
      select: { id: true },
    });
    const allGroomIds = [...new Set([...groomIds, ...staffGrooms.map(g => g.id)])];
    await prisma.groomEngagement.deleteMany({ where: { groomId: { in: allGroomIds } } });
    await prisma.groomRetirementSchedule.deleteMany({ where: { groomId: { in: allGroomIds } } });
    await prisma.groom.deleteMany({ where: { id: { in: allGroomIds } } });
    await prisma.userTransaction.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.horse.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.refreshToken.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }, 60000);

  function send(method, path, body) {
    const agent = request(app);
    return agent[method](path)
      .set('Origin', ORIGIN)
      .set('Content-Type', 'application/json')
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send(body);
  }

  const horseRow = () =>
    prisma.horse.findUnique({
      where: { id: horse.id },
      select: Object.fromEntries(Object.keys(PROTECTED_HORSE_FIELDS).map(k => [k, true])),
    });

  it.each(Object.entries(PROTECTED_HORSE_FIELDS))(
    'PUT /horses/:id refuses { %s } with 400 and changes nothing',
    async (field, value) => {
      const before = await horseRow();

      const res = await send('put', `/api/v1/horses/${horse.id}`, { [field]: value });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(await horseRow()).toEqual(before);
    },
  );

  it('POST /marketplace/store/buy ignores trait fields in the body', async () => {
    const res = await send('post', '/api/v1/marketplace/store/buy', {
      breedId: storeBreedId,
      sex: 'Mare',
      ...PROTECTED_HORSE_FIELDS,
    });

    expect(res.status).toBe(201);
    const bought = await prisma.horse.findFirst({
      where: { userId: player.id, id: { not: horse.id } },
      orderBy: { id: 'desc' },
      select: Object.fromEntries(Object.keys(PROTECTED_HORSE_FIELDS).map(k => [k, true])),
    });
    expect(bought.epigeneticModifiers).toEqual({ positive: [], negative: [], hidden: [] });
    expect(bought.epigeneticFlags).toEqual([]);
    expect(bought.temporaryEpigeneticFlags).toEqual([]);
    expect(bought.ultraRareTraits).toEqual({ ultraRare: [], exotic: [] });
    expect(bought.temperament).not.toBe(PROTECTED_HORSE_FIELDS.temperament);
    expect(bought.personality).toBeNull();
  });

  it('POST /grooms/:id/legacy/create ignores bonusTraitMap / rareTraitPerks in the body', async () => {
    const mentor = await prisma.groom.create({
      data: {
        name: `TestFixture-gu8jk-mentor-${randomBytes(4).toString('hex')}`,
        speciality: 'foal_care',
        personality: 'calm',
        userId: player.id,
        level: 8,
        experience: 2000,
        retired: true,
      },
    });
    groomIds.push(mentor.id);

    const res = await send('post', `/api/v1/grooms/${mentor.id}/legacy/create`, {
      name: 'TestFixture Protege',
      personality: 'calm',
      skillLevel: 'novice',
      speciality: 'foal_care',
      bonusTraitMap: { legendaryBloodline: 0.3, playerInjected: 1 },
      rareTraitPerks: { 'fey-touched': { revealed: true, triggerCount: 9 } },
      traitsShaped: ['legendaryBloodline'],
    });

    expect(res.status).toBe(201);
    const link = await prisma.groomLegacyLog.findFirst({ where: { retiredGroomId: mentor.id } });
    expect(link).not.toBeNull();
    groomIds.push(link.legacyGroomId);
    const protege = await prisma.groom.findUnique({
      where: { id: link.legacyGroomId },
      select: { bonusTraitMap: true, rareTraitPerks: true },
    });
    expect(protege.rareTraitPerks).toEqual({});
    expect(protege.bonusTraitMap).not.toHaveProperty('playerInjected');
    expect(protege.bonusTraitMap).not.toHaveProperty('legendaryBloodline');
    expect(protege.bonusTraitMap).toMatchObject({ legacyMentor: mentor.name });
  });
});
