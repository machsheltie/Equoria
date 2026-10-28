/**
 * The owner's manual groom payday — real HTTP, real DB (Equoria-opdt7).
 * Security gate: file-name token `Authz`.
 *
 * Owner ruling 2026-10-28 (q262): the manual "pay grooms now" trigger stays for
 * the Owner only, behind the emailed staff check-in. "Users have to pay them. My
 * goal is not to automate work for players." It moved from
 * POST /api/v1/groom-salaries/process (any admin token) to
 * POST /api/v1/staff/payroll/grooms/run (capability payroll.run).
 *
 * Only refusals are sent over HTTP. An accepted request runs the real unscoped
 * payday, which graces or releases every underfunded player's grooms in the
 * shared database (groomSalaryService.mjs processWeeklySalaries: tests must
 * scope to their own fixture user), so the owner's success path is proven by
 * the guard tests below plus the registered payday, never by running it here.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { capabilityRequiredCode, checkinRequiredCode } from '../middleware/requireStaffCapability.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { hasCapability } from '../capabilities.mjs';
import { groomPayrollRun } from '../services/groomPayrollPort.mjs';
import { checkIn, createUserFactory, post, startEmailCapture, stopEmailCapture } from './helpers/staffFixtures.mjs';

const staffApi = '/api/v1/staff';
const RUN = `${staffApi}/payroll/grooms/run`;

const cleanup = createCleanupTracker();
const { makeUser, createdUserIds } = createUserFactory('stpayroll');

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

describe('The manual groom payday is the checked-in Owner alone (q262)', () => {
  it('refuses an owner token without the staff check-in on this browser', async () => {
    const owner = await makeUser('owner');
    const res = await post(RUN, owner);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe(checkinRequiredCode);
  }, 60_000);

  it('refuses a checked-in admin: the tool is not theirs', async () => {
    const admin = await makeUser('admin');
    const device = await checkIn(admin);
    const res = await post(RUN, admin, {}, device);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe(capabilityRequiredCode);
  }, 60_000);

  it('refuses a stale admin token whose account is no longer staff, with the ordinary 404', async () => {
    const player = await makeUser('user');
    // The token still names an admin; the database says this account is a player.
    const staleAdmin = {
      ...player,
      token: generateTestToken({ id: player.id, email: player.email, role: 'admin' }),
    };
    const res = await post(RUN, staleAdmin);
    expect(res.status).toBe(404);
  }, 60_000);

  it('the Owner holds payroll.run; admins, moderators and players do not', () => {
    expect(hasCapability('owner', 'payroll.run')).toBe(true);
    for (const role of ['admin', 'moderator', 'user']) {
      expect(hasCapability(role, 'payroll.run')).toBe(false);
    }
  });

  it('the app registers the weekly payday behind the route at start-up', () => {
    expect(typeof groomPayrollRun()).toBe('function');
  });
});
