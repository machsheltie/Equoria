/**
 * Groom staff API types — profile, assignment history, marketplace offers and the
 * weekly-fee summary (Equoria-cbkw, Equoria-95yrv).
 *
 * Split out of ./types.ts, which re-exports every name below unchanged, so the
 * public type surface and the api-client barrel are untouched. The split is the
 * file-size ratchet's preferred fix rather than a new grouping: these six shapes are
 * the groom-staff half of the shared block and nothing else references them.
 */

import type { GroomMetrics } from './types';

// Equoria-cbkw — GroomProfile response shape from GET /api/v1/grooms/:id/profile.
export interface GroomProfile {
  id: number;
  name: string;
  /** Equoria-fby1t — the groom's age in game-years; null when not yet known. */
  ageYears?: number | null;
  speciality: string;
  experience: number;
  skillLevel: string;
  personality: string;
  sessionRate: number;
  metrics: GroomMetrics | null;
  currentAssignments: number;
}

// Equoria-cbkw — GroomAssignmentLog rows from GET /api/v1/grooms/:id/assignment-logs.
export interface GroomAssignmentLogEntry {
  id: number;
  groomId: number;
  horseId: number;
  assignedAt: string;
  unassignedAt: string | null;
  milestonesCompleted: number;
  traitsShaped: string[];
  xpGained: number;
  horse: { id: number; name: string };
}

export interface MarketplaceGroom {
  marketplaceId: string;
  firstName: string;
  lastName: string;
  specialty: string;
  skillLevel: string;
  personality: string;
  experience: number;
  sessionRate: number;
  bio: string;
  availability: boolean;
}

export interface MarketplaceData {
  grooms: MarketplaceGroom[];
  lastRefresh: string;
  nextFreeRefresh: string;
  refreshCost: number;
  canRefreshFree: boolean;
  refreshCount: number;
  /** Equoria-95yrv — what each horse in a groom's care costs per week. */
  feePerHorsePerWeek: number;
  /** Equoria-95yrv — the most horses one groom can take. */
  maxHorsesPerGroom: number;
}

export interface MarketplaceStats {
  totalGrooms: number;
  lastRefresh: string | 'never';
  refreshCount: number;
  qualityDistribution: Record<string, number>;
  specialtyDistribution: Record<string, number>;
  config: {
    refreshIntervalHours: number;
    premiumRefreshCost: number;
    defaultSize: number;
  };
}

/**
 * GET /api/v1/groom-salaries/cost — Equoria-95yrv. The weekly fee is
 * `feePerHorsePerWeek` for every horse a groom is caring for, up to
 * `maxHorsesPerGroom`; the rate travels with the payload so no surface keeps its own
 * copy. `totalMonthlyCost` is gone — the backend never sent it.
 */
export interface SalarySummary {
  totalWeeklyCost: number;
  groomCount: number;
  feePerHorsePerWeek: number;
  maxHorsesPerGroom: number;
  breakdown: Array<{
    groomId: number;
    groomName: string;
    skillLevel: string;
    speciality: string;
    assignedHorses: number;
    weeklyFee: number;
    feeUnpaid: boolean;
  }>;
}
