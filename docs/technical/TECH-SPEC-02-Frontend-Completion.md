# TECH-SPEC-02: Frontend Completion

**Status:** Draft
**Version:** 1.0.0
**Created:** 2025-12-02
**Source:** systems_status_overview.md, GAME_FEATURES.md, architecture-frontend.md

---

## Overview

Complete the remaining ~40% of frontend functionality to achieve production-ready status. The frontend (React 19 + TypeScript + TailwindCSS) currently has 19 components and 115+ tests but is missing authentication UI, training UI, breeding UI, and real API integration.

## Current State

| Category | Status | Components |
|----------|--------|------------|
| Dashboard | Complete | UserDashboard.tsx |
| Horse Management | Complete | HorseListView.tsx, HorseCard.tsx, MultiHorseComparison.tsx |
| Groom System | Complete | MyGroomsDashboard.tsx |
| Competition | Complete | CompetitionBrowser.tsx |
| Analytics | Complete | EnhancedReportingInterface.tsx |
| **Authentication** | **Missing** | 0 components |
| **Training UI** | **Missing** | 0 components |
| **Breeding UI** | **Missing** | 0 components |
| **API Integration** | **Partial** | Mock data only |

---

## Integration Points (Explicit)

- Modules to modify/create
  - `frontend/src/lib/api-client.ts`: extend with auth (login/register/refresh/logout/verify), training (eligibility/status/train/trainable horses), breeding/foal (breed, development, enrichment/activity).
  - `frontend/src/hooks/api/`: add React Query hooks `useAuth.ts`, `useTraining.ts`, `useBreeding.ts`, `useHorses.ts` that wrap `api-client` and centralize query keys/mutations.
  - Components: new feature folders `frontend/src/components/training/` (dashboard, session modal, history panel) and `frontend/src/components/breeding/` (breeding center, pair selector, foal tracker), plus route shells in `frontend/src/pages/` for auth flows.
- APIs/services to integrate
  - Auth: `/api/auth/login`, `/api/auth/register`, `/api/auth/refresh-token`, `/api/auth/logout`, `/api/auth/verify-email`, `/api/auth/resend-verification`, `/api/auth/forgot-password`, `/api/auth/reset-password`.
  - Training: `/api/training/check-eligibility`, `/api/training/train`, `/api/training/status/:horseId/:discipline`, `/api/training/horse/:horseId/all-status`, `/api/training/trainable-horses/:userId`.
  - Breeding/Foals: `/api/foals/breeding/breed`, `/api/foals/:id`, `/api/foals/:id/development`, `/api/foals/:id/activity`, `/api/foals/:id/activities`, `/api/foals/:id/enrich`, `/api/foals/:id/traits`, `/api/foals/:id/reveal-traits`, `/api/foals/:id/develop`.
- Data flow between new and existing code
  - `api-client` (credentialed fetch with refresh) → React Query hooks (type-safe queries/mutations) → feature components (training/breeding/auth UIs) → shared contexts/state invalidations.
  - Invalidation: training mutations refresh `['training', horseId]`, `['training', horseId, 'status']`, and `['horses']`; breeding/foal mutations refresh `['horses']`, `['foals', foalId]`, `['breeding', 'pairs']`.
  - Errors bubble through hooks to UI-level toasts/inline errors; loading handled via shared skeletons/spinners in components.

---

## Phase 1: Authentication UI (Priority: P0)

**Estimated Hours:** 8-10

### 1.1 LoginPage.tsx

**Location:** `frontend/src/pages/LoginPage.tsx`

**Features:**
- Email/password input fields
- Form validation (Zod schema)
- Loading state during submission
- Error message display
- "Remember me" checkbox
- "Forgot password" link
- Social login buttons (Google, Apple)

**Dependencies:**
- React Hook Form
- Zod validation
- React Query mutation

**UI Components:**
```
┌─────────────────────────────────────────────┐
│              EQUORIA LOGIN                   │
├─────────────────────────────────────────────┤
│  ┌─────────────────────────────────────┐    │
│  │ Email                                │    │
│  └─────────────────────────────────────┘    │
│  ┌─────────────────────────────────────┐    │
│  │ Password                      [👁]  │    │
│  └─────────────────────────────────────┘    │
│  [x] Remember me        Forgot password?    │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │          LOG IN                      │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  ─────────── OR CONTINUE WITH ──────────    │
│                                             │
│  [  Google  ]        [  Apple  ]           │
│                                             │
│  Don't have an account? Register            │
└─────────────────────────────────────────────┘
```

### 1.2 RegisterPage.tsx

**Location:** `frontend/src/pages/RegisterPage.tsx`

**Features:**
- Username, email, password fields
- Password confirmation
- Password strength indicator
- Terms & conditions checkbox
- Email verification redirect

### 1.3 ForgotPasswordPage.tsx

**Location:** `frontend/src/pages/ForgotPasswordPage.tsx`

**Features:**
- Email input
- Success message with email sent indicator
- Countdown timer for resend

### 1.4 ResetPasswordPage.tsx

**Location:** `frontend/src/pages/ResetPasswordPage.tsx`

**Features:**
- Token validation from URL
- New password with confirmation
- Password requirements display
- Success redirect to login

### 1.5 EmailVerificationPage.tsx

**Location:** `frontend/src/pages/EmailVerificationPage.tsx`

**Features:**
- Token verification from URL
- Success/failure display
- Resend verification option
- Auto-redirect on success

---

## Phase 2: Training UI (Priority: P1)

**Estimated Hours:** 10-12

### 2.1 TrainingDashboard.tsx

**Location:** `frontend/src/components/TrainingDashboard.tsx`

**Features:**
- List of trainable horses
- Training cooldown status per horse
- Discipline selection
- Training eligibility checks
- Recent training history

**UI Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│                    TRAINING CENTER                           │
├─────────────────────────────────────────────────────────────┤
│  TRAINABLE HORSES (5)                    Filter: [All ▼]    │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ [Horse Card] Storm Runner                               ││
│  │ Level 15 | Cooldown: Ready ✓                           ││
│  │ Best disciplines: Racing, Eventing                      ││
│  │                                   [Train Now]           ││
│  └─────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────┐│
│  │ [Horse Card] Midnight Dream                             ││
│  │ Level 8 | Cooldown: 3 days remaining                   ││
│  │ Best disciplines: Dressage, Show Jumping               ││
│  │                                   [Unavailable]         ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### 2.2 TrainingSessionModal.tsx

**Location:** `frontend/src/components/TrainingSessionModal.tsx`

**Features:**
- Horse stats display
- Discipline selector (23 disciplines)
- Trait bonus/penalty preview
- Expected stat gains preview
- Training confirmation
- Results display after training

### 2.3 TrainingHistoryPanel.tsx

**Location:** `frontend/src/components/TrainingHistoryPanel.tsx`

**Features:**
- Paginated training log
- Discipline scores over time
- Stat gain history
- Training efficiency metrics

---

## Phase 3: Breeding UI (Priority: P1)

**Estimated Hours:** 12-15

### 3.1 BreedingCenter.tsx

**Location:** `frontend/src/components/BreedingCenter.tsx`

**Features:**
- Mare selection interface
- Stallion marketplace browser
- Compatibility scoring display
- Breeding prediction (trait inheritance)
- Stud fee display

### 3.2 BreedingPairSelector.tsx

**Location:** `frontend/src/components/BreedingPairSelector.tsx`

**Features:**
- Side-by-side mare/stallion selection
- Stat comparison
- Trait compatibility analysis
- Genetic diversity indicator
- Inbreeding warning system

**UI Layout:**
```
┌──────────────────────────────────────────────────────────────────────┐
│                        BREEDING PAIR SELECTION                        │
├────────────────────────────────┬─────────────────────────────────────┤
│           MARE                 │           STALLION                   │
│  ┌──────────────────────────┐  │  ┌──────────────────────────────┐   │
│  │ [Select Mare ▼]          │  │  │ [Select Stallion ▼]         │   │
│  │                          │  │  │                              │   │
│  │ Stats:                   │  │  │ Stats:                       │   │
│  │ Speed: 75                │  │  │ Speed: 82                    │   │
│  │ Stamina: 68              │  │  │ Stamina: 71                  │   │
│  │ Agility: 72              │  │  │ Agility: 65                  │   │
│  │                          │  │  │                              │   │
│  │ Traits: Bold, Focused    │  │  │ Traits: Brave, Athletic     │   │
│  └──────────────────────────┘  │  └──────────────────────────────┘   │
├────────────────────────────────┴─────────────────────────────────────┤
│  COMPATIBILITY SCORE: 87%                                             │
│  Predicted Foal Stats: Speed 76-80, Stamina 68-72                    │
│  Trait Inheritance: 60% Bold, 45% Brave                              │
│  Stud Fee: $5,000                                                     │
│                                                                       │
│  [  Breed Now - $5,000  ]                                            │
└──────────────────────────────────────────────────────────────────────┘
```

### 3.3 FoalDevelopmentTracker.tsx

**Location:** `frontend/src/components/FoalDevelopmentTracker.tsx`

**Features:**
- Foal age and development stage
- Milestone progress (Day 0-6 critical period)
- Enrichment activity buttons
- Bonding/stress meters
- Groom assignment interface

### 3.4 LineageTree.tsx

**Location:** `frontend/src/components/LineageTree.tsx`

**Features:**
- Visual family tree (3+ generations)
- Ancestor trait highlighting
- Inbreeding coefficient display
- Click-through to ancestor profiles

---

## Phase 4: API Integration (Priority: P0)

**Estimated Hours:** 10-12

### 4.1 API Client Setup

**Location:** `frontend/src/lib/api-client.ts`

**Tasks:**
1. Keep existing credentialed fetch + refresh pattern; add typed helpers for training (`getTrainableHorses`, `checkEligibility`, `train`, `getDisciplineStatus`, `getHorseStatus`) and breeding/foal (`breed`, `getFoal`, `getDevelopment`, `logActivity`, `enrich`, `revealTraits`).
2. Ensure all requests include `credentials: 'include'`; wire retry-on-401 to reuse refresh path already present.
3. Standardize response typing with `ApiResponse<T>` and surface `retryAfter` for 429s back to React Query callers.
4. Export a small set of utilities (e.g., `withErrorHandling<T>`) if needed for consistent toast messaging at hook level.

### 4.2 React Query Hooks

**Location:** `frontend/src/hooks/api/`

**Files to Create:**
- `useAuth.ts` - Login, logout, register, refresh
- `useHorses.ts` - Horse CRUD operations
- `useTraining.ts` - Training sessions, eligibility
- `useBreeding.ts` - Breeding operations, predictions
- `useCompetition.ts` - Show entry, results
- `useGrooms.ts` - Groom management

### 4.3 Remove Mock Data

**Tasks:**
1. Identify all hardcoded mock data
2. Replace with React Query hooks
3. Add loading states
4. Add error boundaries
5. Add empty states

---

## Testing Requirements

### Unit Tests (Target: 80% coverage)
- Form validation logic
- API hook behavior with MSW
- Component rendering states (loading, error, success)
- Conditional rendering based on auth state

### Integration Tests
- Login → Dashboard flow
- Training session execution
- Breeding pair selection
- Competition entry flow

### E2E Tests (Playwright)
- Full authentication flow
- Training session completion
- Breeding operation
- Competition participation

---

## File Structure

```
frontend/src/
├── pages/
│   ├── LoginPage.tsx          (NEW)
│   ├── RegisterPage.tsx       (NEW)
│   ├── ForgotPasswordPage.tsx (NEW)
│   ├── ResetPasswordPage.tsx  (NEW)
│   ├── EmailVerificationPage.tsx (NEW)
│   └── ...existing pages
├── components/
│   ├── training/
│   │   ├── TrainingDashboard.tsx (NEW)
│   │   ├── TrainingSessionModal.tsx (NEW)
│   │   └── TrainingHistoryPanel.tsx (NEW)
│   ├── breeding/
│   │   ├── BreedingCenter.tsx (NEW)
│   │   ├── BreedingPairSelector.tsx (NEW)
│   │   ├── FoalDevelopmentTracker.tsx (NEW)
│   │   └── LineageTree.tsx (NEW)
│   └── ...existing components
├── hooks/
│   └── api/
│       ├── useAuth.ts (NEW)
│       ├── useHorses.ts (NEW)
│       ├── useTraining.ts (NEW)
│       ├── useBreeding.ts (NEW)
│       ├── useCompetition.ts (NEW)
│       └── useGrooms.ts (NEW)
└── lib/
    └── api.ts (UPDATE)
```

---

## Acceptance Criteria

1. Users can register, login, and manage authentication
2. Users can train horses with full eligibility checking
3. Users can select breeding pairs and view predictions
4. All components fetch data from real API endpoints
5. Loading and error states handled gracefully
6. 80%+ test coverage on new components
7. No mock data in production build
8. Responsive design (mobile-first)
9. Accessibility compliance (WCAG 2.1 AA)
