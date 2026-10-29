/**
 * Check-in codes are bound to the account's security state (STAFF-CR-01).
 * Real HTTP, real DB. Security gate: file-name token `Mfa`.
 *
 * A code issued before a password change, a password reset, a verified-email
 * change or a demote/re-promote must never finish a check-in. Races run as
 * real concurrent schedules: a lock holder (helpers/staffFixtures.mjs
 * raceUnderLock) keeps the contested rows locked until every racing request
 * is settled or queued on a lock (pg_stat_activity), then releases them
 * together.
 * Nothing is mocked; the failed-log case uses a real Postgres trigger.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { readFileSync, existsSync } from 'node:fs';
import {
  ORIGIN,
  STAFF_API,
  capturedFor,
  checkIn,
  createUserFactory,
  deviceCookieFrom,
  latestCode,
  post,
  preparePost,
  raceUnderLock,
  startEmailCapture,
  stopEmailCapture,
  uid,
} from './helpers/staffFixtures.mjs';

const REQUEST = `${STAFF_API}/checkin/request`;
const VERIFY = `${STAFF_API}/checkin/verify`;
const PASSWORD = 'CorrectHorse1!';
const NEW_PASSWORD = 'RescuedPass9!x';
// Usernames with this prefix make the test-only trigger refuse their log rows.
const FAILING_LOG_PREFIX = 'stfaillog';

const cleanup = createCleanupTracker();
const { makeUser, createdUserIds } = createUserFactory('stsecstate');

beforeAll(() => {
  const scope = () => ({ in: createdUserIds });
  cleanup.add(() => prisma.staffActionLog.deleteMany({ where: { actorId: scope() } }), 'action log');
  cleanup.add(() => prisma.staffCheckinCode.deleteMany({ where: { userId: scope() } }), 'checkin codes');
  cleanup.add(() => prisma.staffTrustedDevice.deleteMany({ where: { userId: scope() } }), 'devices');
  cleanup.add(() => prisma.emailVerificationToken.deleteMany({ where: { userId: scope() } }), 'verification tokens');
  cleanup.add(
    () =>
      prisma.$executeRawUnsafe('DELETE FROM password_reset_tokens WHERE "userId" = ANY($1::text[])', createdUserIds),
    'password reset tokens',
  );
  cleanup.add(() => prisma.refreshToken.deleteMany({ where: { userId: scope() } }), 'refresh tokens');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: scope() } }), 'users');
});

afterAll(() => cleanup.run(), 60_000);

beforeEach(() => startEmailCapture());

afterEach(() => stopEmailCapture());

/** A moderator with a real password, so the password routes accept them. */
async function makeModerator(extra = {}) {
  return makeUser('moderator', { password: await bcrypt.hash(PASSWORD, 4), ...extra });
}

/** A session issued now — after any password change, so authentication passes. */
const freshSession = user => ({
  ...user,
  token: generateTestToken({ id: user.id, email: user.email, role: 'moderator' }),
});

/** Send an authenticated non-staff request (auth routes take the bearer token). */
async function authedPost(url, body, user) {
  const csrf = await fetchCsrf(app, { origin: ORIGIN, extraCookies: [`accessToken=${user.token}`] });
  return request(app)
    .post(url)
    .set('Origin', ORIGIN)
    .set('Authorization', `Bearer ${user.token}`)
    .set('Cookie', csrf.cookieHeader)
    .set('X-CSRF-Token', csrf.csrfToken)
    .send(body);
}

/** The newest captured link token of `kind` (email-change, password-reset). */
function capturedLinkToken(kind) {
  const file = process.env.EMAIL_CAPTURE_FILE;
  const entry = (existsSync(file) ? readFileSync(file, 'utf-8').trim().split('\n') : [])
    .filter(Boolean)
    .map(line => JSON.parse(line))
    .filter(e => e.kind === kind)
    .at(-1);
  if (!entry) {
    throw new Error(`No "${kind}" email captured`);
  }
  return new URL(entry.preview).searchParams.get('token');
}

const devicesOf = userId => prisma.staffTrustedDevice.count({ where: { userId } });
const checkinLogsOf = actorId => prisma.staffActionLog.count({ where: { actorId, capability: 'staff.checkin' } });
const codesOf = userId =>
  prisma.staffCheckinCode.findMany({ where: { userId }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });

async function requestCode(user) {
  expect((await post(REQUEST, user)).status).toBe(202);
  return latestCode(user.email);
}

async function expectRefused(user, code) {
  const res = await post(VERIFY, user, { code });
  expect(res.status).toBe(400);
  expect(res.body.code).toBe('staffCheckinCodeInvalid');
  expect(deviceCookieFrom(res)).toBeNull();
  expect(await devicesOf(user.id)).toBe(0);
  expect(await checkinLogsOf(user.id)).toBe(0);
}

describe('An outstanding code dies with the security state it was issued under (STAFF-CR-01)', () => {
  it('refuses a code issued before POST /auth/change-password', async () => {
    const mod = await makeModerator();
    const code = await requestCode(mod);

    const changed = await authedPost(
      '/api/v1/auth/change-password',
      { oldPassword: PASSWORD, newPassword: NEW_PASSWORD },
      mod,
    );
    expect(changed.status).toBe(200);

    await expectRefused(freshSession(mod), code);
  }, 60_000);

  it('refuses a code issued before POST /auth/reset-password', async () => {
    const mod = await makeModerator();
    const code = await requestCode(mod);

    const forgot = await request(app)
      .post('/api/v1/auth/forgot-password')
      .set('Origin', ORIGIN)
      .send({ email: mod.email });
    expect(forgot.status).toBe(200);
    const reset = await request(app)
      .post('/api/v1/auth/reset-password')
      .set('Origin', ORIGIN)
      .send({ token: capturedLinkToken('password-reset'), newPassword: NEW_PASSWORD });
    expect(reset.status).toBe(200);

    await expectRefused(freshSession(mod), code);
  }, 60_000);

  it('refuses a code issued before a confirmed change of verified email', async () => {
    const mod = await makeModerator();
    const code = await requestCode(mod);

    const destination = `stsecstate-new-${uid()}${uid()}@test.com`;
    const staged = await authedPost(
      '/api/v1/auth/email-change/request',
      { email: destination, password: PASSWORD },
      mod,
    );
    expect(staged.status).toBe(200);
    const confirmed = await request(app)
      .get(`/api/v1/auth/email-change/confirm?token=${encodeURIComponent(capturedLinkToken('email-change'))}`)
      .set('Origin', ORIGIN);
    expect(confirmed.status).toBe(200);
    const row = await prisma.user.findUnique({ where: { id: mod.id }, select: { email: true, emailVerified: true } });
    expect(row).toEqual({ email: destination, emailVerified: true });

    await expectRefused(freshSession({ ...mod, email: destination }), code);
  }, 60_000);

  it('refuses a code issued before a demote and re-promote', async () => {
    // Owner ruling q76 (Equoria-i1hgt): only the owner changes staff roles.
    const owner = await makeUser('owner');
    const ownerDevice = await checkIn(owner);
    const mod = await makeModerator();
    const code = await requestCode(mod);

    for (const role of ['user', 'moderator']) {
      const res = await post(`${STAFF_API}/roles/${mod.id}`, owner, { role, reason: 'role review' }, ownerDevice);
      expect(res.status).toBe(200);
    }

    await expectRefused(mod, code);
    // A code issued after the re-promotion still works.
    expect((await post(VERIFY, mod, { code: await requestCode(mod) })).status).toBe(200);
  }, 60_000);
});

describe('Check-in races resolve against the live account (STAFF-CR-01)', () => {
  it('a resend racing a verify never lets the older code finish after the newer one exists', async () => {
    const mod = await makeModerator();
    const codeA = await requestCode(mod);
    const [rowA] = await codesOf(mod.id);

    const sendVerify = await preparePost(VERIFY, mod, { code: codeA });
    const sendResend = await preparePost(REQUEST, mod);
    // Lock code A so the verify stalls on it while the resend runs.
    // The verify is queued first, then the resend.
    const [verified, resent] = await raceUnderLock(
      tx => tx.$queryRaw`SELECT id FROM staff_checkin_codes WHERE id = ${rowA.id} FOR UPDATE`,
      [sendVerify, sendResend],
    );

    expect(resent.status).toBe(202);
    const [a, b] = await codesOf(mod.id);
    expect(b).toBeDefined();
    if (verified.status === 200) {
      // Allowed only when A was consumed while it was still the newest code.
      expect(a.usedAt).not.toBeNull();
      expect(a.usedAt.getTime()).toBeLessThanOrEqual(b.createdAt.getTime());
    } else {
      expect(verified.status).toBe(400);
      expect(await devicesOf(mod.id)).toBe(0);
      expect(a.usedAt).toBeNull();
    }
  }, 60_000);

  it('a role revocation committing during a correct verify leaves no device', async () => {
    const mod = await makeModerator();
    const code = await requestCode(mod);
    const sendVerify = await preparePost(VERIFY, mod, { code });

    // The revocation has written the role but not committed when verify starts,
    // so the guard's own read still sees a moderator.
    const [res] = await raceUnderLock(
      tx => tx.user.update({ where: { id: mod.id }, data: { role: 'user' } }),
      [sendVerify],
    );

    expect(res.status).toBe(400);
    expect(deviceCookieFrom(res)).toBeNull();
    expect(await devicesOf(mod.id)).toBe(0);
    expect(await checkinLogsOf(mod.id)).toBe(0);
  }, 60_000);

  /**
   * A security-state change committing between the verify's two transactions.
   * The lock holder holds the code row, so the verify's first transaction
   * takes the User row and then queues on the code; the change request
   * queues behind it on the User row. On release the verify's first
   * transaction commits (a guess reserved) and the change takes the User row
   * at once — before the verify's bcrypt compare ends — so the verify's
   * second transaction re-reads the account only after the change commits.
   */
  async function raceChangeAgainstVerify(mod, code, sendChange) {
    const [row] = await codesOf(mod.id);
    const sendVerify = await preparePost(VERIFY, mod, { code });
    const [verified, changed] = await raceUnderLock(
      tx => tx.$queryRaw`SELECT id FROM staff_checkin_codes WHERE id = ${row.id} FOR UPDATE`,
      [sendVerify, sendChange],
    );
    expect(changed.status).toBe(200);
    // The verify got past its first transaction: a guess was reserved.
    expect((await codesOf(mod.id))[0].attempts).toBe(1);
    expect(verified.status).toBe(400);
    expect(verified.body.code).toBe('staffCheckinCodeInvalid');
    expect(deviceCookieFrom(verified)).toBeNull();
    expect(await devicesOf(mod.id)).toBe(0);
    expect(await checkinLogsOf(mod.id)).toBe(0);
  }

  it('a password change committing during a correct verify leaves no device', async () => {
    const mod = await makeModerator();
    const code = await requestCode(mod);
    const csrf = await fetchCsrf(app, { origin: ORIGIN, extraCookies: [`accessToken=${mod.token}`] });
    const sendChange = () =>
      request(app)
        .post('/api/v1/auth/change-password')
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${mod.token}`)
        .set('Cookie', csrf.cookieHeader)
        .set('X-CSRF-Token', csrf.csrfToken)
        .send({ oldPassword: PASSWORD, newPassword: NEW_PASSWORD });

    await raceChangeAgainstVerify(mod, code, sendChange);
  }, 60_000);

  it('a password reset committing during a correct verify leaves no device', async () => {
    const mod = await makeModerator();
    const code = await requestCode(mod);
    const forgot = await request(app)
      .post('/api/v1/auth/forgot-password')
      .set('Origin', ORIGIN)
      .send({ email: mod.email });
    expect(forgot.status).toBe(200);
    const token = capturedLinkToken('password-reset');
    const sendReset = () =>
      request(app).post('/api/v1/auth/reset-password').set('Origin', ORIGIN).send({ token, newPassword: NEW_PASSWORD });

    await raceChangeAgainstVerify(mod, code, sendReset);
  }, 60_000);

  it('a verified-email change committing during a correct verify leaves no device', async () => {
    const mod = await makeModerator();
    const code = await requestCode(mod);
    const destination = `stsecstate-new-${uid()}${uid()}@test.com`;
    const staged = await authedPost(
      '/api/v1/auth/email-change/request',
      { email: destination, password: PASSWORD },
      mod,
    );
    expect(staged.status).toBe(200);
    const token = capturedLinkToken('email-change');
    const sendConfirm = () =>
      request(app)
        .get(`/api/v1/auth/email-change/confirm?token=${encodeURIComponent(token)}`)
        .set('Origin', ORIGIN);

    await raceChangeAgainstVerify(mod, code, sendConfirm);
    const row = await prisma.user.findUnique({ where: { id: mod.id }, select: { email: true } });
    expect(row.email).toBe(destination);
  }, 60_000);

  it('two simultaneous correct verifications create exactly one device and one log row', async () => {
    const mod = await makeModerator();
    const code = await requestCode(mod);
    const [row] = await codesOf(mod.id);
    const sends = [await preparePost(VERIFY, mod, { code }), await preparePost(VERIFY, mod, { code })];

    const results = await raceUnderLock(
      tx => tx.$queryRaw`SELECT id FROM staff_checkin_codes WHERE id = ${row.id} FOR UPDATE`,
      sends,
    );

    expect(results.map(r => r.status).sort()).toEqual([200, 400]);
    expect(await devicesOf(mod.id)).toBe(1);
    expect(await checkinLogsOf(mod.id)).toBe(1);
  }, 60_000);

  it('parallel code requests at the last rate-limit slot issue exactly one code', async () => {
    const mod = await makeModerator();
    await requestCode(mod);
    await requestCode(mod);
    const sends = [await preparePost(REQUEST, mod), await preparePost(REQUEST, mod)];

    const results = await raceUnderLock(
      tx => tx.$queryRaw`SELECT id FROM "User" WHERE id = ${mod.id} FOR UPDATE`,
      sends,
    );

    expect(results.map(r => r.status).sort()).toEqual([202, 429]);
    expect(await prisma.staffCheckinCode.count({ where: { userId: mod.id } })).toBe(3);
    expect(capturedFor(mod.email)).toHaveLength(3);
  }, 60_000);
});

describe('A check-in commits whole or not at all (STAFF-CR-01)', () => {
  beforeAll(async () => {
    // Test-only trigger: refuse log rows written by a fixture whose username
    // carries FAILING_LOG_PREFIX. Every other actor is untouched.
    await prisma.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION staff_test_fail_log() RETURNS trigger AS $$
      BEGIN
        IF EXISTS (SELECT 1 FROM "User" WHERE id = NEW."actorId" AND username LIKE '${FAILING_LOG_PREFIX}%') THEN
          RAISE EXCEPTION 'staff log write refused by test trigger';
        END IF;
        RETURN NEW;
      END $$ LANGUAGE plpgsql`);
    await prisma.$executeRawUnsafe(
      'CREATE TRIGGER staff_test_fail_log BEFORE INSERT ON staff_action_log FOR EACH ROW EXECUTE FUNCTION staff_test_fail_log()',
    );
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS staff_test_fail_log ON staff_action_log');
    await prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS staff_test_fail_log()');
  });

  it('a failed log write leaves no trusted device and an unconsumed code', async () => {
    const suffix = `${uid()}${uid()}`;
    const mod = await makeModerator({ username: `${FAILING_LOG_PREFIX}${suffix}` });
    const code = await requestCode(mod);

    const res = await post(VERIFY, mod, { code });
    expect(res.status).toBe(500);
    expect(deviceCookieFrom(res)).toBeNull();
    expect(await devicesOf(mod.id)).toBe(0);
    expect(await checkinLogsOf(mod.id)).toBe(0);
    const [row] = await codesOf(mod.id);
    expect(row.usedAt).toBeNull();
  }, 60_000);
});
