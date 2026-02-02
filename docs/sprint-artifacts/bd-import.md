# BD Import: Frontend Completion

## Epic: Technical Foundation
- type: epic
- priority: P0
- labels: frontend, foundation

Enable all frontend features to communicate with backend. Build first - other epics depend on this.

### Task: API Client with Cookie Authentication
- type: task
- priority: P0
- labels: frontend, api

Create centralized API client in `frontend/src/lib/api.ts` with `credentials: 'include'` on all requests. Handle 401/429 errors with events and toasts.

**Acceptance:**
- apiRequest() function with credentials: 'include'
- ApiError class with status code
- 401 dispatches auth:unauthorized event
- 429 shows rate-limit toast

**Files:** `frontend/src/lib/api.ts`, `frontend/src/types/api.ts`

### Task: Auth API Hooks
- type: task
- priority: P0
- labels: frontend, api, hooks

Create React Query hooks for auth operations: useLogin, useRegister, useCurrentUser, useLogout, useForgotPassword, useResetPassword.

**Acceptance:**
- All hooks call correct endpoints
- Login invalidates currentUser query
- Logout clears query cache
- Tests with MSW

**Files:** `frontend/src/hooks/api/useAuth.ts`

### Task: Auth Context Provider
- type: task
- priority: P0
- labels: frontend, context

Create AuthProvider and useAuth hook providing user state, isLoading, isAuthenticated, logout function.

**Acceptance:**
- AuthProvider wraps app
- useAuth returns user state
- Listens for auth:unauthorized events
- Error if used outside provider

**Files:** `frontend/src/contexts/AuthContext.tsx`

### Task: Validation Schemas
- type: task
- priority: P1
- labels: frontend, validation

Create Zod schemas for login, register, forgotPassword, resetPassword matching backend validation rules.

**Acceptance:**
- loginSchema: email + password
- registerSchema: username (3-30), password (8+, upper, lower, number)
- Type exports for form data
- User-friendly error messages

**Files:** `frontend/src/lib/validations/auth.ts`

---

## Epic: Player Onboarding
- type: epic
- priority: P0
- labels: frontend, auth

Enable new players to create accounts and start playing. Critical path - nothing works without auth.

### Task: Login Page
- type: task
- priority: P0
- labels: frontend, auth, page

Build login page with email/password form, validation, error handling, and navigation links.

**Acceptance:**
- Email and password inputs with validation
- Error message for invalid credentials
- Loading state during submission
- Redirects to /dashboard on success
- Links to /register and /forgot-password

**Files:** `frontend/src/pages/LoginPage.tsx`

### Task: Registration Page
- type: task
- priority: P0
- labels: frontend, auth, page

Build registration page with all fields, password strength indicator, and terms acceptance.

**Acceptance:**
- Username, email, password, confirmPassword, firstName, lastName fields
- Password strength indicator
- Terms checkbox required
- Success shows email verification message

**Files:** `frontend/src/pages/RegisterPage.tsx`

### Task: Email Verification Page
- type: task
- priority: P1
- labels: frontend, auth, page

Build email verification page that reads token from URL and verifies automatically.

**Acceptance:**
- Reads token from URL query param
- Auto-verifies on mount
- Success redirects to login
- Invalid token shows error with resend button

**Files:** `frontend/src/pages/EmailVerificationPage.tsx`

---

## Epic: Account Recovery
- type: epic
- priority: P1
- labels: frontend, auth

Retain players who forget passwords. Important for user retention.

### Task: Forgot Password Page
- type: task
- priority: P1
- labels: frontend, auth, page

Build forgot password page with email input. Shows generic success message for security.

**Acceptance:**
- Email input with validation
- Success message regardless of email existence
- Back to login link

**Files:** `frontend/src/pages/ForgotPasswordPage.tsx`

### Task: Reset Password Page
- type: task
- priority: P1
- labels: frontend, auth, page

Build reset password page with token from URL, new password fields, and requirements display.

**Acceptance:**
- Reads token from URL
- New password + confirm with requirements
- Invalid token shows error
- Success redirects to login

**Files:** `frontend/src/pages/ResetPasswordPage.tsx`

---

## Epic: Horse Training Experience
- type: epic
- priority: P1
- labels: frontend, training, gameplay

Enable players to improve their horses for competitions. Core gameplay loop.

### Task: Training Dashboard
- type: task
- priority: P1
- labels: frontend, training, component

Build dashboard showing all horses with training status, cooldown timers, and eligibility.

**Acceptance:**
- Lists horses with name, age, breed
- Shows training eligibility/cooldown
- Cooldown countdown timer
- Filter: Show All / Ready to Train
- Train button opens modal

**Files:** `frontend/src/components/training/TrainingDashboard.tsx`, `frontend/src/hooks/api/useTraining.ts`

### Task: Training Session Modal
- type: task
- priority: P1
- labels: frontend, training, component

Build modal for selecting discipline and executing training session.

**Acceptance:**
- Shows horse stats
- 23 disciplines grouped by category
- Eligibility check display
- Expected gains preview
- Results: stat gains, XP, new cooldown

**Files:** `frontend/src/components/training/TrainingSessionModal.tsx`, `frontend/src/constants/disciplines.ts`

---

## Epic: Breeding Experience
- type: epic
- priority: P2
- labels: frontend, breeding, gameplay

Enable players to create new horses with desirable traits. Advanced gameplay.

### Task: Breeding Center
- type: task
- priority: P2
- labels: frontend, breeding, component

Build breeding center with tabs for mares, marketplace, and history.

**Acceptance:**
- Tab navigation: My Mares | Stud Marketplace | History
- Mare list with breeding eligibility
- Breeding quality and trait summary
- Select mare opens pair selector

**Files:** `frontend/src/components/breeding/BreedingCenter.tsx`, `frontend/src/hooks/api/useBreeding.ts`

### Task: Breeding Pair Selector
- type: task
- priority: P2
- labels: frontend, breeding, component

Build side-by-side mare/stallion comparison with prediction display.

**Acceptance:**
- Side-by-side stats comparison
- Temperament compatibility score
- Trait inheritance prediction
- Inbreeding warning if >6.25%
- Breed button with confirmation

**Files:** `frontend/src/components/breeding/BreedingPairSelector.tsx`, `frontend/src/types/breeding.ts`

### Task: Foal Development Tracker
- type: task
- priority: P2
- labels: frontend, breeding, component

Build tracker showing foal progress, bonding/stress meters, and enrichment activities.

**Acceptance:**
- Development stage and progress bar
- Bonding/stress meters
- Enrichment activities list
- Activity history log
- Groom assignment display

**Files:** `frontend/src/components/breeding/FoalDevelopmentTracker.tsx`
