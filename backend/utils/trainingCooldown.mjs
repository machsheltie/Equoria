import prisma from '../db/index.mjs';

/**
 * Check if a horse can train (cooldown is null or in the past)
 * @param {Object} horse - Horse object with trainingCooldown field
 * @returns {boolean} - True if horse can train, false otherwise
 */
export function canTrain(horse) {
  if (!horse) {
    throw new Error('Horse object is required');
  }

  // If no cooldown is set, horse can train
  if (!horse.trainingCooldown) {
    return true;
  }

  // Check if cooldown is in the past
  const now = new Date();
  const cooldownDate = new Date(horse.trainingCooldown);

  return cooldownDate <= now;
}

/**
 * Get the remaining cooldown time in milliseconds
 * @param {Object} horse - Horse object with trainingCooldown field
 * @returns {number|null} - Milliseconds remaining or null if ready to train
 */
export function getCooldownTimeRemaining(horse) {
  if (!horse) {
    throw new Error('Horse object is required');
  }

  // If no cooldown is set, return null (ready to train)
  if (!horse.trainingCooldown) {
    return null;
  }

  const now = new Date();
  const cooldownDate = new Date(horse.trainingCooldown);

  // If cooldown is in the past, return null (ready to train)
  if (cooldownDate <= now) {
    return null;
  }

  // Return remaining time in milliseconds
  return cooldownDate.getTime() - now.getTime();
}

/**
 * Set training cooldown for a horse (7 days from now)
 * @param {number} horseId - ID of the horse to set cooldown for
 * @returns {Object} - Updated horse object
 * @throws {Error} - If horse doesn't exist or database operation fails
 */
export async function setCooldown(horseId) {
  if (horseId === null || horseId === undefined) {
    throw new Error('Horse ID is required');
  }

  // Validate horseId is a positive integer
  const id = parseInt(horseId, 10);
  if (isNaN(id) || id <= 0) {
    throw new Error('Horse ID must be a valid positive integer');
  }

  try {
    // Calculate cooldown date (7 days from now)
    const cooldownDate = new Date();
    cooldownDate.setDate(cooldownDate.getDate() + 7);

    // Update the horse's training cooldown
    const updatedHorse = await prisma.horse.update({
      where: { id },
      data: { trainingCooldown: cooldownDate },
      include: {
        breed: true,
        owner: true,
        stable: true,
        player: true,
      },
    });

    return updatedHorse;
  } catch (error) {
    // Handle specific Prisma errors
    if (error.code === 'P2025') {
      throw new Error(`Horse with ID ${id} not found`);
    }

    // Re-throw other database errors
    throw new Error(`Failed to set cooldown for horse ${id}: ${error.message}`);
  }
}

/**
 * Format cooldown time remaining into human-readable format
 * @param {number} milliseconds - Time remaining in milliseconds
 * @returns {string} - Human-readable time format
 */
export function formatCooldown(milliseconds) {
  if (!milliseconds || milliseconds <= 0) {
    return 'Ready to train';
  }

  const days = Math.floor(milliseconds / (1000 * 60 * 60 * 24));
  const hours = Math.floor((milliseconds % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) {
    return `${days} day(s), ${hours} hour(s) remaining`;
  } else if (hours > 0) {
    return `${hours} hour(s), ${minutes} minute(s) remaining`;
  } else {
    return `${minutes} minute(s) remaining`;
  }
}
