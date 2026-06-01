/**
 * API Client for Equoria Frontend
 *
 * Handles all HTTP requests with httpOnly cookie authentication.
 * Automatically includes credentials for cookie-based auth.
 *
 * Security: Uses httpOnly cookies to prevent XSS attacks (tokens not in localStorage)
 *
 * Features:
 * - Auto-retry on 401 with token refresh
 * - Rate limiting (429) with Retry-After support
 * - Comprehensive error handling
 */

// Transport layer extracted to ./http/apiClient (Equoria-rfsml). This file is
// now a compatibility barrel: it re-exports the transport core and hosts the
// domain endpoint wrappers + their response types. New domain clients should
// live in ./api/<domain>.ts and import { apiClient } from the transport module
// (or from this barrel during the incremental migration).
import { apiClient } from './http/apiClient.js';
import type { ApiError, ApiResponse } from './http/types.js';

interface TrainableHorse {
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

interface TrainingRequest {
  horseId: number;
  discipline: string;
}

interface TrainingEligibility {
  eligible: boolean;
  reason?: string;
  cooldownEndsAt?: string | null;
}

interface DisciplineStatus {
  discipline: string;
  score?: number;
  nextEligibleDate?: string | null;
  lastTrainedAt?: string | null;
}

interface StatGain {
  stat: string;
  amount: number;
  traitModified: boolean;
}

interface TraitEffects {
  appliedTraits: string[];
  scoreModifier: number;
  xpModifier: number;
}

interface TemperamentEffects {
  temperament: string;
  xpModifier: number;
  scoreModifier: number;
}

interface TrainingResult {
  success: boolean;
  updatedHorse: {
    id: number;
    name: string;
    discipline_scores?: Record<string, number>;
    userId?: string;
  } | null;
  message: string;
  nextEligible: string | null;
  statGain: StatGain | null;
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

interface BreedRequest {
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
interface FoalDevelopment {
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
interface RawFoalDevelopmentBody {
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

/**
 * Flatten the GET /development envelope-body into the canonical flat
 * FoalDevelopment. Tolerates both the nested GET shape ({ development: {...} })
 * and the already-flat PUT /develop shape. Equoria-n3yw6.
 *
 * Returns `null` when the backend genuinely has no development data
 * (envelope `data: null` → no FoalDevelopment record). This preserves the
 * honest empty-state path in consumers that branch on `!development`; it does
 * NOT fabricate a zeroed record where none exists. When data IS present, any
 * individual missing sub-field falls back to a safe default.
 */
function normalizeFoalDevelopment(
  raw: RawFoalDevelopmentBody | null | undefined
): FoalDevelopment | null {
  if (raw === null || raw === undefined) {
    return null;
  }
  const dev = raw.development ?? {};
  // Prefer the nested `development` block (GET shape); fall back to top-level
  // fields (PUT /develop returns a flat body).
  const currentDay = dev.currentDay ?? raw.currentDay ?? 0;
  const bondingLevel = dev.bondingLevel ?? raw.bondingLevel ?? 0;
  const stressLevel = dev.stressLevel ?? raw.stressLevel ?? 0;
  const completedActivities = dev.completedActivities ?? raw.completedActivities ?? {};
  const maxDay = dev.maxDay ?? raw.maxDay ?? 6;
  return {
    currentDay,
    maxDay,
    bondingLevel,
    stressLevel,
    completedActivities,
    enrichmentDay: dev.enrichmentDay,
    enrichmentWindowOpen: dev.enrichmentWindowOpen,
    availableEnrichmentActivities: raw.availableEnrichmentActivities ?? [],
  };
}

interface Foal {
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

interface BreedResponse {
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

interface FoalActivity {
  id?: number;
  activity: string;
  duration?: number;
  createdAt?: string;
}

// Simple stats object for components — all 12 horse stats
interface SimpleHorseStats {
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

interface HorseSummary {
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

interface HorseTrainingHistoryEntry {
  id?: number;
  discipline?: string;
  score?: number;
  trainedAt?: string;
  notes?: string;
}

interface HorseTrainingAnalytics {
  trainingHistory: HorseTrainingHistoryEntry[];
  disciplineBalance: Record<string, unknown>;
  trainingFrequency: Record<string, unknown>;
}

interface HorseXP {
  horseId: number;
  horseName: string;
  currentXP: number;
  availableStatPoints: number;
  nextStatPointAt: number;
  xpToNextStatPoint: number;
}

interface HorseXPEvent {
  id: number;
  amount: number;
  reason: string;
  timestamp: string;
}

interface HorseXPHistory {
  events: HorseXPEvent[];
  count: number;
  pagination: {
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

interface HorseAge {
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

interface HorseStats {
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

interface HorseProgression {
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

interface StatHistory {
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

interface RecentGains {
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
interface Groom {
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

interface GroomAssignment {
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
interface GroomMetrics {
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
interface GroomProfile {
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
interface GroomAssignmentLogEntry {
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

interface MarketplaceGroom {
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

interface MarketplaceData {
  grooms: MarketplaceGroom[];
  lastRefresh: string;
  nextFreeRefresh: string;
  refreshCost: number;
  canRefreshFree: boolean;
  refreshCount: number;
}

interface MarketplaceStats {
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

interface SalarySummary {
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
interface UserProgress {
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

interface DashboardData {
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

interface ActivityFeedItem {
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
interface Competition {
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

interface Discipline {
  id: string;
  name: string;
  description?: string;
  requiredStats?: string[];
  requiredTraits?: string[];
}

interface EligibilityResult {
  eligible: boolean;
  reasons?: string[];
  requirements?: {
    minAge?: number;
    minLevel?: number;
    requiredTraits?: string[];
  };
}

// Transport core (refreshAccessToken, sleep, getCsrfToken, fetchWithAuth,
// apiClient) lives in ./http/apiClient (Equoria-rfsml). Re-exported here so
// existing import sites keep resolving `apiClient`, `refreshAccessToken`,
// and `sleep` from this barrel unchanged.
export { refreshAccessToken, sleep } from './http/apiClient.js';
// `apiClient` is imported at the top (domain wrappers below call it directly);
// re-export the already-imported binding so the barrel surface is unchanged.
export { apiClient };

/**
 * Training API surface
 */
export const trainingApi = {
  /**
   * Get trainable horses for a user
   * @param userId - UUID of the user (must be authenticated user's UUID)
   */
  getTrainableHorses: (userId: string) => {
    return apiClient.get<TrainableHorse[]>(`/api/v1/training/trainable/${userId}`);
  },
  checkEligibility: (payload: TrainingRequest) => {
    return apiClient.post<TrainingEligibility>('/api/v1/training/check-eligibility', payload);
  },
  train: async (payload: TrainingRequest): Promise<TrainingResult> => {
    const result = await apiClient.post<TrainingResult>('/api/v1/training/train', payload);

    // Add backward-compatible fields for existing components
    if (result.updatedHorse && result.updatedHorse.discipline_scores) {
      const score = result.updatedHorse.discipline_scores[payload.discipline];
      return {
        ...result,
        updatedScore: score ?? 0,
        nextEligibleDate: result.nextEligible ?? '',
        discipline: payload.discipline,
        horseId: payload.horseId,
      };
    }

    // Fallback if no updated horse or scores
    return {
      ...result,
      updatedScore: 0,
      nextEligibleDate: result.nextEligible ?? '',
      discipline: payload.discipline,
      horseId: payload.horseId,
    };
  },
  getDisciplineStatus: (horseId: number, discipline: string) => {
    return apiClient.get<DisciplineStatus>(
      `/api/v1/training/status/${horseId}/${encodeURIComponent(discipline)}`
    );
  },
  getHorseStatus: (horseId: number) => {
    return apiClient.get<DisciplineStatus[] | Record<string, Omit<DisciplineStatus, 'discipline'>>>(
      `/api/v1/training/status/${horseId}`
    );
  },
};

/**
 * Breeding/Foal API surface
 */
export const breedingApi = {
  breedFoal: (payload: BreedRequest) => {
    return apiClient.post<BreedResponse>('/api/v1/horses/foals', payload);
  },
  getFoal: (foalId: number) => {
    return apiClient.get<Foal>(`/api/v1/foals/${foalId}`);
  },
  getFoalDevelopment: async (foalId: number): Promise<FoalDevelopment | null> => {
    // Equoria-n3yw6: the backend nests development stats under
    // data.development; normalize the unwrapped envelope-body to the flat
    // FoalDevelopment contract the UI reads. Returns null when the backend
    // has no development record (envelope data: null) so consumers render
    // an honest empty state rather than a fabricated zeroed record.
    const raw = await apiClient.get<RawFoalDevelopmentBody | null>(
      `/api/v1/foals/${foalId}/development`
    );
    return normalizeFoalDevelopment(raw);
  },
  getFoalActivities: (foalId: number) => {
    return apiClient.get<FoalActivity[]>(`/api/v1/foals/${foalId}/activities`);
  },
  logFoalActivity: (foalId: number, activity: FoalActivity) => {
    return apiClient.post<FoalActivity>(`/api/v1/foals/${foalId}/activity`, activity);
  },
  enrichFoal: (foalId: number, activity: FoalActivity) => {
    return apiClient.post<FoalActivity>(`/api/v1/foals/${foalId}/enrich`, activity);
  },
  revealTraits: (foalId: number) => {
    return apiClient.post<{ traits: string[] }>(`/api/v1/foals/${foalId}/reveal-traits`);
  },
  developFoal: async (
    foalId: number,
    updates: Partial<FoalDevelopment>
  ): Promise<FoalDevelopment | null> => {
    // PUT /develop returns an already-flat body; normalize for shape parity
    // with getFoalDevelopment (Equoria-n3yw6).
    const raw = await apiClient.put<RawFoalDevelopmentBody | null>(
      `/api/v1/foals/${foalId}/develop`,
      updates
    );
    return normalizeFoalDevelopment(raw);
  },
  graduateFoal: (foalId: number) => {
    return apiClient.post<{
      horse: { id: number; name: string; breed: string };
      graduation: {
        clearedAssignments: number;
        bondScore: number;
        isFirstGraduation: boolean;
      };
    }>(`/api/v1/foals/${foalId}/graduate`);
  },
};

// -- Ultra-rare traits --
// Extracted to ./api/ultraRareTraits (Equoria-rfsml). Re-exported for barrel compat.
export { ultraRareTraitsApi } from './api/ultraRareTraits.js';
export type { UltraRareTraitEvent, HorseUltraRareTraitsResponse } from './api/ultraRareTraits.js';

/**
 * Horses API surface
 */
export const horsesApi = {
  create: (data: {
    name: string;
    breedId: number;
    sex?: 'Stallion' | 'Mare' | 'Colt' | 'Filly' | 'Rig';
    gender?: 'Stallion' | 'Mare' | 'Colt' | 'Filly' | 'Rig';
    age?: number;
  }) => apiClient.post<HorseSummary>('/api/v1/horses', data),
  list: () => apiClient.get<HorseSummary[]>(`/api/v1/horses?t=${Date.now()}`),
  get: (horseId: number) =>
    apiClient.get<HorseSummary>(`/api/v1/horses/${horseId}?t=${Date.now()}`),
  getTrainingHistory: (horseId: number) =>
    apiClient.get<HorseTrainingAnalytics>(`/api/v1/horses/${horseId}/training-history`),
  getBreedingData: (horseId: number) =>
    apiClient.get<unknown>(`/api/v1/horses/${horseId}/breeding-data`),
  getXP: (horseId: number) => apiClient.get<HorseXP>(`/api/v1/horses/${horseId}/xp`),
  getXPHistory: (horseId: number, options?: { limit?: number; offset?: number }) => {
    const params = new URLSearchParams();
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.offset) params.append('offset', options.offset.toString());
    const queryString = params.toString() ? `?${params.toString()}` : '';
    return apiClient.get<HorseXPHistory>(`/api/v1/horses/${horseId}/xp-history${queryString}`);
  },
  getAge: (horseId: number) => apiClient.get<HorseAge>(`/api/v1/horses/${horseId}/age`),
  getStats: (horseId: number) => apiClient.get<HorseStats>(`/api/v1/horses/${horseId}/stats`),
  getProgression: (horseId: number) =>
    apiClient.get<HorseProgression>(`/api/v1/horses/${horseId}/progression`),
  getStatHistory: (horseId: number, timeRange = '30d') =>
    apiClient.get<StatHistory>(`/api/v1/horses/${horseId}/stats/history?range=${timeRange}`),
  getRecentGains: (horseId: number, days = 30) =>
    apiClient.get<RecentGains>(`/api/v1/horses/${horseId}/gains/recent?days=${days}`),
  update: (horseId: number, data: { name?: string }) =>
    apiClient.put<HorseSummary>(`/api/v1/horses/${horseId}`, data),
  /** List a stallion at stud (Equoria-q072). POST /api/v1/horses/:id/stud-listing */
  listAtStud: (horseId: number, studFee: number) =>
    apiClient.post<{
      id: number;
      name: string;
      sex: string;
      studStatus: string;
      studFee: number;
    }>(`/api/v1/horses/${horseId}/stud-listing`, { studFee }),
  /** Unlist a stallion from stud (Equoria-q072). DELETE /api/v1/horses/:id/stud-listing */
  unlistAtStud: (horseId: number) =>
    apiClient.delete<{
      id: number;
      name: string;
      sex: string;
      studStatus: string;
      studFee: number;
    }>(`/api/v1/horses/${horseId}/stud-listing`),
  getConformation: (horseId: number | string) =>
    apiClient.get<{
      horseId: number;
      horseName: string;
      breedId: number;
      conformationScores: {
        head: number;
        neck: number;
        shoulders: number;
        back: number;
        hindquarters: number;
        legs: number;
        hooves: number;
        topline: number;
        overallConformation: number;
      };
    }>(`/api/v1/horses/${horseId}/conformation`),
  getBreedAverages: (breedId: number | string) =>
    apiClient.get<{
      breedId: string;
      breedName: string;
      averages: {
        head: number;
        neck: number;
        shoulders: number;
        back: number;
        hindquarters: number;
        legs: number;
        hooves: number;
        topline: number;
        overallConformation: number;
      };
    }>(`/api/v1/breeds/${breedId}/conformation-averages`),
  // Equoria-ac5y — per-region percentile ranking vs same-breed population
  getConformationAnalysis: (horseId: number | string) =>
    apiClient.get<{
      horseId: number;
      horseName: string;
      breedId: number;
      breedName: string;
      breedMeanAvailable: boolean;
      totalHorsesInBreed: number;
      analysis: Record<string, { score: number; breedMean: number | null; percentile: number }>;
      overallConformation: { score: number; breedMean: number | null; percentile: number };
    }>(`/api/v1/horses/${horseId}/conformation/analysis`),
  // Equoria-aa6b — gait scores endpoint
  getGaits: (horseId: number | string) =>
    apiClient.get<{
      horseId: number;
      horseName: string;
      breedId: number;
      gaitScores: {
        walk: number;
        trot: number;
        canter: number;
        gallop: number;
        gaiting: { name: string; score: number }[] | null;
      };
    } | null>(`/api/v1/horses/${horseId}/gaits`),
  // Equoria-876o — temperament reference definitions (all 11 types)
  getTemperamentDefinitions: () =>
    apiClient.get<{
      count: number;
      definitions: {
        name: string;
        description: string;
        prevalenceNote: string;
        trainingModifiers: { xpModifier: number; scoreModifier: number };
        competitionModifiers: { riddenModifier: number; conformationModifier: number };
        bestGroomPersonalities: string[];
      }[];
    }>(`/api/v1/horses/temperament-definitions`),
  // Equoria-lsdb — 31E-4 coat-color genetics endpoint.
  // Returns null when the horse has no genotype data (legacy horse), not an
  // error. Consumers should branch on `data === null` to render fallback UI.
  getGenetics: (horseId: number | string) =>
    apiClient.get<HorseGeneticsResponse | null>(`/api/v1/horses/${horseId}/genetics`),
  // Equoria-lsdb — 31E-4 player-facing coat-color endpoint.
  // Returns null when the horse has no phenotype data (legacy horse).
  getColor: (horseId: number | string) =>
    apiClient.get<HorseColorResponse | null>(`/api/v1/horses/${horseId}/color`),
};

/**
 * 31E-4 — coat-color genetics & color response types (Equoria-lsdb).
 * Both endpoints return the canonical envelope { success, message, data } where
 * `data === null` for legacy horses that pre-date the color-genetics system.
 */
export interface HorseGeneticsResponse {
  horseId: number;
  horseName: string;
  colorGenotype: Record<string, string>;
  phenotype: Record<string, unknown> | null;
}

export interface HorseColorResponse {
  horseId: number;
  horseName: string;
  colorName: string | null;
  shade: string | null;
  faceMarking: string | null;
  legMarkings: Record<string, string> | string[] | null;
  advancedMarkings: Record<string, unknown> | string[] | null;
  modifiers: Record<string, unknown> | null;
}

/**
 * Rider interfaces (Epic 9C)
 */
interface Rider {
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

interface RiderAssignment {
  id: number;
  riderId: number;
  horseId: number;
  horseName: string;
  startDate: string;
  isActive: boolean;
}

interface MarketplaceRider {
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

interface RiderMarketplaceData {
  riders: MarketplaceRider[];
  lastRefresh: string;
  nextFreeRefresh: string;
  refreshCost: number;
  canRefreshFree: boolean;
}

interface RiderDiscoveryData {
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

/**
 * Groom API surface
 */
export const groomsApi = {
  getUserGrooms: (userId: string | number) =>
    apiClient.get<Groom[]>(`/api/v1/grooms/user/${userId}`),
  getAssignments: () => apiClient.get<GroomAssignment[]>('/api/v1/groom-assignments'),
  getSalarySummary: () => apiClient.get<SalarySummary>('/api/v1/groom-salaries/summary'),
  getMarketplace: () => apiClient.get<MarketplaceData>('/api/v1/groom-marketplace'),
  getMarketplaceStats: () => apiClient.get<MarketplaceStats>('/api/v1/groom-marketplace/stats'),
  hireGroom: (marketplaceId: string) =>
    apiClient.post<{
      success: boolean;
      data: { groom: Groom; cost: number; remainingMoney: number };
    }>('/api/v1/groom-marketplace/hire', { marketplaceId }),
  refreshMarketplace: (force: boolean = false) =>
    apiClient.post<MarketplaceData>('/api/v1/groom-marketplace/refresh', { force }),
  assignGroom: (data: {
    groomId: number;
    horseId: number;
    priority: number;
    notes?: string;
    replacePrimary?: boolean;
  }) => apiClient.post<{ success: boolean }>('/api/v1/groom-assignments', data),
  deleteAssignment: (assignmentId: number) =>
    apiClient.delete<{ success: boolean }>(`/api/v1/groom-assignments/${assignmentId}`),
  // Equoria-w1vq — temperament x personality synergy preview for a groom/horse pair
  getSynergy: (groomId: number, horseId: number) =>
    apiClient.get<{
      synergyModifier: number;
      temperament: string | null;
      personality: string | null;
      message: string;
    }>(`/api/v1/grooms/${groomId}/horses/${horseId}/synergy`),
  // Equoria-cbkw — backend returns { success, groom: profile }; no .data key
  // so apiClient.get returns the whole body. Caller reads `.groom`.
  getProfile: (groomId: number) =>
    apiClient.get<{ success: boolean; groom: GroomProfile }>(`/api/v1/grooms/${groomId}/profile`),
  // Equoria-cbkw — backend returns { success, logs }; no .data key.
  getAssignmentLogs: (groomId: number) =>
    apiClient.get<{ success: boolean; logs: GroomAssignmentLogEntry[] }>(
      `/api/v1/grooms/${groomId}/assignment-logs`
    ),
};

/**
 * Rider API surface (Epic 9C)
 *
 * Path registry:
 *   GET  /api/v1/riders/user/:userId       → Rider[]
 *   GET  /api/v1/riders/assignments        → RiderAssignment[]
 *   GET  /api/v1/riders/marketplace        → RiderMarketplaceData
 *   POST /api/v1/riders/marketplace/hire   → { success, data: { rider, cost } }
 *   POST /api/v1/riders/marketplace/refresh → RiderMarketplaceData
 *   POST /api/v1/riders/assignments        → { success }
 *   DELETE /api/v1/riders/assignments/:id  → { success }
 *   GET  /api/v1/riders/:id/discovery      → RiderDiscoveryData
 */
export const ridersApi = {
  getUserRiders: (userId: string | number) =>
    apiClient.get<Rider[]>(`/api/v1/riders/user/${userId}`),
  getAssignments: () => apiClient.get<RiderAssignment[]>('/api/v1/riders/assignments'),
  getMarketplace: () => apiClient.get<RiderMarketplaceData>('/api/v1/riders/marketplace'),
  hireRider: (marketplaceId: string) =>
    apiClient.post<{
      success: boolean;
      data: { rider: Rider; cost: number; remainingMoney: number };
    }>('/api/v1/riders/marketplace/hire', { marketplaceId }),
  refreshMarketplace: (force: boolean = false) =>
    apiClient.post<RiderMarketplaceData>('/api/v1/riders/marketplace/refresh', { force }),
  assignRider: (data: { riderId: number; horseId: number; notes?: string }) =>
    apiClient.post<{ success: boolean }>('/api/v1/riders/assignments', data),
  deleteAssignment: (assignmentId: number) =>
    apiClient.delete<{ success: boolean }>(`/api/v1/riders/assignments/${assignmentId}`),
  getDiscovery: (riderId: number) =>
    apiClient.get<RiderDiscoveryData>(`/api/v1/riders/${riderId}/discovery`),
};

// -- Trainers --
// Extracted to ./api/trainers (Equoria-rfsml). Re-exported for barrel compat.
export { trainersApi } from './api/trainers.js';
export type {
  TrainerEntry,
  MarketplaceTrainer,
  TrainerMarketplaceData,
  TrainerAssignmentEntry,
  TrainerDiscoveryCategory,
  TrainerDiscoveryTrait,
  TrainerDiscoverySlot,
  TrainerDiscoveryData,
} from './api/trainers.js';

// ── Vet Clinic ────────────────────────────────────────────────────────────────
// Extracted to ./api/vet (Equoria-rfsml). Re-exported for barrel compat.
export { vetApi } from './api/vet.js';
export type { VetService, VetAppointmentResult } from './api/vet.js';

// ── Horse Marketplace types (Epic 21) ─────────────────────────────────────────

export interface MarketplaceListing {
  id: number;
  name: string;
  breed: string;
  age: number | null;
  sex: string;
  salePrice: number;
  seller: string;
  stats: {
    speed: number;
    stamina: number;
    agility: number;
    precision: number;
    strength: number;
    intelligence: number;
    boldness: number;
  };
  imageUrl: string | null;
}

export interface MarketplacePagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface MarketplaceBrowseResult {
  listings: MarketplaceListing[];
  pagination: MarketplacePagination;
}

export interface MarketplaceBrowseFilters {
  breed?: string;
  minAge?: number;
  maxAge?: number;
  minPrice?: number;
  maxPrice?: number;
  sort?: 'price_asc' | 'price_desc' | 'newest' | 'youngest';
  page?: number;
  limit?: number;
}

export interface MyListing {
  id: number;
  name: string;
  breed: string;
  age: number | null;
  sex: string;
  salePrice: number;
  imageUrl: string | null;
}

export interface SaleHistoryEntry {
  id: number;
  horseName: string;
  salePrice: number;
  soldAt: string;
  type: 'sold' | 'bought';
  counterparty: string;
}

export interface BuyHorseResult {
  horseName: string;
  salePrice: number;
  sellerUsername: string;
  saleId: number;
  newBalance: number;
}

/**
 * Horse Marketplace API surface (Epic 21)
 *   GET    /api/v1/marketplace            → browse listings
 *   POST   /api/v1/marketplace/list       → list horse for sale
 *   DELETE /api/v1/marketplace/list/:id   → delist horse
 *   POST   /api/v1/marketplace/buy/:id    → purchase horse
 *   GET    /api/v1/marketplace/my-listings → seller's active listings
 *   GET    /api/v1/marketplace/history     → sale history
 *   POST   /api/v1/marketplace/store/buy  → buy store horse (Horse Trader)
 */

// ── Breed types ───────────────────────────────────────────────────────────────

export interface Breed {
  id: number;
  name: string;
  description?: string;
}

/**
 * Breeds API surface
 *   GET /api/v1/breeds → Breed[]  (all breeds in the DB catalog, sorted A–Z)
 */
export const breedsApi = {
  list: () => apiClient.get<Breed[]>('/api/v1/breeds'),
};

export const horseMarketplaceApi = {
  browse: (filters?: MarketplaceBrowseFilters) => {
    const params = new URLSearchParams();
    if (filters?.breed) params.set('breed', filters.breed);
    if (filters?.minAge !== undefined) params.set('minAge', String(filters.minAge));
    if (filters?.maxAge !== undefined) params.set('maxAge', String(filters.maxAge));
    if (filters?.minPrice !== undefined) params.set('minPrice', String(filters.minPrice));
    if (filters?.maxPrice !== undefined) params.set('maxPrice', String(filters.maxPrice));
    if (filters?.sort) params.set('sort', filters.sort);
    if (filters?.page !== undefined) params.set('page', String(filters.page));
    if (filters?.limit !== undefined) params.set('limit', String(filters.limit));
    const qs = params.toString();
    return apiClient.get<{ listings: MarketplaceListing[]; pagination: MarketplacePagination }>(
      `/api/v1/marketplace${qs ? `?${qs}` : ''}`
    );
  },
  listHorse: (data: { horseId: number; price: number }) =>
    apiClient.post<{ horseId: number; salePrice: number }>('/api/v1/marketplace/list', data),
  delistHorse: (horseId: number) => apiClient.delete<void>(`/api/v1/marketplace/list/${horseId}`),
  buyHorse: (horseId: number) =>
    apiClient.post<BuyHorseResult>(`/api/v1/marketplace/buy/${horseId}`, {}),
  myListings: () => apiClient.get<MyListing[]>('/api/v1/marketplace/my-listings'),
  saleHistory: () => apiClient.get<SaleHistoryEntry[]>('/api/v1/marketplace/history'),
  buyStoreHorse: (breedId: number, sex: 'Mare' | 'Stallion') =>
    apiClient.post<{ horse: HorseSummary; pricePaid: number; newBalance: number }>(
      '/api/v1/marketplace/store/buy',
      { breedId, sex }
    ),
};

// -- Tack Shop --
// Extracted to ./api/tackShop (Equoria-rfsml). Re-exported for barrel compat.
export { tackShopApi } from './api/tackShop.js';
export type {
  TackItem,
  TackInventoryData,
  TackPurchaseResult,
  TackUnequipDecorationResult,
} from './api/tackShop.js';

// ── Farrier ───────────────────────────────────────────────────────────────────
// Extracted to ./api/farrier (Equoria-rfsml). Re-exported for barrel compat.
export { farrierApi } from './api/farrier.js';
export type { FarrierService, FarrierBookingResult } from './api/farrier.js';

// -- Feed Shop / per-horse feed --
// Extracted to ./api/feedShop (Equoria-rfsml). Re-exported for barrel compat.
export { feedShopApi, horseFeedApi } from './api/feedShop.js';
export type {
  FeedItem,
  FeedPurchaseResult,
  FeedHorseResponse,
  EquippableResponse,
} from './api/feedShop.js';

// -- Inventory --
// Extracted to ./api/inventory (Equoria-rfsml). Re-exported for barrel compat.
export { inventoryApi } from './api/inventory.js';
export type { InventoryItem, InventoryData, EquipResult, UnequipResult } from './api/inventory.js';

// -- Forum / Direct Messages / Bank --
// Extracted to ./api/{forum,messages,bank} (Equoria-rfsml). Re-exported for
// barrel compat.
export { forumApi } from './api/forum.js';
export type {
  ForumSection,
  ForumAuthor,
  ForumThread,
  ForumPost,
  ThreadsResponse,
  ThreadDetailResponse,
  CreateThreadRequest,
} from './api/forum.js';
export { messagesApi } from './api/messages.js';
export type {
  DirectMessageUser,
  DirectMessage,
  InboxResponse,
  SendMessageRequest,
} from './api/messages.js';
export { bankApi } from './api/bank.js';
export type {
  WeeklyClaimResponse,
  ClaimStatusResponse,
  TransactionHistoryItem,
  TransactionHistoryResponse,
} from './api/bank.js';

// -- Clubs --
// Extracted to ./api/clubs (Equoria-rfsml). Re-exported for barrel compat.
export { clubsApi } from './api/clubs.js';
export type {
  ClubType,
  ClubRole,
  ElectionStatus,
  Club,
  ClubMembership,
  ClubMember,
  ClubElection,
  ElectionCandidate,
} from './api/clubs.js';

/**
 * User Progress API surface
 */
export const userProgressApi = {
  getProgress: (userId: string | number) =>
    apiClient.get<UserProgress>(`/api/v1/users/${userId}/progress`),
  getDashboard: (userId: string | number) =>
    apiClient.get<DashboardData>(`/api/v1/users/dashboard/${userId}`),
  getActivity: (userId: string | number) =>
    apiClient.get<ActivityFeedItem[]>(`/api/v1/users/${userId}/activity`),

  /** Get global community activity feed */
  getCommunityActivity: () => apiClient.get<ActivityFeedItem[]>('/api/v1/users/community/activity'),

  /** Get user details */
  getUser: (userId: string | number) =>
    apiClient.get<{
      id: string;
      username: string;
      money: number;
      level: number;
      currentHorses: number;
      stableLimit: number;
    }>(`/api/v1/users/${userId}`),
};

/**
 * Competitions API surface
 */
/** Scouting field response — GET /api/v1/competition/show/:showId/entries */
export interface ShowFieldEntry {
  entryId: number;
  enteredAt: string;
  horseId: number;
  name: string;
  breed: string | null;
  level: number | null;
  ownerId: string | null;
  ownerName: string | null;
  topStats: Array<{ name: string; value: number }>;
}
export interface ShowFieldResponse {
  success: boolean;
  show: {
    id: number;
    name: string;
    discipline: string;
    entryFee: number;
    maxEntries: number | null;
    status: string;
    closeDate: string | null;
  };
  entryCount: number;
  maxEntries: number | null;
  daysRemaining: number | null;
  entries: ShowFieldEntry[];
}

export const competitionsApi = {
  list: () => apiClient.get<Competition[]>('/api/v1/competition'),
  getDisciplines: () =>
    apiClient.get<{ disciplines: string[]; disciplineDetails: Record<string, unknown>[] }>(
      '/api/v1/competition/disciplines'
    ),
  checkEligibility: (horseId: number, discipline: string) =>
    apiClient.get<{
      horseId: number;
      horseName: string;
      discipline: string;
      eligibility: EligibilityResult;
    }>(`/api/v1/competition/eligibility/${horseId}/${encodeURIComponent(discipline)}`),
  enter: (data: { horseId: number; competitionId: number }) =>
    apiClient.post<{ entryId: number; horseId: number; showId: number; entryFee: number }>(
      '/api/v1/competition/enter',
      {
        horseId: data.horseId,
        showId: data.competitionId,
      }
    ),
  /**
   * Get the list of horses already entered into a given competition.
   * Returns minimal entry data — used by HorseSelector to mark horses as
   * "already entered" so users can't double-enter the same competition.
   */
  getEntries: (competitionId: number) =>
    apiClient.get<Array<{ horseId: number; horseName: string }>>(
      `/api/v1/competitions/${competitionId}/entries`
    ),
  /**
   * Scouting (Equoria-lfkw1, UX-spec 11.3.5 / Journey 4). Returns the REAL
   * entered field for an open show: per entered horse breed / level /
   * top-3 stats / owner, plus header (entry count, max, days remaining,
   * status). Used by CompetitionFieldPreview.
   */
  getShowField: (showId: number) =>
    apiClient.get<ShowFieldResponse>(`/api/v1/competition/show/${showId}/entries`),
  /**
   * Get the current user's horses that are eligible for competition entry.
   * Eligibility filtering (age, health, etc.) is applied per-horse in the
   * HorseSelector UI; this endpoint returns the candidate set.
   */
  getEligibleUserHorses: () =>
    apiClient.get<
      Array<{
        id: number;
        name: string;
        age: number;
        sex: string;
        level: number;
        health: string;
        disciplines: Record<string, number>;
      }>
    >('/api/v1/horses/user/eligible'),
};

// -- Conformation Shows --
// Extracted to ./api/conformationShows (Equoria-rfsml). Re-exported for barrel compat.
export { conformationShowsApi } from './api/conformationShows.js';
export type {
  ConformationShowEntryPayload,
  ConformationShowEntryResult,
  ConformationShowEligibilityResult,
  ConformationShowResultEntry,
  ConformationShowExecuteResult,
  ConformationShowTitlesResult,
} from './api/conformationShows.js';

// -- Breeding Prediction --
// Extracted to ./api/breedingPrediction (Equoria-rfsml). Re-exported for barrel compat.
export { breedingPredictionApi } from './api/breedingPrediction.js';
export type {
  InbreedingAnalysis,
  LineageTreeNode,
  LineageAnalysis,
  GeneticProbability,
  BreedingCompatibility,
  BreedingColorPredictionEntry,
  BreedingColorPredictionResult,
} from './api/breedingPrediction.js';

/**
 * Authentication API endpoints
 */
// ── Crafting System ──────────────────────────────────────────────────────────
// Extracted to ./api/crafting (Equoria-rfsml). Re-exported for barrel compat.
export { craftingApi } from './api/crafting.js';
export type {
  CraftingMaterials,
  CraftingRecipe,
  CraftedItem,
  CraftResult,
} from './api/crafting.js';

/**
 * User preference shape persisted server-side and surfaced on /settings.
 * Must stay aligned with ALLOWED_PREFERENCE_KEYS in
 * backend/modules/auth/controllers/authController.mjs (Story 21S-5).
 */
export interface UserPreferences {
  // Email notifications
  emailCompetition: boolean;
  emailBreeding: boolean;
  emailSystem: boolean;
  // In-app notifications
  inAppTraining: boolean;
  inAppAchievements: boolean;
  inAppNews: boolean;
  // Display / accessibility
  reducedMotion: boolean;
  highContrast: boolean;
  compactCards: boolean;
  // Sound
  soundEnabled: boolean;
}

export const authApi = {
  /**
   * Login user
   * Sets httpOnly cookies automatically
   */
  login: (credentials: { email: string; password: string }) => {
    return apiClient.post<{ user: { id: number; email: string; username: string } }>(
      '/api/v1/auth/login',
      credentials
    );
  },

  /**
   * Register new user
   * Sets httpOnly cookies automatically
   */
  register: (userData: {
    username: string;
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
    // Equoria-iqzn / Equoria-9tlha: ISO date string (YYYY-MM-DD) sent to
    // the server-authoritative COPPA age gate at POST /api/v1/auth/register.
    dateOfBirth?: string;
  }) => {
    return apiClient.post<{
      user: {
        id: number;
        username: string;
        email: string;
        firstName?: string;
        lastName?: string;
        money: number;
        level: number;
        xp: number;
      };
    }>('/api/v1/auth/register', userData);
  },

  /**
   * Get current user profile
   * Uses httpOnly cookies for authentication
   */
  getProfile: () => {
    return apiClient.get<{
      user: {
        id: number;
        username: string;
        email: string;
        firstName?: string;
        lastName?: string;
        money?: number;
        level?: number;
        xp?: number;
        role?: 'user' | 'admin' | 'moderator';
        completedOnboarding?: boolean;
        onboardingStep?: number;
        /** Story 21S-5: canonical persisted preferences field. */
        preferences?: Partial<UserPreferences>;
        /** @deprecated Legacy JSONB columns — prefer preferences above. */
        notifications?: Record<string, boolean | string | number> | null;
        /** @deprecated Legacy JSONB columns — prefer preferences above. */
        display?: Record<string, boolean | string | number> | null;
      };
    }>('/api/v1/auth/profile');
  },

  /**
   * Update user profile
   * Supports updating username/email plus notification and display preferences.
   * Preference payloads are merged into User.settings on the backend and persist
   * across sessions and devices (production parity with beta testing).
   */
  updateProfile: (updates: {
    username?: string;
    email?: string;
    bio?: string;
    avatarUrl?: string;
    notifications?: Record<string, boolean | string | number>;
    display?: Record<string, boolean | string | number>;
  }) => {
    return apiClient.put<{
      user: {
        id: number;
        username: string;
        email: string;
        bio?: string;
        avatarUrl?: string;
        notifications?: Record<string, boolean | string | number> | null;
        display?: Record<string, boolean | string | number> | null;
      };
    }>('/api/v1/auth/profile', updates);
  },

  /**
   * Update user preferences (Story 21S-5)
   *
   * Merge-updates the authenticated user's notification + display
   * preferences. Unknown keys are rejected server-side.
   */
  updatePreferences: (updates: Partial<UserPreferences>) => {
    return apiClient.patch<{
      status: string;
      data: { preferences: UserPreferences };
    }>('/api/v1/auth/profile/preferences', updates);
  },

  /**
   * Logout user
   * Clears httpOnly cookies
   */
  logout: () => {
    return apiClient.post<{ message: string }>('/api/v1/auth/logout');
  },

  /**
   * Refresh access token
   * Uses httpOnly refresh token cookie automatically
   */
  refreshToken: () => {
    return apiClient.post<{ message: string }>('/api/v1/auth/refresh-token');
  },

  /**
   * Verify email with token
   * Token comes from email link
   */
  verifyEmail: (token: string) => {
    return apiClient.get<{
      verified: boolean;
      user: {
        id: number;
        email: string;
        username: string;
      };
    }>(`/api/v1/auth/verify-email?token=${encodeURIComponent(token)}`);
  },

  /**
   * Resend verification email
   * Requires authentication
   */
  resendVerification: () => {
    return apiClient.post<{
      emailSent: boolean;
      expiresAt: string;
    }>('/api/v1/auth/resend-verification');
  },

  /**
   * Get email verification status
   * Requires authentication
   */
  getVerificationStatus: () => {
    return apiClient.get<{
      verified: boolean;
      email: string;
      verifiedAt: string | null;
    }>('/api/v1/auth/verification-status');
  },

  /**
   * Mark authenticated user's onboarding as complete.
   */
  completeOnboarding: () =>
    apiClient.post<{ completedOnboarding: boolean }>('/api/v1/auth/complete-onboarding', {}),

  /**
   * Advance the authenticated user's onboarding step by 1.
   * Optionally sends horse customization data (name, breedId, gender).
   * Sets completedOnboarding: true when step 10 is reached.
   */
  advanceOnboarding: (horseData?: { horseName?: string; breedId?: number; gender?: string }) =>
    apiClient.post<{ step: number; completed: boolean }>(
      '/api/v1/auth/advance-onboarding',
      horseData ?? {}
    ),

  /**
   * Request password reset email.
   */
  forgotPassword: (email: string) => {
    return apiClient.post<{ message: string }>('/api/v1/auth/forgot-password', { email });
  },

  /**
   * Reset password with token.
   */
  resetPassword: (token: string, newPassword: string) => {
    return apiClient.post<{ message: string }>('/api/v1/auth/reset-password', {
      token,
      newPassword,
    });
  },

  /**
   * Change password for authenticated user.
   * Requires current password and new password.
   * Invalidates all sessions on success (CWE-613).
   */
  changePassword: (oldPassword: string, newPassword: string) => {
    return apiClient.post<{ message: string }>('/api/v1/auth/change-password', {
      oldPassword,
      newPassword,
    });
  },

  /**
   * Delete authenticated user's account.
   * Requires user ID. Permanently removes all user data.
   */
  deleteAccount: (userId: number) => {
    return apiClient.delete<{ message: string }>(`/api/v1/users/${userId}`);
  },
};

// ── User Search ───────────────────────────────────────────────────────────────

// -- Users (search) --
// Extracted to ./api/users (Equoria-rfsml). Re-exported for barrel compat.
export { usersApi } from './api/users.js';

// -- Game Notifications --
// Extracted to ./api/gameNotifications (Equoria-rfsml). Re-exported for barrel compat.
export { gameNotificationsApi } from './api/gameNotifications.js';
export type {
  StatGainNotificationPayload,
  FoalBornNotificationPayload,
  GameNotificationType,
  GameNotification,
  GameNotificationsResponse,
} from './api/gameNotifications.js';

// Equoria-n3yw6: exported for the foal-development contract sentinel test.
export { normalizeFoalDevelopment };
export type { RawFoalDevelopmentBody };

/**
 * Export both for convenience
 */
export default apiClient;
export type {
  ActivityFeedItem,
  ApiError,
  ApiResponse,
  BreedRequest,
  BreedResponse,
  Competition,
  Discipline,
  DisciplineStatus,
  DashboardData,
  EligibilityResult,
  Foal,
  FoalActivity,
  FoalDevelopment,
  Groom,
  GroomAssignment,
  GroomMetrics,
  GroomProfile,
  GroomAssignmentLogEntry,
  HorseAge,
  HorseProgression,
  HorseStats,
  HorseSummary,
  HorseTrainingAnalytics,
  HorseTrainingHistoryEntry,
  HorseXP,
  HorseXPEvent,
  HorseXPHistory,
  MarketplaceGroom,
  MarketplaceData,
  MarketplaceStats,
  Rider,
  RiderAssignment,
  MarketplaceRider,
  RiderMarketplaceData,
  RiderDiscoveryData,
  RecentGains,
  SalarySummary,
  StatGain,
  StatHistory,
  TrainableHorse,
  TrainingEligibility,
  TrainingRequest,
  TrainingResult,
  TraitEffects,
  UserProgress,
};
