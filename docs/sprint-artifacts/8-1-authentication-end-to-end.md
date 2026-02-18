# Story 8.1: Authentication End-to-End

Status: ready-for-dev

## Story

As a **player**,
I want to **log in with real credentials and stay logged in across page refreshes**,
so that **I can access my horses and stable data secured by real backend authentication**.

## Acceptance Criteria

1. **Given** I am on the login page **When** I enter valid email and password **Then** I am authenticated via real `POST /api/auth/login`, an HttpOnly cookie is set by the server, and I am redirected to the dashboard (`/`)

2. **And** page refresh maintains session — on refresh `AuthProvider` mounts and calls `GET /api/auth/profile`; if cookie is valid, `isAuthenticated` becomes `true` and no redirect occurs

3. **And** expired/invalid cookie on page load causes `GET /api/auth/profile` to return 401 → `useProfile` fails → `useSessionGuard` detects `error.statusCode === 401` → `ProtectedRoute` redirects to `/login` with state `{ message: "Your session has expired. Please log in again." }`

4. **And** `POST /api/auth/logout` clears the HttpOnly cookie server-side, React Query cache is cleared (`queryClient.clear()`), and user is redirected to `/login`

5. **And** invalid credentials return a generic `"Invalid email or password"` response — no email enumeration (same message regardless of whether email exists)

6. **And** protected routes (`/stable`, `/horses/:id`, `/profile`, and all nav items) redirect unauthenticated users to `/login` with `from` state preserved for post-login redirect

7. **And** role-based routes (admin/moderator) redirect unauthorized users to `/unauthorized` via existing `RoleProtectedRoute` component

## Tasks / Subtasks

- [ ] Task 1: Fix API base URL for dev environment (AC: 1, 2)

  - [ ] 1.1: Create `frontend/.env` from `.env.example` — set `VITE_API_URL=http://localhost:3000`
  - [ ] 1.2: Verify `api-client.ts` correctly picks up VITE_API_URL in both dev and test environments

- [ ] Task 2: Fix MSW handlers base URL and add missing auth handlers (AC: 1, 2, 3)

  - [ ] 2.1: Update `frontend/src/test/msw/handlers.ts` base const from hard-coded `'http://localhost:3001'` to `import.meta.env.VITE_API_URL || 'http://localhost:3000'`
  - [ ] 2.2: Add `http.get(\`\${base}/api/auth/profile\`)` handler returning mock authenticated user
  - [ ] 2.3: Add `http.get(\`\${base}/api/auth/me\`)` handler (alias — same response shape)
  - [ ] 2.4: Add `http.get(\`\${base}/api/auth/verification-status\`)`handler (called by`useVerificationStatus`in`AuthProvider`)

- [ ] Task 3: Create `ProtectedRoute` component (AC: 6)

  - [ ] 3.1: Create `frontend/src/components/auth/ProtectedRoute.tsx` using `useSessionGuard` hook
  - [ ] 3.2: Add named export to `frontend/src/components/auth/index.ts`
  - [ ] 3.3: Write `frontend/src/components/auth/__tests__/ProtectedRoute.story-8-1.test.tsx` (min 15 tests: loading state, authenticated access, unauthenticated redirect, session-expired message)

- [ ] Task 4: Wire protected routes in App.tsx (AC: 6, 7)

  - [ ] 4.1: Import `ProtectedRoute` in `frontend/src/App.tsx`
  - [ ] 4.2: Wrap `/profile`, `/stable`, `/horses/:id` with `<ProtectedRoute>`
  - [ ] 4.3: Wrap nav items routes with `<ProtectedRoute>`
  - [ ] 4.4: Write `frontend/src/App.story-8-1.test.tsx` testing route protection (min 12 tests)

- [ ] Task 5: End-to-end auth flow tests (AC: 1–7)
  - [ ] 5.1: Write `frontend/src/components/auth/__tests__/AuthFlow.story-8-1.test.tsx` covering: login→cookie→redirect, session persist on refresh, logout→cache-clear, generic error message, role guard (min 20 tests)

## Dev Notes

### CRITICAL: This Is a Wiring Story — Do NOT Rebuild What Exists

The auth infrastructure is **95% already built** from Epics 1–3. The work here is:

1. Fix API port mismatch (env file + MSW)
2. Add missing MSW handlers for `GET /api/auth/profile`
3. Create thin `ProtectedRoute` wrapper (10–15 lines)
4. Wire `<ProtectedRoute>` into App.tsx routes
5. Write tests verifying the wiring

**DO NOT** rewrite `useAuth`, `AuthContext`, `useSessionGuard`, `RoleProtectedRoute`, `api-client`. They are complete.

---

### API Base URL Issue (CRITICAL — Fix First)

```typescript
// frontend/src/lib/api-client.ts:15
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
```

- No `frontend/.env` file exists — the fallback `3001` is **wrong** (backend runs on `3000`)
- `.env.example` already has the correct value:
  ```
  VITE_API_URL=http://localhost:3000
  ```
- **Fix:** `cp frontend/.env.example frontend/.env`
- After fix, `VITE_API_URL=http://localhost:3000` is loaded by Vite in both dev and test

---

### MSW Base URL Issue (CRITICAL FOR TESTS)

```typescript
// frontend/src/test/msw/handlers.ts:9
const base = 'http://localhost:3001';
```

- MSW intercepts requests to `3001`. After the `.env` fix, `api-client` will call `3000`.
- Result: all existing tests that use MSW will break (handlers won't intercept)
- **Fix:** Change `handlers.ts` line 9:
  ```typescript
  const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
  ```

---

### Missing MSW Handler (CRITICAL — Tests Will Error Without This)

`AuthProvider` in `frontend/src/contexts/AuthContext.tsx` calls `useProfile()` on every mount.
`useProfile` calls `GET /api/auth/profile`. `useVerificationStatus` calls `GET /api/auth/verification-status`.

Current `handlers.ts` has login/register/logout but **NOT** these GET endpoints.

`setup.ts` uses `onUnhandledRequest: 'error'` — any test that renders `AuthProvider` (or any component wrapped in it) without these handlers will **throw** and fail.

**Add to `handlers.ts`:**

```typescript
// Authenticated profile response
http.get(`${base}/api/auth/profile`, () =>
  HttpResponse.json({
    status: 'success',
    data: {
      user: {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        role: 'user',
      },
    },
  })
),

// /me alias
http.get(`${base}/api/auth/me`, () =>
  HttpResponse.json({
    status: 'success',
    data: {
      user: { id: 1, username: 'testuser', email: 'test@example.com', role: 'user' },
    },
  })
),

// Verification status
http.get(`${base}/api/auth/verification-status`, () =>
  HttpResponse.json({
    status: 'success',
    data: { verified: true, email: 'test@example.com', verifiedAt: '2026-01-01T00:00:00Z' },
  })
),
```

For session-expiry tests, override in individual test files using `server.use(...)`.

---

### `ProtectedRoute` Component — Exact Implementation

Use the existing `useSessionGuard` hook. Do NOT duplicate its logic.

```typescript
// frontend/src/components/auth/ProtectedRoute.tsx
import React, { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useSessionGuard } from '../../hooks/useSessionGuard';

interface ProtectedRouteProps {
  children: ReactNode;
}

const DefaultLoading: React.FC = () => (
  <div
    data-testid="protected-route-loading"
    className="min-h-screen flex items-center justify-center bg-background"
  >
    <div className="text-center space-y-4">
      <div className="w-12 h-12 border-4 border-burnished-gold border-t-transparent rounded-full animate-spin mx-auto" />
      <p className="fantasy-body text-aged-bronze">Verifying session...</p>
    </div>
  </div>
);

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isLoading, shouldRedirect, redirectPath, redirectState } = useSessionGuard();

  if (isLoading) return <DefaultLoading />;
  if (shouldRedirect) return <Navigate to={redirectPath} replace state={redirectState} />;
  return <>{children}</>;
};

export default ProtectedRoute;
```

---

### App.tsx Route Wiring Pattern

```typescript
// BEFORE (unprotected):
<Route path="/profile" element={<ProfilePage />} />
<Route path="/stable" element={<StableView />} />
<Route path="/horses/:id" element={<HorseDetailPage />} />

// AFTER (protected):
<Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
<Route path="/stable" element={<ProtectedRoute><StableView /></ProtectedRoute>} />
<Route path="/horses/:id" element={<ProtectedRoute><HorseDetailPage /></ProtectedRoute>} />

// Nav items:
{navItems.map(({ to, page }) => (
  <Route key={to} path={to} element={<ProtectedRoute>{page}</ProtectedRoute>} />
))}
```

**DO NOT** wrap `/login`, `/register`, `/verify-email`, `/forgot-password`, `/reset-password` — these are public routes.

---

### Backend Auth Endpoints (All Confirmed Present)

```
POST /api/auth/login           → Line 165 authRoutes.mjs — sets HttpOnly cookie
GET  /api/auth/profile         → Line 351 authRoutes.mjs — validateToken middleware
GET  /api/auth/me              → Line 352 authRoutes.mjs — alias for /profile
POST /api/auth/logout          → Line 491 authRoutes.mjs — clears cookie
POST /api/auth/refresh-token   → Line 317 authRoutes.mjs — called auto by api-client on 401
GET  /api/auth/verification-status → Line 688 authRoutes.mjs
```

Backend runs on port **3000**. Verify: `backend/.env` → `PORT=3000`.

---

### LoginPage Behavior (Already Correct)

```typescript
// frontend/src/pages/LoginPage.tsx:27
setTimeout(() => navigate('/'), 100);
```

Redirects to `/` (dashboard) after login. The `useSessionGuard` preserves `from` state on
redirect-to-login, but `LoginPage` currently navigates to `/` unconditionally — this is acceptable
for Story 8.1. Redirect-to-original-page is an enhancement (not in ACs).

---

### AuthContext/useProfile Session Flow

```
App mounts → AuthProvider → useProfile() → GET /api/auth/profile
  ├── 200 OK  → user set, isAuthenticated=true  → ProtectedRoute allows access
  └── 401     → user null, error set             → ProtectedRoute redirects to /login
                                                    (with "Session expired" message if 401)
```

`useProfile` has `retry: false` — no retry on 401, immediate redirect.

---

### Test File Naming Convention

Follow existing Epic 7 pattern: `ComponentName.story-8-1.test.tsx`

```
frontend/src/components/auth/__tests__/ProtectedRoute.story-8-1.test.tsx
frontend/src/components/auth/__tests__/AuthFlow.story-8-1.test.tsx
frontend/src/App.story-8-1.test.tsx
```

### Test Render Helper Pattern

```typescript
// Use renderWithRouter from existing test utilities, or:
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

function renderWithAuth(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter>{ui}</MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
```

### Project Structure Notes

- `ProtectedRoute.tsx` → `frontend/src/components/auth/` (alongside `RoleProtectedRoute.tsx`)
- Export from `frontend/src/components/auth/index.ts` (already has `RoleProtectedRoute`)
- No new dependencies required
- No database schema changes

### References

- [Source: frontend/src/lib/api-client.ts#L15] — API_BASE_URL fallback (3001, needs .env fix)
- [Source: frontend/src/test/msw/handlers.ts#L9] — MSW base URL (needs to match api-client)
- [Source: frontend/src/test/setup.ts#L24] — `onUnhandledRequest: 'error'` — profile handler required
- [Source: frontend/src/contexts/AuthContext.tsx] — useProfile called on mount
- [Source: frontend/src/hooks/useSessionGuard.ts] — complete session guard (use as-is)
- [Source: frontend/src/components/auth/RoleProtectedRoute.tsx] — role-based protection pattern
- [Source: frontend/src/App.tsx] — current unprotected routes
- [Source: backend/routes/authRoutes.mjs#L351-352] — /profile and /me endpoints
- [Source: docs/epics.md#Story-8.1] — Acceptance criteria definition

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-5-20250929

### Debug Log References

### Completion Notes List

### File List

### Change Log
