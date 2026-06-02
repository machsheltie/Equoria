import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import { DatabaseError } from '../../../errors/index.mjs';
import { invalidateCache } from '../../../utils/cacheHelper.mjs';
// Same-module import: avoid routing through the users barrel (index.mjs) to
// prevent a barrel<->service circular dependency, since the barrel re-exports
// this very file (userModelService) alongside gdprAccountService (Equoria-kwjav).
import { eraseUserAccount } from './gdprAccountService.mjs';

const DEFAULT_XP_PER_LEVEL = 100;

/**
 * Calculates the experience points threshold for a specific level.
 * @param {number} level - The level to calculate the threshold for.
 * @returns {number} The experience points threshold for the given level.
 */
function xpThreshold(level) {
  return DEFAULT_XP_PER_LEVEL * level;
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

async function addXpToUser(userId, amount) {
  try {
    if (!userId) {
      throw new Error('User ID is required.');
    }
    if (typeof amount !== 'number' || amount <= 0) {
      throw new Error('XP amount must be a positive number.');
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found.');
    }

    let { xp, level } = user;
    let leveledUp = false;
    let levelsGained = 0;

    xp += amount;

    while (xp >= xpThreshold(level + 1)) {
      level++;
      levelsGained++;
      leveledUp = true;
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { xp, level },
    });

    // Invalidate user progress cache to ensure fresh data on next read
    await invalidateCache(`user:progress:${userId}`);

    return {
      success: true,
      currentXP: updated.xp,
      currentLevel: updated.level,
      leveledUp,
      levelsGained,
      xpGained: amount,
    };
  } catch (error) {
    logger.error(`[addXpToUser] Error: ${error.message}`);
    return {
      success: false,
      error: error.message,
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
  getUserProgress,
  getUserStats,
};
