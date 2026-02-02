/**
 * XP Calculation Utilities
 *
 * Functions for calculating player level and XP progress
 * Story 2.2: XP & Level Display - AC-3
 *
 * Formula:
 * - Level = Math.floor(totalXP / 100) + 1
 * - XP for Next Level = currentLevel * 100
 * - Progress % = ((totalXP % 100) / 100) * 100
 */

/**
 * XP required per level (constant 100 XP per level)
 */
export const XP_PER_LEVEL = 100;

/**
 * Calculate the player's current level based on total XP
 *
 * @param totalXP - Total accumulated XP
 * @returns Current level (minimum 1)
 */
export function calculateLevel(totalXP: number): number {
  if (totalXP === undefined || totalXP === null || totalXP < 0) {
    return 1;
  }
  return Math.floor(totalXP / XP_PER_LEVEL) + 1;
}

/**
 * Get the total XP required to reach the next level from current level
 *
 * @param currentLevel - Current player level
 * @returns Total XP required for next level
 */
export function getXPForNextLevel(currentLevel: number): number {
  if (currentLevel === undefined || currentLevel === null) {
    return XP_PER_LEVEL;
  }
  return currentLevel * XP_PER_LEVEL;
}

/**
 * Get the XP progress within the current level (0-99)
 *
 * @param totalXP - Total accumulated XP
 * @returns XP progress within current level
 */
export function getXPProgress(totalXP: number): number {
  if (totalXP === undefined || totalXP === null || totalXP < 0) {
    return 0;
  }
  return totalXP % XP_PER_LEVEL;
}

/**
 * Get the XP progress as a percentage (0-99)
 *
 * @param totalXP - Total accumulated XP
 * @returns Progress percentage towards next level
 */
export function getXPProgressPercent(totalXP: number): number {
  if (totalXP === undefined || totalXP === null || totalXP < 0) {
    return 0;
  }
  return totalXP % XP_PER_LEVEL;
}

/**
 * Get XP needed to reach the next level
 *
 * @param totalXP - Total accumulated XP
 * @returns XP needed for next level
 */
export function getXPNeededForNextLevel(totalXP: number): number {
  if (totalXP === undefined || totalXP === null || totalXP < 0) {
    return XP_PER_LEVEL;
  }
  const progress = getXPProgress(totalXP);
  return XP_PER_LEVEL - progress;
}

/**
 * Format XP display as "current / total XP"
 *
 * @param totalXP - Total accumulated XP
 * @returns Formatted XP string
 */
export function formatXPDisplay(totalXP: number): string {
  const progress = getXPProgress(totalXP);
  return `${progress} / ${XP_PER_LEVEL} XP`;
}
