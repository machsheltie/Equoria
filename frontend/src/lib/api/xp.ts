/**
 * Horse Points (XP) types
 *
 * (fetchHorseLevelInfo had no callers and was deleted, Equoria-q4uem.15; the
 * HorseLevelInfo type is re-exported by types.ts as HorseXP. fetchXpHistory and
 * its XpGain / XpHistoryFilters / XpApiError types went with the points history,
 * which the owner removed on 2026-10-28, Equoria-fly7a.)
 *
 * READ-ONLY BY CONTRACT (Equoria-6p398.3, audit Finding 3): there is no
 * client-side XP writer. `addXp()` used to POST an arbitrary
 * { amount, reason } to /api/v1/horses/:id/award-xp, an endpoint whose only
 * authorization was horse ownership — a player could mint 1000 XP and ten stat
 * points for their own horse. That endpoint is now 410 Gone. Horse XP is
 * awarded server-side from competition results; the client only reads it
 * (horsesApi.getXP) and spends EARNED stat points through the allocate-stat
 * surface.
 */

/**
 * Horse level and XP progress information
 * Matches GET /api/horses/:horseId/xp backend response shape.
 */
export interface HorseLevelInfo {
  horseId: number;
  horseName: string;
  currentXP: number;
  availableStatPoints: number;
  nextStatPointAt: number;
  xpToNextStatPoint: number;
  /** Horse Points per stat allocation (owner ruling C15: 1,000), from the server. */
  pointsPerStatPoint: number;
}
