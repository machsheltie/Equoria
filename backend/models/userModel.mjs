import prisma from '../db/index.mjs';
import logger from '../utils/logger.mjs';
import { DatabaseError } from '../errors/index.mjs';

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
        role: true,
        level: true,
        xp: true,
        money: true,
        createdAt: true,
      },
    });

    logger.info(`[createUser] User created: ${newUser.username}`);
    return newUser;
  } catch (error) {
    if (error.code === 'P2002') {
      const field = error.meta?.target?.join(', ') || 'field';
      throw new Error(`Duplicate value for ${field}.`);
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
    logger.error(`[updateUser] Error: ${error.message}`);
    throw new DatabaseError(`Update failed: ${error.message}`);
  }
}

async function deleteUser(id) {
  try {
    if (!id) {
      throw new Error('User ID is required.');
    }
    return await prisma.user.delete({ where: { id } });
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

// Deprecated
function addUserXp(userId, amount) {
  logger.warn('[addUserXp] DEPRECATED: Use addXpToUser instead.');
  return addXpToUser(userId, amount);
}

async function checkAndLevelUpUser(userId) {
  logger.warn('[checkAndLevelUpUser] DEPRECATED: XP is auto-managed now.');
  const user = await getUserById(userId);
  return {
    ...user,
    leveledUp: false,
    levelsGained: 0,
    message: 'Deprecated: use addXpToUser.',
  };
}

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
  addUserXp,
  checkAndLevelUpUser,
};
