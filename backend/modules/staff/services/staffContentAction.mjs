/**
 * One content-moderation action (Equoria-puj1e.3, owner ruling q375): renames,
 * forum post edits and removals, and the held-post queue.
 *
 * Each action runs in one transaction. `apply(tx, ctx)` reads and locks its
 * content row, names the account that owns it (or null) and does the work; the
 * owning account's User row is locked here, before the change, and judged by
 * staffTargetRefusal as the lock holder sees it (nobody acts on the owner or on
 * themselves; moderators and admins never on another moderator or admin). The
 * change and its staff log entry commit together; a refusal changes nothing.
 * A notification `apply` asks for is written in the same transaction and
 * published after commit.
 *
 * Every refusal carries a machine code and an authored message.
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import {
  createNotificationTx,
  finalizeNotificationAfterCommit,
} from '../../../utils/notificationService.mjs';
import { staffTargetRefusal } from '../capabilities.mjs';
import { recordStaffActionTx } from './staffActionLogService.mjs';

export const maxReason = 1000;

export const fail = (res, status, message, code) =>
  res.status(status).json({ success: false, message, ...(code ? { code } : {}) });

export const isText = (value, max) =>
  typeof value === 'string' && value.trim() !== '' && value.length <= max;

/** Thrown inside a transaction to roll it back and answer with this refusal. */
export class Refusal extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** A positive integer id from a path segment, or null. */
export function intId(raw) {
  if (typeof raw !== 'string' || !/^[1-9][0-9]{0,9}$/.test(raw)) {
    return null;
  }
  const id = Number(raw);
  return id <= 2_147_483_647 ? id : null;
}

/**
 * Lock the owning account's row and refuse when the actor may not act on it.
 * A null owner (an unowned horse, a show with no host) is never refused.
 */
export async function lockAndJudgeOwner(tx, actor, ownerId) {
  if (!ownerId) {
    return null;
  }
  const rows = await tx.$queryRaw`SELECT id, role FROM "User" WHERE id = ${ownerId} FOR UPDATE`;
  const owner = rows[0];
  if (!owner) {
    return null;
  }
  const refused = staffTargetRefusal({ actor, targetUser: owner });
  if (refused) {
    throw new Refusal(403, refused.message, refused.code);
  }
  return owner;
}

/**
 * Run one content action.
 * @param {object} spec
 * @param {string} spec.capability the staff log capability
 * @param {string} spec.targetType the staff log target type
 * @param {boolean} [spec.reasonRequired=true]
 * @param {(tx: object, ctx: { actor: object, reason: string | null }) => Promise<{
 *   targetId: string, before?: object, after?: object, body: object,
 *   notify?: { userId: string, type: string, payload: object } }>} spec.apply
 */
export async function runContentAction(req, res, next, spec) {
  const { capability, targetType, reasonRequired = true, apply } = spec;
  try {
    const raw = req.body?.reason;
    const given = isText(raw, maxReason);
    if (reasonRequired && !given) {
      return fail(res, 400, 'A reason is required', 'contentReasonRequired');
    }
    if (raw !== undefined && raw !== null && raw !== '' && !given) {
      return fail(res, 400, 'A reason is required', 'contentReasonRequired');
    }
    const reason = given ? raw.trim() : null;
    const outcome = await prisma.$transaction(async tx => {
      const result = await apply(tx, { actor: req.staff, reason });
      if (result.notify) {
        await createNotificationTx(
          tx,
          result.notify.userId,
          result.notify.type,
          result.notify.payload,
        );
      }
      await recordStaffActionTx(tx, {
        actorId: req.staff.id,
        actorRole: req.staff.role,
        capability,
        targetType,
        targetId: result.targetId,
        reason,
        before: result.before,
        after: result.after,
      });
      return result;
    });
    if (outcome.notify) {
      finalizeNotificationAfterCommit(
        outcome.notify.userId,
        outcome.notify.type,
        outcome.notify.payload,
      );
    }
    return res.status(200).json(outcome.body);
  } catch (error) {
    if (error instanceof Refusal) {
      return fail(res, error.status, error.message, error.code);
    }
    logger.error(`[staff] ${capability} on ${targetType} failed: ${error.message}`);
    return next(error);
  }
}
