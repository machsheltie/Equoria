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
  // Stud listing fields (Equoria-q072) — set/cleared via /api/v1/horses/:id/stud-listing
  studStatus?: string;
  studFee?: number;
  userId?: string;
  parentIds?: {
    sireId?: number;
    damId?: number;
  };
  // Equipped tack — JSON field from Prisma; includes item IDs + <category>_condition values
  tack?: Record<string, unknown>;
  // Resolved coat color — finalDisplayColor string (legacy vestigial TEXT column;
  // NULL for all canonical-DB horses post-31E).
  finalDisplayColor?: string;
  // Phenotype JSONB — colorName is the player-visible color (Equoria-lsi5).
  // Mirror the HorseCard.tsx:130 fallback pattern: phenotype.colorName takes
  // precedence over finalDisplayColor, then falls back to 'Unknown' in the UI.
  phenotype?: { colorName?: string; [key: string]: unknown } | null;
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
  // Epic 31D — innate behavioural temperament (one of 11 types). May be null
  // on legacy horses that predate the temperament system (Equoria-8k7k).
  temperament?: string | null;
  // Epic 31E-3 / Equoria-ga5g — markings generated alongside coat color and
  // stored on Horse.phenotype JSONB by markingGenerationService.mjs. Optional
  // because legacy horses (created before 31E-3) won't have markings on the
  // phenotype payload. Each field independently optional so we can render
  // partial data when only some fields exist.
  markings?: HorseMarkings | null;
}

export interface HorseLegMarkings {
  frontLeft?: string;
  frontRight?: string;
  hindLeft?: string;
  hindRight?: string;
}

export interface HorseAdvancedMarkings {
  bloodyShoulderPresent?: boolean;
  snowflakePresent?: boolean;
  frostPresent?: boolean;
}

export interface HorseModifiers {
  isSooty?: boolean;
  isFlaxen?: boolean;
  hasPangare?: boolean;
  isRabicano?: boolean;
}

export interface HorseMarkings {
  faceMarking?: string;
  legMarkings?: HorseLegMarkings;
  advancedMarkings?: HorseAdvancedMarkings;
  modifiers?: HorseModifiers;
}
