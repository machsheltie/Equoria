import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import { DatabaseError } from '../../../errors/index.mjs';
import { invalidateCache } from '../../../utils/cacheHelper.mjs';
// Same-module import: avoid routing through the users barrel (index.mjs) to
// prevent a barrel<->service circular dependency, since the barrel re-exports
// this very file (userModelService) alongside gdprAccountService (Equoria-kwjav).
import { eraseUserAccount } from './gdprAccountService.mjs';

const DEFAULT_XP_PER_LEVEL = 100;
// Default audit reason for an award whose caller supplies none (e.g. the admin
// `POST /api/user/:id/add-xp` path). XpEvent.reason is a NOT-NULL text column, so
// the tx-aware core always needs a non-empty string here (Equoria-jvi3u).
const DEFAULT_XP_REASON = 'XP award';

/**
 * Calculates the experience points threshold for a specific level.
 * @param {number} level - The level to calculate the threshold for.
 * @returns {number} The experience points threshold for the given level.
 */
function xpThreshold(level) {
  return DEFAULT_XP_PER_LEVEL * level;
}

/**
 * The canonical stored level for a given cumulative xp.
 *
 * Mirrors the historical level-up loop (`while (xp >= xpThreshold(level + 1)) level++`)
 * evaluated from the default starting level 1: a brand-new user is level 1 at 0 xp,
 * and reaching the next level requires `xp >= 100 * (level + 1)`. That makes level 1
 * span xp 0..199 and every level k >= 2 span [100k, 100k + 99]. Closed form:
 * `max(1, floor(xp / 100))`. Deriving level from xp this way (instead of a re-read)
 * is what makes the atomic award in `addXpToUserCore` correct under concurrency.
 *
 * @param {number} xp - Cumulative user xp.
 * @returns {number} The level implied by that xp.
 */
function levelForXp(xp) {
  return Math.max(1, Math.floor(xp / DEFAULT_XP_PER_LEVEL));
}

/**
 * Derive a user's STABLE LEVEL (1–5) from their account level. This is the
 * SINGLE source of truth for stable level across the codebase — never inline
 * `ceil(level/4)` at call sites (that is how display and enforcement drift).
 *
 * Ratified 2026-07-07 (docs/design/2026-07-07-game-balance-formulas.md §3):
 *   getStableLevel(user) = clamp(ceil(user.level / 4), 1, 5)
 * User.level 1–4 → SL1, 5–8 → SL2, 9–12 → SL3, 13–16 → SL4, 17+ → SL5.
 *
 * No schema change: derives from the live, monotonic User.level already loaded
 * on every relevant path. A future purchasable stable upgrade can switch the
 * source behind this same signature without moving the roster-cap curves that
 * consume it (Equoria-oey96.8).
 *
 * Defensive: a missing / non-numeric / sub-1 level falls back to level 1 (SL1)
 * — the most restrictive cap, never a permissive one.
 *
 * @param {{ level?: number }} user - User object carrying `level`.
 * @returns {number} Stable level clamped to [1, 5].
 */
function getStableLevel(user) {
  const level = Number(user?.level);
  const safeLevel = Number.isFinite(level) && level >= 1 ? level : 1;
  return Math.min(5, Math.max(1, Math.ceil(safeLevel / 4)));
}

/**
 * Creates a new user in the database.
 *
 * @param {Object} userData - The user data.
 * @param {string} userData.username - The username of the user.
 * @param {string} userData.email - The user's email address.
 * @param {string} userData.password - The user's password.
 * @param {Object} [userData.rest] - Additional user fields.
 * @returns {Promise<Object>} The created user object containing selected fields.
 */
async function createUser(userData) {
  try {
    const { username, email, password, ...rest } = userData;
    if (!username || !email || !password) {
      throw new Error('Username, email, and password are required.');
    }

    const newUser = await prisma.user.create({
      data: {
        username,
        email: email.toLowerCase(),
        password,
        ...rest,
      },
      select: {
        id: true,
        username: true,
        email: true,
        level: true,
        xp: true,
        money: true,
        createdAt: true,
      },
    });

    logger.info(`[createUser] User created: ${newUser.username}`);
    return newUser;
  } catch (error) {
    // Handle Prisma "unique constraint violation" (duplicate email/username).
    // Re-throw with `.code` PRESERVED so the global error handler keys off
    // `err.code === 'P2002'` and renders a clean 409/400 conflict — NOT a 500.
    // Wrapping into a generic Error / DatabaseError drops `.code` and produces
    // a 500 (Equoria-iqdc7; mirrors the updateUser fix Equoria-g5x66). This
    // matches the P2002 contract used elsewhere (updateUser, showController,
    // conformationShowController, tokenRotationService) where the raw
    // `error.code` is the contract between the throwing layer and the mapper.
    if (error.code === 'P2002') {
      const field = error.meta?.target?.join(', ') || 'field';
      logger.error(`[createUser] Duplicate value for ${field}.`);
      throw error;
    }
    logger.error(`[createUser] Error: ${error.message}`);
    throw new DatabaseError(`Create user failed: ${error.message}`);
  }
}

async function getUserById(id) {
  try {
    if (!id) {
      throw new Error('User ID is required.');
    }
    return await prisma.user.findUnique({ where: { id } });
  } catch (error) {
    logger.error(`[getUserById] Error: ${error.message}`);
    throw new DatabaseError(`Lookup failed: ${error.message}`);
  }
}

async function getUserWithHorses(id) {
  try {
    if (!id) {
      throw new Error('User ID is required.');
    }
    return await prisma.user.findUnique({
      where: { id },
      include: {
        horses: { include: { breed: true, stable: true } },
      },
    });
  } catch (error) {
    logger.error(`[getUserWithHorses] Error: ${error.message}`);
    throw new DatabaseError(`Lookup failed: ${error.message}`);
  }
}

async function getUserByEmail(email) {
  try {
    if (!email) {
      throw new Error('Email required.');
    }
    return await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
  } catch (error) {
    logger.error(`[getUserByEmail] Error: ${error.message}`);
    throw new DatabaseError(`Lookup failed: ${error.message}`);
  }
}

async function updateUser(id, updateData) {
  try {
    if (!id) {
      throw new Error('User ID is required.');
    }
    delete updateData.id;
    delete updateData.createdAt;

    return await prisma.user.update({
      where: { id },
      data: updateData,
    });
  } catch (error) {
    // Handle Prisma "record not found" error specifically
    if (error.code === 'P2025') {
      logger.error(`[updateUser] User not found for update: ID ${id}`);
      return null; // Return null to indicate user not found
    }
    // Handle Prisma "unique constraint violation" (duplicate email/username).
    // Re-throw with `.code` PRESERVED so the global error handler keys off
    // `err.code === 'P2002'` and renders a clean 409/400 conflict — NOT a 500.
    // Wrapping into a generic DatabaseError would drop `.code` and produce a
    // 500 (Equoria-g5x66). This mirrors the P2002 handling used elsewhere
    // (showController, conformationShowController, tokenRotationService) where
    // the raw `error.code` is the contract between the throwing layer and the
    // error mapper.
    // Handle Prisma "unique constraint violation" (duplicate email/username).
    // Re-throw with `.code` PRESERVED so the global error handler keys off
    // `err.code === 'P2002'` and renders a clean 409/400 conflict — NOT a 500.
    // Wrapping into a generic DatabaseError would drop `.code` and produce a
    // 500 (Equoria-g5x66). This mirrors the P2002 handling used elsewhere
    // (showController, conformationShowController, tokenRotationService) where
    // the raw `error.code` is the contract between the throwing layer and the
    // error mapper.
    if (error.code === 'P2002') {
      const field = error.meta?.target?.join(', ') || 'field';
      logger.error(`[updateUser] Duplicate value for ${field}: ID ${id}`);
      throw error;
    }
    logger.error(`[updateUser] Error: ${error.message}`);
    throw new DatabaseError(`Update failed: ${error.message}`);
  }
}

/**
 * Deletes a user and all data scoped to that user.
 *
 * Delegates to the proven, scoped, transactional cascade in
 * `gdprAccountService.eraseUserAccount` (Equoria-s3rf) rather than a bare
 * `prisma.user.delete`. A bare delete fails with a Prisma FK Restrict
 * violation (P2003) for any non-empty account because the user owns
 * horses / grooms / forum threads / clubs / etc. whose relations are
 * `onDelete: Restrict` (Equoria-02nos). Reusing `eraseUserAccount` keeps
 * the FK-ordered deletion logic in one place (DRY) — this route is
 * self-scoped via `requireSelfAccess`, matching `eraseUserAccount`'s
 * self-only contract exactly.
 *
 * Idempotent: returns `null` when the user does not exist (the
 * controller maps `null` → 404), matching the prior P2025 behaviour.
 *
 * @param {string} id - The user id (already proven to be the caller's
 *   own id by the route's `requireSelfAccess` middleware).
 * @returns {Promise<{ id: string }|null>} A minimal shape on success,
 *   `null` if the user did not exist.
 */
async function deleteUser(id) {
  try {
    if (!id) {
      throw new Error('User ID is required.');
    }
    const { deleted } = await eraseUserAccount(id);
    if (!deleted) {
      logger.error(`[deleteUser] User not found for deletion: ID ${id}`);
      return null; // Return null to indicate user not found
    }
    return { id };
  } catch (error) {
    logger.error(`[deleteUser] Error: ${error.message}`);
    throw new DatabaseError(`Delete failed: ${error.message}`);
  }
}

/**
 * Tx-aware core for awarding user XP. Every mutation runs on the passed `db`
 * client — either the base prisma client or an interactive-transaction client —
 * so a caller that already holds a transaction can COMPOSE this without a nested
 * `$transaction`. This is a hard requirement of the overnight show executor
 * (Equoria-oey96.4): `executeClosedShows` awards prize money and XP in one
 * per-entry interactive tx, and an internally-self-transacted award called there
 * would deadlock on the user-row lock the outer tx already holds.
 *
 * Equoria-jvi3u: this replaces the former read -> absolute JS write -> SEPARATE
 * un-transacted `logXpEvent` (written by the competition/training controllers).
 * That shape had two defects: a lost-update race (concurrent awards read the same
 * base xp, last writer wins, one award silently lost — and a stale writer could
 * REGRESS level) and audit drift (User.xp and SUM(XpEvent.amount) were two
 * independent statements that a crash could split). Both are closed here:
 *   - `xp: { increment }` returns the new xp; the row lock it takes serializes
 *     competing awards so none are lost;
 *   - the target level is derived from the RETURNED post-increment xp (never a
 *     re-read) and applied with a CONDITIONAL `updateMany` (`level: { lt: target }`)
 *     so a stale concurrent writer can never LOWER it — level stays monotone;
 *   - the `xpEvent` audit row is created on the SAME client, so it commits or
 *     rolls back together with the XP write and `User.xp == SUM(XpEvent.amount)`
 *     holds by construction.
 *
 * @param {object} db - prisma client or a `$transaction` tx client.
 * @param {string} userId - The user receiving XP.
 * @param {number} amount - Positive XP amount (validated by the public wrapper).
 * @param {string} reason - Non-empty audit reason (validated by the wrapper).
 * @returns {Promise<{currentXP:number, currentLevel:number, leveledUp:boolean, levelsGained:number}>}
 */
async function addXpToUserCore(db, userId, amount, reason) {
  const updated = await db.user.update({
    where: { id: userId },
    data: { xp: { increment: amount } },
    // xp = the new post-increment value; level = the PRE-raise level (only xp was
    // written by this statement).
    select: { xp: true, level: true },
  });

  const newXp = updated.xp;
  const targetLevel = levelForXp(newXp);
  // levelsGained is derived from the ATOMIC post-increment xp and its exact
  // pre-value (newXp - amount). Correct under concurrency: the row lock from the
  // update above serializes competing awards, so each 100-xp threshold is credited
  // to exactly one award no matter how the awards interleave.
  const levelsGained = Math.max(0, targetLevel - levelForXp(newXp - amount));
  const leveledUp = levelsGained > 0;

  if (targetLevel > updated.level) {
    // CONDITIONAL raise — never lowers. If a concurrent writer already raised the
    // level to `targetLevel` or higher, `level: { lt: targetLevel }` makes this a
    // no-op, so a stale writer can never regress it.
    await db.user.updateMany({
      where: { id: userId, level: { lt: targetLevel } },
      data: { level: targetLevel },
    });
  }

  // Audit row on the SAME client — commits or rolls back with the XP write.
  await db.xpEvent.create({ data: { userId, amount, reason } });

  return {
    currentXP: newXp,
    currentLevel: Math.max(updated.level, targetLevel),
    leveledUp,
    levelsGained,
  };
}

/**
 * Award XP to a user, level them up monotonically, and write the audit event —
 * all in one transaction. Public wrapper over {@link addXpToUserCore}; keeps the
 * exact prior return shape (success/currentXP/currentLevel/leveledUp/levelsGained/
 * xpGained) so existing callers are unaffected.
 *
 * @param {string} userId - The user receiving XP.
 * @param {number} amount - Positive XP amount.
 * @param {string} [reason='XP award'] - Audit reason recorded on the XpEvent row.
 *   Callers that previously called `logXpEvent` separately now pass their reason
 *   here (competition/training controllers) so the event is written once, in-tx.
 */
async function addXpToUser(userId, amount, reason = DEFAULT_XP_REASON) {
  try {
    if (!userId) {
      throw new Error('User ID is required.');
    }
    if (typeof amount !== 'number' || amount <= 0) {
      throw new Error('XP amount must be a positive number.');
    }
    if (typeof reason !== 'string' || reason.length === 0) {
      throw new Error('Reason must be a non-empty string.');
    }

    const core = await prisma.$transaction(tx => addXpToUserCore(tx, userId, amount, reason));

    // Invalidate user progress cache POST-commit so a reader can never observe a
    // value cached from a transaction that then rolled back.
    await invalidateCache(`user:progress:${userId}`);

    return {
      success: true,
      currentXP: core.currentXP,
      currentLevel: core.currentLevel,
      leveledUp: core.leveledUp,
      levelsGained: core.levelsGained,
      xpGained: amount,
    };
  } catch (error) {
    // A missing user makes `tx.user.update` throw Prisma P2025 inside the tx;
    // preserve the prior clean 'User not found.' message rather than leaking the
    // verbose Prisma text (the old code threw this exact message from an explicit
    // findUnique guard).
    const message = error?.code === 'P2025' ? 'User not found.' : error.message;
    logger.error(`[addXpToUser] Error: ${message}`);
    return {
      success: false,
      error: message,
      currentXP: null,
      currentLevel: null,
      leveledUp: false,
      levelsGained: 0,
    };
  }
}

async function getUserProgress(userId) {
  try {
    const user = await getUserById(userId);
    if (!user) {
      throw new Error('User not found.');
    }

    const threshold = xpThreshold(user.level + 1);
    return {
      userId: user.id,
      level: user.level,
      xp: user.xp,
      xpToNextLevel: threshold - user.xp,
      xpForNextLevel: threshold,
    };
  } catch (error) {
    throw new DatabaseError(`Progress fetch failed: ${error.message}`);
  }
}

async function getUserStats(userId) {
  try {
    if (!userId) {
      throw new Error('User ID is required.');
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { horses: true },
    });
    if (!user) {
      return null;
    }

    const horses = user.horses || [];
    const horseCount = horses.length;
    const avgHorseAge = horseCount
      ? parseFloat((horses.reduce((acc, h) => acc + h.age, 0) / horseCount).toFixed(2))
      : 0;

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      name: user.name,
      createdAt: user.createdAt,
      money: user.money,
      level: user.level,
      xp: user.xp,
      horseCount,
      averageHorseAge: avgHorseAge,
    };
  } catch (error) {
    throw new DatabaseError(`Stats fetch failed: ${error.message}`);
  }
}

// Note: Deprecated functions removed as part of Task 2 naming normalization
// All XP management now uses addXpToUser() with automatic leveling

// ✅ Named exports only — no default export
export {
  createUser,
  getUserById,
  getUserWithHorses,
  getUserByEmail,
  updateUser,
  deleteUser,
  addXpToUser,
  addXpToUserCore,
  getUserProgress,
  getUserStats,
  getStableLevel,
};
