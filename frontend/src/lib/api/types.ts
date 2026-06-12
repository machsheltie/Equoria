/**
 * Shared API response/request types for the Equoria frontend (Equoria-aodym).
 *
 * These interfaces were the top-of-file shared block in api-client.ts —
 * referenced by multiple domain clients (training, horses, grooms, riders,
 * breeding, competitions, userProgress, marketplace) and re-exported from the
 * api-client barrel. They live here so the remaining inline domains can be
 * extracted to ./api/<domain>.ts in follow-up slices without a circular
 * dependency on the barrel. The api-client barrel re-exports every type below
 * unchanged, so the public type surface is preserved.
 *
 * NOTE: `normalizeFoalDevelopment` (the runtime flattener) stays in
 * api-client.ts because it is exported from the barrel and bound to the
 * foal-development contract sentinel test; it imports FoalDevelopment /
 * RawFoalDevelopmentBody from here.
 */

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
  scoreModifier: number;
  xpModifier: number;
}

export interface TemperamentEffects {
  temperament: string;
  xpModifier: number;
  scoreModifier: number;
}

export interface TrainingResult {
  success: boolean;
  message: string;
  nextEligible: string | null;
  statGain: StatGain | null;
  // Equoria-o1x6g — the REAL awarded XP for this session (post-trait,
  // post-temperament, floor-1). Distinct from traitEffects.xpModifier, which is
  // only the trait-attributable delta. Null on the legacy/mock path that does
  // not emit it.
  xpAwarded?: number | null;
  // Equoria-o1x6g — the authoritative discipline-score delta computed by the
  // backend (base +5, trait- and temperament-modified, floor-1). The frontend
  // must read this instead of recomputing base+traitBonus, which drifts.
  disciplineScoreIncrease?: number | null;
  traitEffects?: TraitEffects;
  // Equoria-npnw — temperament modifier attribution. Null when horse.temperament
  // is null (legacy pre-31D-1 horses).
  temperamentEffects?: TemperamentEffects | null;
  // Deprecated fields for backward compatibility (will be removed)
  updatedScore?: number;
  nextEligibleDate?: string;
  discipline?: string;
  horseId?: number;
}

export interface BreedRequest {
  sireId: number;
  damId: number;
  userId?: string;
  breedId?: number;
}

/**
 * FoalDevelopment — the FLAT, canonical foal-development contract the UI
 * consumes (Equoria-n3yw6).
 *
 * IMPORTANT: the real backend (GET /api/foals/:foalId/development) returns
 *   { success, data: { foal, development: { currentDay, bondingLevel,
 *     stressLevel, completedActivities, maxDay, enrichmentDay,
 *     enrichmentWindowOpen }, availableEnrichmentActivities, activityHistory,
 *     availableActivities } }
 * After the apiClient `.data` unwrap that leaves the development stats nested
 * one level deeper (data.development.development.*), so consumers reading
 * `development.currentDay` saw `undefined` and rendered placeholders. The
 * `getFoalDevelopment` API fn below normalizes that envelope into this flat
 * shape so every field here maps to a REAL backend value — there are no
 * fabricated `stage` / `progress` / `enrichmentLevel` placeholder fields.
 */
export interface FoalDevelopment {
  /** Manually-incremented development day (0–6). */
  currentDay: number;
  /** Max development day (6 — the 7-day 0..6 window). */
  maxDay: number;
  /** Bond score 0–100. */
  bondingLevel: number;
  /** Stress level 0–100. */
  stressLevel: number;
  /** Per-day completed enrichment activities. */
  completedActivities: { [day: number]: string[] };
  /** Age-derived enrichment day (date-only UTC), Equoria-g89vy. */
  enrichmentDay?: number;
  /** Whether the age-derived enrichment window is still open. */
  enrichmentWindowOpen?: boolean;
  // Equoria-g89vy: the enrichment day is derived server-side from the foal's
  // age; these activities are for that derived day. Empty when the window is
  // closed (foal aged past day 6). Drives the Enrich activity picker.
  availableEnrichmentActivities?: Array<{ type: string; name: string; description?: string }>;
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
    stressLevel?: number;
    completedActivities?: { [day: number]: string[] };
    maxDay?: number;
    enrichmentDay?: number;
    enrichmentWindowOpen?: boolean;
  };
  availableEnrichmentActivities?: Array<{ type: string; name: string; description?: string }>;
  // The PUT /develop endpoint returns the FLAT shape already, so the same
  // normalizer must also pass through a body that has these fields at the top.
  currentDay?: number;
  bondingLevel?: number;
  stressLevel?: number;
  completedActivities?: { [day: number]: string[] };
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
  age: number;
  ageYears?: number;
  gender: string;
  sex?: string;
  level?: number;
  dateOfBirth: string;
  healthStatus: string;
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
  feedHealth?: 'excellent' | 'good' | 'fair' | 'poor' | 'critical' | 'retired';
  vetHealth?: 'excellent' | 'good' | 'fair' | 'poor' | 'critical' | 'retired' | string;
  displayedHealth?: 'excellent' | 'good' | 'fair' | 'poor' | 'critical' | 'retired';
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
    placement: string | null;
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
  score?: number;
  trainedAt?: string;
  notes?: string;
}

export interface HorseTrainingAnalytics {
  trainingHistory: HorseTrainingHistoryEntry[];
  disciplineBalance: Record<string, unknown>;
  trainingFrequency: Record<string, unknown>;
}

export interface HorseXP {
  horseId: number;
  horseName: string;
  currentXP: number;
  availableStatPoints: number;
  nextStatPointAt: number;
  xpToNextStatPoint: number;
}

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

export interface HorseAge {
  horseId: number;
  horseName: string;
  currentAge: {
    years: number;
    months: number;
  };
  ageInDays: number;
  nextMilestone: {
    name: string;
    ageYears: number;
    daysRemaining: number;
    monthsRemaining: number;
    expectedStatGains: {
      speed: number;
      stamina: number;
      agility: number;
      strength: number;
      intelligence: number;
      temperament: number;
    };
  } | null;
  trainingWindow: {
    isPrimeWindow: boolean;
    windowName: string;
    endsInDays: number | null;
  };
}

export interface HorseStats {
  horseId: number;
  horseName: string;
  age: {
    years: number;
    months: number;
  };
  currentStats: {
    speed: number;
    stamina: number;
    agility: number;
    strength: number;
    intelligence: number;
    temperament: number;
  };
  geneticPotential: {
    speed: number;
    stamina: number;
    agility: number;
    strength: number;
    intelligence: number;
    temperament: number;
  };
  trainingWindow: 'too young' | 'prime' | 'maintenance' | 'senior';
  discipline?: string;
}

export interface HorseProgression {
  horseId: number;
  horseName: string;
  currentLevel: number;
  currentXP: number;
  xpToNextLevel: number;
  totalXP: number;
  progressPercentage: number;
  recentLevelUps: Array<{
    level: number;
    timestamp: string;
    xpGained: number;
  }>;
}

export interface StatHistory {
  horseId: number;
  horseName: string;
  timeRange: string;
  statData: Array<{
    timestamp: string;
    speed: number;
    stamina: number;
    agility: number;
    strength: number;
    intelligence: number;
    temperament: number;
  }>;
}

export interface RecentGains {
  horseId: number;
  horseName: string;
  days: number;
  gains: Array<{
    stat: string;
    change: number;
    percentage: number;
    timestamp: string;
  }>;
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

// Equoria-cbkw — GroomProfile response shape from GET /api/v1/grooms/:id/profile.
export interface GroomProfile {
  id: number;
  name: string;
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

export interface SalarySummary {
  totalMonthlyCost: number;
  totalWeeklyCost: number;
  groomCount: number;
  breakdown: Array<{
    groomId: number;
    groomName: string;
    weeklyCost: number;
    assignmentCount: number;
  }>;
}

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
  totalHorses?: number;
  totalCompetitions?: number;
  totalWins?: number;
  winRate?: number;
}

export interface DashboardData {
  user: {
    id: number;
    username: string;
    level: number;
    money: number;
  };
  horses: {
    total: number;
    trainable: number;
  };
  shows: {
    upcomingEntries: number;
    nextShowRuns: string[];
  };
  activity: {
    lastTrained: string;
    lastShowPlaced: string | null;
  };
  recentShows?: Array<{ id: number; name: string; placement: number }>;
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
