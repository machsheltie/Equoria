/**
 * Outage time-back is the Owner's alone, and apply and undo each need a fresh
 * emailed code (Equoria-puj1e.5, owner rulings q377/q378, STAFF-CR-06) — real
 * HTTP, real DB. Security gate: file-name token `Authz`.
 *
 * Every request here is refused before any game data could change: no hold is
 * taken and no window is applied.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { hasCapability } from '../capabilities.mjs';
import { capabilityRequiredCode, checkinRequiredCode } from '../middleware/requireStaffCapability.mjs';
import {
  checkIn,
  createUserFactory,
  get,
  latestCode,
  post,
  staffApi,
  startEmailCapture,
  stopEmailCapture,
  wrongCodeFor,
} from './helpers/staffFixtures.mjs';
import { easternWall, freshCode, toMinute } from './helpers/timeBackFixtures.mjs';

const cleanup = createCleanupTracker();
const { makeUser, createdUserIds } = createUserFactory('sttbauthz');
const day = 86_400_000;
const window = () => {
  const now = Date.now();
  return { start: easternWall(toMinute(now - 3 * day)), end: easternWall(toMinute(now - day)) };
};
const APPLY = `${staffApi}/time-back/apply`;
const freshCodeInvalid = 'staffFreshCodeInvalid';

beforeAll(() => {
  const scope = () => ({ in: createdUserIds });
  cleanup.add(() => prisma.staffActionLog.deleteMany({ where: { actorId: scope() } }), 'action log');
  cleanup.add(() => prisma.staffCheckinCode.deleteMany({ where: { userId: scope() } }), 'checkin codes');
  cleanup.add(() => prisma.staffTrustedDevice.deleteMany({ where: { userId: scope() } }), 'devices');
  cleanup.add(() => prisma.refreshToken.deleteMany({ where: { userId: scope() } }), 'refresh tokens');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: scope() } }), 'users');
});

afterAll(() => cleanup.run(), 60_000);

beforeEach(() => startEmailCapture());

afterEach(() => stopEmailCapture());

describe('Only the Owner reaches the outage tools', () => {
  it('the Owner holds time-back and jobs.hold; admins, moderators and players do not', () => {
    for (const cap of ['time-back', 'jobs.hold']) {
      expect(hasCapability('owner', cap)).toBe(true);
      for (const role of ['admin', 'moderator', 'user']) {
        expect(hasCapability(role, cap)).toBe(false);
      }
    }
  });

  it('refuses a player with the ordinary 404 on every time-back route', async () => {
    const player = await makeUser('user');
    const { start, end } = window();
    expect((await get(`${staffApi}/time-back`, player)).status).toBe(404);
    expect((await get(`${staffApi}/time-back/preview?start=${start}&end=${end}`, player)).status).toBe(404);
    expect((await post(`${staffApi}/time-back/code`, player, { purpose: 'timeBackApply' })).status).toBe(404);
    expect((await post(APPLY, player, { start, end, code: '123456' })).status).toBe(404);
    expect((await post(`${staffApi}/time-back/1/undo`, player, { code: '123456' })).status).toBe(404);
  }, 60_000);

  it.each(['moderator', 'admin'])(
    'refuses a checked-in %s on every time-back route',
    async role => {
      const steward = await makeUser(role);
      const device = await checkIn(steward);
      const { start, end } = window();
      const responses = [
        await get(`${staffApi}/time-back`, steward, device),
        await get(`${staffApi}/time-back/preview?start=${start}&end=${end}`, steward, device),
        await post(`${staffApi}/time-back/code`, steward, { purpose: 'timeBackApply' }, device),
        await post(APPLY, steward, { start, end, code: '123456' }, device),
        await post(`${staffApi}/time-back/1/undo`, steward, { code: '123456' }, device),
      ];
      for (const res of responses) {
        expect(res.status).toBe(403);
        expect(res.body.code).toBe(capabilityRequiredCode);
      }
      expect(await prisma.staffCheckinCode.count({ where: { userId: steward.id, purpose: { not: 'checkin' } } })).toBe(
        0,
      );
    },
    60_000,
  );

  it('refuses an Owner whose browser is not checked in', async () => {
    const owner = await makeUser('owner');
    const res = await post(APPLY, owner, { ...window(), code: '123456' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe(checkinRequiredCode);
  }, 60_000);
});

describe('Apply and undo each need a fresh emailed code (q378)', () => {
  let owner;
  let device;

  beforeAll(async () => {
    startEmailCapture();
    owner = await makeUser('owner');
    device = await checkIn(owner);
    stopEmailCapture();
  }, 60_000);

  it('a trusted browser with no code, or a wrong code, is refused', async () => {
    const missing = await post(APPLY, owner, window(), device);
    expect(missing.status).toBe(403);
    expect(missing.body.code).toBe(freshCodeInvalid);

    const code = await freshCode(owner, device, 'timeBackApply');
    const wrong = await post(APPLY, owner, { ...window(), code: wrongCodeFor(code) }, device);
    expect(wrong.status).toBe(403);
    expect(wrong.body.code).toBe(freshCodeInvalid);
  }, 60_000);

  it('a browser check-in code, or a code sent to undo, does not apply', async () => {
    expect((await post(`${staffApi}/checkin/request`, owner, {}, device)).status).toBe(202);
    const checkinCode = latestCode(owner.email);
    const asApply = await post(APPLY, owner, { ...window(), code: checkinCode }, device);
    expect(asApply.status).toBe(403);
    expect(asApply.body.code).toBe(freshCodeInvalid);

    const undoCode = await freshCode(owner, device, 'timeBackUndo');
    const undoForApply = await post(APPLY, owner, { ...window(), code: undoCode }, device);
    expect(undoForApply.status).toBe(403);
    expect(undoForApply.body.code).toBe(freshCodeInvalid);
    // Neither code was spent by the refusal.
    expect(
      await prisma.staffCheckinCode.count({
        where: { userId: owner.id, usedAt: { not: null }, purpose: { not: 'checkin' } },
      }),
    ).toBe(0);
  }, 60_000);

  it('an expired code is refused', async () => {
    const code = await freshCode(owner, device, 'timeBackApply');
    await prisma.staffCheckinCode.updateMany({
      where: { userId: owner.id, purpose: 'timeBackApply', usedAt: null, retiredAt: null },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const res = await post(APPLY, owner, { ...window(), code }, device);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe(freshCodeInvalid);
  }, 60_000);

  it('a code sent before the verified email changed is void', async () => {
    const code = await freshCode(owner, device, 'timeBackApply');
    await prisma.user.update({ where: { id: owner.id }, data: { emailVerifiedAt: new Date(Date.now() + 1000) } });
    const res = await post(APPLY, owner, { ...window(), code }, device);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe(freshCodeInvalid);
  }, 60_000);

  it('a fourth code for the same action inside 15 minutes is refused', async () => {
    const res = await post(`${staffApi}/time-back/code`, owner, { purpose: 'timeBackApply' }, device);
    expect(res.status).toBe(429);
  }, 60_000);

  it('a code for an unknown purpose is refused', async () => {
    const res = await post(`${staffApi}/time-back/code`, owner, { purpose: 'checkin' }, device);
    expect(res.status).toBe(400);
  }, 60_000);
});
