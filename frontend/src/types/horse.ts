/**
 * Canonical Horse types for the Equoria frontend.
 *
 * These types mirror the backend HorseSummary API response (GET /api/horses/:id).
 * All components that need a Horse type should import from here instead of
 * defining local inline interfaces.
 *
 * Exceptions:
 * - Breeding-specific horse data → use `types/breeding.ts`
 * - Foal-specific data          → use `types/foal.ts`
 */

/** All ten game stats as returned by /api/horses/:id/stats */
export interface HorseStats {
  speed: number;
  stamina: number;
  agility: number;
  strength: number;
  intelligence: number;
  temperament: number;
  balance?: number;
  precision?: number;
  boldness?: number;
  flexibility?: number;
  obedience?: number;
  focus?: number;
}

/** Core horse data returned by GET /api/horses and GET /api/horses/:id */
export interface Horse {
  id: number;
  name: string;
  breed: string | { id?: number; name?: string; description?: string };
  age: number;
  sex?: string;
  level: number;
  health: number;
  xp: number;
  imageUrl?: string;
  healthStatus?: string;
  color?: string;
  stats: HorseStats;
  disciplineScores: Record<string, number>;
  trainingCooldown?: string;
}

/** Lightweight horse reference used in dropdowns, selectors, and pickers */
export interface HorseRef {
  id: number;
  name: string;
  breed?: string;
  age?: number;
}
