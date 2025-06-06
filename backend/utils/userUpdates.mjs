import prisma from '../db/index.mjs';
import { logger } from './logger.mjs';

/**
 * Update user money
 * @param {string} userId - User ID (UUID)
 * @param {number} amount - Amount to add to user's money
 * @returns {Object} - Updated user object
 */
async function updateUserMoney(userId, amount) {
  try {
    if (!userId || typeof userId !== 'string') {
      throw new Error('Valid user ID is required');
    }

    if (typeof amount !== 'number') {
      throw new Error('Valid amount is required');
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        money: {
          increment: amount,
        },
      },
    });

    logger.info(
      `[userUpdates.updateUserMoney] Updated user ${userId} money by $${amount} (total: $${updatedUser.money})`,
    );
    return updatedUser;
  } catch (error) {
    if (error.code === 'P2025') {
      logger.error(`[userUpdates.updateUserMoney] User not found: ${userId}`);
      throw new Error(`User not found: ${userId}`);
    }

    logger.error(`[userUpdates.updateUserMoney] Error updating user money: ${error.message}`);
    throw error;
  }
}

/**
 * Transfer entry fees to host user
 * @param {string} hostUserId - Host user ID (UUID)
 * @param {number} entryFee - Entry fee per horse
 * @param {number} numEntries - Number of horses entered
 * @returns {Object} - Updated user object
 */
async function transferEntryFees(hostUserId, entryFee, numEntries) {
  try {
    if (!hostUserId) {
      logger.info(
        '[userUpdates.transferEntryFees] No host user specified, entry fees not transferred',
      );
      return null;
    }

    const totalFees = entryFee * numEntries;
    const updatedUser = await updateUserMoney(hostUserId, totalFees);

    logger.info(
      `[userUpdates.transferEntryFees] Transferred $${totalFees} in entry fees to host user ${hostUserId}`,
    );
    return updatedUser;
  } catch (error) {
    logger.error(`[userUpdates.transferEntryFees] Error transferring entry fees: ${error.message}`);
    throw error;
  }
}

export { updateUserMoney, transferEntryFees };
