# Story 8.2: User Dashboard Live Data

Status: Ready for Dev

## Story

As a **player**,
I want to **see my real username, level, XP, currency, horse count, and activity feed on the dashboard**,
so that **I can track my actual game progress and make informed decisions about training and competition**.

## Acceptance Criteria

1. **Given** I am authenticated **When** the dashboard loads **Then** my real username, level, and XP are displayed via `GET /api/users/:id/progress` (not mock fixtures)

2. **And** my real currency (money) is displayed from the dashboard API — staleTime 30 seconds to keep balance current

3. **And** my real horse count is displayed from `GET /api/users/dashboard/:id` — staleTime 2 minutes for stat summaries

4. **And** the activity feed shows real events via `GET /api/users/:id/activity` — empty array renders "The chronicle is silent..." message

5. **And** loading spinners appear while data is fetching (before first successful response)

6. **And** a "Connection Severed" error state renders when both progress and dashboard APIs fail

7. **And** `useUserProgress` staleTime is 30 seconds (not 60 seconds), and `useDashboard` staleTime is 2 minutes (already correct)

## Tasks / Subtasks

- [ ] Task 1: Fix staleTime on `useUserProgress` hook (AC: 2, 7)

  - [ ] 1.1: Change `staleTime` in `useUserProgress()` from `60 * 1000` (1 min) to `30 * 1000` (30s)
  - [ ] 1.2: Change `staleTime` in `useActivityFeed()` from `60 * 1000` to `30 * 1000` for consistency
  - [ ] 1.3: Confirm `useDashboard()` staleTime remains `2 * 60 * 1000` (2 min) ✅ already correct

- [ ] Task 2: Fix `progressData?.money` reference bug (AC: 2)

  - [ ] 2.1: Audit `UserDashboard.tsx` line 154 — `progressData?.money` is wrong (`UserProgress` type has no `money` field)
  - [ ] 2.2: Fix to read money from `dashboardData?.user?.money` (correct source from `DashboardData` type)

- [ ] Task 3: Add missing MSW handler for `GET /api/users/:id` (AC: 1–4)

  - [ ] 3.1: Add `http.get(\`\${base}/api/users/:id\`, ...)`handler to`frontend/src/test/msw/handlers.ts`
  - [ ] 3.2: Response shape: `{ success: true, data: { id, username, money, level, currentHorses, stableLimit } }`
  - [ ] 3.3: Add 404 for id `'999999'` (consistent with other handlers)
  - [ ] Note: This is consumed by `useUser()` hook in `useUserProgress.ts` line 57

- [ ] Task 4: Write hook tests for `useUserProgress.ts` (AC: 1–4)

  - [ ] 4.1: Write `frontend/src/hooks/api/__tests__/useUserProgress.story-8-2.test.tsx`
  - [ ] 4.2: Test `useUserProgress(userId)` — returns level, xp, username from MSW mock (5 tests)
  - [ ] 4.3: Test `useDashboard(userId)` — returns horse count, money from MSW mock (5 tests)
  - [ ] 4.4: Test `useActivityFeed(userId)` — returns empty array, renders correctly (3 tests)
  - [ ] 4.5: Test `useUser(userId)` — returns user data from new MSW handler (3 tests)
  - [ ] 4.6: Test error states — 404 response, query disabled when userId falsy (4 tests)

- [ ] Task 5: Write `UserDashboard` integration tests (AC: 1–6)

  - [ ] 5.1: Write `frontend/src/components/__tests__/UserDashboard.story-8-2.test.tsx`
  - [ ] 5.2: Test: dashboard renders username from `dashboardData.user.username` (AC: 1)
  - [ ] 5.3: Test: dashboard renders level from `progressData.level` (AC: 1)
  - [ ] 5.4: Test: dashboard renders XP progress bar from `progressData.xp` + `progressData.xpToNextLevel` (AC: 1)
  - [ ] 5.5: Test: money renders from `dashboardData.user.money` after fix (AC: 2)
  - [ ] 5.6: Test: horse count renders from `dashboardData.horses.total` (AC: 3)
  - [ ] 5.7: Test: empty activity feed shows "The chronicle is silent..." (AC: 4)
  - [ ] 5.8: Test: loading spinner renders when `isLoading` is true (AC: 5)
  - [ ] 5.9: Test: error state renders "Connection Severed" on API failure (AC: 6)
  - [ ] 5.10: Test: refresh button calls `refetchProgress` and `refetchDashboard` (AC: 1–3)

## Dev Notes

### CRITICAL: This Is a Wiring Verification Story — The Hooks Already Exist

The hook infrastructure is **already complete**:

- `frontend/src/hooks/api/useUserProgress.ts` — all 4 hooks implemented
- `frontend/src/components/UserDashboard.tsx` — already calls `useUserProgress()`, `useDashboard()`, `useActivityFeed()`
- `frontend/src/lib/api-client.ts` — `userProgressApi` implemented with correct URLs
- `frontend/src/test/msw/handlers.ts` — handlers for all 3 main endpoints already exist

**The work here is:**

1. Fix staleTime (1 line change)
2. Fix `progressData?.money` bug (1 line change)
3. Add missing `GET /api/users/:id` MSW handler (10 lines)
4. Write tests proving the wiring is correct

**DO NOT** rewrite the hooks, api-client, or UserDashboard component beyond the two fixes above.

---

### Bug: `progressData?.money` Reference (CRITICAL — Fix First)

In `frontend/src/components/UserDashboard.tsx:154`:

```typescript
// CURRENT (broken — UserProgress type has no `money` field):
<span>{progressData?.money?.toLocaleString() || 0}</span>

// FIX (correct source):
<span>{dashboardData?.user?.money?.toLocaleString() || 0}</span>
```

The `UserProgress` interface (api-client.ts:385–395) has `totalEarnings`, not `money`.
The `DashboardData` interface (api-client.ts:397–416) has `user.money`.

---

### API URLs — Confirmed Correct

From `frontend/src/lib/api-client.ts` (lines 801–817):

```typescript
export const userProgressApi = {
  getProgress: (userId) => apiClient.get(`/api/users/${userId}/progress`),
  getDashboard: (userId) => apiClient.get(`/api/users/dashboard/${userId}`),
  getActivity: (userId) => apiClient.get(`/api/users/${userId}/activity`),
  getUser: (userId) => apiClient.get(`/api/users/${userId}`),
};
```

MSW handlers in `handlers.ts` confirm matching routes:

- `GET /api/users/:id/progress` → line 310 ✅
- `GET /api/users/dashboard/:id` → line 329 ✅ (note order: `dashboard/:id` before `:id`)
- `GET /api/users/:id/activity` → line 349 ✅
- `GET /api/users/:id` → **MISSING** — add in Task 3

**Critical handler ordering:** `GET /api/users/dashboard/:id` MUST appear before `GET /api/users/:id` in `handlers.ts` to prevent `:id` from capturing `dashboard` as the user ID. Current ordering is correct.

---

### staleTime Fix

In `frontend/src/hooks/api/useUserProgress.ts`:

```typescript
// CURRENT:
export function useUserProgress(userId) {
  return useQuery({
    ...
    staleTime: 60 * 1000, // 1 minute  ← CHANGE to 30 * 1000
  });
}

// CURRENT:
export function useActivityFeed(userId) {
  return useQuery({
    ...
    staleTime: 60 * 1000, // 1 minute  ← CHANGE to 30 * 1000
  });
}

// KEEP as-is (already correct per AC):
export function useDashboard(userId) {
  return useQuery({
    ...
    staleTime: 2 * 60 * 1000, // 2 minutes ✅
  });
}
```

---

### Missing MSW Handler to Add (Task 3)

Add after the existing `GET /api/users/:id/activity` handler in `handlers.ts`:

```typescript
// User profile (used by useUser hook)
http.get(`${base}/api/users/:id`, ({ params }) => {
  if (params.id === '999999') {
    return new HttpResponse(null, { status: 404 });
  }
  return HttpResponse.json({
    success: true,
    data: {
      id: params.id,
      username: 'testuser',
      money: 1000,
      level: 1,
      currentHorses: 2,
      stableLimit: 10,
    },
  });
}),
```

**Warning:** This handler must appear AFTER the `GET /api/users/dashboard/:id` handler to avoid route conflicts.

---

### UserDashboard Data Flow

```
UserDashboard(userId={1})
  ├── useUserProgress(1) → GET /api/users/1/progress
  │     Returns: { level, xp, xpToNextLevel, xpForNextLevel, ... }
  │     Renders: Level badge, XP progress bar
  │
  ├── useDashboard(1) → GET /api/users/dashboard/1
  │     Returns: { user: { username, money }, horses: { total, trainable } }
  │     Renders: Welcome header (username), money, horse count, recent shows
  │
  └── useActivityFeed(1) → GET /api/users/1/activity
        Returns: [] (empty) or [{ id, description, timestamp }]
        Renders: Chronicle section or "The chronicle is silent..."
```

**isLoading logic (UserDashboard.tsx:86):**

```typescript
const isLoading = (progressLoading || dashboardLoading) && !propProgressData;
```

Loading state only shows when neither `progressData` prop is passed (for Storybook/test overrides). In real usage, loading appears until both queries resolve.

---

### Test Render Helper Pattern for Hooks

```typescript
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

it('returns user progress data', async () => {
  const { result } = renderHook(() => useUserProgress(1), { wrapper: createWrapper() });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data?.level).toBe(1);
  expect(result.current.data?.xp).toBe(50);
});
```

---

### Test Render Helper Pattern for UserDashboard Component

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import UserDashboard from '../UserDashboard';

function renderDashboard(userId = 1) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <UserDashboard userId={userId} />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

it('renders username from API', async () => {
  renderDashboard(1);
  await waitFor(() => expect(screen.getByText(/testuser/i)).toBeInTheDocument());
});
```

---

### Test File Naming Convention

Follow existing patterns:

```
frontend/src/hooks/api/__tests__/useUserProgress.story-8-2.test.tsx
frontend/src/components/__tests__/UserDashboard.story-8-2.test.tsx
```

---

### Backend Endpoints (Confirmed Present)

```
GET /api/users/:id/progress    → userProgressController.getProgress()
GET /api/users/dashboard/:id   → dashboardController.getDashboard()
GET /api/users/:id/activity    → userProgressController.getActivity()
GET /api/users/:id             → userController.getUser()
```

All endpoints return `{ success: true, data: { ... } }` format.
`api-client.ts:fetchWithAuth()` extracts `.data` automatically (line 583).

---

### Pre-Existing Test Failures (Not This Story's Problem)

22 frontend test files fail pre-existing (Epic 6/7 BreedingPage, UserDashboard fixtures, etc.). These are known and not introduced by Story 8.2.

`UserDashboard` has pre-existing tests in `UserDashboard.story-*` files that use `propProgressData` prop overrides — those tests remain valid and must not break.

---

### References

- [Source: frontend/src/hooks/api/useUserProgress.ts] — all 4 hooks, staleTime values
- [Source: frontend/src/components/UserDashboard.tsx#L154] — `progressData?.money` bug
- [Source: frontend/src/lib/api-client.ts#L801-817] — `userProgressApi` URL surface
- [Source: frontend/src/test/msw/handlers.ts#L309-354] — existing user/dashboard handlers
- [Source: frontend/src/test/setup.ts#L24] — `onUnhandledRequest: 'error'` — new `/api/users/:id` handler required
- [Source: docs/epics.md#Story-8.2] — Acceptance criteria

## Dev Agent Record

### Agent Model Used

_To be filled by implementing agent_

### Debug Log References

_To be filled by implementing agent_

### Completion Notes List

_To be filled by implementing agent_

### File List

**Modified:**

- `frontend/src/hooks/api/useUserProgress.ts` — staleTime fix (2 lines)
- `frontend/src/components/UserDashboard.tsx` — money reference fix (1 line)
- `frontend/src/test/msw/handlers.ts` — add `GET /api/users/:id` handler
- `docs/sprint-artifacts/sprint-status.yaml` — status update
- `docs/sprint-artifacts/8-2-user-dashboard-live-data.md` — this file

**Created:**

- `frontend/src/hooks/api/__tests__/useUserProgress.story-8-2.test.tsx` (20 tests)
- `frontend/src/components/__tests__/UserDashboard.story-8-2.test.tsx` (9 tests)

### Change Log

| Date       | Change                            | Author                     |
| ---------- | --------------------------------- | -------------------------- |
| 2026-02-18 | Story created from Epic 8 context | claude-sonnet-4-5-20250929 |
