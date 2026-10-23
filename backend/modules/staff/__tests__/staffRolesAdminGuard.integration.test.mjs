/**
 * Promote and revoke moderators — real HTTP, real DB (Equoria-puj1e.1, Task 5).
 * Security gate: file-name token `AdminGuard`.
 *
 * Only the admin manages roles. Requests pass real authenticateToken, the
 * CSRF-protected staff router, trusted-device check-in
 * (helpers/staffFixtures.mjs) and requireStaffCapability('roles.manage').
 * Nothing is mocked; the concurrency case races two real requests against
 * the real database.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import {
  ORIGIN,
  STAFF_API,
  checkIn,
  cookiesFor,
  createUserFactory,
  get,
  post,
  startEmailCapture,
  stopEmailCapture,
  uid,
} from './helpers/staffFixtures.mjs';

const ROLES = `${STAFF_API}/roles`;
const LOOKUP = `${ROLES}/lookup`;
const LOG = `${STAFF_API}/log`;

const cleanup = createCleanupTracker();
const { makeUser, createdUserIds } = createUserFactory('staffroles');

const roleOf = async id => (await prisma.user.findUnique({ where: { id }, select: { role: true } })).role;
const logRowsAbout = targetId =>
  prisma.staffActionLog.findMany({ where: { targetId, capability: 'roles.manage' }, orderBy: { id: 'asc' } });

async function checkedInAdmin() {
  const admin = await makeUser('admin');
  return { admin, adminDevice: await checkIn(admin) };
}

const setRole = (admin, adminDevice, target, role, reason = 'trusted community helper') =>
  post(`${ROLES}/${target.id}`, admin, { role, reason }, adminDevice);

beforeAll(() => {
  const scope = () => ({ in: createdUserIds });
  // StaffActionLog.actor is onDelete Restrict, so fixture log rows go first.
  cleanup.add(() => prisma.staffActionLog.deleteMany({ where: { actorId: scope() } }), 'action log');
  cleanup.add(() => prisma.staffCheckinCode.deleteMany({ where: { userId: scope() } }), 'checkin codes');
  cleanup.add(() => prisma.staffTrustedDevice.deleteMany({ where: { userId: scope() } }), 'devices');
  cleanup.add(() => prisma.refreshToken.deleteMany({ where: { userId: scope() } }), 'refresh tokens');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: scope() } }), 'users');
});

afterAll(() => cleanup.run(), 60_000);

beforeEach(() => startEmailCapture());

afterEach(() => stopEmailCapture());

describe('Roles routes are admin-only (Equoria-puj1e.1)', () => {
  it('refuses a checked-in moderator with STAFF_CAPABILITY_REQUIRED on all three routes', async () => {
    const mod = await makeUser('moderator');
    const modDevice = await checkIn(mod);
    const player = await makeUser('user');

    const responses = [
      await get(ROLES, mod, modDevice),
      await post(LOOKUP, mod, { username: player.username }, modDevice),
      await post(`${ROLES}/${player.id}`, mod, { role: 'moderator', reason: 'nice' }, modDevice),
    ];
    for (const res of responses) {
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('STAFF_CAPABILITY_REQUIRED');
    }
    expect(await roleOf(player.id)).toBe('user');
    expect(await logRowsAbout(player.id)).toHaveLength(0);
  });

  it('answers a player with the ordinary 404 on all three routes', async () => {
    const player = await makeUser('user');
    const other = await makeUser('user');
    expect((await get(ROLES, player)).status).toBe(404);
    expect((await post(LOOKUP, player, { username: other.username })).status).toBe(404);
    expect((await post(`${ROLES}/${other.id}`, player, { role: 'moderator', reason: 'x' })).status).toBe(404);
    expect(await roleOf(other.id)).toBe('user');
  });
});

describe('Admin promotes and revokes moderators (Equoria-puj1e.1)', () => {
  it('promotes a player to moderator and records one roles.manage entry', async () => {
    const { admin, adminDevice } = await checkedInAdmin();
    const player = await makeUser('user');
    // A device row left over from an earlier stint as staff.
    await prisma.staffTrustedDevice.create({
      data: { userId: player.id, tokenHash: `leftover-${uid()}${uid()}`, expiresAt: new Date(Date.now() + 86_400_000) },
    });

    const res = await setRole(admin, adminDevice, player, 'moderator', '  steady forum helper  ');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: player.id, username: player.username, role: 'moderator' });
    expect(await roleOf(player.id)).toBe('moderator');
    const leftovers = await prisma.staffTrustedDevice.findMany({ where: { userId: player.id } });
    expect(leftovers).toHaveLength(1);
    expect(leftovers[0].revokedAt).not.toBeNull();

    const rows = await logRowsAbout(player.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      actorId: admin.id,
      actorRole: 'admin',
      capability: 'roles.manage',
      targetType: 'player',
      targetId: player.id,
      reason: 'steady forum helper',
      before: { role: 'user' },
      after: { role: 'moderator' },
      outcome: 'succeeded',
    });
  });

  it('revokes a moderator: role user, devices revoked, next staff request 404, one entry', async () => {
    const { admin, adminDevice } = await checkedInAdmin();
    const mod = await makeUser('moderator');
    const modDevice = await checkIn(mod);
    expect((await get(LOG, mod, modDevice)).status).toBe(200);

    const res = await setRole(admin, adminDevice, mod, 'user', 'stepped away');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: mod.id, username: mod.username, role: 'user' });
    expect(await roleOf(mod.id)).toBe('user');

    const devices = await prisma.staffTrustedDevice.findMany({ where: { userId: mod.id } });
    expect(devices.length).toBeGreaterThan(0);
    expect(devices.every(d => d.revokedAt !== null)).toBe(true);

    expect((await get(LOG, mod, modDevice)).status).toBe(404);

    const rows = await logRowsAbout(mod.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      capability: 'roles.manage',
      reason: 'stepped away',
      before: { role: 'moderator' },
      after: { role: 'user' },
    });
  });

  it('makes a re-promoted moderator check in afresh: the old device cookie is refused', async () => {
    const { admin, adminDevice } = await checkedInAdmin();
    const mod = await makeUser('moderator');
    const oldDevice = await checkIn(mod);

    expect((await setRole(admin, adminDevice, mod, 'user', 'break')).status).toBe(200);
    expect((await setRole(admin, adminDevice, mod, 'moderator', 'back from break')).status).toBe(200);

    const res = await get(LOG, mod, oldDevice);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('STAFF_CHECKIN_REQUIRED');
    expect(await logRowsAbout(mod.id)).toHaveLength(2);
  });

  it('refuses to act on self or another admin with 403 and changes nothing', async () => {
    const { admin, adminDevice } = await checkedInAdmin();
    const otherAdmin = await makeUser('admin');

    for (const target of [admin, otherAdmin]) {
      for (const role of ['user', 'moderator']) {
        const res = await setRole(admin, adminDevice, target, role, 'attempt');
        expect({ target: target.id, role, status: res.status }).toEqual({ target: target.id, role, status: 403 });
      }
      expect(await roleOf(target.id)).toBe('admin');
      expect(await logRowsAbout(target.id)).toHaveLength(0);
    }
  });

  it('answers 404 for an unknown user id', async () => {
    const { admin, adminDevice } = await checkedInAdmin();
    const res = await setRole(admin, adminDevice, { id: `no-such-user-${uid()}` }, 'moderator', 'x');
    expect(res.status).toBe(404);
  });

  it('answers 409 when the role would not change, or the player email is unverified', async () => {
    const { admin, adminDevice } = await checkedInAdmin();
    const mod = await makeUser('moderator');
    const player = await makeUser('user');
    const unverified = await makeUser('user', { emailVerified: false, emailVerifiedAt: null });

    expect((await setRole(admin, adminDevice, mod, 'moderator', 'again')).status).toBe(409);
    expect((await setRole(admin, adminDevice, player, 'user', 'again')).status).toBe(409);
    expect((await setRole(admin, adminDevice, unverified, 'moderator', 'helper')).status).toBe(409);

    expect(await roleOf(mod.id)).toBe('moderator');
    expect(await roleOf(player.id)).toBe('user');
    expect(await roleOf(unverified.id)).toBe('user');
    for (const u of [mod, player, unverified]) {
      expect(await logRowsAbout(u.id)).toHaveLength(0);
    }
  });

  it('rejects any role other than moderator or user, and a missing reason, with 400 before writing', async () => {
    const { admin, adminDevice } = await checkedInAdmin();
    const player = await makeUser('user');
    const bad = [
      { role: 'admin', reason: 'x' },
      { role: 'player', reason: 'x' },
      { role: ['moderator'], reason: 'x' },
      { reason: 'x' },
      { role: 'moderator' },
      { role: 'moderator', reason: '' },
      { role: 'moderator', reason: '   ' },
      { role: 'moderator', reason: 42 },
    ];
    for (const body of bad) {
      const res = await post(`${ROLES}/${player.id}`, admin, body, adminDevice);
      expect({ body, status: res.status }).toEqual({ body, status: 400 });
    }
    expect(await roleOf(player.id)).toBe('user');
    expect(await logRowsAbout(player.id)).toHaveLength(0);
  });

  it('lets exactly one of two parallel revokes succeed, with exactly one entry', async () => {
    const { admin, adminDevice } = await checkedInAdmin();
    const mod = await makeUser('moderator');

    // Fetch both CSRF pairs first so the two revokes leave together.
    const cookies = cookiesFor(admin, adminDevice);
    const csrfs = [
      await fetchCsrf(app, { origin: ORIGIN, extraCookies: cookies }),
      await fetchCsrf(app, { origin: ORIGIN, extraCookies: cookies }),
    ];
    const revoke = csrf =>
      request(app)
        .post(`${ROLES}/${mod.id}`)
        .set('Origin', ORIGIN)
        .set('Cookie', csrf.cookieHeader)
        .set('X-CSRF-Token', csrf.csrfToken)
        .send({ role: 'user', reason: 'double click' });

    // Hold the target's row lock in a real transaction until both requests
    // have read role=moderator and are blocked on their conditional role
    // write, so the two writes truly race instead of running back to back.
    // The requests are sent from the test body, not from inside the holder's
    // callback, so they run on their own connections.
    let signalLocked;
    const locked = new Promise(resolve => {
      signalLocked = resolve;
    });
    const holder = prisma.$transaction(
      async tx => {
        await tx.user.update({ where: { id: mod.id }, data: { role: 'moderator' } });
        signalLocked();
        const deadline = Date.now() + 15_000;
        for (;;) {
          // pg_stat_activity is snapshotted once per transaction; refresh it.
          await tx.$executeRaw`SELECT pg_stat_clear_snapshot()`;
          // Only sessions queued behind THIS holder count, directly or behind
          // the other revoke: a lock wait in another Jest worker's test must not
          // release the holder early (Equoria-8kbfl).
          const [{ n }] = await tx.$queryRaw`
            WITH RECURSIVE queued(pid) AS (
              SELECT pid FROM pg_stat_activity
              WHERE pg_backend_pid() = ANY(pg_blocking_pids(pid))
              UNION
              SELECT a.pid FROM pg_stat_activity a
              JOIN queued q ON q.pid = ANY(pg_blocking_pids(a.pid))
            )
            SELECT count(*)::int AS n FROM queued`;
          if (n >= 2) {
            break;
          }
          if (Date.now() > deadline) {
            throw new Error(`only ${n} revoke(s) reached the role write`);
          }
          await new Promise(resolve => setTimeout(resolve, 25));
        }
      },
      { timeout: 20_000 },
    );
    await locked;
    const inFlight = Promise.all(csrfs.map(revoke));
    await holder;
    const results = await inFlight;

    expect(results.map(r => r.status).sort()).toEqual([200, 409]);
    expect(results.find(r => r.status === 409).body.message).toBe('Role changed meanwhile');
    expect(await roleOf(mod.id)).toBe('user');
    expect(await logRowsAbout(mod.id)).toHaveLength(1);
  });
});

describe('Admin reads staff and looks up players (Equoria-puj1e.1)', () => {
  it('lists current staff with id, username and role only', async () => {
    const { admin, adminDevice } = await checkedInAdmin();
    const mod = await makeUser('moderator');
    const player = await makeUser('user');

    const res = await get(ROLES, admin, adminDevice);
    expect(res.status).toBe(200);
    const byId = new Map(res.body.staff.map(s => [s.id, s]));
    expect(byId.get(mod.id)).toEqual({ id: mod.id, username: mod.username, role: 'moderator' });
    expect(byId.get(admin.id)).toEqual({ id: admin.id, username: admin.username, role: 'admin' });
    expect(byId.has(player.id)).toBe(false);
    for (const entry of res.body.staff) {
      expect(Object.keys(entry).sort()).toEqual(['id', 'role', 'username']);
      // Owner ruling 2026-10-23 (Equoria-4tleh) added the owner as a third staff
      // level; the list was moderator and admin under the two-role contract.
      expect(['moderator', 'admin', 'owner']).toContain(entry.role);
    }
  });

  it('looks a player up by username, returning id, username and role only', async () => {
    const { admin, adminDevice } = await checkedInAdmin();
    const player = await makeUser('user');

    const res = await post(LOOKUP, admin, { username: player.username }, adminDevice);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: player.id, username: player.username, role: 'user' });
  });

  it('answers 404 for an unknown username and 400 for a malformed one', async () => {
    const { admin, adminDevice } = await checkedInAdmin();
    expect((await post(LOOKUP, admin, { username: `nobody${uid()}${uid()}` }, adminDevice)).status).toBe(404);
    for (const body of [{}, { username: '' }, { username: 42 }, { username: ['a'] }, { username: 'x'.repeat(101) }]) {
      const res = await post(LOOKUP, admin, body, adminDevice);
      expect({ body, status: res.status }).toEqual({ body, status: 400 });
    }
  });
});
