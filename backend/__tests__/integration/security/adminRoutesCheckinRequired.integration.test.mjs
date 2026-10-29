/**
 * Admin tools need the emailed staff check-in (Equoria-n256i, owner ruling
 * 2026-10-29, q289).
 *
 * WHAT THIS PROVES
 * The admin routes are found by walking the mounted Express app itself, not
 * by a hand-kept list: every route whose chain (mount-level or per-route)
 * contains a requireRole gate naming a staff role is an admin route. For each
 * one, an admin with a verified email but no check-in on this browser is
 * refused with 403 staffCheckinRequired before any handler runs. A new
 * requireRole('admin') route that forgets requireStaffCheckin('admin') fails
 * the static walk and the HTTP sweep.
 *
 * Also: a checked-in admin gets through; another account's device, a revoked
 * device and a demoted account (whose old token still says admin) are refused;
 * the GET /horses?userId= admin override needs the check-in as well.
 *
 * REAL APP / REAL DB: backend/app.mjs over supertest, real user and device
 * rows, the check-in itself through the real staff routes with the email
 * service's non-production capture sink. Nothing is mocked.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { requireRole } from '../../../middleware/auth.mjs';
import { isStaffRole } from '../../../modules/staff/capabilities.mjs';
import { staffCheckinGuardMarker } from '../../../modules/staff/middleware/requireStaffCheckin.mjs';
import { revokeStaffTrustedDevicesTx } from '../../../modules/staff/index.mjs';
import { createCleanupTracker } from '../../helpers/failLoudCleanup.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import {
  ORIGIN,
  checkIn,
  cookiesFor,
  createUserFactory,
  startEmailCapture,
  stopEmailCapture,
  uid,
} from '../../../modules/staff/__tests__/helpers/staffFixtures.mjs';
import { testHorseData } from '../../helpers/createTestHorse.mjs';

// ── Route walk ──────────────────────────────────────────────────────────────

/** The static path a `use()` layer is mounted at ('' for '/'). Unreadable mounts fail loudly. */
function mountPathOf(layer) {
  // `use('/')` compiles to ^\/?(?=\/|$): an empty prefix.
  const match = layer.regexp.source.match(/^\^((?:\\\/(?:[\w-]|\\\.)+)*)\\\/\?\(\?=\\\/\|\$\)$/);
  if (!match) {
    throw new Error(`admin-route walk cannot read the mount ${layer.regexp.source}`);
  }
  return match[1].replace(/\\\//g, '/').replace(/\\\./g, '.');
}

/** Whether `gatePath` covers `path` on a segment boundary. */
const covers = (gatePath, path) => gatePath === '' || path === gatePath || path.startsWith(`${gatePath}/`);

const gateOf = (handle, path) => {
  if (Array.isArray(handle?.requiredRoles) && handle.requiredRoles.some(isStaffRole)) {
    return { kind: 'role', path, roles: handle.requiredRoles };
  }
  if (handle?.[staffCheckinGuardMarker]) {
    return { kind: 'checkin', path };
  }
  return null;
};

/**
 * Every route behind a staff-role requireRole gate, with whether a check-in
 * guard sits in the same chain.
 * @returns {{ method: string, path: string, checkin: boolean }[]}
 */
function collectAdminRoutes(router, prefix = '', inherited = []) {
  const found = [];
  const gates = [...inherited];
  for (const layer of router.stack) {
    if (layer.route) {
      if (typeof layer.route.path !== 'string') {
        throw new Error(`admin-route walk cannot read the route path under ${prefix}`);
      }
      // A router's '/' route answers at the mount itself (GET /api/v1/admin/news).
      const path = layer.route.path === '/' && prefix ? prefix : prefix + layer.route.path;
      const chain = [
        ...gates.filter(gate => covers(gate.path, path)),
        ...layer.route.stack.map(l => gateOf(l.handle, path)).filter(Boolean),
      ];
      if (chain.some(gate => gate.kind === 'role')) {
        const checkin = chain.some(gate => gate.kind === 'checkin');
        for (const method of Object.keys(layer.route.methods)) {
          found.push({ method, path, checkin });
        }
      }
      continue;
    }
    // Only routers and gates need their mount read; any other middleware (a
    // catch-all '*', say) decides nothing here.
    const gateHere = gateOf(layer.handle, '');
    if (!layer.handle?.stack && !gateHere) {
      continue;
    }
    const path = prefix + mountPathOf(layer);
    if (layer.handle?.stack) {
      found.push(
        ...collectAdminRoutes(
          layer.handle,
          path,
          gates.filter(gate => covers(gate.path, path)),
        ),
      );
      continue;
    }
    const gate = gateOf(layer.handle, path);
    if (gate) {
      gates.push(gate);
    }
  }
  return found;
}

const concretePath = path => path.replace(/:\w+\??/g, '1');

// ── Fixtures ────────────────────────────────────────────────────────────────

const cleanup = createCleanupTracker();
const { makeUser, createdUserIds } = createUserFactory('admincheckin');
const horseIds = [];

beforeAll(() => {
  const scope = () => ({ in: createdUserIds });
  cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: horseIds } } }), 'horses');
  cleanup.add(() => prisma.staffActionLog.deleteMany({ where: { actorId: scope() } }), 'action log');
  cleanup.add(() => prisma.staffCheckinCode.deleteMany({ where: { userId: scope() } }), 'checkin codes');
  cleanup.add(() => prisma.staffTrustedDevice.deleteMany({ where: { userId: scope() } }), 'devices');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: scope() } }), 'users');
});

afterAll(() => cleanup.run(), 60_000);

beforeEach(() => startEmailCapture());
afterEach(() => stopEmailCapture());

async function send(method, path, user, device) {
  const cookies = cookiesFor(user, device);
  if (method === 'get' || method === 'head') {
    return request(app)[method](path).set('Origin', ORIGIN).set('Cookie', cookies);
  }
  const csrf = await fetchCsrf(app, { origin: ORIGIN, extraCookies: cookies });
  const agent = request(app);
  return agent[method](path)
    .set('Origin', ORIGIN)
    .set('Cookie', csrf.cookieHeader)
    .set('X-CSRF-Token', csrf.csrfToken)
    .send({});
}

const expectCheckinRequired = (res, label) => {
  if (res.status !== 403 || res.body?.code !== 'staffCheckinRequired') {
    throw new Error(
      `${label} answered ${res.status} ${JSON.stringify(res.body)} to an admin who has not ` +
        'checked in; every admin route needs requireStaffCheckin (Equoria-n256i).',
    );
  }
};

// ── Tests ───────────────────────────────────────────────────────────────────

describe('admin routes are found from the mounted app (Equoria-n256i)', () => {
  const routes = collectAdminRoutes(app._router);
  const keys = routes.map(r => `${r.method.toUpperCase()} ${r.path}`);

  it('finds the admin mounts and the per-route admin gates', () => {
    for (const known of [
      'GET /api/v1/admin/cron/status',
      'POST /api/v1/admin/horses/:id/set-age',
      'GET /api/v1/admin/news',
      'POST /api/v1/admin/news',
      'GET /api/v1/performance/metrics',
      'POST /api/v1/memory/gc',
      'POST /api/v1/breeds',
      'PATCH /api/v1/forum/threads/:id/pin',
      'POST /api/v1/shows/execute',
    ]) {
      expect(keys).toContain(known);
    }
    expect(keys.some(k => k.includes(' /api/v1/optimization/'))).toBe(true);
    expect(keys.some(k => k.includes(' /api/v1/compatibility/'))).toBe(true);
    expect(routes.length).toBeGreaterThan(30);
  });

  it('every admin route carries the check-in guard', () => {
    expect(routes.filter(r => !r.checkin).map(r => `${r.method.toUpperCase()} ${r.path}`)).toEqual([]);
  });

  it('the walk catches a new admin route that forgets the check-in (sentinel-positive)', () => {
    const planted = express();
    const router = express.Router();
    router.post('/forgot', requireRole('admin'), (req, res) => res.json({ ok: true }));
    planted.use('/api/v1/planted', router);
    planted.use(
      '/api/v1/plantedMount',
      requireRole('admin'),
      express.Router().get('/x', () => {}),
    );
    const found = collectAdminRoutes(planted._router);
    expect(found).toEqual([
      { method: 'post', path: '/api/v1/planted/forgot', checkin: false },
      { method: 'get', path: '/api/v1/plantedMount/x', checkin: false },
    ]);
  });
});

describe('an admin who has not checked in reaches no admin route (Equoria-n256i)', () => {
  it('every enumerated admin route answers 403 staffCheckinRequired', async () => {
    const admin = await makeUser('admin');
    const routes = collectAdminRoutes(app._router);
    for (const route of routes) {
      const path = concretePath(route.path);
      const res = await send(route.method, path, admin);
      expectCheckinRequired(res, `${route.method.toUpperCase()} ${path}`);
    }
  }, 120_000);

  it('the owner is held to the same check-in', async () => {
    const owner = await makeUser('owner');
    expectCheckinRequired(await send('get', '/api/v1/admin/cron/status', owner), 'GET /api/v1/admin/cron/status');
  }, 30_000);
});

describe('the check-in opens admin tools only for its own live account (Equoria-n256i)', () => {
  it('a checked-in admin gets through to the tool', async () => {
    const admin = await makeUser('admin');
    const device = await checkIn(admin);
    const res = await send('get', '/api/v1/admin/cron/status', admin, device);
    expect(res.status).toBe(200);
    expect(res.body.code).toBeUndefined();
  }, 60_000);

  it("another admin's device does not open the tools", async () => {
    const admin = await makeUser('admin');
    const other = await makeUser('admin');
    const othersDevice = await checkIn(other);
    expectCheckinRequired(
      await send('get', '/api/v1/admin/cron/status', admin, othersDevice),
      "GET /api/v1/admin/cron/status with another account's device",
    );
  }, 60_000);

  it('a revoked device (password or email change, q261) no longer opens them', async () => {
    const admin = await makeUser('admin');
    const device = await checkIn(admin);
    await prisma.$transaction(tx => revokeStaffTrustedDevicesTx(tx, admin.id));
    expectCheckinRequired(
      await send('get', '/api/v1/admin/cron/status', admin, device),
      'GET /api/v1/admin/cron/status with a revoked device',
    );
  }, 60_000);

  it('losing staff access closes them although the old token still says admin', async () => {
    const admin = await makeUser('admin');
    const device = await checkIn(admin);
    await prisma.user.update({ where: { id: admin.id }, data: { role: 'user' } });
    const res = await send('get', '/api/v1/admin/cron/status', admin, device);
    expect(res.status).toBe(403);
    expect(res.body.message).toBe('Insufficient permissions');
  }, 60_000);
});

describe("GET /horses?userId= (an admin's look at another stable) needs the check-in", () => {
  it('without it the admin sees only their own horses; with it, the named stable', async () => {
    const admin = await makeUser('admin');
    const player = await makeUser('user');
    const horse = await prisma.horse.create({
      data: await testHorseData(prisma, {
        ...fixtureColor(),
        name: `TestFixture-admincheckin-${uid()}`,
        sex: 'Mare',
        dateOfBirth: new Date('2020-01-01'),
        userId: player.id,
      }),
    });
    horseIds.push(horse.id);
    const path = `/api/v1/horses?userId=${player.id}`;

    const before = await send('get', path, admin);
    expect(before.status).toBe(200);
    expect(before.body.data.map(h => h.id)).not.toContain(horse.id);

    const device = await checkIn(admin);
    const after = await send('get', path, admin, device);
    expect(after.status).toBe(200);
    expect(after.body.data.map(h => h.id)).toContain(horse.id);
  }, 60_000);
});
