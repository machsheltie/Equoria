/**
 * Shared API response/request types for the Equoria frontend (Equoria-aodym).
 *
 * These interfaces were the top-of-file shared block in api-client.ts —
 * referenced by multiple domain clients (training, horses, grooms, riders,
 * breeding, competitions, userProgress, marketplace) and re-exported from the
 * api-client barrel. They live here so the remaining inline domains can be
 * extracted to ./api/<domain>.ts in follow-up slices without a circular
 * dependency on the barrel, which re-exports every type below unchanged.
 *
 * NOTE: `normalizeFoalDevelopment` (the runtime flattener) stays in
 * api-client.ts because it is exported from the barrel and bound to the
 * foal-development contract sentinel test; it imports FoalDevelopment /
 * RawFoalDevelopmentBody from here.
 */

import type { HealthBand } from '../healthWords';

export interface TrainableHorse {
  id: number;
  horseId?: number;
  name: string;
  level?: number;
  breed?: string | { name?: string };
  gender?: string;
  sex?: string;
  age?: number;
  ageYears?: number;
  canTrain?: boolean;
  ineligibleReason?: string | null;
  bestDisciplines?: string[];
  trainableDisciplines?: string[];
  nextEligibleAt?: string | null;
}

export interface TrainingRequest {
  horseId: number;
  discipline: string;
}

export interface TrainingEligibility {
  eligible: boolean;
  reason?: string;
  cooldownEndsAt?: string | null;
}

export interface DisciplineStatus {
  discipline: string;
  score?: number;
  nextEligibleDate?: string | null;
  lastTrainedAt?: string | null;
}

export interface StatGain {
  stat: string;
  amount: number;
  traitModified: boolean;
}

export interface TraitEffects {
  appliedTraits: string[];
  xpModifier: number;
}

export interface TrainingResult {
  success: boolean;
  message: string;
  nextEligible: string | null;
  // Equoria-o1x6g — the REAL awarded XP for this session (post-trait,
  // post-temperament, floor-1). Distinct from traitEffects.xpModifier, which is
  // only the trait-attributable delta. Null on the legacy/mock path that does
  // not emit it.
  xpAwarded?: number | null;
  // Equoria-o1x6g — the authoritative discipline-score delta computed by the
  // backend (the flat +5, owner ruling 2026-10-23). The frontend must read
  // this instead of recomputing the gain, which drifts.
  disciplineScoreIncrease?: number | null;
  // Equoria-3kegj — the assigned trainer's per-training fee this session
  // charged (0 when the horse has no trainer).
  trainingFee?: number;
  traitEffects?: TraitEffects;
  // Equoria-8vmdv: these are NOT deprecated — the prior "deprecated, will be
  // removed" label was inverted vs the real /train contract. The flat-shape
  // route handler (trainingController.mjs ~764) emits `updatedScore` +
  // `nextEligibleDate`, both read by current components: TrainingResultsDisplay
  // reads `updatedScore` + `nextEligibleDate`; TrainingTab reads `updatedScore`.
  // They coexist with the sibling handler's `nextEligible` (above, ~485), so
  // this type unions both response shapes — none of these is legacy.
  updatedScore?: number;
  nextEligibleDate?: string;
  // Optional flat-shape extras present on some response paths (discipline label
  // / horse id); not part of the canonical fields above.
  discipline?: string;
  horseId?: number;
}

/** POST /horses/foals — the PAIR only; no owner id, the session owns it (Equoria-6w3ur). */
export interface BreedRequest {
  sireId: number;
  damId: number;
}

/**
 * FoalDevelopment — the FLAT, canonical foal-development contract the UI
 * consumes (Equoria-n3yw6).
 *
 * IMPORTANT: the real backend (GET /api/foals/:foalId/development) returns
 *   { success, data: { foal, development: { currentDay, bondingLevel,
 *     maxDay }, activityHistory } }
 * After the apiClient `.data` unwrap that leaves the development stats nested
 * one level deeper (data.development.development.*), so consumers reading
 * `development.currentDay` saw `undefined` and rendered placeholders. The
 * `getFoalDevelopment` API fn below normalizes that envelope into this flat
 * shape so every field here maps to a REAL backend value — there are no
 * fabricated `stage` / `progress` / `enrichmentLevel` placeholder fields.
 * The player-run enrichment fields were removed (Equoria-fr2kg; owner ruling
 * 2026-10-14/15: foal enrichment is the groom's job).
 */
export interface FoalDevelopment {
  /** Manually-incremented development day (0–6). */
  currentDay: number;
  /** Max development day (6 — the 7-day 0..6 window). */
  maxDay: number;
  /** Bond score 0–100. */
  bondingLevel: number;
}

/**
 * Raw backend envelope-body for GET /api/foals/:foalId/development, AFTER the
 * apiClient `.data` unwrap. The development stats live under a nested
 * `development` key here — `normalizeFoalDevelopment` flattens it.
 */
export interface RawFoalDevelopmentBody {
  development?: {
    currentDay?: number;
    bondingLevel?: number;
    maxDay?: number;
  };
  // The PUT /develop endpoint returns the FLAT shape already, so the same
  // normalizer must also pass through a body that has these fields at the top.
  currentDay?: number;
  bondingLevel?: number;
  maxDay?: number;
}

export interface Foal {
  id: number;
  name: string;
  sireId?: number;
  damId?: number;
  ageDays?: number;
  ageInDays?: number;
  dateOfBirth?: string;
  /** Alias for dateOfBirth — some API responses use this field name */
  birthDate?: string;
  sex?: string;
  userId?: string;
  traits?: string[];
  development?: FoalDevelopment;
}

export interface BreedResponse {
  success?: boolean;
  message?: string;
  // Pregnancy-flow response (current backend contract — POST /horses/foals starts an
  // in-foal pregnancy; the actual foal is created later by the foaling job).
  pregnancyStarted?: boolean;
  damId?: number;
  sireId?: number;
  /** ISO string — when the foal is expected to be born (7 days from breeding). */
  foalDueDate?: string;
  // Legacy / future contract — when the backend returns a freshly-born foal directly.
  foalId?: number;
  foal?: Foal;
}

export interface FoalActivity {
  id?: number;
  activity: string;
  duration?: number;
  createdAt?: string;
}

// Simple stats object for components — all 12 horse stats
export interface SimpleHorseStats {
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

export interface HorseSummary {
  id: number;
  name: string;
  breed: string | { id?: number; name?: string; description?: string };
  // Foreign key to the breed row, returned flat beside the `breed` relation.
  breedId?: number;
  age: number;
  ageYears: number;
  gender: string;
  sex?: string;
  level?: number;
  dateOfBirth: string;
  healthStatus: string;
  // Bond, 0-100 (GET /horses/:id returns the whole row).
  bondScore?: number;
  imageUrl?: string;
  stats: SimpleHorseStats;
  disciplineScores: Record<string, number>;
  traits?: string[];
  trait?: string;
  description?: string;
  forSale?: boolean;
  salePrice?: number;
  userId?: string;
  parentIds?: {
    sireId?: number;
    damId?: number;
  };
  // Care & cooldown fields from Prisma
  lastFedDate?: string;
  lastVettedDate?: string;
  lastShod?: string;
  lastGroomed?: string;
  trainingCooldown?: string;
  // Breeding state (GET /horses list + detail, Equoria-q4uem.9 slice 6):
  // when a MARE's breeding cooldown ends (null when not a mare or not on
  // cooldown; stallions never have one) and whether she is in foal.
  breedingCooldownEndsAt?: string | null;
  inFoal?: boolean;
  // Earnings fields (API may return either name)
  totalEarnings?: number;
  earnings?: number;
  // Coat color from genetics system
  finalDisplayColor?: string;
  // Full phenotype JSONB — returned by GET /horses/:id; colorName is the player-visible color
  phenotype?: { colorName?: string; [key: string]: unknown } | null;
  // Epic 31D — horse temperament (e.g. "Calm", "Spirited"). Null/undefined for legacy horses.
  // Drives groom synergy + competition modifiers; HorseCard renders a small chip when present.
  temperament?: string | null;
  // Epic 31F (Equoria-u7e6) — conformation title progression
  // currentTitle: human-readable title (e.g. "Champion") or null for un-titled horses
  // breedingValueBoost: 0..N multiplier applied to breeding outcomes (0 = no boost)
  // titlePoints: cumulative show points used to compute the next title threshold
  currentTitle?: string | null;
  breedingValueBoost?: number;
  titlePoints?: number;
  // Equipped tack (JSON field) — includes item IDs and <category>_condition values
  tack?: Record<string, unknown>;
  // Stats returned flat from API (all 12)
  precision?: number;
  strength?: number;
  speed?: number;
  agility?: number;
  endurance?: number;
  intelligence?: number;
  stamina?: number;
  balance?: number;
  boldness?: number;
  flexibility?: number;
  obedience?: number;
  focus?: number;
  // Feed-system redesign 2026-04-29 (A11): equipped feed tier (per-horse)
  // and the three derived health bands injected by the backend serializer
  // (backend/utils/horseHealth.mjs withHealth()).
  equippedFeedType?: string | null;
  feedHealth?: HealthBand;
  vetHealth?: HealthBand;
  displayedHealth?: HealthBand;
  // Feed-system redesign 2026-04-29 (B6, Equoria-ta4s): in-foal state on the
  // mare's row. Set by `breedFoal()` (B3); consumed by `runFoalingJob()` (B5).
  // The panel on HorseDetailPage uses these to render the gestation-day
  // countdown, per-tier feeding counters, and bonus preview.
  inFoalSinceDate?: string | null;
  pregnancySireId?: number | null;
  pregnancyFeedingsByTier?: Record<string, number>;
  // Equoria-55bo.5: lightweight most-recent competition result, attached by
  // the list serializer (one batched query, no N+1). Consumed by
  // NarrativeChip.deriveLatestChapter to surface competition narratives.
  // Explicit null when the horse has no competition history.
  latestEvent?: {
    type: 'competition';
    showName: string;
    discipline: string;
    placement: number | null;
    date: string | null;
  } | null;
  // Equoria-55bo.6: real per-horse championship signal, derived by the list
  // serializer from the horse's actual 1st-place CompetitionResult rows
  // (counted in the same batched query as latestEvent, no N+1). Drives the
  // ornate GoldBorderFrame on non-HoF stable/dashboard cards (Spec 11.3.13).
  // NOT a hardcoded "featured" flag — hasChampionship === firstPlaceWins > 0.
  firstPlaceWins?: number;
  hasChampionship?: boolean;
}

export interface HorseTrainingHistoryEntry {
  id?: number;
  discipline?: string;
  trainedAt?: string;
  /**
   * The trained discipline's score just before / just after the session
   * (Equoria-ky2ob). Null on sessions logged before they were recorded.
   */
  scoreBefore?: number | null;
  scoreAfter?: number | null;
}

export interface HorseTrainingAnalytics {
  trainingHistory: HorseTrainingHistoryEntry[];
  disciplineBalance: Record<string, unknown>;
  trainingFrequency: Record<string, unknown>;
}

/** GET /api/v1/horses/:id/xp — one shape, defined in ./xp (Equoria-576c0 B13). */
export type { HorseLevelInfo as HorseXP } from './xp';

export interface HorseXPEvent {
  id: number;
  amount: number;
  reason: string;
  timestamp: string;
}

export interface HorseXPHistory {
  events: HorseXPEvent[];
  count: number;
  pagination: {
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

/**
 * Groom interfaces
 */
export interface Groom {
  id: number;
  name: string;
  skillLevel: string;
  specialty: string;
  personality: string;
  experience: number;
  // Equoria-oey96.6 — progression level (1–10); gates the talent-tree tiers. The
  // list serializer supplies it. Optional so older cached envelopes typecheck.
  level?: number;
  /**
   * Equoria-fby1t (owner ruling, 2026-09-14) — the groom's age in game-years, shown
   * to the player wherever their identity is. `null` when it is not yet known (a
   * groom predating the age model whose first weekly pass has not run): the surface
   * shows an em dash, never a zero. Optional so older cached envelopes typecheck.
   */
  ageYears?: number | null;
  sessionRate: number;
  isActive: boolean;
  availableSlots: number;
  currentAssignments: number;
  maxAssignments: number;
}

export interface GroomAssignment {
  id: number;
  groomId: number;
  horseId: number;
  priority: number;
  notes?: string;
  isActive: boolean;
  startDate: string;
}

// Equoria-cbkw — GroomMetrics aggregated on every performance-record write
// (backend groomPerformanceService). 7 score fields, 0-100 each.
export interface GroomMetrics {
  id: number;
  groomId: number;
  totalInteractions: number;
  bondingEffectiveness: number;
  taskCompletion: number;
  horseWellbeing: number;
  showPerformance: number;
  consistency: number;
  playerSatisfaction: number;
  reputationScore: number;
  lastUpdated: string;
}

// Groom staff shapes (profile, assignment history, marketplace, weekly fee) live in
// ./groomStaffTypes.ts and are re-exported here, so every existing importer is
// unchanged. Equoria-95yrv split them out under the file-size ratchet.
export * from './groomStaffTypes';

/**
 * User Progress interfaces
 */
export interface UserProgress {
  userId: string;
  username: string;
  level: number;
  xp: number;
  xpToNextLevel: number;
  xpForNextLevel: number;
  xpForCurrentLevel: number;
  progressPercentage: number;
  totalEarnings: number;
  // Equoria-oey96.2: the four Game-Statistics fields the ProfilePage cards
  // read. Now REQUIRED — the /progress endpoint always returns them (real
  // aggregate values, not optional/undefined that silently rendered 0).
  totalHorses: number;
  totalCompetitions: number;
  winRate: number;
  breedingCount: number;
  // totalWins is not returned by /progress (only /competition-stats). Kept
  // optional so consumers of that other endpoint can still read it.
  totalWins?: number;
}

export interface ActivityFeedItem {
  id: number;
  userId: number;
  type: string;
  description: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

/**
 * Competition interfaces
 */
export interface Competition {
  id: number;
  name: string;
  description?: string;
  discipline: string;
  date: string;
  location?: string;
  prizePool: number;
  entryFee: number;
  maxEntries?: number;
  currentEntries?: number;
  status?: string;
  entryDeadline?: string;
  /** When the show stops taking entries (the list endpoint returns the Show row). */
  closeDate?: string | null;
  runDate?: string;
  // Equoria-e0cn: conformation shows are differentiated by showType ('conformation'
  // vs ridden 'show'). Surfacing this here lets the conformation entry UI filter
  // the unified competitions list without a separate backend endpoint.
  showType?: string;
  hostUserId?: string | null;
}

export interface Discipline {
  id: string;
  name: string;
  description?: string;
  requiredStats?: string[];
  requiredTraits?: string[];
}

export interface EligibilityResult {
  eligible: boolean;
  reasons?: string[];
  requirements?: {
    minAge?: number;
    minLevel?: number;
    requiredTraits?: string[];
  };
}

/**
 * Rider interfaces (Epic 9C)
 */
export interface Rider {
  id: number;
  name: string;
  firstName: string;
  lastName: string;
  skillLevel: string; // rookie | developing | experienced
  personality: string; // daring | methodical | intuitive | competitive
  experience: number; // total XP
  level: number; // 1–10
  weeklyRate: number;
  careerWeeks: number;
  totalWins: number;
  totalCompetitions: number; // real total; 0 when not yet recorded
  prestige: number; // 0–100
  isActive: boolean;
  retired: boolean;
  assignedHorseId?: number | null;
  bio: string;
  hiredDate: string; // ISO timestamp (backend createdAt)
}

export interface RiderAssignment {
  id: number;
  riderId: number;
  horseId: number;
  horseName: string;
  startDate: string;
  isActive: boolean;
}

export interface MarketplaceRider {
  marketplaceId: string;
  firstName: string;
  lastName: string;
  skillLevel: string;
  personality: string;
  experience: number;
  weeklyRate: number;
  bio: string;
  availability: boolean;
  knownAffinities: string[]; // only visible for 'experienced' skill level
}

export interface RiderMarketplaceData {
  riders: MarketplaceRider[];
  lastRefresh: string;
  nextFreeRefresh: string;
  refreshCost: number;
  canRefreshFree: boolean;
}

export interface RiderDiscoveryData {
  riderId: number;
  totalSlots: number;
  discoveredCount: number;
  slots: Array<{
    slotIndex: number;
    category: string;
    discovered: boolean;
    trait?: {
      id: string;
      category: string;
      label: string;
      value: string;
      strength: string;
      discoveredAt?: string;
      icon: string;
      description: string;
    };
  }>;
  nextDiscoveryAt?: number;
}
