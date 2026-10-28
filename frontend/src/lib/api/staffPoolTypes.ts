/**
 * The staff hiring pools (owner rulings 2026-10-28, q153/q177; Equoria-266h7).
 *
 * A rider or groom a player lets go, or stops paying, returns to the hiring list at its
 * current level with what it has revealed intact. These are the rows of
 * GET /api/v1/riders/free-agents and GET /api/v1/groom-marketplace/free-agents: real
 * staff rows (hired by `id`, not a marketplace offer id), each with its weekly price
 * and only its revealed growth items, as authored labels.
 */

import type { StaffGrowthView } from './types';

export interface PoolRider {
  id: number;
  firstName: string;
  lastName: string;
  name: string;
  /** Stored word, used only as the badge key; players read `personalityLabel`. */
  personality: string;
  personalityLabel: string;
  /** Equoria-nawn5: star level (rookie..expert); shown through StaffLevelStars, never raw. */
  starLevel: string;
  speciality?: string;
  specialityLabel?: string;
  bio?: string | null;
  /** One week at the rider's current level's price; hiring charges this once. */
  weeklyRate: number;
  growth?: StaffGrowthView;
}

export interface PoolGroom {
  id: number;
  name: string;
  /** Stored word, used only as the badge key; players read `personalityLabel`. */
  personality: string;
  personalityLabel: string;
  starLevel: string;
  speciality: string;
  specialityLabel: string;
  bio?: string | null;
  /** One week at the groom's current level's price; hiring charges this once. */
  weeklyFee: number;
  growth?: StaffGrowthView;
}

/** GET /api/v1/riders/free-agents (unwrapped `data`). */
export interface PoolRiderList {
  riders: PoolRider[];
  total: number;
}

/** GET /api/v1/groom-marketplace/free-agents (unwrapped `data`). */
export interface PoolGroomList {
  grooms: PoolGroom[];
  total: number;
}

/** How many pool rows one page of the hiring list asks for (the server's maximum). */
export const staffPoolPageSize = 100;
