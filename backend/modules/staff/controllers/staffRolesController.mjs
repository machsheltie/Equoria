/**
 * Staff roles controller (Equoria-puj1e.1, Task 5)
 *
 * The admin promotes a player to moderator and revokes them. Every route runs
 * behind requireStaffCapability('roles.manage'), which only the admin holds.
 *
 * assertActionableTarget is deliberately not used: it refuses any staff
 * target, and revoking targets a moderator. Instead the admin may not act on
 * their own account or on any admin, and the role must actually change.
 *
 * The role write, the target's trusted-device revocation, the retirement of
 * their outstanding check-in codes, on demotion the deletion of their unread
 * staff-ticket bells, and the log entry commit in one transaction. The role
 * write is conditional on the role read beforehand, so of two racing requests
 * exactly one succeeds.
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import { deleteUnreadNotificationsTx } from '../../../utils/notificationService.mjs';
import { recordStaffActionTx } from '../services/staffActionLogService.mjs';
import { retireStaffCheckinCodesTx } from '../services/staffChallengeRetirement.mjs';

const ASSIGNABLE_ROLES = new Set(['moderator', 'user']);
const MAX_TEXT = 100;
const MAX_REASON = 1000;
const PUBLIC_FIELDS = { id: true, username: true, role: true };
// Bells that link into the Steward's Office (STAFF-CR-11).
const STAFF_BELL_TYPES = ['staffTicket', 'staffTicketUpdate'];

const fail = (res, status, message) => res.status(status).json({ success: false, message });

const isText = (value, max) =>
  typeof value === 'string' && value.trim() !== '' && value.length <= max;

class RoleChangedMeanwhile extends Error {}

/** GET /api/v1/staff/roles — current staff, public fields only. */
export async function listStaff(req, res, next) {
  try {
    const staff = await prisma.user.findMany({
      where: { role: { in: ['moderator', 'admin'] } },
      select: PUBLIC_FIELDS,
      orderBy: [{ role: 'asc' }, { username: 'asc' }],
    });
    return res.status(200).json({ staff });
  } catch (error) {
    logger.error(`[staff] roles list failed: ${error.message}`);
    return next(error);
  }
}

/** POST /api/v1/staff/roles/lookup { username } → { id, username, role } */
export async function lookupUser(req, res, next) {
  try {
    const username = req.body?.username;
    if (!isText(username, MAX_TEXT)) {
      return fail(res, 400, 'A username is required');
    }
    const user = await prisma.user.findUnique({ where: { username }, select: PUBLIC_FIELDS });
    if (!user) {
      return fail(res, 404, 'No player has that username');
    }
    return res.status(200).json(user);
  } catch (error) {
    logger.error(`[staff] roles lookup failed: ${error.message}`);
    return next(error);
  }
}

/** Returns [status, message] when the change is refused, or null. */
function refusal(actorId, target, toRole) {
  if (target.id === actorId || target.role === 'admin') {
    return [403, "This account's role cannot be changed here"];
  }
  if (toRole === 'moderator' && target.role !== 'user') {
    return [409, 'This account is not a plain player'];
  }
  if (toRole === 'user' && target.role !== 'moderator') {
    return [409, 'This account is not a moderator'];
  }
  if (toRole === 'moderator' && target.emailVerified !== true) {
    return [409, 'A moderator needs a verified email address'];
  }
  return null;
}

/** POST /api/v1/staff/roles/:userId { role: 'moderator'|'user', reason } */
export async function setUserRole(req, res, next) {
  try {
    const { userId } = req.params;
    const toRole = req.body?.role;
    const reason = req.body?.reason;
    if (typeof toRole !== 'string' || !ASSIGNABLE_ROLES.has(toRole)) {
      return fail(res, 400, 'Role must be moderator or user');
    }
    if (!isText(reason, MAX_REASON)) {
      return fail(res, 400, 'A reason is required');
    }
    if (!isText(userId, MAX_TEXT)) {
      return fail(res, 404, 'No such player');
    }

    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { ...PUBLIC_FIELDS, emailVerified: true },
    });
    if (!target) {
      return fail(res, 404, 'No such player');
    }
    const refused = refusal(req.staff.id, target, toRole);
    if (refused) {
      return fail(res, ...refused);
    }

    const fromRole = target.role;
    await prisma.$transaction(async tx => {
      const { count } = await tx.user.updateMany({
        where: {
          id: target.id,
          role: fromRole,
          ...(toRole === 'moderator' ? { emailVerified: true } : {}),
        },
        data: { role: toRole },
      });
      if (count !== 1) {
        throw new RoleChangedMeanwhile();
      }
      // On demotion this ends staff access; on promotion it clears any
      // leftover device so a returning moderator checks in afresh.
      await tx.staffTrustedDevice.updateMany({
        where: { userId: target.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      // STAFF-CR-01: a code issued before the change can never finish a
      // check-in after it, so demote-then-re-promote starts from nothing.
      await retireStaffCheckinCodesTx(tx, target.id);
      // STAFF-CR-11: a former moderator's feed keeps no unread pointers into
      // the office. A ticket change holding a share lock on this user row
      // commits first, so its bell is deleted here too.
      if (toRole === 'user') {
        await deleteUnreadNotificationsTx(tx, target.id, STAFF_BELL_TYPES);
      }
      await recordStaffActionTx(tx, {
        actorId: req.staff.id,
        actorRole: req.staff.role,
        capability: 'roles.manage',
        targetType: 'player',
        targetId: target.id,
        reason,
        before: { role: fromRole },
        after: { role: toRole },
      });
    });

    return res.status(200).json({ id: target.id, username: target.username, role: toRole });
  } catch (error) {
    if (error instanceof RoleChangedMeanwhile) {
      return fail(res, 409, 'Role changed meanwhile');
    }
    logger.error(`[staff] role change failed: ${error.message}`);
    return next(error);
  }
}
