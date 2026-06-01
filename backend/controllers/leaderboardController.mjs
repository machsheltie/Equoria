/**
 * Backwards-compat shim — real implementation in modules/leaderboards/controllers/leaderboardController.mjs
 *
 * Equoria-94z3m: re-export through the leaderboards module barrel (index.mjs)
 * to satisfy the cross-module public-API boundary rule (no-restricted-imports
 * / Equoria-fy2tx). Named exports mirror the controller's public surface (the
 * prior `export *` never forwarded the controller's default export, so this
 * preserves the existing surface exactly).
 */
export {
  getTopUsersByLevel,
  getTopUsersByXP,
  getTopHorsesByPerformance,
  getTopHorsesByEarnings,
  getTopUsersByHorseEarnings,
  getRecentWinners,
  getLeaderboardStats,
  getUserRankSummary,
  captureRankSnapshots,
  getUserRankHistory,
  getTopPlayersByLevel,
  getTopPlayersByXP,
  getTopPlayersByHorseEarnings,
} from '../modules/leaderboards/index.mjs';
