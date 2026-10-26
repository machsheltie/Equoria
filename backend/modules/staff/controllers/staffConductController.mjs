/**
 * Staff conduct controller (Equoria-w47x7 / Equoria-puj1e.2, owner ruling q77)
 *
 * Warn, freeze (1, 3 or 7 days), ban an account, and ban the IP or the device a
 * player signed in from. Every route sits behind its own capability; the
 * actor-versus-target rules are staffTargetRefusal's (nobody acts on the owner or
 * on themselves; moderators and admins never act on another moderator or admin).
 *
 * Each action runs in one transaction that first locks the target's User row, so
 * the target is judged as the lock holder sees it, a role change cannot slip past
 * the refusal, and two stewards acting at once serialise: the second sees the
 * first's freeze or ban and is refused with a 409. The conduct record, the
 * refresh-token revocation and the staff log entry commit together.
 *
 * Every refusal carries a machine code and an authored message.
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import {
  createNotificationTx,
  finalizeNotificationAfterCommit,
} from '../../../utils/notificationService.mjs';
import { staffRoles, staffTargetRefusal } from '../capabilities.mjs';
import { recordStaffActionTx } from '../services/staffActionLogService.mjs';
import { accountStanding, evictStandingCache } from '../services/conductEnforcementService.mjs';

export const FREEZE_DAYS = Object.freeze([1, 3, 7]);
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MAX_TEXT = 100;
const MAX_REASON = 1000;
const RECORD_PAGE = 50;
const PUBLIC_FIELDS = { id: true, username: true, role: true };

const fail = (res, status, message, code) =>
  res.status(status).json({ success: false, message, ...(code ? { code } : {}) });

const isText = (value, max) =>
  typeof value === 'string' && value.trim() !== '' && value.length <= max;

/** Thrown inside a transaction to roll it back and answer with this refusal. */
class Refusal extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const noSuchPlayer = () => new Refusal(404, 'No such player', 'conductTargetNotFound');

/** POST /api/v1/staff/conduct/lookup { username }: a POST keeps the name out of URLs and logs. */
export async function lookupPlayer(req, res, next) {
  try {
    const username = req.body?.username;
    if (!isText(username, MAX_TEXT)) {
      return fail(res, 400, 'A username is required');
    }
    const user = await prisma.user.findUnique({ where: { username }, select: PUBLIC_FIELDS });
    if (!user) {
      return fail(res, 404, 'No player has that username', 'conductTargetNotFound');
    }
    return res.status(200).json(user);
  } catch (error) {
    logger.error(`[staff] conduct lookup failed: ${error.message}`);
    return next(error);
  }
}

/** GET /api/v1/staff/conduct/:userId: standing and the most recent conduct entries. */
export async function getConductRecord(req, res, next) {
  try {
    const { userId } = req.params;
    const user = isText(userId, MAX_TEXT)
      ? await prisma.user.findUnique({ where: { id: userId }, select: PUBLIC_FIELDS })
      : null;
    if (!user) {
      return fail(res, 404, 'No such player', 'conductTargetNotFound');
    }
    const [standing, records] = await Promise.all([
      accountStanding(prisma, user.id),
      prisma.conductRecord.findMany({
        where: { userId: user.id },
        orderBy: { id: 'desc' },
        take: RECORD_PAGE,
        select: {
          id: true,
          kind: true,
          reason: true,
          issuedByRole: true,
          freezeDays: true,
          endsAt: true,
          createdAt: true,
        },
      }),
    ]);
    return res.status(200).json({
      player: user,
      standing: standing
        ? { state: standing.state, ...(standing.endsAt ? { endsAt: standing.endsAt } : {}) }
        : { state: 'good' },
      records,
    });
  } catch (error) {
    logger.error(`[staff] conduct record failed: ${error.message}`);
    return next(error);
  }
}

/**
 * Run one conduct action. `apply(tx, ctx)` does the work under the target's row
 * lock and returns { before, after, body, notify?, revokeSessions? }.
 */
async function runAction(req, res, next, { capability, targetType = 'player', input = {}, apply }) {
  try {
    const reason = req.body?.reason;
    if (!isText(reason, MAX_REASON)) {
      return fail(res, 400, 'A reason is required', 'conductReasonRequired');
    }
    const { userId } = req.params;
    const outcome = await prisma.$transaction(async tx => {
      if (!isText(userId, MAX_TEXT)) {
        throw noSuchPlayer();
      }
      // Lock the target first: everything below sees what the lock holder sees.
      const locked =
        await tx.$queryRaw`SELECT id, role FROM "User" WHERE id = ${userId} FOR UPDATE`;
      const target = locked[0];
      if (!target) {
        throw noSuchPlayer();
      }
      const refused = staffTargetRefusal({ actor: req.staff, targetUser: target });
      if (refused) {
        throw new Refusal(403, refused.message, refused.code);
      }
      const result = await apply(tx, { target, reason: reason.trim(), actor: req.staff, input });
      if (result.revokeSessions) {
        await tx.refreshToken.deleteMany({ where: { userId: target.id } });
      }
      await recordStaffActionTx(tx, {
        actorId: req.staff.id,
        actorRole: req.staff.role,
        capability,
        targetType,
        targetId: target.id,
        reason,
        before: result.before,
        after: result.after,
      });
      return { target, result };
    });
    evictStandingCache(outcome.target.id);
    if (outcome.result.notify) {
      finalizeNotificationAfterCommit(
        outcome.target.id,
        outcome.result.notify.type,
        outcome.result.notify.payload,
      );
    }
    return res.status(200).json(outcome.result.body);
  } catch (error) {
    if (error instanceof Refusal) {
      return fail(res, error.status, error.message, error.code);
    }
    logger.error(`[staff] conduct action failed: ${error.message}`);
    return next(error);
  }
}

/** POST /api/v1/staff/conduct/:userId/warn { reason } */
export const warnPlayer = (req, res, next) =>
  runAction(req, res, next, {
    capability: 'warn',
    async apply(tx, { target, reason, actor }) {
      const record = await tx.conductRecord.create({
        data: {
          userId: target.id,
          kind: 'warning',
          reason,
          issuedById: actor.id,
          issuedByRole: actor.role,
        },
      });
      const payload = { reason };
      await createNotificationTx(tx, target.id, 'conductWarning', payload);
      return {
        before: null,
        after: { kind: 'warning', recordId: record.id },
        notify: { type: 'conductWarning', payload },
        body: { id: target.id, kind: 'warning', recordId: record.id },
      };
    },
  });

/** POST /api/v1/staff/conduct/:userId/freeze { days: 1|3|7, reason } */
export const freezePlayer = (req, res, next) => {
  const days = req.body?.days;
  if (!FREEZE_DAYS.includes(days)) {
    return fail(res, 400, 'A freeze lasts 1, 3 or 7 days', 'conductFreezeLength');
  }
  return runAction(req, res, next, {
    capability: 'freeze',
    input: { days },
    async apply(tx, { target, reason, actor, input }) {
      const standing = await accountStanding(tx, target.id);
      if (standing?.state === 'banned') {
        throw new Refusal(409, 'This account is already banned.', 'conductAlreadyBanned');
      }
      if (standing?.state === 'frozen') {
        throw new Refusal(409, 'This account is already frozen.', 'conductAlreadyFrozen');
      }
      const endsAt = new Date(Date.now() + input.days * MS_PER_DAY);
      const record = await tx.conductRecord.create({
        data: {
          userId: target.id,
          kind: 'freeze',
          reason,
          issuedById: actor.id,
          issuedByRole: actor.role,
          freezeDays: input.days,
          endsAt,
        },
      });
      return {
        revokeSessions: true,
        before: { standing: 'good' },
        after: {
          kind: 'freeze',
          days: input.days,
          endsAt: endsAt.toISOString(),
          recordId: record.id,
        },
        body: { id: target.id, kind: 'freeze', days: input.days, endsAt, recordId: record.id },
      };
    },
  });
};

/** POST /api/v1/staff/conduct/:userId/ban/account { reason } */
export const banAccount = (req, res, next) =>
  runAction(req, res, next, {
    capability: 'ban.account',
    async apply(tx, { target, reason, actor }) {
      const standing = await accountStanding(tx, target.id);
      if (standing?.state === 'banned') {
        throw new Refusal(409, 'This account is already banned.', 'conductAlreadyBanned');
      }
      const record = await tx.conductRecord.create({
        data: {
          userId: target.id,
          kind: 'ban',
          reason,
          issuedById: actor.id,
          issuedByRole: actor.role,
        },
      });
      return {
        revokeSessions: true,
        before: { standing: standing?.state ?? 'good' },
        after: { kind: 'ban', recordId: record.id },
        body: { id: target.id, kind: 'ban', recordId: record.id },
      };
    },
  });

/**
 * Ban the IP or device the player last signed in from. Refused when the
 * connection is already banned, when the player has not been seen signing in, or
 * when a steward has signed in from it (it would lock stewards out too).
 */
function banConnection(kind, capability) {
  const sightingField = kind === 'ip' ? 'ipAddress' : 'deviceHash';
  return (req, res, next) =>
    runAction(req, res, next, {
      capability,
      targetType: kind === 'ip' ? 'playerIp' : 'playerDevice',
      async apply(tx, { target, reason, actor }) {
        const sighting = await tx.loginSighting.findFirst({
          where: { userId: target.id, ...(kind === 'ip' ? { ipAddress: { not: '' } } : {}) },
          orderBy: { lastSeenAt: 'desc' },
          select: { ipAddress: true, deviceHash: true },
        });
        if (!sighting) {
          throw new Refusal(
            409,
            'This player has not been seen signing in, so there is no connection to ban.',
            'conductNoSighting',
          );
        }
        const value = sighting[sightingField];
        const stewardUses = await tx.loginSighting.findFirst({
          where: { [sightingField]: value, user: { role: { in: [...staffRoles] } } },
          select: { id: true },
        });
        if (stewardUses) {
          throw new Refusal(
            409,
            'A steward signs in from this connection too, so it cannot be banned.',
            'conductBlockHitsStaff',
          );
        }
        const { count } = await tx.conductBlock.createMany({
          data: [
            {
              kind,
              value,
              reason,
              issuedById: actor.id,
              issuedByRole: actor.role,
              sourceUserId: target.id,
            },
          ],
          skipDuplicates: true,
        });
        if (count !== 1) {
          throw new Refusal(
            409,
            kind === 'ip' ? 'This IP is already banned.' : 'This device is already banned.',
            'conductAlreadyBlocked',
          );
        }
        return {
          before: null,
          after: { kind: `${kind}Ban`, sourceUserId: target.id },
          body: { id: target.id, kind: `${kind}Ban` },
        };
      },
    });
}

/** POST /api/v1/staff/conduct/:userId/ban/ip { reason } */
export const banIp = banConnection('ip', 'ban.ip');
/** POST /api/v1/staff/conduct/:userId/ban/device { reason } */
export const banDevice = banConnection('device', 'ban.device');
