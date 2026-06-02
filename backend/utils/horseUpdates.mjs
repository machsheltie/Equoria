import prisma from '../../packages/database/prismaClient.mjs';
import logger from './logger.mjs';

/**
 * Update horse earnings after competition
 * @param {number} horseId - Horse ID
 * @param {number} prizeAmount - Prize amount to add
 * @returns {Object} - Updated horse object
 */
async function updateHorseEarnings(horseId, prizeAmount) {
  if (!horseId || typeof horseId !== 'number' || horseId <= 0) {
    throw new Error('Valid horse ID is required');
  }

  if (!prizeAmount || typeof prizeAmount !== 'number' || prizeAmount < 0) {
    throw new Error('Valid prize amount is required');
  }

  // Equoria-8nmxm: re-aim the writer at Horse.totalEarnings (the canonical
  // column read by leaderboards + horseController). Pre-fix this updated
  // Horse.earnings (Decimal) which was never read anywhere — the leaderboard
  // and frontend Hall-of-Fame queries against totalEarnings were always
  // 0/null because the column was never written. The dead Decimal column
  // is dropped by the migration that ships with this commit's PR follow-up.
  const updatedHorse = await prisma.horse.update({
    where: { id: horseId },
    data: {
      totalEarnings: {
        increment: prizeAmount,
      },
    },
    include: {
      breed: true,
      user: true,
      stable: true,
    },
  });

  logger.info(
    `[horseUpdates.updateHorseEarnings] Updated horse ${horseId} earnings by $${prizeAmount} (total: $${updatedHorse.totalEarnings})`,
  );
  return updatedHorse;
}

/**
 * Update horse stat after competition win
 * @param {number} horseId - Horse ID
 * @param {string} statName - Name of stat to increase
 * @param {number} increase - Amount to increase (default 1)
 * @returns {Object} - Updated horse object
 */
async function updateHorseStat(horseId, statName, increase = 1) {
  if (!horseId || typeof horseId !== 'number' || horseId <= 0) {
    throw new Error('Valid horse ID is required');
  }

  if (!statName || typeof statName !== 'string') {
    throw new Error('Valid stat name is required');
  }

  if (!increase || typeof increase !== 'number' || increase <= 0) {
    throw new Error('Valid increase amount is required');
  }

  // Validate stat name
  const validStats = [
    'speed',
    'stamina',
    'agility',
    'balance',
    'precision',
    'intelligence',
    'boldness',
    'flexibility',
    'obedience',
    'focus',
  ];

  if (!validStats.includes(statName)) {
    throw new Error(`Invalid stat name: ${statName}. Must be one of: ${validStats.join(', ')}`);
  }

  // Build dynamic update object
  const updateData = {
    [statName]: {
      increment: increase,
    },
  };

  const updatedHorse = await prisma.horse.update({
    where: { id: horseId },
    data: updateData,
    include: {
      breed: true,
      user: true,
      stable: true,
    },
  });

  logger.info(
    `[horseUpdates.updateHorseStat] Updated horse ${horseId} ${statName} by +${increase} (new value: ${updatedHorse[statName]})`,
  );
  return updatedHorse;
}

/**
 * Update both earnings and stats for a competition winner
 * @param {number} horseId - Horse ID
 * @param {number} prizeAmount - Prize amount to add
 * @param {Object|null} statGain - Stat gain object {stat, gain} or null
 * @returns {Object} - Updated horse object
 */
async function updateHorseRewards(horseId, prizeAmount, statGain = null) {
  // Start with earnings update
  let updatedHorse = await updateHorseEarnings(horseId, prizeAmount);

  // Apply stat gain if applicable
  if (statGain && statGain.stat && statGain.gain) {
    updatedHorse = await updateHorseStat(horseId, statGain.stat, statGain.gain);
  }

  return updatedHorse;
}

export { updateHorseEarnings, updateHorseStat, updateHorseRewards };
