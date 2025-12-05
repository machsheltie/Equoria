# Epics & Stories: Frontend Completion

> **NOTE:** This document represents a **frontend-focused MVP breakdown** that is separate from the master epic structure defined in `docs/epics.md`. Epic numbering here is independent and should not be confused with the master epic IDs tracked in `sprint-status.yaml`. This breakdown focuses on frontend implementation tasks for achieving a minimum viable product.

**Created:** 2025-12-02
**Status:** Ready for Development
**Workflow:** BMAD create-epics-and-stories
**Source Documents:**
- PRD-02-Core-Features.md
- PRD-03-Gameplay-Systems.md
- Architecture.md (complete)
- tech-spec-comprehensive-frontend-completion.md
- tech-spec-elicitation-addendum.md

---

## Executive Summary

This document breaks down the Equoria Frontend Completion into **5 user-value epics** with **14 stories**. Total estimated effort: **27-35 hours**.

**Key Insight:** This is a thin UI layer over a production-ready backend. We're building views, not business logic.

---

## FR Inventory (Functional Requirements)

| FR ID | Requirement | Source | Epic |
|-------|-------------|--------|------|
| FR-001 | User can register with email/password | PRD-02 | Epic 1 |
| FR-002 | User can login with email/password | PRD-02 | Epic 1 |
| FR-003 | User can verify email via link | PRD-02 | Epic 1 |
| FR-004 | User can request password reset | PRD-02 | Epic 2 |
| FR-005 | User can reset password via token | PRD-02 | Epic 2 |
| FR-006 | User can view horses ready for training | PRD-03 | Epic 3 |
| FR-007 | User can select discipline and train horse | PRD-03 | Epic 3 |
| FR-008 | User can see training results and cooldown | PRD-03 | Epic 3 |
| FR-009 | User can view breeding-eligible horses | PRD-03 | Epic 4 |
| FR-010 | User can compare breeding pairs | PRD-03 | Epic 4 |
| FR-011 | User can see breeding prediction | PRD-03 | Epic 4 |
| FR-012 | User can track foal development | PRD-03 | Epic 4 |
| FR-013 | All API calls include cookie credentials | Architecture | Epic 5 |
| FR-014 | Frontend tests verify core functionality | Architecture | Epic 5 |

---

## Epic Overview

| Epic | Name | Stories | Hours | Priority | Dependencies |
|------|------|---------|-------|----------|--------------|
| E1 | Player Onboarding | 3 | 9-12 | P0 (Critical) | E5 (partial) |
| E2 | Account Recovery | 2 | 4-6 | P1 (High) | E1 |
| E3 | Horse Training Experience | 2 | 6-8 | P1 (High) | E5, E1 |
| E4 | Breeding Experience | 3 | 8-10 | P2 (Medium) | E5, E1 |
| E5 | Technical Foundation | 4 | 5-7 | P0 (Critical) | None |

**Recommended Order:** E5 → E1 → E2 → E3 → E4

---

## Epic 5: Technical Foundation

**Priority:** P0 - Critical (Build First)
**Estimated Hours:** 5-7
**User Value:** Enables all frontend features to communicate with backend
**Dependencies:** None

### Story 5.1: API Client with Cookie Authentication

**As a** frontend developer
**I want** a centralized API client that includes credentials on all requests
**So that** authentication works seamlessly across all features

**Acceptance Criteria:**
- [ ] AC1: `apiRequest()` function exists in `frontend/src/lib/api.ts`
- [ ] AC2: All requests include `credentials: 'include'` header
- [ ] AC3: API errors throw `ApiError` with status code and message
- [ ] AC4: 401 errors dispatch `auth:unauthorized` event
- [ ] AC5: 429 errors show rate-limit toast notification
- [ ] AC6: Network errors show connection error toast

**Technical Notes:**
- Base URL from `VITE_API_URL` env variable
- Response type: `ApiResponse<T>` with status, message, data, errors

**Files to Create:**
- `frontend/src/lib/api.ts`
- `frontend/src/types/api.ts`

**Estimated Hours:** 2-3

---

### Story 5.2: Auth API Hooks

**As a** frontend developer
**I want** React Query hooks for all authentication operations
**So that** components can easily interact with auth endpoints

**Acceptance Criteria:**
- [ ] AC1: `useLogin()` mutation calls POST `/api/auth/login`
- [ ] AC2: `useRegister()` mutation calls POST `/api/auth/register`
- [ ] AC3: `useCurrentUser()` query calls GET `/api/auth/me`
- [ ] AC4: `useLogout()` mutation calls POST `/api/auth/logout`
- [ ] AC5: `useForgotPassword()` mutation calls POST `/api/auth/forgot-password`
- [ ] AC6: `useResetPassword()` mutation calls POST `/api/auth/reset-password`
- [ ] AC7: Login success invalidates `['currentUser']` query
- [ ] AC8: Logout success clears entire query cache

**Files to Create:**
- `frontend/src/hooks/api/useAuth.ts`
- `frontend/src/hooks/api/__tests__/useAuth.test.tsx`

**Estimated Hours:** 2-3

---

### Story 5.3: Auth Context Provider

**As a** frontend developer
**I want** a React context that provides current user state
**So that** components can check authentication status

**Acceptance Criteria:**
- [ ] AC1: `AuthProvider` wraps app and provides `AuthContext`
- [ ] AC2: `useAuth()` hook returns `{ user, isLoading, isAuthenticated, logout }`
- [ ] AC3: Context listens for `auth:unauthorized` events and redirects to `/login`
- [ ] AC4: `isAuthenticated` is `true` when user object exists
- [ ] AC5: Error when `useAuth()` called outside provider

**Files to Create:**
- `frontend/src/contexts/AuthContext.tsx`

**Estimated Hours:** 1-2

---

### Story 5.4: Validation Schemas

**As a** frontend developer
**I want** Zod validation schemas matching backend rules
**So that** form validation is consistent and type-safe

**Acceptance Criteria:**
- [ ] AC1: `loginSchema` validates email format and non-empty password
- [ ] AC2: `registerSchema` validates username (3-30 chars, alphanumeric + underscore)
- [ ] AC3: `registerSchema` validates password (8+ chars, uppercase, lowercase, number)
- [ ] AC4: `registerSchema` validates password confirmation match
- [ ] AC5: Type exports: `LoginFormData`, `RegisterFormData`, etc.
- [ ] AC6: Error messages are user-friendly (not technical)

**Files to Create:**
- `frontend/src/lib/validations/auth.ts`

**Estimated Hours:** 1

---

## Epic 1: Player Onboarding

**Priority:** P0 - Critical Path
**Estimated Hours:** 9-12
**User Value:** New players can create accounts and start playing
**Dependencies:** Epic 5 (API Client)

### Story 1.1: Login Page

**As a** returning player
**I want** to log in with my email and password
**So that** I can access my stable and horses

**Acceptance Criteria:**
- [ ] AC1: Page renders email input, password input, and "Log In" button
- [ ] AC2: Email field validates format before submission
- [ ] AC3: Invalid credentials show inline error message
- [ ] AC4: Button shows loading state during API call (`isPending`)
- [ ] AC5: Successful login redirects to `/dashboard`
- [ ] AC6: "Forgot Password?" link navigates to `/forgot-password`
- [ ] AC7: "Create Account" link navigates to `/register`
- [ ] AC8: Rate limit error (429) shows toast with wait time

**API Integration:**
- POST `/api/auth/login` with `{ email, password }`
- Cookies set automatically by backend

**Files to Create:**
- `frontend/src/pages/LoginPage.tsx`
- `frontend/src/pages/__tests__/LoginPage.test.tsx`

**Estimated Hours:** 3-4

---

### Story 1.2: Registration Page

**As a** new player
**I want** to create an account with my details
**So that** I can start building my stable

**Acceptance Criteria:**
- [ ] AC1: Page renders username, email, password, confirm password, first name, last name fields
- [ ] AC2: Password shows strength indicator (requirements checklist)
- [ ] AC3: Password confirmation validates match in real-time
- [ ] AC4: Username validates: 3-30 chars, alphanumeric + underscore only
- [ ] AC5: Terms checkbox must be checked before submission
- [ ] AC6: Button disabled during submission (`isPending`)
- [ ] AC7: Success shows message: "Check your email to verify your account"
- [ ] AC8: "Already have an account?" link navigates to `/login`

**API Integration:**
- POST `/api/auth/register` with `{ username, email, password, firstName, lastName }`

**Files to Create:**
- `frontend/src/pages/RegisterPage.tsx`
- `frontend/src/pages/__tests__/RegisterPage.test.tsx`

**Estimated Hours:** 4-5

---

### Story 1.3: Email Verification Page

**As a** new player
**I want** to verify my email address from the link I received
**So that** I can complete my registration

**Acceptance Criteria:**
- [ ] AC1: Page reads `token` from URL query parameter
- [ ] AC2: Auto-verifies on mount by calling verify endpoint
- [ ] AC3: Success shows "Email verified!" with redirect to `/login`
- [ ] AC4: Invalid/expired token shows error with "Resend verification" button
- [ ] AC5: Resend button calls resend endpoint and shows confirmation
- [ ] AC6: Loading state shown while verification in progress

**API Integration:**
- GET `/api/auth/verify-email?token=xxx`
- POST `/api/auth/resend-verification`

**Files to Create:**
- `frontend/src/pages/EmailVerificationPage.tsx`
- `frontend/src/pages/__tests__/EmailVerificationPage.test.tsx`

**Estimated Hours:** 2-3

---

## Epic 2: Account Recovery

**Priority:** P1 - High
**Estimated Hours:** 4-6
**User Value:** Players who forget passwords can regain access
**Dependencies:** Epic 1 (Player Onboarding)

### Story 2.1: Forgot Password Page

**As a** player who forgot my password
**I want** to request a password reset link
**So that** I can recover access to my account

**Acceptance Criteria:**
- [ ] AC1: Page renders email input and "Send Reset Link" button
- [ ] AC2: Email validates format before submission
- [ ] AC3: Success message shown regardless of email existence (security)
- [ ] AC4: Message: "If an account exists with this email, you'll receive a reset link"
- [ ] AC5: "Back to Login" link navigates to `/login`
- [ ] AC6: Button disabled during submission

**API Integration:**
- POST `/api/auth/forgot-password` with `{ email }`

**Files to Create:**
- `frontend/src/pages/ForgotPasswordPage.tsx`
- `frontend/src/pages/__tests__/ForgotPasswordPage.test.tsx`

**Estimated Hours:** 2-3

---

### Story 2.2: Reset Password Page

**As a** player with a password reset link
**I want** to set a new password
**So that** I can log in again

**Acceptance Criteria:**
- [ ] AC1: Page reads `token` from URL query parameter
- [ ] AC2: Page renders new password, confirm password, and "Reset Password" button
- [ ] AC3: Password requirements displayed (8+ chars, uppercase, lowercase, number)
- [ ] AC4: Password confirmation validates match
- [ ] AC5: Invalid/expired token shows error with link to `/forgot-password`
- [ ] AC6: Success redirects to `/login` with toast: "Password reset successful"
- [ ] AC7: Button disabled during submission

**API Integration:**
- POST `/api/auth/reset-password` with `{ token, password }`

**Files to Create:**
- `frontend/src/pages/ResetPasswordPage.tsx`
- `frontend/src/pages/__tests__/ResetPasswordPage.test.tsx`

**Estimated Hours:** 2-3

---

## Epic 3: Horse Training Experience

**Priority:** P1 - High
**Estimated Hours:** 6-8
**User Value:** Players can improve their horses for competitions
**Dependencies:** Epic 5 (API Client), Epic 1 (Auth)

### Story 3.1: Training Dashboard

**As a** player
**I want** to see all my horses and their training status
**So that** I can decide which horse to train next

**Acceptance Criteria:**
- [ ] AC1: Dashboard lists all user's horses with name, age, and breed
- [ ] AC2: Each horse shows training eligibility status (eligible/cooldown)
- [ ] AC3: Cooldown horses show countdown timer: "X days remaining"
- [ ] AC4: Filter toggle: "Show All" / "Ready to Train"
- [ ] AC5: Clicking "Train" opens TrainingSessionModal for that horse
- [ ] AC6: Horses under age 3 show "Too young to train"
- [ ] AC7: Loading skeleton shown while fetching horses
- [ ] AC8: Empty state: "No horses yet" with link to acquire horses

**API Integration:**
- GET `/api/horses` - Get user's horses
- GET `/api/training/status/:horseId` - Get training status per horse

**Files to Create:**
- `frontend/src/components/training/TrainingDashboard.tsx`
- `frontend/src/components/training/__tests__/TrainingDashboard.test.tsx`
- `frontend/src/hooks/api/useTraining.ts`

**Estimated Hours:** 4-5

---

### Story 3.2: Training Session Modal

**As a** player
**I want** to select a discipline and train my horse
**So that** my horse's stats improve for competitions

**Acceptance Criteria:**
- [ ] AC1: Modal shows horse name and current stats
- [ ] AC2: Discipline dropdown with all 23 disciplines (grouped by category)
- [ ] AC3: Categories: English, Western, Racing, Specialty
- [ ] AC4: Selecting discipline shows eligibility check result
- [ ] AC5: Expected stat gains preview shown (from API)
- [ ] AC6: "Train" button disabled if ineligible or `isPending`
- [ ] AC7: Results display: stat gains, XP earned, new cooldown
- [ ] AC8: "Close" button returns to dashboard with refetched data
- [ ] AC9: Error state: "Training failed" with retry option

**API Integration:**
- GET `/api/training/eligibility/:horseId/:discipline`
- POST `/api/training/train` with `{ horseId, discipline }`

**Files to Create:**
- `frontend/src/components/training/TrainingSessionModal.tsx`
- `frontend/src/components/training/__tests__/TrainingSessionModal.test.tsx`
- `frontend/src/components/training/DisciplineSelector.tsx`
- `frontend/src/constants/disciplines.ts`
- `frontend/src/constants/trainingRules.ts`

**Estimated Hours:** 3-4

---

## Epic 4: Breeding Experience

**Priority:** P2 - Medium
**Estimated Hours:** 8-10
**User Value:** Players can create new horses with desirable traits
**Dependencies:** Epic 5 (API Client), Epic 1 (Auth)

### Story 4.1: Breeding Center

**As a** player
**I want** to see my breeding-eligible horses
**So that** I can plan my breeding strategy

**Acceptance Criteria:**
- [ ] AC1: Tab navigation: "My Mares" | "Stud Marketplace" | "History"
- [ ] AC2: "My Mares" shows user's female horses with breeding eligibility
- [ ] AC3: Mares show: name, age, breed, breeding quality, trait summary
- [ ] AC4: Ineligible mares show reason (too young/too old)
- [ ] AC5: "Select Mare" button opens BreedingPairSelector
- [ ] AC6: "Stud Marketplace" shows available stallions (placeholder for now)
- [ ] AC7: "History" shows past breeding records
- [ ] AC8: Loading skeletons for each tab

**API Integration:**
- GET `/api/horses?sex=female` - Get user's mares
- GET `/api/horses/:id/breeding-data` - Get breeding info per horse

**Files to Create:**
- `frontend/src/components/breeding/BreedingCenter.tsx`
- `frontend/src/components/breeding/__tests__/BreedingCenter.test.tsx`
- `frontend/src/hooks/api/useBreeding.ts`
- `frontend/src/constants/breedingRules.ts`

**Estimated Hours:** 4-5

---

### Story 4.2: Breeding Pair Selector

**As a** player
**I want** to compare a mare and stallion side-by-side
**So that** I can choose the best breeding pair

**Acceptance Criteria:**
- [ ] AC1: Side-by-side display: mare (left) vs stallion (right)
- [ ] AC2: Each side shows: name, age, stats, trait badges
- [ ] AC3: Stats comparison with visual bars (who's higher)
- [ ] AC4: Temperament compatibility score displayed
- [ ] AC5: "Predict Offspring" button fetches prediction
- [ ] AC6: Prediction shows: trait probabilities, rare traits, warnings
- [ ] AC7: Inbreeding warning if coefficient > 6.25%
- [ ] AC8: "Breed" button initiates breeding (with confirmation)
- [ ] AC9: "Insufficient data" message if prediction unavailable

**API Integration:**
- GET `/api/breeding/predict?stallionId=X&mareId=Y`
- GET `/api/breeding/compatibility/:stallionId/:mareId`
- POST `/api/breeding/breed` with `{ stallionId, mareId }`

**Files to Create:**
- `frontend/src/components/breeding/BreedingPairSelector.tsx`
- `frontend/src/components/breeding/__tests__/BreedingPairSelector.test.tsx`
- `frontend/src/components/breeding/BreedingPredictionDisplay.tsx`
- `frontend/src/types/breeding.ts`

**Estimated Hours:** 4-5

---

### Story 4.3: Foal Development Tracker

**As a** player
**I want** to track my foal's development progress
**So that** I can optimize their growth into adult horses

**Acceptance Criteria:**
- [ ] AC1: Display foal name, age, and development stage
- [ ] AC2: Progress bar showing development percentage
- [ ] AC3: Bonding meter (0-100) with current level
- [ ] AC4: Stress meter (0-100) with warning if high
- [ ] AC5: Available enrichment activities list
- [ ] AC6: Activity buttons disabled during cooldown
- [ ] AC7: Groom assignment display (if assigned)
- [ ] AC8: Activity history log (last 10 activities)
- [ ] AC9: Completing activity updates meters and logs

**API Integration:**
- GET `/api/foals/:foalId/development` - Get development data
- POST `/api/foals/:foalId/activity` with `{ activityType }`

**Files to Create:**
- `frontend/src/components/breeding/FoalDevelopmentTracker.tsx`
- `frontend/src/components/breeding/__tests__/FoalDevelopmentTracker.test.tsx`
- `frontend/src/types/foal.ts`

**Estimated Hours:** 3-4

---

## NFR Tracking

| NFR | Requirement | Implementation | Verification |
|-----|-------------|----------------|--------------|
| NFR-001 | 80% test coverage | Colocated tests for all components | CI coverage gate |
| NFR-002 | <200ms API latency | Backend handles | Load testing |
| NFR-003 | Loading states | Skeleton/spinner components | Manual QA |
| NFR-004 | Error handling | Toast + inline patterns | Test coverage |
| NFR-005 | Accessibility | Semantic HTML, ARIA labels | Lighthouse audit |

---

## Route Configuration

Add to `frontend/src/App.tsx`:

```typescript
// Auth Routes (unauthenticated only)
<Route path="/login" element={<LoginPage />} />
<Route path="/register" element={<RegisterPage />} />
<Route path="/forgot-password" element={<ForgotPasswordPage />} />
<Route path="/reset-password" element={<ResetPasswordPage />} />
<Route path="/verify-email" element={<EmailVerificationPage />} />

// Protected Routes (authenticated only)
<Route path="/training" element={<TrainingDashboard />} />
<Route path="/breeding" element={<BreedingCenter />} />
```

---

## Definition of Done (All Stories)

- [ ] Code compiles without TypeScript errors
- [ ] Component renders without console errors
- [ ] All acceptance criteria verified
- [ ] Tests written and passing (80%+ coverage)
- [ ] Loading states implemented
- [ ] Error states implemented
- [ ] Responsive design verified (mobile + desktop)
- [ ] Accessibility basics (keyboard nav, semantic HTML)
- [ ] PR reviewed and approved

---

## Total Effort Summary

| Epic | Stories | Hours |
|------|---------|-------|
| E5: Technical Foundation | 4 | 5-7 |
| E1: Player Onboarding | 3 | 9-12 |
| E2: Account Recovery | 2 | 4-6 |
| E3: Horse Training | 2 | 6-8 |
| E4: Breeding Experience | 3 | 8-10 |
| **Total** | **14** | **27-35** |

---

*Generated by BMAD create-epics-and-stories workflow*
*Ready for sprint planning and development*
