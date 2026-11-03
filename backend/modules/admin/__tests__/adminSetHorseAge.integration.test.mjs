/**
 * The Owner's set-age tool (Equoria-0ro0p).
 *
 *   POST /api/v1/admin/horses/:id/set-age
 *
 * 1. A horse number that names no horse answers 404 'No horse has that number.'
 *    (the Steward's Office copy), not the 500 the Prisma P2025 used to become.
 * 2. The birth-date write and the age write commit together or not at all. A
 *    trigger on this test's own horse refuses the age write; the birth date
 *    must stay as it was. Before the fix the birth date was already committed
 *    when the age write failed.
 *
 * Real Express app, real JWT, real CSRF, real staff check-in, real DB. No mocks.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';

import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { createTestHorse, cleanupTestHorses } from '../../../__tests__/helpers/createTestHorse.mjs';
import { checkedInDeviceCookie } from '../../../tests/helpers/staffDeviceFixture.mjs';
import { birthDateForAge } from '../../../utils/horseAge.mjs';

const origin = 'http://localhost:3000';
const fixturePrefix = 'TestFixture-setAge';

describe('Equoria-0ro0p: the Owner set-age tool', () => {
  const cleanup = createCleanupTracker();
  const horseIds = [];
  let owner;
  let horse;
  const startingBirth = birthDateForAge(4);

  async function postSetAge(horseId, body) {
    const csrf = await fetchCsrf(app, {
      origin,
      extraCookies: [`accessToken=${owner.token}`, owner.device],
    });
    return request(app)
      .post(`/api/v1/admin/horses/${horseId}/set-age`)
      .set('Authorization', `Bearer ${owner.token}`)
      .set('Origin', origin)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send(body);
  }

  beforeAll(async () => {
    const tag = randomBytes(6).toString('hex');
    const user = await prisma.user.create({
      data: {
        emailVerified: true,
        email: `${fixturePrefix}-owner-${tag}@example.com`,
        username: `${fixturePrefix}-${tag}`.slice(0, 30),
        password: 'irrelevant-not-a-login-test',
        firstName: 'Set',
        lastName: 'Age',
        role: 'owner',
        money: 0,
        settings: {},
      },
    });
    cleanup.add(() => cleanupTestHorses(prisma, horseIds), 'fixture horse');
    cleanup.add(() => prisma.user.deleteMany({ where: { id: user.id } }), 'owner account');
    owner = {
      user,
      token: generateTestToken({ id: user.id, email: user.email, role: 'owner' }),
      device: await checkedInDeviceCookie(user.id),
    };
    horse = await createTestHorse(
      prisma,
      {
        name: `${fixturePrefix}-horse-${randomBytes(4).toString('hex')}`,
        sex: 'Mare',
        dateOfBirth: startingBirth,
        age: 4,
      },
      horseIds,
    );
  }, 60000);

  afterAll(() => cleanup.run(), 60000);

  it('answers 404 with the office copy for a horse number that names no horse', async () => {
    const top = await prisma.horse.aggregate({ _max: { id: true } });
    const missingId = (top._max.id ?? 0) + 100000;

    const res = await postSetAge(missingId, { gameAge: 6 });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ success: false, message: 'No horse has that number.' });
  });

  it('leaves the birth date as it was when the age write fails', async () => {
    const suffix = randomBytes(4).toString('hex');
    const fn = `ro0p_fail_age_${suffix}`;
    const trg = `ro0p_fail_age_trg_${suffix}`;
    await prisma.$executeRawUnsafe(`
      CREATE FUNCTION ${fn}() RETURNS trigger AS $$
      BEGIN
        IF NEW.id = ${Number(horse.id)} AND NEW.age IS DISTINCT FROM OLD.age THEN
          RAISE EXCEPTION 'injected test failure (TestFixture-0ro0p)';
        END IF;
        RETURN NEW;
      END $$ LANGUAGE plpgsql`);
    await prisma.$executeRawUnsafe(
      `CREATE TRIGGER ${trg} BEFORE UPDATE ON horses FOR EACH ROW EXECUTE FUNCTION ${fn}()`,
    );

    let res;
    try {
      res = await postSetAge(horse.id, { gameAge: 9 });
    } finally {
      await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${trg} ON horses`);
      await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS ${fn}()`);
    }

    expect(res.status).toBe(500);
    const row = await prisma.horse.findUnique({
      where: { id: horse.id },
      select: { dateOfBirth: true, age: true },
    });
    expect(row.dateOfBirth.getTime()).toBe(startingBirth.getTime());
    expect(row.age).toBe(4);
  });

  it('sets the birth date and the age together', async () => {
    const res = await postSetAge(horse.id, { gameAge: 6 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const row = await prisma.horse.findUnique({
      where: { id: horse.id },
      select: { dateOfBirth: true, age: true },
    });
    expect(row.age).toBe(6);
    expect(row.dateOfBirth.getTime()).toBe(birthDateForAge(6).getTime());
  });
});
