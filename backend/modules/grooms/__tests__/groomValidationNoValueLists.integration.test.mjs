/**
 * Validation refusals on the groom doors do not hand over the game's internal
 * value lists (Equoria-bdpvw; owner ruling 2026-10-23: players never see raw
 * code names, they hint at exploits).
 *
 * Defect: 'interactionType must be one of: <every stored interaction code>' and
 * the three hire-field equivalents (POST /grooms/hire, retired by
 * Equoria-bvddn.7) spelled every valid stored value into the
 * response body, visible in the network tab to anyone who sent a bad value.
 *
 * Real DB, real HTTP, real auth, real CSRF. One scoped user, removed fail-loud.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';

import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { gameCalendarDate } from '../../../utils/gameTime.mjs';

const ORIGIN = 'http://localhost:3000';

// Four or more comma-separated words in a row is an enumeration of stored values.
const noValueList = /(\w+, ){3}\w+/;

describe('groom validation refusals carry no value lists (Equoria-bdpvw)', () => {
  const cleanup = createCleanupTracker();
  let user;
  let token;
  let csrf;

  beforeAll(async () => {
    const suffix = `bdpvw-${randomBytes(5).toString('hex')}`;
    user = await prisma.user.create({
      data: {
        email: `${suffix}@test.com`,
        username: suffix,
        password: 'irrelevant-not-a-login-test',
        firstName: 'Test',
        lastName: 'Lists',
        money: 5000,
      },
    });
    // This user is the suite's own: its horses and grooms go first, then the user.
    cleanup.add(() => prisma.horse.deleteMany({ where: { userId: user?.id } }), 'horses');
    cleanup.add(() => prisma.groom.deleteMany({ where: { userId: user?.id } }), 'grooms');
    cleanup.add(() => prisma.user.delete({ where: { id: user?.id } }), 'user');
    token = generateTestToken({ id: user.id, email: user.email, role: 'user' });
    csrf = await fetchCsrf(app, { origin: ORIGIN, extraCookies: [`accessToken=${token}`] });
  }, 60000);

  afterAll(async () => {
    await cleanup.run();
  });

  const post = path =>
    request(app)
      .post(path)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('X-CSRF-Token', csrf.csrfToken)
      .set('Cookie', csrf.cookieHeader);

  // POST /grooms/interact (and its interactionType list) is retired
  // (Equoria-l7xag); "groom horse" is the care door now, and its activity
  // refusal must not list the foal's activity codes either.
  it('a bad foal activity is refused without listing the activity codes', async () => {
    const foal = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `bdpvw-foal-${randomBytes(4).toString('hex')}`,
        sex: 'Filly',
        dateOfBirth: gameCalendarDate(new Date(), -3),
        age: 0,
        userId: user.id,
      },
    });
    const groom = await prisma.groom.create({
      data: {
        name: `bdpvw-groom-${randomBytes(4).toString('hex')}`,
        speciality: 'foalCare',
        skillLevel: 'novice',
        personality: 'gentle',
        userId: user.id,
      },
    });
    await prisma.groomAssignment.create({
      data: { foalId: foal.id, groomId: groom.id, userId: user.id, isActive: true },
    });

    const res = await post(`/api/v1/grooms/care/${foal.id}/groom`).send({
      activity: 'notARealActivity',
    });

    expect(res.status).toBe(400);
    expect(res.body.data.code).toBe('activityNotOffered');
    const body = JSON.stringify(res.body);
    expect(body).not.toMatch(/must be one of/i);
    expect(body).not.toMatch(noValueList);
    expect(body).not.toMatch(/tyingPractice|hoofHandling|stableExposure/);
  });
});
