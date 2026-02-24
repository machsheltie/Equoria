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

// Track if a token refresh is in progress to avoid multiple concurrent refreshes
let isRefreshing = false;
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
  name: string;
  level?: number;
  breed?: string;
  gender?: string;
  sex?: string;
  ageYears?: number;
  bestDisciplines?: string[];
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
  name?: string;
  sireId?: number;
  damId?: number;
  ageDays?: number;
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

// Simple stats object for components
interface SimpleHorseStats {
  speed: number;
  stamina: number;
  agility: number;
  strength: number;
  intelligence: number;
  health: number;
}

interface HorseSummary {
  id: number;
  name: string;
  breed: string;
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
  description?: string;
  parentIds?: {
    sireId?: number;
    damId?: number;
  };
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
  // If already refreshing, return the existing promise
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/refresh-token`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Base fetch wrapper with cookie credentials
 * Features: Auto-retry on 401, Rate limiting (429) handling
 */
async function fetchWithAuth<T>(
  endpoint: string,
  options: RequestInit = {},
  retryCount = 0
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  const isTestEnv = import.meta.env.MODE === 'test' || import.meta.env.VITE_E2E_TEST === 'true';

  const config: RequestInit = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(isTestEnv ? { 'x-test-skip-csrf': 'true' } : {}),
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
    return apiClient.post<TrainingEligibility>('/api/training/check-eligibility', payload);
  },
  train: async (payload: TrainingRequest): Promise<TrainingResult> => {
    const result = await apiClient.post<TrainingResult>('/api/training/train', payload);

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
    return apiClient.post<BreedResponse>('/api/horses/foals', payload);
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
  getAssignments: () => apiClient.get<GroomAssignment[]>('/api/groom-assignments'),
  getSalarySummary: () => apiClient.get<SalarySummary>('/api/groom-salaries/summary'),
  getMarketplace: () => apiClient.get<MarketplaceData>('/api/groom-marketplace'),
  getMarketplaceStats: () => apiClient.get<MarketplaceStats>('/api/groom-marketplace/stats'),
  hireGroom: (marketplaceId: string) =>
    apiClient.post<{
      success: boolean;
      data: { groom: Groom; cost: number; remainingMoney: number };
    }>('/api/groom-marketplace/hire', { marketplaceId }),
  refreshMarketplace: (force: boolean = false) =>
    apiClient.post<MarketplaceData>('/api/groom-marketplace/refresh', { force }),
  assignGroom: (data: {
    groomId: number;
    horseId: number;
    priority: number;
    notes?: string;
    replacePrimary?: boolean;
  }) => apiClient.post<{ success: boolean }>('/api/groom-assignments', data),
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
  getAssignments: () => apiClient.get<RiderAssignment[]>('/api/riders/assignments'),
  getMarketplace: () => apiClient.get<RiderMarketplaceData>('/api/riders/marketplace'),
  hireRider: (marketplaceId: string) =>
    apiClient.post<{
      success: boolean;
      data: { rider: Rider; cost: number; remainingMoney: number };
    }>('/api/riders/marketplace/hire', { marketplaceId }),
  refreshMarketplace: (force: boolean = false) =>
    apiClient.post<RiderMarketplaceData>('/api/riders/marketplace/refresh', { force }),
  assignRider: (data: { riderId: number; horseId: number; notes?: string }) =>
    apiClient.post<{ success: boolean }>('/api/riders/assignments', data),
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
  getAssignments: () => apiClient.get<TrainerAssignmentEntry[]>('/api/trainers/assignments'),
  getMarketplace: () => apiClient.get<TrainerMarketplaceData>('/api/trainers/marketplace'),
  hireTrainer: (marketplaceId: string) =>
    apiClient.post<{
      success: boolean;
      data: { trainer: TrainerEntry; cost: number; remainingMoney: number };
    }>('/api/trainers/marketplace/hire', { marketplaceId }),
  refreshMarketplace: (force: boolean = false) =>
    apiClient.post<TrainerMarketplaceData>('/api/trainers/marketplace/refresh', { force }),
  assignTrainer: (data: { trainerId: number; horseId: number; notes?: string }) =>
    apiClient.post<{ success: boolean }>('/api/trainers/assignments', data),
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
  getServices: () => apiClient.get<VetService[]>('/api/vet/services'),
  bookAppointment: (data: { horseId: number; serviceId: string }) =>
    apiClient.post<{ success: boolean; data: VetAppointmentResult }>(
      '/api/vet/book-appointment',
      data
    ),
};

// ── Tack Shop types ───────────────────────────────────────────────────────────

export interface TackItem {
  id: string;
  category: 'saddle' | 'bridle';
  name: string;
  description: string;
  cost: number;
  bonus: string;
  disciplines: string[];
}

export interface TackInventoryData {
  items: TackItem[];
  categories: { saddles: TackItem[]; bridles: TackItem[] };
}

export interface TackPurchaseResult {
  horse: { id: number; name: string; tack: Record<string, string> };
  item: TackItem;
  cost: number;
  remainingMoney: number;
}

/**
 * Tack Shop API surface
 *   GET  /api/tack-shop/inventory → TackInventoryData
 *   POST /api/tack-shop/purchase  → TackPurchaseResult
 */
export const tackShopApi = {
  getInventory: () => apiClient.get<TackInventoryData>('/api/tack-shop/inventory'),
  purchaseItem: (data: { horseId: number; itemId: string }) =>
    apiClient.post<{ success: boolean; data: TackPurchaseResult }>('/api/tack-shop/purchase', data),
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
  getServices: () => apiClient.get<FarrierService[]>('/api/farrier/services'),
  bookService: (data: { horseId: number; serviceId: string }) =>
    apiClient.post<{ success: boolean; data: FarrierBookingResult }>(
      '/api/farrier/book-service',
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
  getCatalog: () => apiClient.get<FeedItem[]>('/api/feed-shop/catalog'),
  purchaseFeed: (data: { horseId: number; feedId: string }) =>
    apiClient.post<{ success: boolean; data: FeedPurchaseResult }>('/api/feed-shop/purchase', data),
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
  list: () => apiClient.get<Competition[]>('/api/competition'),
  getDisciplines: () =>
    apiClient.get<{ disciplines: string[]; disciplineDetails: unknown[] }>(
      '/api/competition/disciplines'
    ),
  checkEligibility: (horseId: number, discipline: string) =>
    apiClient.get<{ success: boolean; data: { eligibility: EligibilityResult } }>(
      `/api/competition/eligibility/${horseId}/${encodeURIComponent(discipline)}`
    ),
  enter: (data: { horseId: number; competitionId: number }) =>
    apiClient.post<{ success: boolean; data: { entryId: number } }>('/api/competition/enter', {
      horseId: data.horseId,
      showId: data.competitionId,
    }),
};

/**
 * Breeding Prediction API surface
 */
export const breedingPredictionApi = {
  /**
   * Calculate inbreeding coefficient for a breeding pair
   */
  getInbreedingAnalysis: (payload: { stallionId: number; mareId: number }) =>
    apiClient.post<unknown>('/api/genetics/inbreeding-analysis', payload),

  /**
   * Get lineage analysis for a breeding pair
   */
  getLineageAnalysis: (stallionId: number, mareId: number) =>
    apiClient.get<unknown>(`/api/breeding/lineage-analysis/${stallionId}/${mareId}`),

  /**
   * Calculate genetic probability for offspring
   */
  getGeneticProbability: (payload: { stallionId: number; mareId: number }) =>
    apiClient.post<unknown>('/api/breeding/genetic-probability', payload),

  /**
   * Get breeding compatibility score
   */
  getBreedingCompatibility: (payload: { stallionId: number; mareId: number }) =>
    apiClient.post<unknown>('/api/genetics/breeding-compatibility', payload),
};

/**
 * Authentication API endpoints
 */
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
