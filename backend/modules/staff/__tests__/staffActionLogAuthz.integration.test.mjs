/**
 * Staff action log — real HTTP, real DB (Equoria-puj1e.1, Task 4).
 * Security gate: file-name token `Authz`.
 *
 * Covers who may read the log (admin: every entry and any filter; moderator:
 * their own, whatever actorId they pass), the reason rule for punitive
 * capabilities, rollback with the action, permanence, and cursor paging.
 * Requests pass real authenticateToken, CSRF-protected router, trusted-device
 * check-in (helpers/staffFixtures.mjs) and requireStaffCapability.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import * as staff from '../index.mjs';
import * as logService from '../services/staffActionLogService.mjs';
import { checkIn, createUserFactory, get, startEmailCapture, stopEmailCapture, uid } from './helpers/staffFixtures.mjs';

const LOG = '/api/v1/staff/log';

const cleanup = createCleanupTracker();
const { makeUser, createdUserIds } = createUserFactory('staffauthz');

const { recordStaffActionTx, recordStaffFailure } = staff;

const entryFor = (actor, overrides = {}) => ({
  actorId: actor.id,
  actorRole: actor.role,
  capability: 'rename',
  targetType: 'player',
  targetId: `target-${uid()}`,
  ...overrides,
});

const rowsFor = actorIds =>
  prisma.staffActionLog.findMany({ where: { actorId: { in: actorIds } }, orderBy: { id: 'asc' } });

async function fixtureStaff() {
  const admin = await makeUser('admin');
  const mod = await makeUser('moderator');
  const adminDevice = await checkIn(admin);
  const modDevice = await checkIn(mod);
  return { admin, mod, adminDevice, modDevice };
}

beforeAll(() => {
  const scope = () => ({ in: createdUserIds });
  // StaffActionLog.actor is onDelete Restrict, so fixture rows go first. This
  // is test teardown of rows the test itself created; the service has no delete.
  cleanup.add(
    () => prisma.staffActionLog.updateMany({ where: { actorId: scope() }, data: { reversesId: null } }),
    'unlink reversals',
  );
  cleanup.add(() => prisma.staffActionLog.deleteMany({ where: { actorId: scope() } }), 'action log');
  cleanup.add(() => prisma.staffCheckinCode.deleteMany({ where: { userId: scope() } }), 'checkin codes');
  cleanup.add(() => prisma.staffTrustedDevice.deleteMany({ where: { userId: scope() } }), 'devices');
  cleanup.add(() => prisma.refreshToken.deleteMany({ where: { userId: scope() } }), 'refresh tokens');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: scope() } }), 'users');
});

afterAll(() => cleanup.run(), 60_000);

beforeEach(() => startEmailCapture());

afterEach(() => stopEmailCapture());

describe('Staff action log read access (Equoria-puj1e.1)', () => {
  it('shows an admin every entry and honours the actor filter', async () => {
    const { admin, mod, adminDevice } = await fixtureStaff();
    const byMod = await recordStaffActionTx(prisma, entryFor(mod));
    const byAdmin = await recordStaffActionTx(prisma, entryFor(admin));

    const all = await get(LOG, admin, adminDevice);
    expect(all.status).toBe(200);
    const ids = all.body.entries.map(e => e.id);
    expect(ids).toEqual(expect.arrayContaining([byMod.id, byAdmin.id]));
    expect(ids.indexOf(byAdmin.id)).toBeLessThan(ids.indexOf(byMod.id));

    const onlyMod = await get(`${LOG}?actorId=${mod.id}`, admin, adminDevice);
    expect(onlyMod.status).toBe(200);
    expect(onlyMod.body.entries.every(e => e.actorId === mod.id)).toBe(true);
    expect(onlyMod.body.entries.map(e => e.id)).toContain(byMod.id);
    expect(onlyMod.body.entries.map(e => e.id)).not.toContain(byAdmin.id);
  });

  it('filters by target, capability and target type for an admin', async () => {
    const { admin, adminDevice } = await fixtureStaff();
    const targetId = `target-${uid()}`;
    const warn = await recordStaffActionTx(prisma, entryFor(admin, { capability: 'warn', reason: 'rude', targetId }));
    await recordStaffActionTx(prisma, entryFor(admin, { capability: 'rename', targetId }));
    await recordStaffActionTx(prisma, entryFor(admin, { capability: 'warn', reason: 'rude', targetType: 'horse' }));

    const res = await get(`${LOG}?targetType=player&targetId=${targetId}&capability=warn`, admin, adminDevice);
    expect(res.status).toBe(200);
    expect(res.body.entries.map(e => e.id)).toEqual([warn.id]);
  });

  it("forces a moderator to their own entries even when they pass an admin's actorId", async () => {
    const { admin, mod, modDevice } = await fixtureStaff();
    const own = await recordStaffActionTx(prisma, entryFor(mod));
    const adminsEntry = await recordStaffActionTx(prisma, entryFor(admin));

    for (const url of [LOG, `${LOG}?actorId=${admin.id}`, `${LOG}?actorId=${mod.id}`]) {
      const res = await get(url, mod, modDevice);
      expect(res.status).toBe(200);
      const ids = res.body.entries.map(e => e.id);
      expect(ids).toContain(own.id);
      expect(ids).not.toContain(adminsEntry.id);
      expect(res.body.entries.every(e => e.actorId === mod.id)).toBe(true);
    }
  });

  it('refuses a player, an unchecked-in browser and an anonymous caller', async () => {
    const player = await makeUser('user');
    const mod = await makeUser('moderator');
    expect((await get(LOG, player)).status).toBe(404);
    const noDevice = await get(LOG, mod);
    expect(noDevice.status).toBe(403);
    expect(noDevice.body.code).toBe('STAFF_CHECKIN_REQUIRED');
  });

  it('pages 50 at a time, newest first, with a cursor that ends in null', async () => {
    const { admin, adminDevice } = await fixtureStaff();
    const created = [];
    for (let i = 0; i < 55; i += 1) {
      created.push(await recordStaffActionTx(prisma, entryFor(admin, { targetId: `page-${i}` })));
    }
    const newestFirst = created.map(r => r.id).reverse();

    const first = await get(`${LOG}?actorId=${admin.id}`, admin, adminDevice);
    expect(first.status).toBe(200);
    expect(first.body.entries).toHaveLength(50);
    expect(first.body.entries.map(e => e.id)).toEqual(newestFirst.slice(0, 50));
    expect(first.body.nextCursor).toBe(newestFirst[49]);

    const second = await get(`${LOG}?actorId=${admin.id}&cursor=${first.body.nextCursor}`, admin, adminDevice);
    expect(second.status).toBe(200);
    expect(second.body.entries.map(e => e.id)).toEqual(newestFirst.slice(50));
    expect(second.body.nextCursor).toBeNull();
  });

  it('rejects garbage query parameters with 400', async () => {
    const { admin, adminDevice } = await fixtureStaff();
    const bad = [
      'cursor=abc',
      'cursor=-1',
      'cursor=0',
      'cursor=1.5',
      'cursor=99999999999',
      'cursor=1&cursor=2',
      'capability=not.a.capability',
      'capability[]=warn',
      'actorId=',
      `actorId=${'x'.repeat(101)}`,
      'actorId[a]=1',
      'targetType=',
      'unknown=1',
    ];
    for (const qs of bad) {
      const res = await get(`${LOG}?${qs}`, admin, adminDevice);
      expect({ qs, status: res.status }).toEqual({ qs, status: 400 });
    }
  });
});

describe('Staff action recording (Equoria-puj1e.1)', () => {
  it('refuses a punitive entry with a missing or blank reason and writes no row', async () => {
    const { admin } = await fixtureStaff();
    const punitive = ['warn', 'freeze', 'ban.account', 'ban.ip', 'ban.device', 'roles.manage'];

    for (const capability of punitive) {
      for (const reason of [undefined, null, '', '   ', '\n\t ']) {
        await expect(recordStaffActionTx(prisma, entryFor(admin, { capability, reason }))).rejects.toMatchObject({
          statusCode: 400,
        });
      }
    }
    expect(await rowsFor([admin.id])).toHaveLength(0);
  });

  it('records a punitive entry with a reason, trimmed, and non-punitive entries without one', async () => {
    const { admin } = await fixtureStaff();
    const warn = await recordStaffActionTx(
      prisma,
      entryFor(admin, {
        capability: 'ban.account',
        reason: '  repeated harassment  ',
        before: { status: 'ok' },
        after: { status: 'banned' },
      }),
    );
    expect(warn).toMatchObject({
      actorId: admin.id,
      actorRole: 'admin',
      capability: 'ban.account',
      reason: 'repeated harassment',
      before: { status: 'ok' },
      after: { status: 'banned' },
      outcome: 'succeeded',
      error: null,
      reversesId: null,
    });
    const rename = await recordStaffActionTx(prisma, entryFor(admin, { capability: 'rename' }));
    expect(rename.reason).toBeNull();
    expect(rename.before).toBeNull();
    expect(rename.after).toBeNull();
  });

  it('links a reversal to the entry it reverses, once', async () => {
    const { admin } = await fixtureStaff();
    const original = await recordStaffActionTx(prisma, entryFor(admin, { capability: 'freeze', reason: 'spam' }));
    const reversal = await recordStaffActionTx(
      prisma,
      entryFor(admin, {
        capability: 'freeze',
        reason: 'cleared',
        reversesId: original.id,
        targetId: original.targetId,
      }),
    );
    expect(reversal.reversesId).toBe(original.id);
    await expect(
      recordStaffActionTx(prisma, entryFor(admin, { capability: 'freeze', reason: 'again', reversesId: original.id })),
    ).rejects.toBeDefined();
  });

  it('leaves no row when an error is thrown after recording inside a transaction', async () => {
    const { admin } = await fixtureStaff();
    const targetId = `rollback-${uid()}`;

    await expect(
      prisma.$transaction(async tx => {
        await recordStaffActionTx(tx, entryFor(admin, { targetId }));
        throw new Error('action failed after logging');
      }),
    ).rejects.toThrow('action failed after logging');

    expect(await prisma.staffActionLog.count({ where: { actorId: admin.id, targetId } })).toBe(0);
  });

  it('records a failed attempt outside a transaction with outcome failed', async () => {
    const { mod } = await fixtureStaff();
    const row = await recordStaffFailure(entryFor(mod, { capability: 'warn', error: 'target is staff' }));
    expect(row).toMatchObject({ outcome: 'failed', error: 'target is staff', actorId: mod.id, capability: 'warn' });
    expect(row.reason).toBeNull();
  });

  it('keeps the log permanent: no update or delete is exposed', () => {
    const names = [...Object.keys(logService), ...Object.keys(staff)];
    expect(names.filter(n => /^(update|delete|remove|purge|edit|clear|reset)/i.test(n))).toEqual([]);
    expect(Object.keys(logService).sort()).toEqual(
      ['LOG_PAGE_SIZE', 'isPunitiveCapability', 'listStaffActions', 'recordStaffActionTx', 'recordStaffFailure'].sort(),
    );
  });
});
