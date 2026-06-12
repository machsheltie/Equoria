/**
 * 🔒 Admin-MFA enforcement on POST /api/v1/shows/execute — real-DB integration
 * (Equoria-l432a, OWASP A07).
 *
 * WHY THIS SUITE EXISTS
 *   POST /api/v1/shows/execute scores every due closed show, pays out every
 *   prize, and burns/settles escrow — a high-impact administrative action.
 *   Equoria-619ik gated it `requireRole('admin')`. But the `/shows` router
 *   rides the authRouter (backend/app/routers.mjs), NOT the adminRouter, so the
 *   global `requireAdminMfa` mounted on the adminRouter (Equoria-te21j) does
 *   NOT cover this route. Equoria-l432a adds `requireAdminMfa` directly on the
 *   route (after `requireRole('admin')`) so the ADMIN_MFA_REQUIRED policy gates
 *   this high-impact write too.
 *
 * CONTRACT PROVEN (no mocks — real Express app, real DB, real JWT + CSRF):
 *   - Flag ON  + admin WITHOUT mfaEnabled  -> 403 "admin MFA required" (the fix;
 *                                             without it this returns 200 and
 *                                             executes the due shows).
 *   - Flag OFF + admin WITHOUT mfaEnabled  -> 200 normal execution (no
 *                                             behavioral change vs. before the
 *                                             policy — existing admins not
 *                                             locked out).
 *   - Flag ON  + admin WITH mfaEnabled     -> 200 (passes).
 *   - Flag ON  + non-admin                 -> 403 but NOT the MFA message
 *                                             (requireRole short-circuits first;
 *                                             the gate must not crash on a
 *                                             non-admin).
 *
 * The execute scan is scoped to THIS suite's own past-due show via the optional
 * `showIds` body filter (Equoria-rsss0) so this suite never claims a parallel
 * competition suite's open shows, and the env flag is toggled per-test and
 * restored in afterAll.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const ORIGIN = 'http://localhost:3000';
const EXECUTE_ROUTE = '/api/v1/shows/execute';
const FLAG = 'ADMIN_MFA_REQUIRED';

describe('Admin-MFA enforcement on POST /api/v1/shows/execute (Equoria-l432a)', () => {
  let adminNoMfa;
  let adminWithMfa;
  let normalUser;
  let adminNoMfaToken;
  let adminWithMfaToken;
  let normalUserToken;
  let pastShowId;
  const ts = `${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}`;
  const originalFlag = process.env[FLAG];
  const cleanup = createCleanupTracker();

  // Scoped, fail-loud cleanup. Delete child rows (results, entries) and the
  // show before the users/horse they reference, so FK order is respected. ids
  // are read at run() time.
  cleanup.add(
    () => prisma.competitionResult.deleteMany({ where: { showId: pastShowId } }),
    'competitionResult',
  );
  cleanup.add(() => prisma.showEntry.deleteMany({ where: { showId: pastShowId } }), 'showEntry');
  cleanup.add(
    () => prisma.show.deleteMany({ where: { id: { in: [pastShowId].filter(Boolean) } } }),
    'show',
  );
  cleanup.add(
    () =>
      prisma.horse.deleteMany({
        where: { name: { startsWith: `TestFixture-l432a-${ts}` } },
      }),
    'horse',
  );
  cleanup.add(
    () =>
      prisma.user.deleteMany({
        where: {
          id: { in: [adminNoMfa?.id, adminWithMfa?.id, normalUser?.id].filter(Boolean) },
        },
      }),
    'user',
  );

  beforeAll(async () => {
    const pw = await bcrypt.hash('AdminPassword123!', 1);

    adminNoMfa = await prisma.user.create({
      data: {
        username: `l432a_admin_nomfa_${ts}`,
        email: `l432a_admin_nomfa_${ts}@example.com`,
        password: pw,
        firstName: 'L432a',
        lastName: 'Tester',
        role: 'admin',
        mfaEnabled: false,
        money: 10000,
      },
    });
    adminWithMfa = await prisma.user.create({
      data: {
        username: `l432a_admin_mfa_${ts}`,
        email: `l432a_admin_mfa_${ts}@example.com`,
        password: pw,
        firstName: 'L432a',
        lastName: 'Tester',
        role: 'admin',
        mfaEnabled: true,
        money: 10000,
      },
    });
    normalUser = await prisma.user.create({
      data: {
        username: `l432a_user_${ts}`,
        email: `l432a_user_${ts}@example.com`,
        password: pw,
        firstName: 'L432a',
        lastName: 'Tester',
        role: 'user',
        mfaEnabled: false,
        money: 10000,
      },
    });

    adminNoMfaToken = generateTestToken({ id: adminNoMfa.id, role: 'admin' });
    adminWithMfaToken = generateTestToken({ id: adminWithMfa.id, role: 'admin' });
    normalUserToken = generateTestToken({ id: normalUser.id, role: 'user' });

    // A horse owned by the normal user, entered into a past-due show so the
    // happy-path execute call has real work to do (scoring + payout).
    const horse = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-l432a-${ts}-horse`,
        sex: 'Mare',
        dateOfBirth: new Date('2018-01-01'),
        age: 7,
        userId: normalUser.id,
        healthStatus: 'healthy',
        speed: 60,
        stamina: 60,
        agility: 60,
        balance: 60,
        precision: 60,
        boldness: 60,
      },
    });

    const pastDate = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago
    const pastShow = await prisma.show.create({
      data: {
        name: `TestFixture-l432a-${ts}-show`,
        discipline: 'Dressage',
        entryFee: 0,
        levelMin: 1,
        levelMax: 999,
        prize: 0,
        runDate: pastDate,
        status: 'open',
        openDate: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
        closeDate: pastDate,
        createdByUserId: normalUser.id,
        prizeEscrow: 0,
        feeEscrow: 0,
      },
    });
    pastShowId = pastShow.id;

    await prisma.showEntry.create({
      data: { showId: pastShowId, horseId: horse.id, userId: normalUser.id, feePaid: 0 },
    });
  }, 120000);

  afterAll(async () => {
    if (originalFlag === undefined) {
      delete process.env[FLAG];
    } else {
      process.env[FLAG] = originalFlag;
    }
    await cleanup.run();
  }, 120000);

  it('flag ON: admin WITHOUT mfaEnabled is blocked on /shows/execute with a clear 403', async () => {
    process.env[FLAG] = 'true';
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${adminNoMfaToken}`] });
    const res = await request(app)
      .post(EXECUTE_ROUTE)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${adminNoMfaToken}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ showIds: [pastShowId] });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(String(res.body.message)).toMatch(/admin.*MFA.*required/i);
    // Sentinel: the gate short-circuited before the controller — NO execution
    // payload was produced.
    expect(res.body.data).toBeUndefined();

    // The show is still 'open' — the blocked call must not have executed it.
    const show = await prisma.show.findUnique({
      where: { id: pastShowId },
      select: { status: true },
    });
    expect(show.status).toBe('open');
  });

  it('flag OFF (default): admin WITHOUT mfaEnabled executes normally (200, unchanged behavior)', async () => {
    delete process.env[FLAG];
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${adminNoMfaToken}`] });
    const res = await request(app)
      .post(EXECUTE_ROUTE)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${adminNoMfaToken}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ showIds: [pastShowId] });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.data.executed).toBe('number');
    expect(typeof res.body.data.message).toBe('string');

    // The durable, race-free invariant: this suite's past-due show is no longer
    // 'open' — it has been claimed/completed by a sanctioned executor.
    const show = await prisma.show.findUnique({
      where: { id: pastShowId },
      select: { status: true },
    });
    expect(['completed', 'executing']).toContain(show.status);
  });

  it('flag ON: admin WITH mfaEnabled passes the gate (200)', async () => {
    process.env[FLAG] = 'true';
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${adminWithMfaToken}`] });
    const res = await request(app)
      .post(EXECUTE_ROUTE)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${adminWithMfaToken}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      // This suite's show was already completed by the flag-OFF test above; the
      // scoped scan finds 0 due shows, so executed === 0. We assert the request
      // PASSED the MFA gate (200, not a 403 MFA rejection) — that is the
      // contract under test here.
      .send({ showIds: [pastShowId] });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.data.executed).toBe('number');
  });

  it('flag ON: non-admin user is rejected by requireRole (403, NOT the MFA message, no crash)', async () => {
    process.env[FLAG] = 'true';
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${normalUserToken}`] });
    const res = await request(app)
      .post(EXECUTE_ROUTE)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${normalUserToken}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ showIds: [pastShowId] });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    // requireRole('admin') rejects a 'user' BEFORE requireAdminMfa runs, so the
    // message is the role rejection, not the MFA-specific one.
    expect(res.body.message).toBe('Insufficient permissions');
    expect(String(res.body.message)).not.toMatch(/admin.*MFA.*required/i);
  });
});
