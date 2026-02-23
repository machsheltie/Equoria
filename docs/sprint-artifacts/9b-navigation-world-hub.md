# Epic 9B: Navigation & World Hub

Status: Completed — 2026-02-23

## Stories Completed

### 9B-1: World Hub Page

**File:** `frontend/src/pages/WorldHubPage.tsx`

8 location cards displayed at `/world`:

| Location            | Icon | Links To      |
| ------------------- | ---- | ------------- |
| Vet Clinic          | 🏥   | /stable       |
| Farrier             | 🔨   | /stable       |
| Tack Shop           | 🧴   | /stable       |
| Feed Shop           | 🌾   | /stable       |
| Training Center     | 🏋️   | /training     |
| Grooms              | 🧑‍🌾   | /stable       |
| Riders              | 🏇   | /competitions |
| Breeding Specialist | 🧬   | /breeding     |

Each card supports:

- `alertCount` + `alertLabel` for action badges (e.g. "3 horses need shoeing")
- Unique accent color per location
- Hover animation (-translate-y-0.5 + shadow)

### 9B-2: Navigation Restructure

**File:** `frontend/src/components/MainNavigation.tsx`, `frontend/src/nav-items.tsx`

Fixed broken routes:

- `Dashboard → /dashboard` ❌ → `Home → /` ✅
- `Competition → /competition` ❌ → `Competitions → /competitions` ✅
- `Genetics → /genetics` ❌ → removed (no page exists)
- `Analytics → /analytics` ❌ → removed (no page exists)

Added:

- `World → /world` (WorldHubPage)
- `Leaderboards → /leaderboards` (LeaderboardsPage — already existed)
- `Settings → /settings` (SettingsPage)

Fixed `isActiveRoute()` logic:

```typescript
// Before: would match / for EVERY route (startsWith is greedy)
return location.pathname.startsWith(href);

// After: exact match for root, prefix match for others
if (href === '/') return location.pathname === '/';
return location.pathname.startsWith(href);
```

Removed unused `Button` import from MainNavigation (ESLint error).

### 9B-3: Horse Care Status Strip

**File:** `frontend/src/components/HorseCard.tsx`

Added optional `careStatus` prop:

```typescript
interface CareStatus {
  lastShod?: Date | string | null;
  lastFed?: Date | string | null;
  lastTrained?: Date | string | null;
  lastFoaled?: Date | string | null;
}
```

Added `sex` prop to control mare-only display of `lastFoaled`.

Date formatting helper:

```typescript
const formatCareDate = (date): string => {
  if (!date) return 'Never';
  const daysAgo = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (daysAgo === 0) return 'Today';
  if (daysAgo === 1) return '1d ago';
  return `${daysAgo}d ago`;
};
```

Strip renders below stats grid with `data-testid="care-status-strip"`.
Strip is hidden when `careStatus` prop is omitted (backward-compatible).

### 9B-4: Settings Page

**File:** `frontend/src/pages/SettingsPage.tsx`

Three-section settings interface at `/settings`:

1. **Account** — username, email, change password, danger zone
2. **Notifications** — 6 toggles (email: competition/breeding/system; in-app: training/achievements/news)
3. **Display** — 3 toggles (reduced motion, high contrast, compact cards)

Toggle component uses `role="switch"` + `aria-checked` for accessibility.

## Key Implementation Notes

### TypeScript Underscore Rule (per PATTERN_LIBRARY.md)

Interface function-type parameters that are named but unused in implementations must use `_` prefix:

```typescript
// ToggleProps in SettingsPage.tsx
onChange: (_checked: boolean) => void;  // ✅ not onChange: (checked: boolean) => void
```

### Stash Recovery

During development, an accidental `git stash` stashed working tree changes for MainNavigation, HorseCard, and nav-items. Recovered with:

```bash
git checkout stash@{0} -- frontend/src/components/MainNavigation.tsx \
  frontend/src/components/HorseCard.tsx \
  frontend/src/nav-items.tsx
```

### Pre-existing TypeScript Errors

The frontend has ~30 pre-existing TypeScript errors in files not touched by Epic 9B (AssignGroomModal, BreedingCenter, CompetitionBrowser, etc.). These are not regressions from 9B work.

### Pre-existing Test Failures

Frontend Vitest suite has 25 failing test files (195 failing tests) related to MSW handler configuration — pre-existing before Epic 9B, not caused by these changes.
