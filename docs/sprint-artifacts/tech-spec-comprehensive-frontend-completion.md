# Tech-Spec: Comprehensive Frontend Completion

**Created:** 2025-12-02
**Status:** Ready for Development
**Author:** BMAD Tech-Spec Workflow
**Scope:** Items 1-5 (Auth, Frontend Auth Pages, Training UI, Breeding UI, Test Infrastructure)

---

## Overview

### Problem Statement

The Equoria backend is 100% production-ready with comprehensive authentication, training, breeding, and competition systems. However, the frontend (~60% complete) lacks:

1. **Authentication UI** - No login/register/password-reset pages
2. **Training UI** - No interface for the training system
3. **Breeding UI** - No interface for breeding pair selection and foal development
4. **API Integration** - Components use mock data instead of real API calls
5. **Test Infrastructure** - Minor ES module compatibility issues

### Solution

Build the missing frontend components following established patterns (React Query, TypeScript, TailwindCSS) and integrate with the existing backend API endpoints.

### Scope

**In Scope:**
- 5 Authentication pages (Login, Register, ForgotPassword, ResetPassword, EmailVerification)
- Training Dashboard and Session Modal
- Breeding Center with Pair Selector and Foal Tracker
- API client setup with React Query hooks
- Test configuration verification

**Out of Scope:**
- Backend changes (already complete)
- Social login UI (Phase 2)
- Mobile-specific optimizations

---

## Context for Development

### Codebase Patterns

**Backend Controller Pattern** (`backend/controllers/authController.mjs`):
```javascript
export const login = async (req, res, next) => {
  try {
    // Validation
    // Business logic
    // Set httpOnly cookies
    res.status(200).json({
      status: 'success',
      message: 'Login successful',
      data: { user: { id, username, email } }
    });
  } catch (error) {
    logger.error('[authController.login] Error:', error);
    next(error);
  }
};
```

**Frontend Component Pattern** (`frontend/src/components/UserDashboard.tsx`):
```typescript
interface ComponentProps {
  userId: number;
  dataOverride?: DataType; // Optional prop data
}

const Component: React.FC<ComponentProps> = ({ userId, dataOverride }) => {
  const { data, isLoading, error, refetch } = useQuery<DataType>({
    queryKey: ['keyName', userId],
    queryFn: async () => {
      const response = await fetch(`/api/endpoint/${userId}`);
      if (!response.ok) throw new Error('Failed to fetch');
      return response.json();
    },
    enabled: !dataOverride && typeof fetch !== 'undefined',
  });

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;

  return (/* JSX */);
};
```

### Files to Reference

| Purpose | File |
|---------|------|
| Auth Controller | `backend/controllers/authController.mjs` |
| Auth Routes | `backend/routes/authRoutes.mjs` |
| Training Controller | `backend/controllers/trainingController.mjs` |
| Foal Routes | `backend/routes/foalRoutes.mjs` |
| Dashboard Component | `frontend/src/components/UserDashboard.tsx` |
| Fantasy Form | `frontend/src/components/FantasyForm.tsx` |
| Jest Config | `backend/jest.config.mjs` |

### Technical Decisions

1. **Auth tokens in httpOnly cookies** - Already implemented in backend, frontend just needs `credentials: 'include'`
2. **React Query for server state** - Consistent with existing components
3. **No Redux needed** - React Query handles server state, local state is minimal
4. **TailwindCSS + Radix UI** - Matches existing component library
5. **Form handling** - Use controlled components with useState (no form library needed)

---

## Implementation Plan

### Phase 1: API Client Setup (Foundation)

#### Task 1.1: Create API Client with Cookie Support
**File:** `frontend/src/lib/api.ts`

```typescript
const API_BASE = import.meta.env.VITE_API_URL || '';

interface ApiResponse<T> {
  status: 'success' | 'error';
  message: string;
  data?: T;
  errors?: Array<{ field: string; message: string }>;
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    credentials: 'include', // Include httpOnly cookies
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Request failed');
  }

  return data;
}
```

#### Task 1.2: Create Auth API Hooks
**File:** `frontend/src/hooks/api/useAuth.ts`

```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';

interface User {
  id: string;
  username: string;
  email: string;
  emailVerified: boolean;
}

interface LoginCredentials {
  email: string;
  password: string;
}

interface RegisterData {
  username: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (credentials: LoginCredentials) =>
      apiRequest<{ user: User }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
    },
  });
}

export function useRegister() {
  return useMutation({
    mutationFn: (data: RegisterData) =>
      apiRequest<{ user: User }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  });
}

export function useCurrentUser() {
  return useQuery({
    queryKey: ['currentUser'],
    queryFn: () => apiRequest<{ user: User }>('/api/auth/me'),
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      apiRequest('/api/auth/logout', { method: 'POST' }),
    onSuccess: () => {
      queryClient.clear();
    },
  });
}
```

---

### Phase 2: Authentication Pages

#### Task 2.1: Login Page
**File:** `frontend/src/pages/LoginPage.tsx`

**Features:**
- Email/password form with validation
- Error message display
- Loading state during submission
- Link to register and forgot password
- Redirect to dashboard on success

**API Integration:**
- `POST /api/auth/login` - Login with credentials
- Cookies set automatically by backend

#### Task 2.2: Register Page
**File:** `frontend/src/pages/RegisterPage.tsx`

**Features:**
- Username, email, password, firstName, lastName fields
- Password strength indicator (min 8 chars, uppercase, lowercase, number)
- Real-time validation feedback
- Success message about verification email

**API Integration:**
- `POST /api/auth/register` - Create account

#### Task 2.3: Forgot Password Page
**File:** `frontend/src/pages/ForgotPasswordPage.tsx`

**Features:**
- Email input only
- Success message regardless of email existence (security)
- Link back to login

**API Integration:**
- `POST /api/auth/forgot-password` - Request reset (to be implemented)

#### Task 2.4: Reset Password Page
**File:** `frontend/src/pages/ResetPasswordPage.tsx`

**Features:**
- Token from URL query parameter
- New password + confirm password
- Password requirements display
- Success redirect to login

**API Integration:**
- `POST /api/auth/reset-password` - Reset with token (to be implemented)

#### Task 2.5: Email Verification Page
**File:** `frontend/src/pages/EmailVerificationPage.tsx`

**Features:**
- Auto-verify from URL token
- Success/failure message
- Resend verification button
- Redirect to dashboard on success

**API Integration:**
- `GET /api/auth/verify-email?token=xxx` - Verify email
- `POST /api/auth/resend-verification` - Resend email

---

### Phase 3: Training UI

#### Task 3.1: Training Dashboard
**File:** `frontend/src/components/TrainingDashboard.tsx`

**Features:**
- List of user's horses with training status
- Cooldown countdown for each horse
- Filter by trainable/all
- Discipline quick-select buttons

**API Integration:**
- `GET /api/horses` - Get user's horses
- `GET /api/training/status/:horseId` - Get training status per horse

#### Task 3.2: Training Session Modal
**File:** `frontend/src/components/TrainingSessionModal.tsx`

**Features:**
- Horse stats display
- Discipline dropdown (23 disciplines)
- Eligibility check display
- Expected gains preview
- Confirm/cancel buttons
- Results display after training

**API Integration:**
- `GET /api/training/eligibility/:horseId/:discipline` - Check eligibility
- `POST /api/training/train` - Execute training session

---

### Phase 4: Breeding UI

#### Task 4.1: Breeding Center
**File:** `frontend/src/components/BreedingCenter.tsx`

**Features:**
- Tab navigation: My Mares | Stud Marketplace | Breeding History
- Mare list with breeding status
- Stud search with filters

**API Integration:**
- `GET /api/horses?sex=female` - Get user's mares
- `GET /api/horses/:id/breeding-data` - Get breeding info

#### Task 4.2: Breeding Pair Selector
**File:** `frontend/src/components/BreedingPairSelector.tsx`

**Features:**
- Side-by-side mare/stallion comparison
- Stat comparison visualization
- Predicted foal traits display
- Stud fee display
- Breed button with confirmation

**API Integration:**
- `GET /api/breeding/predict` - Predict offspring traits (if available)

#### Task 4.3: Foal Development Tracker
**File:** `frontend/src/components/FoalDevelopmentTracker.tsx`

**Features:**
- Foal age and development stage
- Bonding/stress meters
- Available enrichment activities
- Activity history log
- Groom assignment display

**API Integration:**
- `GET /api/foals/:foalId/development` - Get foal development data
- `POST /api/foals/:foalId/activity` - Complete enrichment activity

---

### Phase 5: Test Infrastructure Verification

#### Task 5.1: Verify Jest ES Module Configuration
**File:** `backend/jest.config.mjs`

**Current Config (Already Correct):**
```javascript
export default {
  testEnvironment: 'node',
  transform: {}, // No transformation needed for ES modules
  testMatch: ['**/*.test.mjs', '**/*.test.js'],
  // ...
};
```

**Verification Steps:**
1. Run `npm test` in backend directory
2. Check for "require is not defined" errors
3. If errors occur, check for any `.js` test files using CommonJS syntax

#### Task 5.2: Add Frontend Test Setup
**File:** `frontend/vitest.config.ts` (if using Vitest) or `frontend/jest.config.js`

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
});
```

---

## Acceptance Criteria

### Authentication Pages
- [ ] AC1: User can register with valid credentials and receives verification email notice
- [ ] AC2: User can login with valid credentials and is redirected to dashboard
- [ ] AC3: User sees error messages for invalid login attempts
- [ ] AC4: User can request password reset and sees confirmation message
- [ ] AC5: User can verify email from link and sees success message

### Training UI
- [ ] AC6: User can view list of their horses with training status
- [ ] AC7: User can see cooldown remaining for each horse
- [ ] AC8: User can select a horse and discipline to train
- [ ] AC9: User sees eligibility check results before training
- [ ] AC10: User can complete training and sees results (stat gains, XP)

### Breeding UI
- [ ] AC11: User can view their mares and select one for breeding
- [ ] AC12: User can browse available stallions
- [ ] AC13: User can compare mare and stallion stats side-by-side
- [ ] AC14: User can view foal development progress
- [ ] AC15: User can complete enrichment activities for foals

### API Integration
- [ ] AC16: All API calls include `credentials: 'include'` for cookie auth
- [ ] AC17: Loading states shown during API requests
- [ ] AC18: Error states shown when API calls fail
- [ ] AC19: Data refreshes after mutations (invalidateQueries)

### Tests
- [ ] AC20: Backend tests pass without "require is not defined" errors
- [ ] AC21: Frontend components have basic render tests

---

## Additional Context

### Dependencies

**Already Installed:**
- @tanstack/react-query (server state)
- react-router-dom (routing)
- tailwindcss (styling)
- lucide-react (icons)

**May Need:**
- zod (optional - form validation schemas)

### Testing Strategy

**Unit Tests:**
- Test React Query hooks with MSW for API mocking
- Test form validation logic
- Test component rendering states

**Integration Tests:**
- Test auth flow (login → dashboard redirect)
- Test training flow (select horse → train → see results)

### Notes

1. **Backend Auth Already Complete** - The backend has full auth with httpOnly cookies, token rotation, email verification. Frontend just needs to call the APIs.

2. **No localStorage Needed** - Tokens are in httpOnly cookies, so no client-side token management required.

3. **CSRF Not Needed Yet** - SameSite=strict cookies provide CSRF protection. If adding forms that need CSRF, backend already supports it.

4. **Password Reset Backend** - The forgot-password and reset-password endpoints may need to be implemented in backend if not already present.

---

## File Structure

```
frontend/src/
├── lib/
│   └── api.ts                    (NEW - API client)
├── hooks/
│   └── api/
│       ├── useAuth.ts            (NEW - Auth hooks)
│       ├── useTraining.ts        (NEW - Training hooks)
│       └── useBreeding.ts        (NEW - Breeding hooks)
├── pages/
│   ├── LoginPage.tsx             (NEW)
│   ├── RegisterPage.tsx          (NEW)
│   ├── ForgotPasswordPage.tsx    (NEW)
│   ├── ResetPasswordPage.tsx     (NEW)
│   └── EmailVerificationPage.tsx (NEW)
├── components/
│   ├── training/
│   │   ├── TrainingDashboard.tsx     (NEW)
│   │   └── TrainingSessionModal.tsx  (NEW)
│   └── breeding/
│       ├── BreedingCenter.tsx        (NEW)
│       ├── BreedingPairSelector.tsx  (NEW)
│       └── FoalDevelopmentTracker.tsx (NEW)
└── App.tsx                       (UPDATE - Add routes)
```

---

## Estimated Effort

| Phase | Tasks | Hours |
|-------|-------|-------|
| Phase 1: API Client | 2 tasks | 3-4 |
| Phase 2: Auth Pages | 5 tasks | 8-10 |
| Phase 3: Training UI | 2 tasks | 6-8 |
| Phase 4: Breeding UI | 3 tasks | 8-10 |
| Phase 5: Tests | 2 tasks | 2-3 |
| **Total** | **14 tasks** | **27-35 hours** |

---

*Generated by BMAD Tech-Spec Workflow*
*Ready for development in fresh context*
