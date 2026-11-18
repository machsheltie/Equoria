/**
 * Staff renames (Equoria-puj1e.3, owner ruling q375): a steward renames a horse,
 * a show or a player. Moderators, admins and the owner hold `rename`.
 *
 * A rename obeys the same rule a player's own naming does: the horse-name rule
 * (asked through the port the app layer fills), the show-creation rule (at least
 * two characters, unique) and the sign-up rule for usernames (3 to 30 letters,
 * numbers or underscores, unique). The account that owns the horse, hosts the show
 * or is the player is judged by staffTargetRefusal under its row lock. Each rename
 * and its staff log entry (old and new name) commit together. A reason is required.
 *
 * Lookups return only what a steward needs to confirm the target: the name and the
 * owner's username. Never traits, hidden or otherwise.
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import { horseNameRejection } from '../services/contentRulesPort.mjs';
import {
  Refusal,
  fail,
  intId,
  isText,
  lockAndJudgeOwner,
  runContentAction,
} from '../services/staffContentAction.mjs';

const usernameShape = /^[a-zA-Z0-9_]{3,30}$/;

const horseNameMessages = {
  type: 'Write the new name.',
  length: 'A horse name is 1 to 40 characters.',
  characters: 'A horse name cannot contain the "<" character.',
};

const notFound = (what, code) => new Refusal(404, `No such ${what}`, code);

/** The row changed hands between the read and the lock: ask the steward to retry. */
const moved = () =>
  new Refusal(409, 'This changed while you were renaming it. Try again.', 'renameTargetChanged');

/** Prisma's unique-violation code, raised by a taken show name or username. */
const isUniqueViolation = error => error?.code === 'P2002';

/** GET /api/v1/staff/content/horses/:horseId */
export async function lookupHorse(req, res, next) {
  try {
    const id = intId(req.params.horseId);
    const horse = id
      ? await prisma.horse.findUnique({
          where: { id },
          select: { id: true, name: true, user: { select: { username: true } } },
        })
      : null;
    if (!horse) {
      return fail(res, 404, 'No such horse', 'renameHorseNotFound');
    }
    return res.status(200).json({
      id: horse.id,
      name: horse.name,
      ownerUsername: horse.user?.username ?? null,
    });
  } catch (error) {
    logger.error(`[staff] horse lookup failed: ${error.message}`);
    return next(error);
  }
}

/** POST /api/v1/staff/content/horses/:horseId/rename { name, reason } */
export function renameHorse(req, res, next) {
  const name = req.body?.name;
  const rejection = horseNameRejection(name);
  if (rejection) {
    return fail(res, 400, horseNameMessages[rejection], 'renameNameInvalid');
  }
  return runContentAction(req, res, next, {
    capability: 'rename',
    targetType: 'horse',
    async apply(tx, { actor }) {
      const id = intId(req.params.horseId);
      const seen = id
        ? await tx.horse.findUnique({ where: { id }, select: { userId: true } })
        : null;
      if (!seen) {
        throw notFound('horse', 'renameHorseNotFound');
      }
      // Lock order: the owning account before the horse.
      await lockAndJudgeOwner(tx, actor, seen.userId);
      const rows =
        await tx.$queryRaw`SELECT id, name, "userId" FROM horses WHERE id = ${id} FOR UPDATE`;
      const horse = rows[0];
      if (!horse) {
        throw notFound('horse', 'renameHorseNotFound');
      }
      if (horse.userId !== seen.userId) {
        throw moved();
      }
      await tx.horse.update({ where: { id }, data: { name } });
      return {
        targetId: String(id),
        before: { name: horse.name },
        after: { name },
        body: { id, name },
      };
    },
  });
}

/** GET /api/v1/staff/content/shows/:showId */
export async function lookupShow(req, res, next) {
  try {
    const id = intId(req.params.showId);
    const show = id
      ? await prisma.show.findUnique({
          where: { id },
          select: { id: true, name: true, createdByUser: { select: { username: true } } },
        })
      : null;
    if (!show) {
      return fail(res, 404, 'No such show', 'renameShowNotFound');
    }
    return res.status(200).json({
      id: show.id,
      name: show.name,
      hostUsername: show.createdByUser?.username ?? null,
    });
  } catch (error) {
    logger.error(`[staff] show lookup failed: ${error.message}`);
    return next(error);
  }
}

/** POST /api/v1/staff/content/shows/:showId/rename { name, reason } */
export function renameShow(req, res, next) {
  const raw = req.body?.name;
  if (typeof raw !== 'string' || raw.trim().length < 2) {
    return fail(res, 400, 'A show name needs at least 2 characters.', 'renameNameInvalid');
  }
  const name = raw.trim();
  return runContentAction(req, res, next, {
    capability: 'rename',
    targetType: 'show',
    async apply(tx, { actor }) {
      const id = intId(req.params.showId);
      const seen = id
        ? await tx.show.findUnique({ where: { id }, select: { createdByUserId: true } })
        : null;
      if (!seen) {
        throw notFound('show', 'renameShowNotFound');
      }
      await lockAndJudgeOwner(tx, actor, seen.createdByUserId);
      const rows =
        await tx.$queryRaw`SELECT id, name, "createdByUserId" FROM shows WHERE id = ${id} FOR UPDATE`;
      const show = rows[0];
      if (!show) {
        throw notFound('show', 'renameShowNotFound');
      }
      if (show.createdByUserId !== seen.createdByUserId) {
        throw moved();
      }
      try {
        await tx.show.update({ where: { id }, data: { name } });
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new Refusal(409, 'Another show already has that name.', 'renameNameTaken');
        }
        throw error;
      }
      return {
        targetId: String(id),
        before: { name: show.name },
        after: { name },
        body: { id, name },
      };
    },
  });
}

/** POST /api/v1/staff/content/players/rename { username, newUsername, reason } */
export function renamePlayer(req, res, next) {
  const { username, newUsername } = req.body ?? {};
  if (!isText(username, 100)) {
    return fail(res, 400, 'Name the player to rename.', 'renamePlayerNotFound');
  }
  if (typeof newUsername !== 'string' || !usernameShape.test(newUsername)) {
    return fail(
      res,
      400,
      'A username is 3 to 30 letters, numbers or underscores.',
      'renameNameInvalid',
    );
  }
  return runContentAction(req, res, next, {
    capability: 'rename',
    targetType: 'player',
    async apply(tx, { actor }) {
      const seen = await tx.user.findUnique({ where: { username }, select: { id: true } });
      if (!seen) {
        throw notFound('player', 'renamePlayerNotFound');
      }
      const player = await lockAndJudgeOwner(tx, actor, seen.id);
      if (!player) {
        throw notFound('player', 'renamePlayerNotFound');
      }
      const current = await tx.user.findUnique({
        where: { id: seen.id },
        select: { username: true },
      });
      if (current.username !== username) {
        throw moved();
      }
      try {
        await tx.user.update({ where: { id: seen.id }, data: { username: newUsername } });
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new Refusal(409, 'Another player already has that name.', 'renameNameTaken');
        }
        throw error;
      }
      return {
        targetId: seen.id,
        before: { username },
        after: { username: newUsername },
        body: { id: seen.id, username: newUsername },
      };
    },
  });
}
