/**
 * Shared types for HorseDetailPage and its lazy-loaded tab sub-panels.
 *
 * These are the local-to-page types that the tab components need. They are
 * a superset of the canonical types/horse.ts (which reflects the list API).
 * The detail page uses its own Horse interface because the detail API returns
 * additional fields (parentIds, tack, feed-system fields, etc.).
 */

export interface HorseStats {
  precision: number;
  strength: number;
  speed: number;
  agility: number;
  endurance: number;
  intelligence: number;
  stamina: number;
  balance: number;
  boldness: number;
  flexibility: number;
  obedience: number;
  focus: number;
}

export interface Horse {
  id: number;
  name: string;
  breed: string;
  breedId?: number;
  age: number;
  gender: string;
  dateOfBirth: string;
  healthStatus: string;
  imageUrl?: string;
  stats: HorseStats;
  disciplineScores: Record<string, number>;
  traits?: string[];
  description?: string;
  forSale?: boolean;
  salePrice?: number;
  userId?: string;
  parentIds?: {
    sireId?: number;
    damId?: number;
  };
  // Equipped tack — JSON field from Prisma; includes item IDs + <category>_condition values
  tack?: Record<string, unknown>;
  // Resolved coat color — finalDisplayColor string, or colorName from phenotype JSONB
  finalDisplayColor?: string;
  // Feed-system redesign 2026-04-29 (A11/A16): per-horse equipped feed tier
  // and the three derived health bands injected by the backend serializer
  // (backend/utils/horseHealth.mjs withHealth()).
  lastFedDate?: string | null;
  equippedFeedType?: string | null;
  feedHealth?: 'excellent' | 'good' | 'fair' | 'poor' | 'critical' | 'retired';
  vetHealth?: 'excellent' | 'good' | 'fair' | 'poor' | 'critical' | 'retired' | string;
  displayedHealth?: 'excellent' | 'good' | 'fair' | 'poor' | 'critical' | 'retired';
  // Feed-system redesign 2026-04-29 (B6, Equoria-ta4s): in-foal state on the
  // mare's row. Set by `breedFoal()` (B3); consumed by `runFoalingJob()` (B5).
  inFoalSinceDate?: string | null;
  pregnancySireId?: number | null;
  pregnancyFeedingsByTier?: Record<string, number>;
}
