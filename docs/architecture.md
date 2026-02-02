---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
status: 'complete'
completedAt: '2025-12-02'
inputDocuments:
  - docs/product/PRD-00-Brief.md
  - docs/product/PRD-01-Overview.md
  - docs/product/PRD-02-Core-Features.md
  - docs/product/PRD-03-Gameplay-Systems.md
  - docs/product/PRD-04-Advanced-Systems.md
  - docs/product/PRD-07-Player-Guide.md
  - docs/product/PRD-08-Security-Architecture.md
  - docs/product/PRD-10-Project-Milestones.md
  - docs/architecture-frontend.md
  - docs/architecture-backend.md
  - docs/index.md
  - docs/sprint-artifacts/tech-spec-comprehensive-frontend-completion.md
  - docs/sprint-artifacts/tech-spec-elicitation-addendum.md
workflowType: 'architecture'
lastStep: 2
project_name: 'Equoria'
user_name: 'Heirr'
date: '2025-12-02'
hasProjectContext: false
elicitationMethods:
  - Architecture Decision Records
  - Cross-Functional War Room
  - Pre-mortem Analysis
  - Red Team vs Blue Team
  - First Principles Analysis
partyAgents:
  - Winston (Architect)
  - Amelia (Developer)
  - John (PM)
  - Murat (Test Architect)
  - Sally (UX Designer)
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Document Purpose

This Architecture Decision Document (ADD) captures the key technical decisions for extending the Equoria platform with frontend completion. It provides AI agents with unambiguous implementation guidance to prevent conflicts and ensure consistent development.

**Scope:** Frontend Completion (Auth UI, Training UI, Breeding UI, API Integration)

**Context:** Brownfield project with production-ready backend (~95% complete) and partial frontend (~60% complete)

---

## Project Context Analysis (Enhanced)

_Enhanced through 5 elicitation methods with BMAD agent collaboration_

### Requirements Overview

**Functional Requirements:**

The Equoria frontend completion is a **thin UI layer** over a production-ready backend. Key insight: We're not building business logic—we're building views.

| System | Backend Status | Frontend Need |
|--------|---------------|---------------|
| Authentication | 100% Complete | 5 UI pages |
| Training | 100% Complete | Dashboard + Modal |
| Breeding | 100% Complete | Center + Selector + Tracker |
| Competition | 100% Complete | Already has CompetitionBrowser |
| Grooms | 100% Complete | Already has MyGroomsDashboard |

**Non-Functional Requirements:**

| NFR | Requirement | Enforcement |
|-----|-------------|-------------|
| API Latency | <200ms @ p95 | Backend handles |
| Dashboard Load | <500ms | React Query caching |
| Auth Rate Limit | 5 req/15 min | Backend enforced |
| Test Coverage | 80% minimum | CI/CD gate |

### Architecture Decisions Made

| ADR | Decision | Choice | Rationale |
|-----|----------|--------|-----------|
| ADR-001 | State Management | React Query only | Server is source of truth, no client store needed |
| ADR-002 | Form Handling | useState + Zod | 5 forms don't justify a library |
| ADR-003 | Auth Storage | HttpOnly cookies | Already implemented in backend |
| ADR-004 | API Client | Centralized fetch wrapper | Single point for `credentials: 'include'` |

### Scale & Complexity Assessment

| Indicator | Value | Implication |
|-----------|-------|-------------|
| Complexity Level | Medium | UI layer over complex domain |
| Primary Pattern | Fetch → Render → Mutate → Invalidate | Simple data flow |
| Risk Level | Low | Backend stability de-risks frontend |
| New Components | 15-20 | Auth (5), Training (3), Breeding (4+) |
| API Endpoints Used | ~15 | Subset of 130+ available |

### Technical Constraints & Dependencies

| Constraint | Description | Mitigation |
|------------|-------------|------------|
| Cookie Auth | Must use `credentials: 'include'` on ALL fetches | Centralized API client in `lib/api.ts` |
| 23 Disciplines | Large dataset for training UI | Category grouping (Western/English/Racing/Specialty) |
| Breeding Predictions | Can return empty for horses without history | Handle `hasInsufficientData` flag explicitly |
| Training Cooldown | 7-day global cooldown per horse | Display countdown timer, disable train button |
| Token Rotation | Access tokens expire in 15 minutes | React Query will refetch, cookies auto-refresh |

### Cross-Cutting Concerns (Prioritized)

| Priority | Concern | Implementation | Owner |
|----------|---------|----------------|-------|
| P0 | Auth State | React Context `AuthProvider` wrapping app | Frontend |
| P0 | API Error Handling | Centralized error handler with toast notifications | Frontend |
| P1 | Loading States | Skeleton components for data-heavy views | Frontend |
| P1 | Form Validation | Zod schemas matching backend rules | Frontend |
| P1 | Double-click Prevention | Disable buttons during mutation `isPending` | Frontend |
| P2 | Trait Display | Reusable `TraitBadge` component | Frontend |

### Risk Mitigations (from Pre-mortem Analysis)

| Risk | Scenario | Mitigation | Test Coverage |
|------|----------|------------|---------------|
| Token Loss | `credentials: 'include'` forgotten | Centralized API client | Integration test |
| Timezone Bug | Cooldown shows wrong time | UTC on server, local on display | Unit test |
| Empty Data Crash | Breeding prediction null | Check `hasInsufficientData` flag | Component test |
| Registration Block | Email verification broken | E2E test full registration flow | E2E test |
| Race Condition | Double-click creates duplicate | `disabled={isPending}` on buttons | Manual QA |

### Security Hardening (from Red Team Analysis)

| Attack Vector | Defense | Status |
|---------------|---------|--------|
| CSRF | `sameSite: 'strict'` cookies | ✅ Backend implemented |
| XSS via Forms | React escaping + Zod validation | ✅ Double defense |
| Token Theft | HttpOnly cookies (no JS access) | ✅ Backend implemented |
| Brute Force | Rate limiting (5/15min) | ✅ Backend implemented |

### MVP Prioritization (from War Room)

```
PHASE 1 - Critical Path (~12 hours):
├── Task 1.1: API Client Setup (2h)
├── Task 1.2: Auth API Hooks (2h)
├── Task 2.1: LoginPage (3-4h)
└── Task 2.2: RegisterPage (4-5h)

PHASE 2 - Complete Auth (~8 hours):
├── Task 2.3: ForgotPasswordPage (2-3h)
├── Task 2.4: ResetPasswordPage (2-3h)
├── Task 2.5: EmailVerificationPage (2-3h)
└── AuthContext Provider integration

PHASE 3 - Feature UIs (~15 hours):
├── Task 3.1: TrainingDashboard (4-5h)
├── Task 3.2: TrainingSessionModal (3-4h)
├── Task 4.1: BreedingCenter (4-5h)
├── Task 4.2: BreedingPairSelector (4-5h)
└── Task 4.3: FoalDevelopmentTracker (3-4h)

PHASE 4 - Polish & Tests (~3 hours):
├── Task 5.1: Test Infrastructure Verification (1-2h)
└── Task 5.2: Frontend Test Setup (1-2h)
```

### First Principles Summary

**What this project IS:**
- A thin UI layer over a complete backend
- Views that fetch, render, mutate, and invalidate
- Cookie-based auth that "just works"

**What this project IS NOT:**
- A complex client-side application
- A system that needs Redux or complex state
- Something that requires building backend logic

**Core Implementation Pattern:**
```typescript
// Every component follows this pattern:
const { data, isLoading, error } = useQuery({...});
const { mutate, isPending } = useMutation({...});

if (isLoading) return <Skeleton />;
if (error) return <ErrorMessage error={error} />;

return (
  <View>
    {/* Render data */}
    <Button disabled={isPending} onClick={() => mutate(...)}>
      Action
    </Button>
  </View>
);
```

---

## Existing Technology Stack (Brownfield)

_Step 3 - Starter Template evaluation not applicable; documenting existing stack_

This is a **brownfield project** with an established, production-ready technology stack. No starter template selection is needed.

### Established Stack

| Layer | Technology | Version | Status |
|-------|------------|---------|--------|
| **Frontend** | React + Vite | React 18, Vite 5 | ~60% complete |
| **Backend** | Node.js + Express | Node 20 LTS, Express 4 | ~95% complete |
| **Database** | PostgreSQL + Prisma | PG 15+, Prisma 5 | Production ready |
| **State** | React Query | TanStack Query v5 | Established pattern |
| **Styling** | TailwindCSS | v3.x | Fully configured |
| **UI Components** | Radix UI | Latest | Available |
| **Icons** | Lucide React | Latest | Installed |
| **Testing** | Jest + RTL | Jest 29 | 942+ tests |

### Why No Starter Template

- ✅ Codebase already exists with 471 backend files
- ✅ 19 frontend components already built
- ✅ Build tooling configured (Vite)
- ✅ Testing infrastructure in place
- ✅ Database schema finalized (29 models)
- ✅ API contracts documented (130+ endpoints)

### Frontend Completion Scope

We are **extending**, not bootstrapping:

```
frontend/src/
├── components/      # 19 existing components
│   ├── ui/          # 9 Radix primitives
│   └── ...          # Domain components
├── hooks/           # To add: API hooks
├── lib/             # To add: api.ts
└── pages/           # To add: Auth pages
```

---

## Core Architectural Decisions

_Step 4 - Confirmed via quick approval (brownfield context)_

### Decision Summary

Most architectural decisions are inherited from the existing production codebase. The following UI/UX patterns were confirmed for frontend completion:

### Confirmed Decisions (ADR-005 through ADR-008)

| ADR | Decision | Choice | Rationale |
|-----|----------|--------|-----------|
| ADR-005 | Error Display | Toast for mutations, inline for forms | Toasts don't block UI; inline errors guide form correction |
| ADR-006 | Loading States | Skeleton for lists, spinner for buttons | Skeletons reduce layout shift; spinners show action feedback |
| ADR-007 | File Organization | Feature-based folders | `/training/`, `/breeding/` keep related code together |
| ADR-008 | Test Organization | Colocated with components | Tests next to source for easy maintenance |

### Inherited Decisions (From Existing Stack)

| Category | Decision | Source |
|----------|----------|--------|
| Database | PostgreSQL 15+ with Prisma 5 ORM | Production backend |
| Data Validation | Zod schemas (frontend) + Express validators (backend) | Existing patterns |
| Authentication | HttpOnly cookies with 15-min access tokens | Backend implemented |
| Authorization | Role-based (User/Admin) via middleware | Backend implemented |
| API Style | REST with JSON, standardized response format | 130+ existing endpoints |
| State Management | React Query v5 (TanStack Query) | ADR-001 |
| Styling | TailwindCSS 3.x + Radix UI primitives | Existing frontend |
| Build | Vite 5 with React 18 | Existing frontend |
| Testing | Jest 29 + React Testing Library | 942+ existing tests |

### File Structure Pattern

```
frontend/src/
├── components/
│   ├── training/           # Feature: Training UI
│   │   ├── TrainingDashboard.tsx
│   │   ├── TrainingDashboard.test.tsx  # Colocated test
│   │   └── TrainingSessionModal.tsx
│   ├── breeding/           # Feature: Breeding UI
│   │   ├── BreedingCenter.tsx
│   │   ├── BreedingPairSelector.tsx
│   │   └── FoalDevelopmentTracker.tsx
│   └── ui/                 # Shared primitives (existing)
├── hooks/
│   └── api/                # API hooks by domain
│       ├── useAuth.ts
│       ├── useTraining.ts
│       └── useBreeding.ts
├── lib/
│   └── api.ts              # Centralized fetch client
└── pages/                  # Route-level components
    ├── LoginPage.tsx
    ├── RegisterPage.tsx
    └── ...
```

### Error Handling Pattern

```typescript
// Mutation errors → Toast notification
const { mutate } = useMutation({
  onError: (error) => toast.error(error.message),
});

// Form validation errors → Inline display
{errors.email && (
  <span className="text-red-500 text-sm">{errors.email}</span>
)}
```

### Loading State Pattern

```typescript
// List loading → Skeleton
if (isLoading) return <HorseListSkeleton count={5} />;

// Button loading → Spinner + disabled
<Button disabled={isPending}>
  {isPending ? <Spinner /> : 'Submit'}
</Button>
```

---

## Implementation Patterns & Consistency Rules

_Step 5 - Enhanced through 5 elicitation methods with party agent review_

### Critical Rules (Must Follow)

| Rule | Rationale |
|------|-----------|
| **NEVER use raw `fetch()`** | Always use `apiRequest()` from `lib/api.ts` - ensures cookies included |
| **No `any` types** | TypeScript strict mode - find proper type or use `unknown` |
| **No `@ts-ignore`** | Fix the type issue instead of suppressing |
| **No direct API URLs** | All endpoints go through centralized client |

### Naming Patterns

**API Client Functions:**
```typescript
// Queries (GET)
fetchHorses()           // List all
fetchHorseById(id)      // Single by ID
fetchTrainingStatus(horseId)  // Nested resource

// Mutations (POST/PUT/DELETE)
createTrainingSession(data)
updateHorse(id, data)
deleteBreedingRecord(id)
```

**React Query Keys:**
```typescript
// Pattern: ['domain', ...identifiers]
['horses']                      // All horses
['horses', horseId]             // Single horse
['training', horseId, 'status'] // Nested resource
['currentUser']                 // Singleton
['breeding', 'predictions', mareId, stallionId]  // Compound
```

**Component & File Naming:**
```
ComponentName.tsx       # PascalCase for components
ComponentName.test.tsx  # Colocated test
useHookName.ts          # camelCase with 'use' prefix
api.ts                  # lowercase for utilities
```

### Import Patterns

**Import Order (enforced by ESLint):**
```typescript
// 1. React
import React, { useState, useEffect } from 'react';

// 2. External libraries
import { useQuery, useMutation } from '@tanstack/react-query';
import { z } from 'zod';

// 3. Internal modules (absolute imports)
import { apiRequest } from '@/lib/api';
import { useAuth } from '@/hooks/api';

// 4. Relative imports
import { TrainingCard } from './TrainingCard';

// 5. Types
import type { Horse, TrainingSession } from '@/types';
```

**Barrel Exports for Hooks:**
```typescript
// hooks/api/index.ts
export { useAuth, useLogin, useLogout, useCurrentUser } from './useAuth';
export { useTraining, useTrainingStatus } from './useTraining';
export { useBreeding, useBreedingPrediction } from './useBreeding';

// Usage
import { useAuth, useTraining } from '@/hooks/api';
```

### Error Handling Hierarchy

| Error Type | Source | Display Method | Example |
|------------|--------|----------------|---------|
| **Validation** | Zod schema | Inline under field | "Email is required" |
| **API 4xx** | Backend validation | Inline OR Toast | "Email already exists" |
| **API 5xx** | Server error | Toast only | "Server error, please retry" |
| **Network** | Connection failed | Toast + Retry button | "Network error" |

**Implementation:**
```typescript
// Zod validation → Inline
const result = schema.safeParse(formData);
if (!result.success) {
  setErrors(result.error.flatten().fieldErrors);
  return; // Don't call API
}

// API errors → Centralized handler
const { mutate } = useMutation({
  mutationFn: createUser,
  onError: (error: ApiError) => {
    if (error.status === 400 && error.errors) {
      // Field-specific errors → Inline
      setErrors(error.errors);
    } else {
      // General errors → Toast
      toast.error(error.message);
    }
  },
});
```

### Loading State Patterns

| Context | Pattern | Component |
|---------|---------|-----------|
| **List loading** | Skeleton | `<HorseListSkeleton count={5} />` |
| **Button action** | Spinner + disabled | `<Button disabled={isPending}>` |
| **Page loading** | Full skeleton | `<PageSkeleton />` |
| **Inline refresh** | Subtle spinner | Background refetch indicator |

### Optimistic Update Pattern

```typescript
const { mutate } = useMutation({
  mutationFn: updateHorse,
  onMutate: async (updatedHorse) => {
    // Cancel in-flight queries
    await queryClient.cancelQueries({ queryKey: ['horses', updatedHorse.id] });

    // Snapshot previous value
    const previous = queryClient.getQueryData(['horses', updatedHorse.id]);

    // Optimistically update
    queryClient.setQueryData(['horses', updatedHorse.id], updatedHorse);

    // Return rollback context
    return { previous };
  },
  onError: (err, updatedHorse, context) => {
    // Rollback on error
    queryClient.setQueryData(['horses', updatedHorse.id], context?.previous);
    toast.error('Update failed');
  },
  onSettled: () => {
    // Refetch to ensure consistency
    queryClient.invalidateQueries({ queryKey: ['horses'] });
  },
});
```

### Testing Patterns

**API Mocking with MSW:**
```typescript
// test/mocks/handlers.ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.post('/api/auth/login', async ({ request }) => {
    const { email } = await request.json();
    if (email === 'test@example.com') {
      return HttpResponse.json({
        status: 'success',
        data: { user: { id: '1', email } }
      });
    }
    return HttpResponse.json(
      { status: 'error', message: 'Invalid credentials' },
      { status: 401 }
    );
  }),
];
```

**Test Data Factories:**
```typescript
// test/factories/horse.ts
export const createMockHorse = (overrides = {}): Horse => ({
  id: 1,
  name: 'Test Horse',
  breed: 'Thoroughbred',
  age: 5,
  stats: { speed: 75, stamina: 80, agility: 70 },
  ...overrides,
});

// Usage in tests
const horse = createMockHorse({ name: 'Custom Name' });
```

**Component Test Pattern:**
```typescript
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '@/test/utils';

describe('TrainingDashboard', () => {
  it('should display horses with training status', async () => {
    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <TrainingDashboard userId="1" />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Test Horse')).toBeInTheDocument();
    });
  });
});
```

### Form Implementation Pattern

```typescript
// 1. Define Zod schema
const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Min 8 characters'),
});

// 2. Component with form state
const LoginPage = () => {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { mutate, isPending } = useLogin();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    // 3. Validate with Zod
    const result = loginSchema.safeParse(formData);
    if (!result.success) {
      setErrors(result.error.flatten().fieldErrors);
      return;
    }

    // 4. Clear errors and submit
    setErrors({});
    mutate(result.data);
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        value={formData.email}
        onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
      />
      {errors.email && <span className="text-red-500">{errors.email}</span>}

      <Button type="submit" disabled={isPending}>
        {isPending ? <Spinner /> : 'Login'}
      </Button>
    </form>
  );
};
```

### Anti-Patterns (Never Do)

| Anti-Pattern | Why It's Bad | Correct Pattern |
|--------------|--------------|-----------------|
| `fetch('/api/...')` | Missing credentials | `apiRequest('/api/...')` |
| `any` type | Loses type safety | Find correct type |
| `// @ts-ignore` | Hides real issues | Fix the type |
| `useState` for server data | No caching/sync | `useQuery` |
| Inline styles | Hard to maintain | Tailwind classes |
| `console.log` in production | Performance/security | Remove or use logger |

---

## Project Structure & Boundaries

_Step 6 - Enhanced through 5 elicitation methods with party agent review_

### Complete Frontend Directory Structure

```
frontend/src/
├── components/
│   ├── ui/                              # EXISTING - Radix primitives (9)
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── input.tsx
│   │   ├── select.tsx
│   │   ├── dialog.tsx
│   │   ├── tabs.tsx
│   │   ├── toast.tsx
│   │   ├── skeleton.tsx
│   │   └── index.ts
│   │
│   ├── training/                        # NEW - Training feature
│   │   ├── TrainingDashboard.tsx
│   │   ├── TrainingDashboard.test.tsx
│   │   ├── TrainingSessionModal.tsx
│   │   ├── TrainingSessionModal.test.tsx
│   │   ├── TrainingCard.tsx
│   │   ├── TrainingCard.test.tsx
│   │   ├── DisciplineSelector.tsx       # 23-discipline picker
│   │   ├── DisciplineSelector.test.tsx
│   │   └── index.ts
│   │
│   ├── breeding/                        # NEW - Breeding feature
│   │   ├── BreedingCenter.tsx
│   │   ├── BreedingCenter.test.tsx
│   │   ├── BreedingPairSelector.tsx
│   │   ├── BreedingPairSelector.test.tsx
│   │   ├── FoalDevelopmentTracker.tsx
│   │   ├── FoalDevelopmentTracker.test.tsx
│   │   ├── TraitBadge.tsx               # Reusable trait display
│   │   ├── TraitBadge.test.tsx
│   │   └── index.ts
│   │
│   ├── auth/                            # NEW - Auth components
│   │   ├── AuthLayout.tsx               # Shared auth page layout
│   │   ├── AuthLayout.test.tsx
│   │   ├── PasswordStrength.tsx         # Password strength indicator
│   │   ├── PasswordStrength.test.tsx
│   │   └── index.ts
│   │
│   ├── shared/                          # NEW - Shared UI patterns
│   │   ├── Skeleton.tsx                 # Loading skeletons
│   │   ├── ErrorMessage.tsx             # Error display
│   │   ├── Toast.tsx                    # Toast notifications
│   │   ├── CooldownTimer.tsx            # Training cooldown display
│   │   ├── CooldownTimer.test.tsx
│   │   └── index.ts
│   │
│   ├── stable/                          # NEW - Cross-domain components
│   │   ├── HorseOverview.tsx            # Training + breeding + stats
│   │   ├── HorseOverview.test.tsx
│   │   └── index.ts
│   │
│   ├── CompetitionBrowser.tsx           # EXISTING
│   ├── MyGroomsDashboard.tsx            # EXISTING
│   ├── UserDashboard.tsx                # EXISTING
│   └── ... (16 more existing)
│
├── contexts/                            # NEW - React contexts
│   ├── AuthContext.tsx                  # Auth state provider
│   ├── AuthContext.test.tsx
│   └── index.ts
│
├── hooks/
│   └── api/                             # NEW - API hooks
│       ├── useAuth.ts
│       ├── useAuth.test.ts
│       ├── useTraining.ts
│       ├── useTraining.test.ts
│       ├── useBreeding.ts
│       ├── useBreeding.test.ts
│       ├── useHorses.ts
│       ├── useHorses.test.ts
│       └── index.ts                     # Barrel export
│
├── lib/                                 # NEW - Utilities
│   ├── api.ts                           # Centralized fetch client
│   ├── api.test.ts
│   ├── schemas.ts                       # Zod validation schemas
│   ├── constants.ts                     # Disciplines, error messages
│   └── utils.ts                         # EXISTING
│
├── pages/                               # NEW - Route pages
│   ├── LoginPage.tsx
│   ├── LoginPage.test.tsx
│   ├── RegisterPage.tsx
│   ├── RegisterPage.test.tsx
│   ├── ForgotPasswordPage.tsx
│   ├── ForgotPasswordPage.test.tsx
│   ├── ResetPasswordPage.tsx
│   ├── ResetPasswordPage.test.tsx
│   ├── EmailVerificationPage.tsx
│   ├── EmailVerificationPage.test.tsx
│   └── index.ts
│
├── types/                               # NEW - TypeScript types
│   ├── api.ts                           # API response types
│   ├── auth.ts                          # Auth-related types
│   ├── horse.ts                         # Horse/training types
│   ├── breeding.ts                      # Breeding types
│   ├── training.ts                      # Training types
│   └── index.ts
│
├── test/                                # NEW - Test utilities
│   ├── mocks/
│   │   ├── handlers.ts                  # MSW handlers
│   │   └── server.ts                    # MSW server setup
│   ├── factories/
│   │   ├── horse.ts
│   │   ├── user.ts
│   │   ├── training.ts
│   │   └── index.ts
│   ├── setup.ts                         # Test setup
│   └── utils.tsx                        # Test helpers (render with providers)
│
├── App.tsx                              # EXISTING - Update routes
├── main.tsx                             # EXISTING
└── vite-env.d.ts                        # EXISTING
```

### Requirements to Structure Mapping

| Requirement | Primary Location | Supporting Files |
|-------------|------------------|------------------|
| **Login** | `pages/LoginPage.tsx` | `hooks/api/useAuth.ts`, `lib/schemas.ts` |
| **Register** | `pages/RegisterPage.tsx` | `components/auth/PasswordStrength.tsx` |
| **Password Reset** | `pages/ForgotPasswordPage.tsx`, `ResetPasswordPage.tsx` | `hooks/api/useAuth.ts` |
| **Email Verify** | `pages/EmailVerificationPage.tsx` | `hooks/api/useAuth.ts` |
| **Training Dashboard** | `components/training/TrainingDashboard.tsx` | `hooks/api/useTraining.ts` |
| **Training Session** | `components/training/TrainingSessionModal.tsx` | `DisciplineSelector.tsx` |
| **Breeding Center** | `components/breeding/BreedingCenter.tsx` | `hooks/api/useBreeding.ts` |
| **Pair Selection** | `components/breeding/BreedingPairSelector.tsx` | `TraitBadge.tsx` |
| **Foal Tracking** | `components/breeding/FoalDevelopmentTracker.tsx` | `hooks/api/useBreeding.ts` |

### Architectural Boundaries

```
┌─────────────────────────────────────────────────────────────────────┐
│                           FRONTEND                                   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                     contexts/AuthContext                     │   │
│  │                  (Wraps entire application)                  │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                               │                                     │
│  ┌──────────────┐  ┌──────────┴───────┐  ┌──────────────┐         │
│  │    Pages     │  │    Components    │  │    Shared    │         │
│  │  (Routes)    │──│   (Features)     │──│  (Cross-cut) │         │
│  │              │  │                  │  │              │         │
│  │ • Login      │  │ • training/      │  │ • Skeleton   │         │
│  │ • Register   │  │ • breeding/      │  │ • Toast      │         │
│  │ • Reset      │  │ • stable/        │  │ • Cooldown   │         │
│  └──────┬───────┘  └────────┬─────────┘  └──────────────┘         │
│         │                   │                                       │
│  ┌──────┴───────────────────┴──────────────────────────────────┐   │
│  │                      hooks/api/                              │   │
│  │  useAuth • useTraining • useBreeding • useHorses            │   │
│  └──────────────────────────┬──────────────────────────────────┘   │
│                             │                                       │
│  ┌──────────────────────────┴──────────────────────────────────┐   │
│  │                        lib/api.ts                            │   │
│  │              credentials: 'include' ALWAYS                   │   │
│  │                  (SINGLE BOUNDARY)                           │   │
│  └──────────────────────────┬──────────────────────────────────┘   │
└─────────────────────────────┼───────────────────────────────────────┘
                              │
                        HTTP + Cookies
                              │
┌─────────────────────────────┼───────────────────────────────────────┐
│                       BACKEND (Existing)                             │
│  ┌──────────────┐  ┌───────┴────────┐  ┌──────────────┐            │
│  │   Routes     │──│  Controllers   │──│   Services   │            │
│  │  /api/*      │  │                │  │              │            │
│  └──────────────┘  └────────────────┘  └──────┬───────┘            │
│                                               │                      │
│                                        ┌──────┴───────┐             │
│                                        │    Prisma    │             │
│                                        └──────┬───────┘             │
└───────────────────────────────────────────────┼─────────────────────┘
                                                │
                                         ┌──────┴───────┐
                                         │  PostgreSQL  │
                                         └──────────────┘
```

### Dependency Flow (One-Way)

```
pages → components → hooks/api → lib/api → Backend
                  ↘           ↗
                    contexts
                  ↗           ↘
               types ← lib/schemas ← lib/constants
```

**Rule:** Dependencies flow DOWN and RIGHT only. Never import upward.

### Barrel Export Pattern

Every folder with multiple files MUST have an `index.ts`:

```typescript
// components/training/index.ts
export { TrainingDashboard } from './TrainingDashboard';
export { TrainingSessionModal } from './TrainingSessionModal';
export { TrainingCard } from './TrainingCard';
export { DisciplineSelector } from './DisciplineSelector';

// Usage
import { TrainingDashboard, TrainingCard } from '@/components/training';
```

### File Count Summary

| Category | Files | Tests | Total |
|----------|-------|-------|-------|
| Pages | 5 | 5 | 10 |
| Auth Components | 2 | 2 | 4 |
| Training Components | 4 | 4 | 8 |
| Breeding Components | 4 | 4 | 8 |
| Shared Components | 4 | 1 | 5 |
| Stable Components | 1 | 1 | 2 |
| Contexts | 1 | 1 | 2 |
| Hooks | 4 | 4 | 8 |
| Lib | 4 | 1 | 5 |
| Types | 5 | 0 | 5 |
| Test Utils | 5 | 0 | 5 |
| **TOTAL** | **39** | **23** | **62** |

### Future Extensibility

Structure handles new features naturally:

```
components/
├── training/       # Exists
├── breeding/       # Exists
├── shows/          # Future: same pattern
├── marketplace/    # Future: same pattern
└── stable/         # Cross-domain stays here
```

---

## Architecture Validation Results

_Step 7 - Comprehensive validation completed_

### Coherence Validation ✅

**Decision Compatibility:** All 8 ADRs work together without conflicts. React Query handles server state, Zod handles validation, TailwindCSS handles styling - no overlapping responsibilities.

**Pattern Consistency:** All implementation patterns directly support the ADR decisions. Naming conventions are consistent (camelCase for functions, PascalCase for components).

**Structure Alignment:** Project structure enables all patterns. Feature-based organization with barrel exports supports clean imports.

### Requirements Coverage ✅

| Requirement Category | Coverage | Components |
|---------------------|----------|------------|
| Authentication UI | 100% | 5 pages + AuthContext |
| Training UI | 100% | Dashboard + Modal + Selector |
| Breeding UI | 100% | Center + Selector + Tracker |
| API Integration | 100% | lib/api.ts + 4 hook files |
| Test Infrastructure | 100% | MSW + factories + setup |

### Implementation Readiness ✅

| Criterion | Status |
|-----------|--------|
| All critical decisions documented | ✅ 8 ADRs |
| Implementation patterns comprehensive | ✅ 15+ patterns |
| Code examples provided | ✅ Every pattern |
| Project structure complete | ✅ 62 files mapped |
| Boundaries clearly defined | ✅ Diagram + flow |

### Architecture Completeness Checklist

**✅ Requirements Analysis**
- [x] Project context analyzed (10 PRD documents)
- [x] Scale assessed (Medium complexity)
- [x] Technical constraints identified (5 constraints)
- [x] Cross-cutting concerns mapped (6 priorities)
- [x] Risk mitigations defined (5 risks)

**✅ Architectural Decisions**
- [x] ADR-001: State Management → React Query
- [x] ADR-002: Form Handling → useState + Zod
- [x] ADR-003: Auth Storage → HttpOnly cookies
- [x] ADR-004: API Client → Centralized fetch
- [x] ADR-005: Error Display → Toast + Inline
- [x] ADR-006: Loading States → Skeleton + Spinner
- [x] ADR-007: File Organization → Feature-based
- [x] ADR-008: Test Organization → Colocated

**✅ Implementation Patterns**
- [x] Naming conventions (API, Query keys, Components, Files)
- [x] Import patterns (Order, Barrel exports)
- [x] Error handling hierarchy (Validation/4xx/5xx/Network)
- [x] Loading state patterns (Skeleton/Spinner/Full)
- [x] Form implementation pattern
- [x] Optimistic update pattern
- [x] Testing patterns (MSW, factories, component tests)
- [x] Anti-patterns documented

**✅ Project Structure**
- [x] Complete directory structure (62 files)
- [x] Component boundaries established
- [x] Dependency flow documented (one-way)
- [x] Requirements-to-structure mapping
- [x] Future extensibility confirmed

### Validation Metrics

| Metric | Value |
|--------|-------|
| ADRs Documented | 8 |
| Patterns Defined | 15+ |
| Files Mapped | 62 |
| Elicitation Methods Used | 15 |
| Party Agent Reviews | 5 |
| Requirements Covered | 100% |

### Architecture Readiness Assessment

**Overall Status:** 🟢 READY FOR IMPLEMENTATION

**Confidence Level:** HIGH
- Validated through 15 elicitation methods
- Reviewed by 5 party agents (Architect, Developer, PM, Test Architect, UX Designer)
- All conflicts and gaps resolved

**Key Strengths:**
1. Thin UI layer - simple "fetch → render → mutate → invalidate" pattern
2. Single auth boundary - all cookies in `lib/api.ts`
3. Feature-based organization - easy navigation
4. Comprehensive testing strategy - MSW + factories
5. Future-proof structure - handles new features naturally

---

## Implementation Handoff

### AI Agent Guidelines

1. **Follow ADRs exactly** - No deviations from documented decisions
2. **Use patterns consistently** - Same approach across all components
3. **Respect boundaries** - Dependencies flow one way only
4. **Never bypass auth** - Always use `apiRequest()`, never raw `fetch()`
5. **Colocate tests** - Test file next to source file

### Implementation Order

```
PHASE 1 - Foundation:
├── lib/api.ts              (Centralized fetch client)
├── lib/schemas.ts          (Zod validation schemas)
├── lib/constants.ts        (Disciplines, error messages)
├── types/*.ts              (TypeScript definitions)
└── contexts/AuthContext.tsx (Auth state provider)

PHASE 2 - Auth Pages:
├── hooks/api/useAuth.ts    (Auth API hooks)
├── pages/LoginPage.tsx
├── pages/RegisterPage.tsx
├── pages/ForgotPasswordPage.tsx
├── pages/ResetPasswordPage.tsx
└── pages/EmailVerificationPage.tsx

PHASE 3 - Training UI:
├── hooks/api/useTraining.ts
├── components/training/TrainingDashboard.tsx
├── components/training/TrainingSessionModal.tsx
└── components/training/DisciplineSelector.tsx

PHASE 4 - Breeding UI:
├── hooks/api/useBreeding.ts
├── components/breeding/BreedingCenter.tsx
├── components/breeding/BreedingPairSelector.tsx
└── components/breeding/FoalDevelopmentTracker.tsx

PHASE 5 - Polish:
├── components/shared/*.tsx
├── test/mocks/handlers.ts
└── test/factories/*.ts
```

### Quick Reference for Agents

| Question | Answer |
|----------|--------|
| Where do auth pages go? | `frontend/src/pages/` |
| Where do training components go? | `frontend/src/components/training/` |
| Where do API hooks go? | `frontend/src/hooks/api/` |
| How to make API calls? | `import { apiRequest } from '@/lib/api'` |
| How to validate forms? | Zod schema → `safeParse()` → show errors |
| How to handle loading? | `if (isLoading) return <Skeleton />` |
| How to handle errors? | Validation=inline, API=toast, 5xx=toast |

---

## Architecture Completion Summary

_Step 8 - Workflow finalized_

### Workflow Completion

| Metric | Value |
|--------|-------|
| **Status** | ✅ COMPLETE |
| **Steps Completed** | 8/8 |
| **Date Completed** | 2025-12-02 |
| **Document Location** | `docs/architecture.md` |

### Final Deliverables

**📋 Architecture Decision Document**
- 8 ADRs with clear rationale
- 15+ implementation patterns
- 62 files mapped in project structure
- 100% requirements coverage

**🔧 AI Agent Implementation Guide**
- Technology stack with verified versions
- Consistency rules preventing conflicts
- Code examples for every pattern
- Anti-patterns to avoid

**✅ Validation Results**
- Coherence: All decisions compatible
- Coverage: All requirements supported
- Readiness: Implementation-ready

### Success Factors

1. **Clear Decision Framework** - 8 ADRs guide all technical choices
2. **Consistency Guarantee** - Patterns ensure AI agents produce compatible code
3. **Complete Coverage** - Every requirement mapped to architecture
4. **Brownfield Optimized** - Built on existing production-ready backend

### Document Stats

| Category | Count |
|----------|-------|
| PRD Documents Analyzed | 10 |
| ADRs Created | 8 |
| Patterns Defined | 15+ |
| Files Mapped | 62 |
| Elicitation Methods Used | 15 |
| Party Agent Reviews | 3 rounds |

---

**Architecture Status:** 🟢 READY FOR IMPLEMENTATION

**Next Phase:** Begin implementation following Phase 1 → Phase 5 order

---

_Generated by BMAD Architecture Workflow_
_Validated through Advanced Elicitation + Party Mode collaboration_
