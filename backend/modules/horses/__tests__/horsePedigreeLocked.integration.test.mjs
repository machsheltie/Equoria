/**
 * horsePedigreeLocked — integration tests (Equoria-bvddn.2, owner ruling 2026-09-30;
 * route closed Equoria-h4zni)
 *
 * OWNER RULING 2026-09-30: a horse's sire and dam can NEVER be edited. Pedigree
 * is fixed by breeding. Players may only rename horses they own, on that horse's
 * own page (PATCH /horses/:id/name). Players have zero control over pedigree.
 *
 * OLD CONTRACT (Equoria-bvddn.2): PUT /horses/:id's allow-list was empty, so
 * sireId/damId were refused 400 as unexpected fields and an empty PUT was a 200
 * no-op. The route stayed open only because the generic security suites used it
 * as their validator vehicle.
 * NEW CONTRACT (Equoria-h4zni): those suites moved to live routes, and PUT
 * /horses/:id answers 410 Gone for EVERY authenticated caller and payload —
 * before id validation or the ownership lookup, mirroring the closed DELETE —
 * and writes nothing. Anonymous is still 401.
 *
 * The regression case is the one that used to SUCCEED before bvddn.2: PUT of a
 * same-owner Stallion as sire and Mare as dam (valid sexes, valid ownership)
 * returned 200 and rewrote the horse's parents.
 *
 * Real-DB integration. No mocks. Scoped cleanup by id.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { randomBytes } from 'node:crypto';
import app from '../../../app.mjs';
import { createMockToken } from '../../../__tests__/factories/index.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { testHorseData } from '../../../__tests__/helpers/createTestHorse.mjs';

/** Assert the closed-route answer: 410, the authored message, no data. */
function expectPutClosed(response) {
  expect(response.status).toBe(410);
  expect(response.body.success).toBe(false);
  expect(response.body.message).toMatch(/can no longer be edited/i);
  expect(response.body.message).toContain('PATCH /api/v1/horses/:id/name');
  expect(response.body.data).toBeUndefined();
}

describe('PUT /horses/:id — closed, pedigree is locked (Equoria-h4zni, owner ruling 2026-09-30)', () => {
  let csrf;
  let strangerCsrf;
  let user;
  let stranger;
  let token;
  let strangerToken;
  let horse;
  let stallion;
  let mare;
  const createdHorseIds = [];
  const createdUserIds = [];

  const put = (body, { id = horse.id, as = 'owner' } = {}) =>
    request(app)
      .put(`/api/v1/horses/${id}`)
      .set('Authorization', `Bearer ${as === 'owner' ? token : strangerToken}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', (as === 'owner' ? csrf : strangerCsrf).cookieHeader)
      .set('X-CSRF-Token', (as === 'owner' ? csrf : strangerCsrf).csrfToken)
      .send(body);

  const horseState = () =>
    prisma.horse.findUnique({
      where: { id: horse.id },
      select: {
        sireId: true,
        damId: true,
        name: true,
        sex: true,
        dateOfBirth: true,
        breedId: true,
        userId: true,
        updatedAt: true,
      },
    });

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-for-testing-only-32chars';
    const suffix = randomBytes(6).toString('hex');

    const makeUser = label =>
      prisma.user.create({
        data: {
          email: `pedlock-${label}-${suffix}@test.invalid`,
          username: `pedlock-${label}-${suffix}`,
          password: 'hashed',
          firstName: 'Pedigree',
          lastName: 'Lock',
          emailVerified: true,
        },
      });
    user = await makeUser('owner');
    createdUserIds.push(user.id);
    stranger = await makeUser('stranger');
    createdUserIds.push(stranger.id);
    token = createMockToken(user.id, { payload: { email: user.email, role: user.role || 'user' } });
    strangerToken = createMockToken(stranger.id, {
      payload: { email: stranger.email, role: stranger.role || 'user' },
    });

    const dob = new Date();
    dob.setUTCFullYear(dob.getUTCFullYear() - 5);
    const make = async (label, sex) =>
      prisma.horse.create({
        data: await testHorseData(prisma, {
          ...fixtureColor(),
          name: `TestFixture-pedlock-${label}-${suffix}`,
          userId: user.id,
          sex,
          dateOfBirth: dob,
        }),
      });
    horse = await make('target', 'Mare');
    createdHorseIds.push(horse.id);
    stallion = await make('stallion', 'Stallion');
    createdHorseIds.push(stallion.id);
    mare = await make('mare', 'Mare');
    createdHorseIds.push(mare.id);

    csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    strangerCsrf = await fetchCsrf(app, { extraCookies: [`accessToken=${strangerToken}`] });
  }, 120000);

  afterAll(async () => {
    if (createdHorseIds.length > 0) {
      await prisma.horse.deleteMany({ where: { id: { in: createdHorseIds } } });
    }
    if (createdUserIds.length > 0) {
      await prisma.refreshToken.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
  }, 120000);

  it('refuses sireId + damId pointing at owned horses of the right sex, parents unchanged', async () => {
    const before = await horseState();

    const response = await put({ sireId: stallion.id, damId: mare.id });

    expectPutClosed(response); // OLD: 400 unexpected field (Equoria-h4zni)
    const after = await horseState();
    expect(after).toEqual(before);
    expect(after.sireId).toBeNull();
    expect(after.damId).toBeNull();
  });

  it('refuses a sireId alone and a damId alone, parents unchanged', async () => {
    const sireOnly = await put({ sireId: stallion.id });
    const damOnly = await put({ damId: mare.id });

    expectPutClosed(sireOnly); // OLD: 400 (Equoria-h4zni)
    expectPutClosed(damOnly); // OLD: 400 (Equoria-h4zni)
    const after = await horseState();
    expect(after.sireId).toBeNull();
    expect(after.damId).toBeNull();
  });

  it('an empty PUT is refused too and changes nothing (no field is editable here)', async () => {
    const before = await horseState();
    const response = await put({});
    expectPutClosed(response); // OLD: 200 no-op (Equoria-h4zni)
    expect(await horseState()).toEqual(before);
  });

  it("answers a stranger, a missing id and a malformed id with the owner's exact body (no oracle)", async () => {
    const before = await horseState();
    const owner = await put({ name: 'Taken' });
    const strangerRes = await put({ name: 'Taken' }, { as: 'stranger' });
    const missing = await put({ name: 'Taken' }, { id: 2_147_483_640 });
    const malformed = await put({ name: 'Taken' }, { id: 'not-a-number' });

    for (const res of [owner, strangerRes, missing, malformed]) {
      expectPutClosed(res);
      expect(res.body).toEqual(owner.body);
    }
    expect(await horseState()).toEqual(before);
  });

  it('still answers 401 to an anonymous caller', async () => {
    const anonCsrf = await fetchCsrf(app);
    const response = await request(app)
      .put(`/api/v1/horses/${horse.id}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', anonCsrf.cookieHeader)
      .set('X-CSRF-Token', anonCsrf.csrfToken)
      .send({ sireId: stallion.id });
    expect(response.status).toBe(401);
  });
});
