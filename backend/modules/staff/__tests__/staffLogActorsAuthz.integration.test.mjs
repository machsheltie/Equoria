/**
 * The ledger's actor list — real HTTP, real DB (STAFF-CR-16).
 * Security gate: file-name token `Authz`.
 *
 * The admin filters the permanent ledger by steward. The filter's choices come
 * from GET /api/v1/staff/log/actors: every account that has ever written to the
 * log, drawn from the whole log rather than one page, so a steward who was
 * revoked or erased stays selectable. Only log.view.all may read it.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { eraseUserAccount } from '../../users/index.mjs';
import { LOG_PAGE_SIZE, recordStaffActionTx } from '../services/staffActionLogService.mjs';
import {
  STAFF_API,
  checkIn,
  createUserFactory,
  get,
  post,
  startEmailCapture,
  stopEmailCapture,
  uid,
} from './helpers/staffFixtures.mjs';

const LOG = `${STAFF_API}/log`;
const ACTORS = `${STAFF_API}/log/actors`;

const cleanup = createCleanupTracker();
const { makeUser, createdUserIds } = createUserFactory('staffactors');

const entryFor = actor => ({
  actorId: actor.id,
  actorRole: actor.role,
  capability: 'rename',
  targetType: 'player',
  targetId: `target-${uid()}`,
});

beforeAll(() => {
  const scope = () => ({ in: createdUserIds });
  cleanup.add(() => prisma.staffActionLog.deleteMany({ where: { actorId: scope() } }), 'action log');
  cleanup.add(() => prisma.notification.deleteMany({ where: { userId: scope() } }), 'notifications');
  cleanup.add(() => prisma.staffCheckinCode.deleteMany({ where: { userId: scope() } }), 'checkin codes');
  cleanup.add(() => prisma.staffTrustedDevice.deleteMany({ where: { userId: scope() } }), 'devices');
  cleanup.add(() => prisma.refreshToken.deleteMany({ where: { userId: scope() } }), 'refresh tokens');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: scope() } }), 'users');
});

afterAll(() => cleanup.run(), 60_000);

beforeEach(() => startEmailCapture());

afterEach(() => stopEmailCapture());

describe('The ledger actor list (STAFF-CR-16)', () => {
  it('lists a revoked and an erased steward once each, even past the first page', async () => {
    const admin = await makeUser('admin');
    const revoked = await makeUser('moderator');
    const erased = await makeUser('moderator');
    const adminDevice = await checkIn(admin);

    const revokedEntry = await recordStaffActionTx(prisma, entryFor(revoked));
    await recordStaffActionTx(prisma, entryFor(revoked));
    const erasedEntry = await recordStaffActionTx(prisma, entryFor(erased));

    for (const mod of [revoked, erased]) {
      const demoted = await post(
        `${STAFF_API}/roles/${mod.id}`,
        admin,
        { role: 'user', reason: 'stepped down' },
        adminDevice,
      );
      expect(demoted.status).toBe(200);
    }
    expect(await eraseUserAccount(erased.id)).toEqual({ deleted: true });

    // Bury both stewards' entries below a full page of newer ones.
    for (let i = 0; i < LOG_PAGE_SIZE; i += 1) {
      await recordStaffActionTx(prisma, entryFor(admin));
    }
    const firstPage = await get(LOG, admin, adminDevice);
    expect(firstPage.status).toBe(200);
    const pageIds = firstPage.body.entries.map(entry => entry.id);
    expect(pageIds.length).toBeGreaterThan(0);
    expect(pageIds).not.toContain(revokedEntry.id);
    expect(pageIds).not.toContain(erasedEntry.id);

    const res = await get(ACTORS, admin, adminDevice);
    expect(res.status).toBe(200);
    const { actors } = res.body;
    const ids = actors.map(actor => actor.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(actors).toEqual(
      expect.arrayContaining([
        { id: admin.id, username: admin.username },
        { id: revoked.id, username: revoked.username },
        { id: erased.id, username: null },
      ]),
    );

    // The erased steward's ID still filters the ledger to their entries.
    const theirs = await get(`${LOG}?actorId=${erased.id}`, admin, adminDevice);
    expect(theirs.status).toBe(200);
    expect(theirs.body.entries.map(entry => entry.id)).toEqual([erasedEntry.id]);
  });

  it('is refused to a moderator, a player and an unchecked-in admin', async () => {
    const mod = await makeUser('moderator');
    const modDevice = await checkIn(mod);
    const player = await makeUser('user');
    const admin = await makeUser('admin');

    const asMod = await get(ACTORS, mod, modDevice);
    expect(asMod.status).toBe(403);
    expect(asMod.body.code).toBe('STAFF_CAPABILITY_REQUIRED');
    expect(asMod.body.actors).toBeUndefined();
    expect((await get(ACTORS, player)).status).toBe(404);
    const noDevice = await get(ACTORS, admin);
    expect(noDevice.status).toBe(403);
    expect(noDevice.body.code).toBe('STAFF_CHECKIN_REQUIRED');
  });

  it('refuses a query string', async () => {
    const admin = await makeUser('admin');
    const adminDevice = await checkIn(admin);
    const res = await get(`${ACTORS}?cursor=5`, admin, adminDevice);
    expect(res.status).toBe(400);
  });
});
