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

// Nullish coalescing: empty string = relative URLs (correct for monolithic deploy).
// Set VITE_API_URL only for split-deploy scenarios.
const API_BASE_URL = import.meta.env.VITE_API_URL ?? '';

// Single promise acts as deduplication lock — no separate boolean flag needed.
// All concurrent 401 callers await the same promise until it settles.
let refreshPromise: Promise<boolean> | null = null;

interface ApiError {
  message: string;
  status: string;
  statusCode: number;
  retryAfter?: number; // Seconds to wait before retrying (for 429)
}

interface ApiResponse<T> {
  status: string;
  message?: string;
  data?: T;
}

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

interface FoalDevelopment {
  stage?: string;
  progress?: number;
  bonding?: number;
  stress?: number;
  enrichmentLevel?: number;
  currentDay: number;
  bondingLevel: number;
  stressLevel: number;
  completedActivities: { [day: number]: string[] }; // Explicitly typing this as per backend
  maxDay: number;
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
  // Coat color from genetics system
  finalDisplayColor?: string;
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

/**
 * Attempt to refresh the access token using the refresh token cookie
 */
async function refreshAccessToken(): Promise<boolean> {
  // If a refresh is already in flight, every caller shares the same promise.
  if (refreshPromise) {
    return refreshPromise;
  }

  // Create the refresh promise *before* any async work so concurrent callers
  // that arrive between now and the first await see it immediately.
  refreshPromise = (async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/refresh-token`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });

      return response.ok;
    } catch {
      return false;
    }
  })();

  try {
    return await refreshPromise;
  } finally {
    // Clear AFTER the promise settles so all concurrent awaiters resolve first.
    refreshPromise = null;
  }
}

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * CSRF token cache — fetched once, reused for all mutations
 */
let _csrfToken: string | null = null;
let _csrfFetching: Promise<string> | null = null;

async function getCsrfToken(): Promise<string> {
  if (_csrfToken) return _csrfToken;
  if (_csrfFetching) return _csrfFetching;

  _csrfFetching = (async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/csrf-token`, {
        credentials: 'include',
      });
      const data = await res.json();
      _csrfToken = data.csrfToken || '';
      return _csrfToken;
    } catch {
      return '';
    } finally {
      _csrfFetching = null;
    }
  })();

  return _csrfFetching;
}

/**
 * Base fetch wrapper with cookie credentials
 * Features: Auto-retry on 401, Rate limiting (429) handling, CSRF token injection
 */
async function fetchWithAuth<T>(
  endpoint: string,
  options: RequestInit = {},
  retryCount = 0
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  const isTestEnv = import.meta.env.MODE === 'test' || import.meta.env.VITE_E2E_TEST === 'true';
  const isMutation = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(
    (options.method || 'GET').toUpperCase()
  );

  // Fetch CSRF token for mutations in non-test environments
  const csrfHeader: Record<string, string> = {};
  if (isMutation && !isTestEnv) {
    const token = await getCsrfToken();
    if (token) csrfHeader['X-CSRF-Token'] = token;
  }

  const config: RequestInit = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(isTestEnv ? { 'x-test-skip-csrf': 'true' } : csrfHeader),
      ...options.headers,
    },
    credentials: 'include', // CRITICAL: Send httpOnly cookies with request
  };

  try {
    const response = await fetch(url, config);

    // Handle 401 Unauthorized - attempt token refresh once
    if (response.status === 401 && retryCount === 0) {
      // Don't retry refresh endpoint itself
      if (!endpoint.includes('/refresh')) {
        const refreshed = await refreshAccessToken();
        if (refreshed) {
          // Retry the original request
          return fetchWithAuth<T>(endpoint, options, retryCount + 1);
        }
      }
      // Refresh failed, throw 401 error
      throw {
        message: 'Session expired. Please log in again.',
        status: 'error',
        statusCode: 401,
      } as ApiError;
    }

    // Handle 403 CSRF error — refresh token and retry once
    if (response.status === 403 && retryCount === 0 && isMutation) {
      const body = await response
        .clone()
        .json()
        .catch(() => ({}));
      if (body?.code === 'INVALID_CSRF_TOKEN') {
        _csrfToken = null; // Invalidate cached token
        return fetchWithAuth<T>(endpoint, options, retryCount + 1);
      }
    }

    // Handle 429 Rate Limiting
    if (response.status === 429) {
      const retryAfterHeader = response.headers.get('Retry-After');
      const retryAfter = retryAfterHeader ? parseInt(retryAfterHeader, 10) : 60;

      throw {
        message: 'Too many requests. Please try again later.',
        status: 'error',
        statusCode: 429,
        retryAfter,
      } as ApiError;
    }

    // Handle other non-2xx responses
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({
        message: response.statusText,
        status: 'error',
        statusCode: response.status,
      }));

      throw {
        message: errorData.message || 'An error occurred',
        status: errorData.status || 'error',
        statusCode: response.status,
      } as ApiError;
    }

    // Handle no-content responses
    if (response.status === 204) {
      return {} as T;
    }

    const data: ApiResponse<T> = await response.json();

    // Return data property if it exists, otherwise return the whole response
    return (data.data !== undefined ? data.data : data) as T;
  } catch (error) {
    // Re-throw ApiError
    if ((error as ApiError).statusCode) {
      throw error;
    }

    // Network errors
    throw {
      message: error instanceof Error ? error.message : 'Network error',
      status: 'error',
      statusCode: 0,
    } as ApiError;
  }
}

// Export for testing
export { refreshAccessToken, sleep };

/**
 * API Client methods
 */
export const apiClient = {
  /**
   * GET request
   */
  get: <T>(endpoint: string, options?: RequestInit): Promise<T> => {
    return fetchWithAuth<T>(endpoint, {
      method: 'GET',
      ...options,
    });
  },

  /**
   * POST request
   */
  post: <T>(endpoint: string, body?: unknown, options?: RequestInit): Promise<T> => {
    return fetchWithAuth<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
      ...options,
    });
  },

  /**
   * PUT request
   */
  put: <T>(endpoint: string, body?: unknown, options?: RequestInit): Promise<T> => {
    return fetchWithAuth<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body),
      ...options,
    });
  },

  /**
   * PATCH request
   */
  patch: <T>(endpoint: string, body?: unknown, options?: RequestInit): Promise<T> => {
    return fetchWithAuth<T>(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(body),
      ...options,
    });
  },

  /**
   * DELETE request
   */
  delete: <T>(endpoint: string, options?: RequestInit): Promise<T> => {
    return fetchWithAuth<T>(endpoint, {
      method: 'DELETE',
      ...options,
    });
  },
};

/**
 * Training API surface
 */
export const trainingApi = {
  /**
   * Get trainable horses for a user
   * @param userId - UUID of the user (must be authenticated user's UUID)
   */
  getTrainableHorses: (userId: string) => {
    return apiClient.get<TrainableHorse[]>(`/api/training/trainable/${userId}`);
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
      `/api/training/status/${horseId}/${encodeURIComponent(discipline)}`
    );
  },
  getHorseStatus: (horseId: number) => {
    return apiClient.get<DisciplineStatus[] | Record<string, Omit<DisciplineStatus, 'discipline'>>>(
      `/api/training/status/${horseId}`
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
    return apiClient.get<Foal>(`/api/foals/${foalId}`);
  },
  getFoalDevelopment: (foalId: number) => {
    return apiClient.get<FoalDevelopment>(`/api/foals/${foalId}/development`);
  },
  getFoalActivities: (foalId: number) => {
    return apiClient.get<FoalActivity[]>(`/api/foals/${foalId}/activities`);
  },
  logFoalActivity: (foalId: number, activity: FoalActivity) => {
    return apiClient.post<FoalActivity>(`/api/foals/${foalId}/activity`, activity);
  },
  enrichFoal: (foalId: number, activity: FoalActivity) => {
    return apiClient.post<FoalActivity>(`/api/foals/${foalId}/enrich`, activity);
  },
  revealTraits: (foalId: number) => {
    return apiClient.post<{ traits: string[] }>(`/api/foals/${foalId}/reveal-traits`);
  },
  developFoal: (foalId: number, updates: Partial<FoalDevelopment>) => {
    return apiClient.put<FoalDevelopment>(`/api/foals/${foalId}/develop`, updates);
  },
  graduateFoal: (foalId: number) => {
    return apiClient.post<{
      horse: { id: number; name: string; breed: string };
      graduation: {
        clearedAssignments: number;
        bondScore: number;
        isFirstGraduation: boolean;
      };
    }>(`/api/foals/${foalId}/graduate`);
  },
};

/**
 * Horses API surface
 */
export const horsesApi = {
  list: () => apiClient.get<HorseSummary[]>(`/api/horses?t=${Date.now()}`),
  get: (horseId: number) => apiClient.get<HorseSummary>(`/api/horses/${horseId}?t=${Date.now()}`),
  getTrainingHistory: (horseId: number) =>
    apiClient.get<HorseTrainingAnalytics>(`/api/horses/${horseId}/training-history`),
  getBreedingData: (horseId: number) =>
    apiClient.get<unknown>(`/api/horses/${horseId}/breeding-data`),
  getXP: (horseId: number) => apiClient.get<HorseXP>(`/api/horses/${horseId}/xp`),
  getXPHistory: (horseId: number, options?: { limit?: number; offset?: number }) => {
    const params = new URLSearchParams();
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.offset) params.append('offset', options.offset.toString());
    const queryString = params.toString() ? `?${params.toString()}` : '';
    return apiClient.get<HorseXPHistory>(`/api/horses/${horseId}/xp-history${queryString}`);
  },
  getAge: (horseId: number) => apiClient.get<HorseAge>(`/api/horses/${horseId}/age`),
  getStats: (horseId: number) => apiClient.get<HorseStats>(`/api/horses/${horseId}/stats`),
  getProgression: (horseId: number) =>
    apiClient.get<HorseProgression>(`/api/horses/${horseId}/progression`),
  getStatHistory: (horseId: number, timeRange = '30d') =>
    apiClient.get<StatHistory>(`/api/horses/${horseId}/stats/history?range=${timeRange}`),
  getRecentGains: (horseId: number, days = 30) =>
    apiClient.get<RecentGains>(`/api/horses/${horseId}/gains/recent?days=${days}`),
  update: (horseId: number, data: { name?: string }) =>
    apiClient.put<HorseSummary>(`/api/v1/horses/${horseId}`, data),
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
};

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
  prestige: number; // 0–100
  isActive: boolean;
  assignedHorseId?: number | null;
  bio: string;
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
  getUserGrooms: (userId: string | number) => apiClient.get<Groom[]>(`/api/grooms/user/${userId}`),
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
    apiClient.delete<{ success: boolean }>(`/api/groom-assignments/${assignmentId}`),
};

/**
 * Rider API surface (Epic 9C)
 *
 * Path registry:
 *   GET  /api/riders/user/:userId       → Rider[]
 *   GET  /api/riders/assignments        → RiderAssignment[]
 *   GET  /api/riders/marketplace        → RiderMarketplaceData
 *   POST /api/riders/marketplace/hire   → { success, data: { rider, cost } }
 *   POST /api/riders/marketplace/refresh → RiderMarketplaceData
 *   POST /api/riders/assignments        → { success }
 *   DELETE /api/riders/assignments/:id  → { success }
 *   GET  /api/riders/:id/discovery      → RiderDiscoveryData
 */
export const ridersApi = {
  getUserRiders: (userId: string | number) => apiClient.get<Rider[]>(`/api/riders/user/${userId}`),
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
    apiClient.delete<{ success: boolean }>(`/api/riders/assignments/${assignmentId}`),
  getDiscovery: (riderId: number) =>
    apiClient.get<RiderDiscoveryData>(`/api/riders/${riderId}/discovery`),
};

/**
 * Trainer API surface (Epic 13-5)
 *
 * Path registry:
 *   GET  /api/trainers/user/:userId        → Trainer[]
 *   GET  /api/trainers/assignments         → TrainerAssignment[]
 *   GET  /api/trainers/marketplace         → TrainerMarketplaceData
 *   POST /api/trainers/marketplace/hire    → { success, data: { trainer, cost } }
 *   POST /api/trainers/marketplace/refresh → TrainerMarketplaceData
 *   POST /api/trainers/assignments         → { success }
 *   DELETE /api/trainers/assignments/:id   → { success }
 *   DELETE /api/trainers/:id/dismiss       → { success }
 */

export interface TrainerEntry {
  id: number;
  firstName: string;
  lastName: string;
  name: string;
  skillLevel: string; // novice | developing | expert
  personality: string; // focused | encouraging | technical | competitive | patient
  speciality: string;
  sessionRate: number;
  experience: number;
  level: number;
  careerWeeks: number;
  retired: boolean;
  bio?: string;
  assignedHorseId?: number | null;
}

export interface MarketplaceTrainer {
  marketplaceId: string;
  firstName: string;
  lastName: string;
  skillLevel: string;
  personality: string;
  speciality: string;
  sessionRate: number;
  bio: string;
  availability: boolean;
}

export interface TrainerMarketplaceData {
  trainers: MarketplaceTrainer[];
  lastRefresh: string;
  nextFreeRefresh: string;
  refreshCost: number;
  canRefreshFree: boolean;
}

export interface TrainerAssignmentEntry {
  id: number;
  trainerId: number;
  horseId: number;
  horseName: string;
  trainerName: string;
  startDate: string;
  isActive: boolean;
}

export const trainersApi = {
  getUserTrainers: (userId: string | number) =>
    apiClient.get<TrainerEntry[]>(`/api/trainers/user/${userId}`),
  getAssignments: () => apiClient.get<TrainerAssignmentEntry[]>('/api/v1/trainers/assignments'),
  getMarketplace: () => apiClient.get<TrainerMarketplaceData>('/api/v1/trainers/marketplace'),
  hireTrainer: (marketplaceId: string) =>
    apiClient.post<{
      success: boolean;
      data: { trainer: TrainerEntry; cost: number; remainingMoney: number };
    }>('/api/v1/trainers/marketplace/hire', { marketplaceId }),
  refreshMarketplace: (force: boolean = false) =>
    apiClient.post<TrainerMarketplaceData>('/api/v1/trainers/marketplace/refresh', { force }),
  assignTrainer: (data: { trainerId: number; horseId: number; notes?: string }) =>
    apiClient.post<{ success: boolean }>('/api/v1/trainers/assignments', data),
  deleteAssignment: (assignmentId: number) =>
    apiClient.delete<{ success: boolean }>(`/api/trainers/assignments/${assignmentId}`),
  dismissTrainer: (trainerId: number) =>
    apiClient.delete<{ success: boolean }>(`/api/trainers/${trainerId}/dismiss`),
};

// ── Vet Clinic types ──────────────────────────────────────────────────────────

export interface VetService {
  id: string;
  name: string;
  description: string;
  duration: string;
  cost: number;
  healthOutcome: string | null;
}

export interface VetAppointmentResult {
  horse: { id: number; name: string; healthStatus: string | null; lastVettedDate: string | null };
  service: VetService;
  cost: number;
  remainingMoney: number;
}

/**
 * Vet Clinic API surface
 *   GET  /api/vet/services          → VetService[]
 *   POST /api/vet/book-appointment  → VetAppointmentResult
 */
export const vetApi = {
  getServices: () => apiClient.get<VetService[]>('/api/v1/vet/services'),
  bookAppointment: (data: { horseId: number; serviceId: string }) =>
    apiClient.post<{ success: boolean; data: VetAppointmentResult }>(
      '/api/v1/vet/book-appointment',
      data
    ),
};

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
 *   GET /api/breeds → Breed[]  (all 320 breeds, sorted A–Z)
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
  buyStoreHorse: (breedId: number, sex: 'mare' | 'stallion') =>
    apiClient.post<{ horse: HorseSummary; pricePaid: number; newBalance: number }>(
      '/api/v1/marketplace/store/buy',
      { breedId, sex }
    ),
};

// ── Tack Shop types ───────────────────────────────────────────────────────────

export interface TackItem {
  id: string;
  category:
    | 'saddle'
    | 'bridle'
    | 'halter'
    | 'saddle_pad'
    | 'leg_wraps'
    | 'reins'
    | 'girth'
    | 'breastplate'
    | 'decorative';
  name: string;
  description: string;
  cost: number;
  bonus: string;
  numericBonus: number;
  /** Presence bonus for parade shows (decorative items only) */
  presenceBonus?: number;
  tier: 'basic' | 'quality' | 'premium';
  disciplines: string[];
  icon?: string;
  image?: string;
  ageRestriction?: number;
  /** True for decorative/cosmetic items that affect parade presentation only */
  isCosmetic?: boolean;
  /** Limited-use count (e.g. Glitter Spray has 3 applications) */
  limitedUse?: number;
  /** Seasonal tag for grouping under seasonal sub-header (e.g. 'winter', 'summer') */
  seasonalTag?: string;
}

export interface TackInventoryData {
  items: TackItem[];
  categories: Record<string, TackItem[]>;
  categoryDisplayNames?: Record<string, string>;
}

export interface TackPurchaseResult {
  horse: { id: number; name: string; tack: Record<string, unknown> };
  item: TackItem;
  cost: number;
  remainingMoney: number;
}

export interface TackRepairResult {
  horse: { id: number; name: string; tack: Record<string, unknown> };
  item: TackItem;
  category: string;
  repairCost: number;
  previousCondition: number;
  newCondition: number;
  remainingMoney: number;
}

export interface TackUnequipDecorationResult {
  horse: { id: number; name: string; tack: Record<string, unknown> };
  removedItemId: string;
}

/**
 * Tack Shop API surface
 *   GET  /api/tack-shop/inventory              → TackInventoryData
 *   POST /api/tack-shop/purchase               → TackPurchaseResult
 *   POST /api/tack-shop/repair                 → TackRepairResult
 *   POST /api/tack-shop/unequip-decoration     → TackUnequipDecorationResult
 */
export const tackShopApi = {
  getInventory: () => apiClient.get<TackInventoryData>('/api/v1/tack-shop/inventory'),
  purchaseItem: (data: { horseId: number; itemId: string }) =>
    apiClient.post<TackPurchaseResult>('/api/v1/tack-shop/purchase', data),
  repairItem: (data: { horseId: number; category: string }) =>
    apiClient.post<TackRepairResult>('/api/v1/tack-shop/repair', data),
  unequipDecoration: (data: { horseId: number; itemId: string }) =>
    apiClient.post<TackUnequipDecorationResult>('/api/v1/tack-shop/unequip-decoration', data),
};

// ── Farrier types ─────────────────────────────────────────────────────────────

export interface FarrierService {
  id: string;
  name: string;
  description: string;
  duration: string;
  cost: number;
  hoofConditionOutcome: string;
  includesShoing: boolean;
  icon?: string;
}

export interface FarrierBookingResult {
  horse: {
    id: number;
    name: string;
    hoofCondition: string | null;
    lastFarrierDate: string | null;
    lastShod: string | null;
  };
  service: FarrierService;
  cost: number;
  remainingMoney: number;
}

/**
 * Farrier API surface
 *   GET  /api/farrier/services     → FarrierService[]
 *   POST /api/farrier/book-service → FarrierBookingResult
 */
export const farrierApi = {
  getServices: () => apiClient.get<FarrierService[]>('/api/v1/farrier/services'),
  bookService: (data: { horseId: number; serviceId: string }) =>
    apiClient.post<{ success: boolean; data: FarrierBookingResult }>(
      '/api/v1/farrier/book-service',
      data
    ),
};

// ── Feed Shop types ───────────────────────────────────────────────────────────

export interface FeedItem {
  id: string;
  name: string;
  description: string;
  billing: string;
  cost: number;
  energyBoost: number;
  feedType: string;
}

export interface FeedPurchaseResult {
  horse: {
    id: number;
    name: string;
    currentFeed: string | null;
    lastFedDate: string | null;
    energyLevel: number | null;
  };
  feed: FeedItem;
  cost: number;
  remainingMoney: number;
}

/**
 * Feed Shop API surface
 *   GET  /api/feed-shop/catalog  → FeedItem[]
 *   POST /api/feed-shop/purchase → FeedPurchaseResult
 */
export const feedShopApi = {
  getCatalog: () => apiClient.get<FeedItem[]>('/api/v1/feed-shop/catalog'),
  purchaseFeed: (data: { horseId: number; feedId: string }) =>
    apiClient.post<FeedPurchaseResult>('/api/v1/feed-shop/purchase', data),
};

// ── Inventory types ───────────────────────────────────────────────────────────

export interface InventoryItem {
  id: string;
  itemId: string;
  category: 'saddle' | 'bridle';
  name: string;
  bonus?: string;
  quantity: number;
  equippedToHorseId?: number | null;
  equippedToHorseName?: string | null;
}

export interface InventoryData {
  items: InventoryItem[];
  total: number;
}

export interface EquipResult {
  items: InventoryItem[];
  equippedItem: InventoryItem;
}

export interface UnequipResult {
  items: InventoryItem[];
  unequippedItem: InventoryItem;
}

/**
 * Inventory API surface
 *   GET  /api/inventory         → InventoryData   (fetchWithAuth unwraps data.data)
 *   POST /api/inventory/equip   → EquipResult
 *   POST /api/inventory/unequip → UnequipResult
 */
export const inventoryApi = {
  getInventory: () => apiClient.get<InventoryData>('/api/v1/inventory'),
  equipItem: (vars: { inventoryItemId: string; horseId: number }) =>
    apiClient.post<EquipResult>('/api/v1/inventory/equip', vars),
  unequipItem: (vars: { inventoryItemId: string }) =>
    apiClient.post<UnequipResult>('/api/v1/inventory/unequip', vars),
};

// ─── Forum types ────────────────────────────────────────────────────────────
export type ForumSection = 'general' | 'art' | 'sales' | 'services' | 'venting';

export interface ForumAuthor {
  id: string;
  username: string;
}

export interface ForumThread {
  id: number;
  section: ForumSection;
  title: string;
  author: ForumAuthor;
  tags: string[];
  isPinned: boolean;
  viewCount: number;
  replyCount: number;
  lastActivityAt: string;
  createdAt: string;
}

export interface ForumPost {
  id: number;
  threadId: number;
  author: ForumAuthor;
  content: string;
  createdAt: string;
}

export interface ThreadsResponse {
  threads: ForumThread[];
  total: number;
  page: number;
}

export interface ThreadDetailResponse {
  thread: ForumThread;
  posts: ForumPost[];
}

export interface CreateThreadRequest {
  section: ForumSection;
  title: string;
  content: string;
  tags?: string[];
}

/**
 * Forum API surface — message board threads and posts.
 */
export const forumApi = {
  getThreads: (section?: ForumSection, page = 1) => {
    const params = new URLSearchParams({ page: String(page) });
    if (section) params.set('section', section);
    return apiClient.get<ThreadsResponse>(`/api/v1/forum/threads?${params.toString()}`);
  },

  getThread: (id: number) => apiClient.get<ThreadDetailResponse>(`/api/v1/forum/threads/${id}`),

  createThread: (req: CreateThreadRequest) =>
    apiClient.post<{ thread: ForumThread; firstPost: ForumPost }>('/api/v1/forum/threads', req),

  createPost: (threadId: number, content: string) =>
    apiClient.post<{ post: ForumPost }>(`/api/v1/forum/threads/${threadId}/posts`, { content }),

  incrementView: (threadId: number) =>
    apiClient.post<Record<string, never>>(`/api/v1/forum/threads/${threadId}/view`, {}),
};

// ── Direct Message types ─────────────────────────────────────────────────────
export interface DirectMessageUser {
  id: string;
  username: string;
}

export interface DirectMessage {
  id: number;
  senderId: string;
  sender: DirectMessageUser;
  recipientId: string;
  recipient: DirectMessageUser;
  subject: string;
  content: string;
  tag?: string;
  isRead: boolean;
  createdAt: string;
}

export interface InboxResponse {
  messages: DirectMessage[];
}

export interface SendMessageRequest {
  recipientId: string;
  subject: string;
  content: string;
  tag?: string;
}

// ── Bank Types ──────────────────────────────────────────────────────────────────

export interface WeeklyClaimResponse {
  amount: number;
  newBalance: number;
  nextClaimDate: string;
}

export interface ClaimStatusResponse {
  canClaim: boolean;
  nextClaimDate: string | null;
  rewardAmount: number;
}

/**
 * Bank API surface
 *   POST /api/v1/bank/claim        → Claim weekly reward
 *   GET  /api/v1/bank/claim-status → Check claim availability
 */
export const bankApi = {
  claimWeekly: () => apiClient.post<WeeklyClaimResponse>('/api/v1/bank/claim', {}),
  getClaimStatus: () => apiClient.get<ClaimStatusResponse>('/api/v1/bank/claim-status'),
};

/**
 * Messages API surface (Epic 19B-2)
 *   GET   /api/messages/inbox         → InboxResponse
 *   GET   /api/messages/sent          → InboxResponse
 *   GET   /api/messages/unread-count  → { count: number }
 *   GET   /api/messages/:id           → { message: DirectMessage }
 *   POST  /api/messages               → { message: DirectMessage }
 *   PATCH /api/messages/:id/read      → { success: boolean }
 */
export const messagesApi = {
  getInbox: () => apiClient.get<InboxResponse>('/api/v1/messages/inbox'),
  getSent: () => apiClient.get<InboxResponse>('/api/v1/messages/sent'),
  getUnreadCount: () => apiClient.get<{ count: number }>('/api/v1/messages/unread-count'),
  getMessage: (id: number) => apiClient.get<{ message: DirectMessage }>(`/api/v1/messages/${id}`),
  sendMessage: (req: SendMessageRequest) =>
    apiClient.post<{ message: DirectMessage }>('/api/v1/messages', req),
  markRead: (id: number) =>
    apiClient.patch<{ success: boolean }>(`/api/v1/messages/${id}/read`, {}),
};

// ── Club Types ─────────────────────────────────────────────────────────────────

export type ClubType = 'discipline' | 'breed';
export type ClubRole = 'member' | 'officer' | 'president';
export type ElectionStatus = 'upcoming' | 'open' | 'closed';

export interface Club {
  id: number;
  name: string;
  type: ClubType;
  category: string;
  description: string;
  leader: { id: string; username: string };
  memberCount: number;
  createdAt: string;
}

export interface ClubMembership {
  id: number;
  club: Club;
  role: ClubRole;
  joinedAt: string;
}

export interface ClubElection {
  id: number;
  clubId: number;
  position: string;
  status: ElectionStatus;
  startsAt: string;
  endsAt: string;
}

export interface ElectionCandidate {
  id: number;
  user: { id: string; username: string };
  statement: string;
  voteCount: number;
}

/**
 * Clubs API surface
 *   GET    /api/clubs                               → { clubs: Club[] }
 *   GET    /api/clubs/mine                          → { memberships: ClubMembership[] }
 *   GET    /api/clubs/:id                           → { club: Club }
 *   POST   /api/clubs                               → { club: Club }
 *   POST   /api/clubs/:id/join                      → { membership: ClubMembership }
 *   DELETE /api/clubs/:id/leave                     → { success: true }
 *   GET    /api/clubs/:id/elections                 → { elections: ClubElection[] }
 *   POST   /api/clubs/:id/elections                 → { election: ClubElection }
 *   POST   /api/clubs/elections/:id/nominate        → { candidate }
 *   POST   /api/clubs/elections/:id/vote            → { ballot }
 *   GET    /api/clubs/elections/:id/results         → { election, candidates: ElectionCandidate[] }
 */
export const clubsApi = {
  getClubs: (type?: ClubType, category?: string) => {
    const params = new URLSearchParams();
    if (type) params.set('type', type);
    if (category) params.set('category', category);
    const qs = params.toString();
    return apiClient.get<{ clubs: Club[] }>(`/api/v1/clubs${qs ? `?${qs}` : ''}`);
  },
  getMyClubs: () => apiClient.get<{ memberships: ClubMembership[] }>('/api/v1/clubs/mine'),
  getClub: (id: number) =>
    apiClient.get<{ club: Club & { members: ClubMembership[] } }>(`/api/v1/clubs/${id}`),
  createClub: (payload: { name: string; type: ClubType; category: string; description: string }) =>
    apiClient.post<{ club: Club }>('/api/v1/clubs', payload),
  joinClub: (id: number) =>
    apiClient.post<{ membership: ClubMembership }>(`/api/v1/clubs/${id}/join`, {}),
  leaveClub: (id: number) => apiClient.delete<void>(`/api/v1/clubs/${id}/leave`),
  getElections: (clubId: number) =>
    apiClient.get<{ elections: ClubElection[] }>(`/api/v1/clubs/${clubId}/elections`),
  createElection: (
    clubId: number,
    payload: { position: string; startsAt: string; endsAt: string }
  ) => apiClient.post<{ election: ClubElection }>(`/api/v1/clubs/${clubId}/elections`, payload),
  nominate: (electionId: number, statement: string) =>
    apiClient.post<void>(`/api/v1/clubs/elections/${electionId}/nominate`, { statement }),
  vote: (electionId: number, candidateId: number) =>
    apiClient.post<void>(`/api/v1/clubs/elections/${electionId}/vote`, { candidateId }),
  getResults: (electionId: number) =>
    apiClient.get<{ election: ClubElection; candidates: ElectionCandidate[] }>(
      `/api/v1/clubs/elections/${electionId}/results`
    ),
};

/**
 * User Progress API surface
 */
export const userProgressApi = {
  getProgress: (userId: string | number) =>
    apiClient.get<UserProgress>(`/api/users/${userId}/progress`),
  getDashboard: (userId: string | number) =>
    apiClient.get<DashboardData>(`/api/users/dashboard/${userId}`),
  getActivity: (userId: string | number) =>
    apiClient.get<ActivityFeedItem[]>(`/api/users/${userId}/activity`),
  getUser: (userId: string | number) =>
    apiClient.get<{
      id: string;
      username: string;
      money: number;
      level: number;
      currentHorses: number;
      stableLimit: number;
    }>(`/api/users/${userId}`),
};

/**
 * Competitions API surface
 */
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
    }>(`/api/competition/eligibility/${horseId}/${encodeURIComponent(discipline)}`),
  enter: (data: { horseId: number; competitionId: number }) =>
    apiClient.post<{ success: boolean; data: { entryId: number } }>('/api/v1/competition/enter', {
      horseId: data.horseId,
      showId: data.competitionId,
    }),
};

/**
 * Breeding Prediction API surface
 */
export interface InbreedingAnalysis {
  coefficient: number;
  risk: string;
  commonAncestors: Array<{ name: string; generation: number }>;
}

export interface LineageAnalysis {
  stallionLineage: Array<{ name: string; generation: number }>;
  mareLineage: Array<{ name: string; generation: number }>;
  commonAncestors: Array<{ name: string; generation: number }>;
}

export interface GeneticProbability {
  traitProbabilities: Array<{ trait: string; probability: number }>;
  statRanges: Record<string, { min: number; max: number; expected: number }>;
}

export interface BreedingCompatibility {
  score: number;
  rating: string;
  factors: Array<{ name: string; impact: number; description: string }>;
}

export const breedingPredictionApi = {
  /**
   * Calculate inbreeding coefficient for a breeding pair
   */
  getInbreedingAnalysis: (payload: { stallionId: number; mareId: number }) =>
    apiClient.post<InbreedingAnalysis>('/api/v1/genetics/inbreeding-analysis', payload),

  /**
   * Get lineage analysis for a breeding pair
   */
  getLineageAnalysis: (stallionId: number, mareId: number) =>
    apiClient.get<LineageAnalysis>(`/api/breeding/lineage-analysis/${stallionId}/${mareId}`),

  /**
   * Calculate genetic probability for offspring
   */
  getGeneticProbability: (payload: { stallionId: number; mareId: number }) =>
    apiClient.post<GeneticProbability>('/api/v1/breeding/genetic-probability', payload),

  /**
   * Get breeding compatibility score
   */
  getBreedingCompatibility: (payload: { stallionId: number; mareId: number }) =>
    apiClient.post<BreedingCompatibility>('/api/v1/genetics/breeding-compatibility', payload),
};

/**
 * Authentication API endpoints
 */
// ── Crafting System ──────────────────────────────────────────────────────────

export interface CraftingMaterials {
  leather: number;
  cloth: number;
  dye: number;
  metal: number;
  thread: number;
}

export interface CraftingRecipe {
  id: string;
  name: string;
  description: string;
  tier: number;
  cost: number;
  materials: CraftingMaterials;
  result: string;
  resultName: string;
  resultCategory: string;
  bonus: string;
  numericBonus: number;
  isCosmetic: boolean;
  locked: boolean;
  affordable: boolean;
  deficit?: string;
  lockReason?: string;
}

export interface CraftedItem {
  id: string;
  itemId: string;
  category: string;
  name: string;
  bonus: string;
  numericBonus: number;
  isCosmetic: boolean;
  quantity: number;
  origin: 'crafted';
  craftedAt: string;
  equippedToHorseId: number | null;
  equippedToHorseName: string | null;
}

export interface CraftResult {
  item: CraftedItem;
  remainingMaterials: CraftingMaterials;
  coinsSpent: number;
  newBalance: number;
}

export const craftingApi = {
  getMaterials: () =>
    apiClient.get<{ materials: CraftingMaterials; workshopTier: number }>(
      '/api/v1/crafting/materials'
    ),

  getRecipes: () =>
    apiClient.get<{ workshopTier: number; recipes: CraftingRecipe[] }>('/api/v1/crafting/recipes'),

  craftItem: (recipeId: string) =>
    apiClient.post<CraftResult>('/api/v1/crafting/craft', { recipeId }),
};

export const authApi = {
  /**
   * Login user
   * Sets httpOnly cookies automatically
   */
  login: (credentials: { email: string; password: string }) => {
    return apiClient.post<{ user: { id: number; email: string; username: string } }>(
      '/api/auth/login',
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
    }>('/api/auth/register', userData);
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
      };
    }>('/api/auth/profile');
  },

  /**
   * Update user profile
   * Supports updating username (display name), bio, and avatar
   */
  updateProfile: (updates: {
    username?: string;
    email?: string;
    bio?: string;
    avatarUrl?: string;
  }) => {
    return apiClient.put<{
      user: {
        id: number;
        username: string;
        email: string;
        bio?: string;
        avatarUrl?: string;
      };
    }>('/api/auth/profile', updates);
  },

  /**
   * Logout user
   * Clears httpOnly cookies
   */
  logout: () => {
    return apiClient.post<{ message: string }>('/api/auth/logout');
  },

  /**
   * Refresh access token
   * Uses httpOnly refresh token cookie automatically
   */
  refreshToken: () => {
    return apiClient.post<{ message: string }>('/api/auth/refresh-token');
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
    }>(`/api/auth/verify-email?token=${encodeURIComponent(token)}`);
  },

  /**
   * Resend verification email
   * Requires authentication
   */
  resendVerification: () => {
    return apiClient.post<{
      emailSent: boolean;
      expiresAt: string;
    }>('/api/auth/resend-verification');
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
    }>('/api/auth/verification-status');
  },

  /**
   * Mark authenticated user's onboarding as complete.
   */
  completeOnboarding: () =>
    apiClient.post<{ completedOnboarding: boolean }>('/api/auth/complete-onboarding', {}),

  /**
   * Advance the authenticated user's onboarding step by 1.
   * Sets completedOnboarding: true when step 10 is reached.
   */
  advanceOnboarding: () =>
    apiClient.post<{ step: number; completed: boolean }>('/api/auth/advance-onboarding', {}),

  /**
   * Request password reset email
   * Note: Requires backend endpoint (not yet implemented)
   */
  forgotPassword: (email: string) => {
    return apiClient.post<{ message: string }>('/api/auth/forgot-password', { email });
  },

  /**
   * Reset password with token
   * Note: Requires backend endpoint (not yet implemented)
   */
  resetPassword: (token: string, newPassword: string) => {
    return apiClient.post<{ message: string }>('/api/auth/reset-password', {
      token,
      newPassword,
    });
  },
};

// ── User Search ───────────────────────────────────────────────────────────────

export const usersApi = {
  search: (username: string) =>
    apiClient.get<{ users: { id: string; username: string }[] }>(
      `/api/v1/users/search?username=${encodeURIComponent(username)}`
    ),
};

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
