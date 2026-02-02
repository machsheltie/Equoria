# Tech-Spec Elicitation Addendum

**Created:** 2025-12-02
**Parent Spec:** tech-spec-comprehensive-frontend-completion.md
**Purpose:** Advanced implementation details from codebase analysis

---

## Phase 1: API Client - Enhanced Details

### 1.1 Complete API Response Types

```typescript
// frontend/src/types/api.ts

// Standard API response wrapper
interface ApiResponse<T> {
  status: 'success' | 'error';
  message: string;
  data?: T;
  errors?: Array<{ field: string; message: string }>;
}

// Auth responses (from authController.mjs)
interface LoginResponse {
  user: {
    id: string;
    username: string;
    email: string;
    firstName?: string;
    lastName?: string;
    emailVerified: boolean;
  };
}

interface RegisterResponse {
  user: {
    id: string;
    username: string;
    email: string;
    emailVerified: false; // Always false on registration
  };
}

interface TokenRefreshResponse {
  user: {
    id: string;
    username: string;
    email: string;
  };
}

interface EmailVerificationResponse {
  verified: boolean;
  email: string;
  verifiedAt?: string;
}
```

### 1.2 Error Handling with Toast Integration

```typescript
// frontend/src/lib/api.ts

import { toast } from 'sonner'; // or your toast library

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public errors?: Array<{ field: string; message: string }>
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      // Handle specific error codes
      if (response.status === 401) {
        // Trigger token refresh or redirect to login
        window.dispatchEvent(new CustomEvent('auth:unauthorized'));
      }

      if (response.status === 429) {
        toast.error('Too many requests. Please wait before trying again.');
      }

      throw new ApiError(
        data.message || 'Request failed',
        response.status,
        data.errors
      );
    }

    return data;
  } catch (error) {
    if (error instanceof ApiError) throw error;

    // Network error
    toast.error('Network error. Please check your connection.');
    throw new Error('Network error');
  }
}
```

---

## Phase 2: Auth Pages - Validation Schemas

### 2.1 Zod Validation Schemas

```typescript
// frontend/src/lib/validations/auth.ts

import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string()
    .email('Please enter a valid email address')
    .max(255, 'Email must be less than 255 characters'),
  password: z.string()
    .min(1, 'Password is required'),
});

export const registerSchema = z.object({
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be less than 30 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  email: z.string()
    .email('Please enter a valid email address')
    .max(255, 'Email must be less than 255 characters'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  confirmPassword: z.string(),
  firstName: z.string()
    .min(1, 'First name is required')
    .max(50, 'First name must be less than 50 characters'),
  lastName: z.string()
    .min(1, 'Last name is required')
    .max(50, 'Last name must be less than 50 characters'),
  acceptTerms: z.boolean()
    .refine(val => val === true, 'You must accept the terms and conditions'),
}).refine(data => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export const forgotPasswordSchema = z.object({
  email: z.string()
    .email('Please enter a valid email address'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export type LoginFormData = z.infer<typeof loginSchema>;
export type RegisterFormData = z.infer<typeof registerSchema>;
export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;
```

### 2.2 Auth Context Provider

```typescript
// frontend/src/contexts/AuthContext.tsx

import { createContext, useContext, useEffect, ReactNode } from 'react';
import { useCurrentUser, useLogout } from '@/hooks/api/useAuth';
import { useQueryClient } from '@tanstack/react-query';

interface User {
  id: string;
  username: string;
  email: string;
  emailVerified: boolean;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data, isLoading } = useCurrentUser();
  const logoutMutation = useLogout();
  const queryClient = useQueryClient();

  // Listen for unauthorized events
  useEffect(() => {
    const handleUnauthorized = () => {
      queryClient.clear();
      window.location.href = '/login';
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, [queryClient]);

  const user = data?.data?.user ?? null;

  return (
    <AuthContext.Provider value={{
      user,
      isLoading,
      isAuthenticated: !!user,
      logout: logoutMutation.mutate,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
```

---

## Phase 3: Training UI - Complete Discipline Data

### 3.1 All 23 Disciplines (from schema.mjs)

```typescript
// frontend/src/constants/disciplines.ts

export const DISCIPLINES = {
  RACING: 'Racing',
  SHOW_JUMPING: 'Show Jumping',
  DRESSAGE: 'Dressage',
  CROSS_COUNTRY: 'Cross Country',
  WESTERN_PLEASURE: 'Western Pleasure',
  REINING: 'Reining',
  CUTTING: 'Cutting',
  BARREL_RACING: 'Barrel Racing',
  ROPING: 'Roping',
  TEAM_PENNING: 'Team Penning',
  RODEO: 'Rodeo',
  HUNTER: 'Hunter',
  SADDLESEAT: 'Saddleseat',
  ENDURANCE: 'Endurance',
  EVENTING: 'Eventing',
  VAULTING: 'Vaulting',
  POLO: 'Polo',
  COMBINED_DRIVING: 'Combined Driving',
  FINE_HARNESS: 'Fine Harness',
  GAITED: 'Gaited',
  GYMKHANA: 'Gymkhana',
  STEEPLECHASE: 'Steeplechase',
  HARNESS_RACING: 'Harness Racing',
} as const;

export const DISCIPLINE_VALUES = Object.values(DISCIPLINES);

// Discipline icons for UI
export const DISCIPLINE_ICONS: Record<string, string> = {
  'Racing': '🏇',
  'Show Jumping': '🦘',
  'Dressage': '💃',
  'Cross Country': '🌲',
  'Western Pleasure': '🤠',
  'Reining': '🔄',
  'Cutting': '✂️',
  'Barrel Racing': '🛢️',
  'Roping': '🪢',
  'Team Penning': '👥',
  'Rodeo': '🐂',
  'Hunter': '🎯',
  'Saddleseat': '🎩',
  'Endurance': '⏱️',
  'Eventing': '🏆',
  'Vaulting': '🤸',
  'Polo': '🏑',
  'Combined Driving': '🐴',
  'Fine Harness': '🎀',
  'Gaited': '👣',
  'Gymkhana': '🎪',
  'Steeplechase': '🏃',
  'Harness Racing': '🛞',
};

// Discipline categories for filtering
export const DISCIPLINE_CATEGORIES = {
  ENGLISH: ['Show Jumping', 'Dressage', 'Cross Country', 'Hunter', 'Eventing', 'Saddleseat'],
  WESTERN: ['Western Pleasure', 'Reining', 'Cutting', 'Barrel Racing', 'Roping', 'Team Penning', 'Rodeo'],
  RACING: ['Racing', 'Steeplechase', 'Harness Racing'],
  SPECIALTY: ['Endurance', 'Vaulting', 'Polo', 'Combined Driving', 'Fine Harness', 'Gaited', 'Gymkhana'],
};
```

### 3.2 Horse Stats (from schema.mjs)

```typescript
// frontend/src/constants/horseStats.ts

export const HORSE_STATS = {
  SPEED: 'speed',
  AGILITY: 'agility',
  ENDURANCE: 'endurance',
  STRENGTH: 'strength',
  PRECISION: 'precision',
  BALANCE: 'balance',
  COORDINATION: 'coordination',
  INTELLIGENCE: 'intelligence',
  FOCUS: 'focus',
  OBEDIENCE: 'obedience',
  BOLDNESS: 'boldness',
  FLEXIBILITY: 'flexibility',
} as const;

export const STAT_DISPLAY_NAMES: Record<string, string> = {
  speed: 'Speed',
  agility: 'Agility',
  endurance: 'Endurance',
  strength: 'Strength',
  precision: 'Precision',
  balance: 'Balance',
  coordination: 'Coordination',
  intelligence: 'Intelligence',
  focus: 'Focus',
  obedience: 'Obedience',
  boldness: 'Boldness',
  flexibility: 'Flexibility',
};

// Primary stats per discipline (for training recommendations)
export const DISCIPLINE_PRIMARY_STATS: Record<string, string[]> = {
  'Racing': ['speed', 'endurance', 'agility'],
  'Show Jumping': ['agility', 'precision', 'boldness'],
  'Dressage': ['precision', 'obedience', 'balance'],
  'Cross Country': ['endurance', 'boldness', 'agility'],
  'Western Pleasure': ['obedience', 'balance', 'flexibility'],
  'Reining': ['agility', 'coordination', 'obedience'],
  'Cutting': ['agility', 'intelligence', 'focus'],
  'Barrel Racing': ['speed', 'agility', 'coordination'],
  'Endurance': ['endurance', 'strength', 'focus'],
  'Eventing': ['agility', 'endurance', 'boldness'],
  // ... etc
};
```

### 3.3 Training Business Rules

```typescript
// frontend/src/constants/trainingRules.ts

export const TRAINING_RULES = {
  MIN_AGE: 3,           // Horses must be 3+ years old
  MAX_AGE: 20,          // Horses can train until age 20
  COOLDOWN_DAYS: 7,     // 7-day global cooldown between sessions
  MAX_DAILY_SESSIONS: 1, // One session per horse per day
};

// Training eligibility check (client-side preview)
export function canTrainClient(horse: {
  age: number;
  lastTrainingDate?: Date;
  hasGaitedTrait?: boolean;
}): { eligible: boolean; reason?: string } {

  if (horse.age < TRAINING_RULES.MIN_AGE) {
    return { eligible: false, reason: `Horse must be at least ${TRAINING_RULES.MIN_AGE} years old` };
  }

  if (horse.age > TRAINING_RULES.MAX_AGE) {
    return { eligible: false, reason: `Horse cannot train after age ${TRAINING_RULES.MAX_AGE}` };
  }

  if (horse.lastTrainingDate) {
    const daysSince = Math.floor(
      (Date.now() - new Date(horse.lastTrainingDate).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysSince < TRAINING_RULES.COOLDOWN_DAYS) {
      const remaining = TRAINING_RULES.COOLDOWN_DAYS - daysSince;
      return {
        eligible: false,
        reason: `Cooldown active: ${remaining} day${remaining > 1 ? 's' : ''} remaining`
      };
    }
  }

  return { eligible: true };
}
```

---

## Phase 4: Breeding UI - Complete Prediction Data

### 4.1 Breeding Prediction Types (from breedingPredictionService.mjs)

```typescript
// frontend/src/types/breeding.ts

// Trait categories for inheritance display
export const TRAIT_CATEGORIES = {
  empathy: ['sensitive', 'empathic', 'gentle', 'caring', 'intuitive'],
  boldness: ['bold', 'brave', 'confident', 'fearless', 'daring'],
  intelligence: ['quick_learner', 'clever', 'smart', 'wise', 'analytical'],
  physical: ['athletic', 'strong', 'agile', 'fast', 'enduring'],
  temperament: ['calm', 'spirited', 'gentle', 'fiery', 'steady'],
  social: ['charismatic', 'friendly', 'leader', 'cooperative', 'outgoing'],
};

export const RARE_TRAITS = [
  'sensitive', 'noble', 'legacy_talent', 'exceptional', 'prodigy',
  'natural_leader', 'empathic', 'intuitive', 'charismatic', 'legendary',
];

export const NEGATIVE_TRAITS = [
  'stubborn', 'anxious', 'aggressive', 'fearful', 'lazy', 'unpredictable',
  'difficult', 'nervous', 'spooky', 'resistant',
];

// Inheritance probability response
export interface TraitProbability {
  traitName: string;
  probability: number;        // 0-75%
  hasStacking: boolean;       // Both parents have trait
  stackingBonus: number;      // +15% if stacking
  isRare: boolean;
  isNegative: boolean;
  isEpigenetic: boolean;
  parentSources: {
    stallion: boolean;
    mare: boolean;
  };
}

export interface InheritancePrediction {
  stallionId: number;
  mareId: number;
  traitProbabilities: TraitProbability[];
  summary: {
    totalTraitsConsidered: number;
    epigeneticTraits: number;
    rareTraits: number;
    negativeTraits: number;
    stackingTraits: number;
    averageInheritanceChance: number;
  };
  hasInsufficientData: boolean;
  calculatedAt: string;
}

// Temperament compatibility (from breedingPredictionService.mjs)
export const TEMPERAMENT_COMPATIBILITY: Record<string, number> = {
  'calm-calm': 85,
  'calm-spirited': 70,
  'calm-gentle': 90,
  'spirited-spirited': 60,
  'spirited-calm': 70,
  'spirited-gentle': 65,
  'gentle-gentle': 95,
  'gentle-calm': 90,
  'gentle-spirited': 65,
};

export interface TemperamentInfluence {
  stallionTemperament: string;
  mareTemperament: string;
  compatibilityScore: number;  // 60-95
  predictedOffspringTemperament: string[];
  traitInfluenceModifiers: {
    boldness: number;
    empathy: number;
    calmness: number;
    energy: number;
  };
}

// Breeding quality levels
export type BreedingQuality = 'exceptional' | 'excellent' | 'good' | 'fair' | 'poor';

export interface BreedingData {
  horseId: number;
  horseName: string;
  sex: string;
  traitSummary: {
    totalTraits: number;
    epigeneticTraits: number;
    rareTraits: number;
    negativeTraits: number;
    averageBondScore: number;
  };
  breedingQuality: BreedingQuality;
  temperamentInfluence: {
    temperament: string;
    breedingCompatibility: {
      bestMatches: string[];
      worstMatches: string[];
    };
  };
}
```

### 4.2 Breeding API Hooks

```typescript
// frontend/src/hooks/api/useBreeding.ts

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';
import type {
  InheritancePrediction,
  TemperamentInfluence,
  BreedingData
} from '@/types/breeding';

// Get breeding data for a single horse
export function useBreedingData(horseId: number | undefined) {
  return useQuery({
    queryKey: ['breedingData', horseId],
    queryFn: () => apiRequest<{ breedingData: BreedingData }>(
      `/api/horses/${horseId}/breeding-data`
    ),
    enabled: !!horseId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Predict breeding outcome for a pair
export function useBreedingPrediction(stallionId?: number, mareId?: number) {
  return useQuery({
    queryKey: ['breedingPrediction', stallionId, mareId],
    queryFn: () => apiRequest<{ prediction: InheritancePrediction }>(
      `/api/breeding/predict?stallionId=${stallionId}&mareId=${mareId}`
    ),
    enabled: !!stallionId && !!mareId,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

// Get temperament compatibility
export function useTemperamentCompatibility(stallionId?: number, mareId?: number) {
  return useQuery({
    queryKey: ['temperamentCompatibility', stallionId, mareId],
    queryFn: () => apiRequest<{ compatibility: TemperamentInfluence }>(
      `/api/breeding/compatibility/${stallionId}/${mareId}`
    ),
    enabled: !!stallionId && !!mareId,
  });
}

// Execute breeding
export function useExecuteBreeding() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { stallionId: number; mareId: number }) =>
      apiRequest<{ foalId: number }>('/api/breeding/breed', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['horses'] });
      queryClient.invalidateQueries({ queryKey: ['foals'] });
      queryClient.invalidateQueries({ queryKey: ['breedingHistory'] });
    },
  });
}
```

### 4.3 Breeding Age Rules (from schema.mjs)

```typescript
// frontend/src/constants/breedingRules.ts

export const BREEDING_LIMITS = {
  MIN_STALLION_AGE: 3,
  MIN_MARE_AGE: 3,
  MAX_STALLION_AGE: 25,
  MAX_MARE_AGE: 20,
};

export const INHERITANCE_RATES = {
  BASE: 25,           // Base 25% inheritance chance
  MAX_SINGLE: 50,     // Maximum with one parent having trait
  MAX_STACKING: 75,   // Maximum with both parents having trait
  STACKING_BONUS: 15, // Bonus for trait stacking
  RARE_BONUS: 10,     // Bonus for rare traits
  EPIGENETIC_BONUS: 5, // Bonus for epigenetic traits
  NEGATIVE_PENALTY: 5, // Penalty for negative traits
};

// Check breeding eligibility
export function canBreed(horse: {
  age: number;
  sex: string;
}): { eligible: boolean; reason?: string } {
  if (horse.sex === 'Stallion') {
    if (horse.age < BREEDING_LIMITS.MIN_STALLION_AGE) {
      return { eligible: false, reason: `Stallion must be at least ${BREEDING_LIMITS.MIN_STALLION_AGE} years old` };
    }
    if (horse.age > BREEDING_LIMITS.MAX_STALLION_AGE) {
      return { eligible: false, reason: `Stallion cannot breed after age ${BREEDING_LIMITS.MAX_STALLION_AGE}` };
    }
  }

  if (horse.sex === 'Mare') {
    if (horse.age < BREEDING_LIMITS.MIN_MARE_AGE) {
      return { eligible: false, reason: `Mare must be at least ${BREEDING_LIMITS.MIN_MARE_AGE} years old` };
    }
    if (horse.age > BREEDING_LIMITS.MAX_MARE_AGE) {
      return { eligible: false, reason: `Mare cannot breed after age ${BREEDING_LIMITS.MAX_MARE_AGE}` };
    }
  }

  if (!['Stallion', 'Mare'].includes(horse.sex)) {
    return { eligible: false, reason: 'Only stallions and mares can breed' };
  }

  return { eligible: true };
}
```

---

## Phase 5: Test Patterns - Example Test Files

### 5.1 Auth Hook Test Example

```typescript
// frontend/src/hooks/api/__tests__/useAuth.test.tsx

import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { useLogin, useCurrentUser, useLogout } from '../useAuth';

const server = setupServer();

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}

describe('useLogin', () => {
  it('should login successfully', async () => {
    server.use(
      http.post('/api/auth/login', () => {
        return HttpResponse.json({
          status: 'success',
          message: 'Login successful',
          data: {
            user: { id: '1', username: 'testuser', email: 'test@example.com' }
          }
        });
      })
    );

    const { result } = renderHook(() => useLogin(), { wrapper: createWrapper() });

    result.current.mutate({ email: 'test@example.com', password: 'password123' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data?.user.username).toBe('testuser');
  });

  it('should handle login error', async () => {
    server.use(
      http.post('/api/auth/login', () => {
        return HttpResponse.json(
          { status: 'error', message: 'Invalid credentials' },
          { status: 401 }
        );
      })
    );

    const { result } = renderHook(() => useLogin(), { wrapper: createWrapper() });

    result.current.mutate({ email: 'test@example.com', password: 'wrong' });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useCurrentUser', () => {
  it('should fetch current user', async () => {
    server.use(
      http.get('/api/auth/me', () => {
        return HttpResponse.json({
          status: 'success',
          data: {
            user: { id: '1', username: 'testuser', email: 'test@example.com', emailVerified: true }
          }
        });
      })
    );

    const { result } = renderHook(() => useCurrentUser(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data?.user.emailVerified).toBe(true);
  });
});
```

### 5.2 Component Test Example

```typescript
// frontend/src/pages/__tests__/LoginPage.test.tsx

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import LoginPage from '../LoginPage';

const server = setupServer();

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const renderLoginPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <LoginPage />
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('LoginPage', () => {
  it('renders login form', () => {
    renderLoginPage();

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /log in/i })).toBeInTheDocument();
  });

  it('shows validation errors for empty fields', async () => {
    const user = userEvent.setup();
    renderLoginPage();

    await user.click(screen.getByRole('button', { name: /log in/i }));

    await waitFor(() => {
      expect(screen.getByText(/please enter a valid email/i)).toBeInTheDocument();
    });
  });

  it('submits form with valid data', async () => {
    const user = userEvent.setup();

    server.use(
      http.post('/api/auth/login', () => {
        return HttpResponse.json({
          status: 'success',
          data: { user: { id: '1', username: 'test', email: 'test@example.com' } }
        });
      })
    );

    renderLoginPage();

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /log in/i }));

    await waitFor(() => {
      expect(screen.queryByText(/invalid/i)).not.toBeInTheDocument();
    });
  });
});
```

---

## Updated File Structure

```
frontend/src/
├── lib/
│   ├── api.ts                      (API client with error handling)
│   └── validations/
│       └── auth.ts                 (Zod schemas)
├── types/
│   ├── api.ts                      (Response types)
│   ├── breeding.ts                 (Breeding types)
│   └── training.ts                 (Training types)
├── constants/
│   ├── disciplines.ts              (23 disciplines)
│   ├── horseStats.ts               (12 stats)
│   ├── trainingRules.ts            (Training business rules)
│   └── breedingRules.ts            (Breeding business rules)
├── contexts/
│   └── AuthContext.tsx             (Auth state provider)
├── hooks/api/
│   ├── useAuth.ts                  (Auth hooks)
│   ├── useTraining.ts              (Training hooks)
│   ├── useBreeding.ts              (Breeding hooks)
│   └── __tests__/
│       ├── useAuth.test.tsx
│       ├── useTraining.test.tsx
│       └── useBreeding.test.tsx
├── pages/
│   ├── LoginPage.tsx
│   ├── RegisterPage.tsx
│   ├── ForgotPasswordPage.tsx
│   ├── ResetPasswordPage.tsx
│   ├── EmailVerificationPage.tsx
│   └── __tests__/
│       └── LoginPage.test.tsx
└── components/
    ├── training/
    │   ├── TrainingDashboard.tsx
    │   ├── TrainingSessionModal.tsx
    │   └── DisciplineSelector.tsx
    └── breeding/
        ├── BreedingCenter.tsx
        ├── BreedingPairSelector.tsx
        ├── BreedingPredictionDisplay.tsx
        └── FoalDevelopmentTracker.tsx
```

---

## Summary of Enhancements

| Area | Original | Enhanced |
|------|----------|----------|
| API Types | Basic | Full TypeScript interfaces from actual responses |
| Validation | Manual | Zod schemas with exact backend rules |
| Disciplines | "23 disciplines" | All 23 names, icons, categories |
| Stats | "Horse stats" | All 12 stats with display names |
| Breeding | "Prediction" | Full trait inheritance algorithm constants |
| Testing | "Add tests" | Complete MSW-based test examples |

---

*Generated by Advanced Elicitation Mode*
*Ready for implementation in fresh context*
