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

// Shared API types extracted to ./api/types (Equoria-aodym). Imported here
// for the inline domain wrappers below + normalizeFoalDevelopment, and
// re-exported at the bottom of this barrel so the public type surface is
// unchanged.
import type {
  ActivityFeedItem,
  BreedRequest,
  BreedResponse,
  Competition,
  DashboardData,
  Discipline,
  DisciplineStatus,
  EligibilityResult,
  Foal,
  FoalActivity,
  FoalDevelopment,
  Groom,
  GroomAssignment,
  GroomAssignmentLogEntry,
  GroomMetrics,
  GroomProfile,
  HorseAge,
  HorseProgression,
  HorseStats,
  HorseSummary,
  HorseTrainingAnalytics,
  HorseTrainingHistoryEntry,
  HorseXP,
  HorseXPEvent,
  HorseXPHistory,
  MarketplaceData,
  MarketplaceGroom,
  MarketplaceRider,
  MarketplaceStats,
  RawFoalDevelopmentBody,
  RecentGains,
  Rider,
  RiderAssignment,
  RiderDiscoveryData,
  RiderMarketplaceData,
  SalarySummary,
  StatGain,
  StatHistory,
  TrainableHorse,
  TrainingEligibility,
  TrainingRequest,
  TrainingResult,
  TraitEffects,
  UserProgress,
} from './api/types.js';

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

// Rider types live in ./api/types (Equoria-aodym).

// -- Grooms --
// Extracted to ./api/grooms (Equoria-jog8w). Re-exported for barrel compat.
export { groomsApi } from './api/grooms.js';

// -- Riders (Epic 9C) --
// Extracted to ./api/riders (Equoria-jog8w). Re-exported for barrel compat.
export { ridersApi } from './api/riders.js';

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

// -- Breeds --
// Extracted to ./api/breeds (Equoria-jog8w). Re-exported for barrel compat.
export { breedsApi } from './api/breeds.js';
export type { Breed } from './api/breeds.js';

// -- Horse Marketplace (Epic 21) --
// Extracted to ./api/horseMarketplace (Equoria-jog8w). Re-exported for barrel compat.
export { horseMarketplaceApi } from './api/horseMarketplace.js';
export type {
  MarketplaceListing,
  MarketplacePagination,
  MarketplaceBrowseResult,
  MarketplaceBrowseFilters,
  MyListing,
  SaleHistoryEntry,
  BuyHorseResult,
} from './api/horseMarketplace.js';

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

// -- User Progress --
// Extracted to ./api/userProgress (Equoria-jog8w). Re-exported for barrel compat.
export { userProgressApi } from './api/userProgress.js';

// -- Competitions --
// Extracted to ./api/competitionsApi (Equoria-jog8w). Re-exported for barrel
// compat. (Distinct from ./api/competitions.ts, which hosts the standalone
// fetchCompetitions/... function surface.)
export { competitionsApi } from './api/competitionsApi.js';
export type { ShowFieldEntry, ShowFieldResponse } from './api/competitionsApi.js';

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
