---
title: 'Marketplace Hub + Horse Trader Store'
slug: 'marketplace-hub-horse-trader'
created: '2026-04-03'
status: 'completed'
stepsCompleted: [1, 2, 3, 4, 5, 6, 7]
tech_stack:
  - React 19 + TypeScript
  - React Router v6
  - TanStack Query v5
  - Express + Prisma (Node.js ESM)
files_to_modify:
  - frontend/src/nav-items.tsx
  - frontend/src/pages/HorseMarketplacePage.tsx
  - frontend/src/lib/api-client.ts
  - backend/modules/marketplace/controllers/marketplaceController.mjs
  - backend/modules/marketplace/routes/marketplaceRoutes.mjs
files_to_create:
  - frontend/src/pages/MarketplaceHubPage.tsx
  - frontend/src/pages/HorseTraderPage.tsx
  - frontend/src/hooks/api/useHorseTrader.ts
code_patterns:
  - LocationCard hub pattern (WorldHubPage.tsx)
  - Prisma $transaction for atomic purchase (marketplaceController.mjs buyHorse)
  - TanStack Query mutation with cache invalidation (useMarketplace.ts)
  - Searchable combobox using shadcn/ui Command (no external deps needed)
  - useProfile() for live balance display
test_patterns:
  - MSW handler for POST /api/v1/marketplace/store/buy
  - MSW handler for GET /api/breeds (already exists)
---

# Tech-Spec: Marketplace Hub + Horse Trader Store

**Created:** 2026-04-03

## Overview

### Problem Statement

The `/marketplace` route goes directly to the user-to-user horse marketplace (HorseMarketplacePage). There is no way for users to buy horses from the game store. Players who want a new horse of a specific breed have no path to acquire one other than breeding.

### Solution

Replace `/marketplace` with a two-card hub (like WorldHubPage). Add a Horse Trader store page where users pick a breed (searchable dropdown of all 320 breeds) and sex (mare/stallion), pay 1,000 coins, and receive a 3-year-old horse in their stable. Route the existing horse marketplace to `/marketplace/horses`.

### Scope

**In Scope:**

- New `MarketplaceHubPage` at `/marketplace` with two `LocationCard`s
- New `HorseTraderPage` at `/marketplace/horse-trader` with breed combobox + sex selector + buy flow
- Backend `POST /api/v1/marketplace/store/buy` endpoint (atomic: deduct coins, create horse)
- Reroute existing `HorseMarketplacePage` to `/marketplace/horses`
- Update nav-items and in-app links accordingly
- Searchable dropdown showing all 320 breeds, sorted alphabetically
- Success state showing new horse name; error state showing insufficient funds

**Out of Scope:**

- Horse naming by user (auto-generated from breed + random suffix)
- Breed-tier or demand-based pricing (flat 1,000 coins for all breeds)
- Foal purchase (store always delivers a 3-year-old)
- Gender other than mare/stallion (no gelding)
- Any changes to the groom MarketplacePage (separate concern, different route)

---

## Context for Development

### Codebase Patterns

**Hub pattern — WorldHubPage.tsx:**

```tsx
// WorldHubPage renders a grid of LocationCard components.
// Each card: { id, name, description, icon, href, paintingGradient }
// Grid: grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5
// PageHero at top, then location grid in max-w-7xl mx-auto px-4 container
```

**LocationCard interface (frontend/src/components/LocationCard.tsx):**

```tsx
export interface LocationCardProps {
  id: string;
  name: string;
  description: string;
  icon: string; // emoji
  href: string; // React Router path
  paintingGradient: string;
  backgroundImage?: string;
  backgroundPosition?: string;
}
```

**Atomic purchase pattern — marketplaceController.mjs buyHorse:**

```js
// Uses prisma.$transaction(async tx => { ... })
// 1. Find + validate buyer (balance check: buyer.money < price → 400)
// 2. tx.user.update({ data: { money: { decrement: price } } })
// 3. Create the horse (new: call createHorse() within tx — see note below)
// 4. Re-fetch buyer.money post-transaction for response newBalance
// Returns { horseName, salePrice, newBalance }
```

**createHorse() — backend/models/horseModel.mjs:**

```js
// Requires: name, age, breedId (OR breed), userId, sex
// Accepts: speed, stamina, agility, balance, precision, intelligence,
//          boldness, flexibility, obedience, focus, strength, endurance,
//          dateOfBirth, healthStatus, conformationScores, gaitScores, temperament
// Returns full horse object with breed included
// NOTE: createHorse uses prisma internally (not tx). For atomicity, deduct
// coins in a $transaction first, then call createHorse after transaction
// resolves — same pattern as the existing store logic.
```

**Breed starter stats — backend/modules/horses/data/breedGeneticProfiles.mjs:**

```js
// BREED_GENETIC_PROFILES[breedId].starter_stats = {
//   speed: { mean, std_dev }, stamina: { mean, std_dev }, ...12 stats
// }
// Available for canonical breed IDs 1–12 only.
// For non-canonical breeds (IDs > 12): use randomStat(min=20, max=45)
//   (lower max than seed's 80 so store horses aren't overpowered)
// Helper: function sampleStat({ mean, std_dev }) — clamp(Math.round(mean + std_dev * randn()), 1, 100)
//   where randn() is Box-Muller or simple: (Math.random() + Math.random() - 1) * 1.41
```

**Stats generation for store horse:**

```js
const STORE_PRICE = 1000;
const STAT_KEYS = [
  'speed',
  'stamina',
  'agility',
  'balance',
  'precision',
  'intelligence',
  'boldness',
  'flexibility',
  'obedience',
  'focus',
  'strength',
  'endurance',
];

function sampleStat({ mean, std_dev }) {
  const z = (Math.random() + Math.random() - 1) * 1.41; // approx normal
  return Math.max(1, Math.min(100, Math.round(mean + std_dev * z)));
}

function generateStoreStats(breedId) {
  const profile = BREED_GENETIC_PROFILES[breedId];
  if (profile?.starter_stats) {
    return Object.fromEntries(STAT_KEYS.map((k) => [k, sampleStat(profile.starter_stats[k])]));
  }
  // Non-canonical breed fallback: random 20–45
  return Object.fromEntries(STAT_KEYS.map((k) => [k, 20 + Math.floor(Math.random() * 26)]));
}
```

**Horse name auto-generation:**

```js
// Format: "{BreedName} #{4-digit random}"  e.g. "Arabian #4821"
const horseName = `${breed.name} #${String(Math.floor(1000 + Math.random() * 9000))}`;
```

**Nav routing pattern — nav-items.tsx:**

```tsx
// Each entry: { title, to, Page, icon? }
// Routes are rendered via navItems.map(({ to, Page }) => <Route path={to} element={<Page />} />)
// Sub-routes (e.g. /marketplace/horses) must be added as separate entries
// App.tsx uses lazy() imports; new pages must be lazy-imported there or in nav-items.tsx
```

**TanStack Query mutation pattern — useMarketplace.ts:**

```ts
// useMutation({ mutationFn, onSuccess: () => queryClient.invalidateQueries(...) })
// On success: invalidate ['horses'] (stable list) and ['profile'] (balance update)
```

**useProfile balance — hooks/useAuth.ts:**

```ts
// useProfile() returns { data: { user: { money: number, ... } } }
// Display user.money before purchase to show current balance
```

**GET /api/breeds response:**

```json
{ "success": true, "data": [{ "id": 1, "name": "Thoroughbred", ... }], "count": 320 }
// Sorted alphabetically by name (orderBy: { name: 'asc' })
// Endpoint: GET /api/breeds (no auth required? — check breedRoutes)
// Actually mounted at authRouter, so auth IS required. Use authenticated call.
```

**api-client.ts pattern:**

```ts
// fetchWithAuth unwraps: returns data.data if present, else data
// So apiClient.get('/api/breeds') returns Breed[] directly
```

### Files to Reference

| File                                                                | Purpose                                            |
| ------------------------------------------------------------------- | -------------------------------------------------- |
| `frontend/src/pages/WorldHubPage.tsx`                               | Hub layout + LocationCard usage pattern to copy    |
| `frontend/src/components/LocationCard.tsx`                          | LocationCard component interface                   |
| `frontend/src/pages/HorseMarketplacePage.tsx`                       | Existing marketplace — move to /marketplace/horses |
| `frontend/src/nav-items.tsx`                                        | Add 3 route entries, update /marketplace target    |
| `frontend/src/hooks/api/useMarketplace.ts`                          | Mutation + invalidation pattern to follow          |
| `frontend/src/hooks/useAuth.ts`                                     | useProfile() for live balance                      |
| `frontend/src/lib/api-client.ts`                                    | Add buyStoreHorse() to marketplaceApi              |
| `backend/modules/marketplace/controllers/marketplaceController.mjs` | Add buyStoreHorse function                         |
| `backend/modules/marketplace/routes/marketplaceRoutes.mjs`          | Add POST /store/buy route                          |
| `backend/models/horseModel.mjs`                                     | createHorse() signature reference                  |
| `backend/modules/horses/data/breedGeneticProfiles.mjs`              | starter_stats for canonical breeds                 |

### Technical Decisions

1. **Price:** 1,000 coins flat for all breeds, all sexes.
2. **Breeds:** All 320 from DB. Canonical 12 (IDs 1–12) use `starter_stats`; others use random 20–45.
3. **UI:** Shadcn/ui-style Command combobox (search-as-you-type) for breed selection. Already in project — check existing usage before creating new pattern.
4. **Horse name:** Auto-generated as `"{BreedName} #{4-digit}"` — no user input required.
5. **Age/sex:** Always 3-year-old. Sex: mare or stallion (radio, default mare).
6. **Atomicity:** Deduct coins in `prisma.$transaction`, then call `createHorse()` outside (same pattern avoids nested prisma client issues). If `createHorse` fails after deduct, log error and return 500 — acceptable for now (no partial refund logic).
7. **Route structure:** `/marketplace` → hub, `/marketplace/horses` → existing HorseMarketplacePage, `/marketplace/horse-trader` → new HorseTraderPage.
8. **Nav:** Update single nav entry from HorseMarketplacePage to MarketplaceHubPage. Sub-routes added as separate nav-items entries (no icon needed for sub-routes if they're not in main nav).

---

## Implementation Plan

### Tasks

**Order: backend first (lowest dependency), then frontend hook, then pages, then routing.**

#### TASK 1 — Backend: Add `buyStoreHorse` to marketplaceController.mjs

**File:** `backend/modules/marketplace/controllers/marketplaceController.mjs`

Add new exported async function `buyStoreHorse` after the existing `buyHorse` function:

```js
import { BREED_GENETIC_PROFILES } from '../../horses/data/breedGeneticProfiles.mjs';
import { createHorse } from '../../../models/horseModel.mjs';
// (breedGeneticProfiles import may already exist — check top of file)

const STORE_PRICE = 1000;
const STAT_KEYS = [
  'speed',
  'stamina',
  'agility',
  'balance',
  'precision',
  'intelligence',
  'boldness',
  'flexibility',
  'obedience',
  'focus',
  'strength',
  'endurance',
];

function sampleStat({ mean, std_dev }) {
  const z = (Math.random() + Math.random() - 1) * 1.41;
  return Math.max(1, Math.min(100, Math.round(mean + std_dev * z)));
}

function generateStoreStats(breedId) {
  const profile = BREED_GENETIC_PROFILES[breedId];
  if (profile?.starter_stats) {
    return Object.fromEntries(STAT_KEYS.map((k) => [k, sampleStat(profile.starter_stats[k])]));
  }
  return Object.fromEntries(STAT_KEYS.map((k) => [k, 20 + Math.floor(Math.random() * 26)]));
}

export async function buyStoreHorse(req, res) {
  try {
    const buyerId = req.user.id;
    const { breedId, sex } = req.body;

    // Validate inputs
    const parsedBreedId = parseInt(breedId, 10);
    if (!parsedBreedId || parsedBreedId < 1) {
      return res.status(400).json({ success: false, message: 'Valid breedId is required' });
    }
    if (!['mare', 'stallion'].includes(sex)) {
      return res.status(400).json({ success: false, message: 'sex must be mare or stallion' });
    }

    // Verify breed exists
    const breed = await prisma.breed.findUnique({ where: { id: parsedBreedId } });
    if (!breed) {
      return res.status(404).json({ success: false, message: 'Breed not found' });
    }

    // Atomic coin deduction
    const updatedUser = await prisma.$transaction(async (tx) => {
      const buyer = await tx.user.findUnique({ where: { id: buyerId } });
      if (!buyer) throw Object.assign(new Error('User not found'), { statusCode: 404 });
      if (buyer.money < STORE_PRICE) {
        throw Object.assign(new Error(`Insufficient funds. You need ${STORE_PRICE} coins.`), {
          statusCode: 400,
        });
      }
      return tx.user.update({
        where: { id: buyerId },
        data: { money: { decrement: STORE_PRICE } },
        select: { money: true },
      });
    });

    // Generate horse
    const stats = generateStoreStats(parsedBreedId);
    const horseName = `${breed.name} #${String(Math.floor(1000 + Math.random() * 9000))}`;
    const dateOfBirth = new Date();
    dateOfBirth.setFullYear(dateOfBirth.getFullYear() - 3);

    const newHorse = await createHorse({
      name: horseName,
      breedId: parsedBreedId,
      sex,
      age: 3,
      dateOfBirth: dateOfBirth.toISOString(),
      userId: buyerId,
      healthStatus: 'Excellent',
      ...stats,
    });

    logger.info(
      `[marketplace] User ${buyerId} bought store horse "${horseName}" (breed ${parsedBreedId}) for ${STORE_PRICE} coins`
    );

    return res.status(201).json({
      success: true,
      message: `${horseName} has been added to your stable!`,
      data: {
        horse: newHorse,
        pricePaid: STORE_PRICE,
        newBalance: updatedUser.money,
      },
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, message: err.message });
    }
    logger.error('buyStoreHorse error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}
```

---

#### TASK 2 — Backend: Register route in marketplaceRoutes.mjs

**File:** `backend/modules/marketplace/routes/marketplaceRoutes.mjs`

Add import and route:

```js
// Add to imports:
import {
  browseListings,
  listHorse,
  delistHorse,
  buyHorse,
  myListings,
  saleHistory,
  buyStoreHorse,
} from '../controllers/marketplaceController.mjs';

// Add route (before the :horseId dynamic route to avoid conflicts):
router.post('/store/buy', buyStoreHorse);
```

Full URL: `POST /api/v1/marketplace/store/buy`

---

#### TASK 3 — Frontend: Add `buyStoreHorse` to api-client.ts

**File:** `frontend/src/lib/api-client.ts`

Find the `marketplaceApi` object and add:

```ts
buyStoreHorse: (breedId: number, sex: 'mare' | 'stallion') =>
  apiClient.post<{
    horse: HorseSummary;
    pricePaid: number;
    newBalance: number;
  }>('/api/v1/marketplace/store/buy', { breedId, sex }),
```

Also add `Breed` type if not already exported:

```ts
export interface Breed {
  id: number;
  name: string;
  description?: string;
}
```

And add to `breedsApi` (or confirm it exists):

```ts
export const breedsApi = {
  list: () => apiClient.get<Breed[]>('/api/breeds'),
};
```

---

#### TASK 4 — Frontend: Create `useHorseTrader.ts` hook

**File:** `frontend/src/hooks/api/useHorseTrader.ts`

```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { marketplaceApi, breedsApi, type Breed } from '@/lib/api-client';

export const useBreeds = () =>
  useQuery<Breed[]>({
    queryKey: ['breeds'],
    queryFn: breedsApi.list,
    staleTime: 10 * 60 * 1000, // 10 min — breed list rarely changes
  });

export const useBuyStoreHorse = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ breedId, sex }: { breedId: number; sex: 'mare' | 'stallion' }) =>
      marketplaceApi.buyStoreHorse(breedId, sex),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['horses'] }); // refresh stable
      queryClient.invalidateQueries({ queryKey: ['profile'] }); // refresh balance
    },
  });
};
```

---

#### TASK 5 — Frontend: Create `HorseTraderPage.tsx`

**File:** `frontend/src/pages/HorseTraderPage.tsx`

Full implementation:

- `PageHero` with title "Horse Trader" and subtitle "Browse all 320 breeds. Pick your horse."
- `useBreeds()` — populate searchable combobox
- `useProfile()` — show current balance, disable buy if balance < 1000
- `useBuyStoreHorse()` — mutation on form submit
- **Breed selector:** Controlled input with `<input type="text">` filter + scrollable list of matching breeds (Command/combobox pattern using project's existing shadcn/ui components). Display selected breed name; store selected `breedId`.
- **Sex selector:** Two `<button>` toggles: Mare | Stallion (default: Mare)
- **Price display:** "1,000 coins" prominently shown
- **Balance display:** "Your balance: X coins" — warn style if < 1000
- **Buy button:** Disabled if no breed selected OR `isPending` OR balance < 1000
- **Success state:** Show `CinematicMoment` or inline success card with horse name + "View in Stable" link
- **Error state:** Inline error message (e.g. "Insufficient funds")

UI structure:

```
PageHero
└── max-w-2xl mx-auto px-4 py-8
    └── Glass card (bg-[var(--glass-bg)] border border-[var(--glass-border)])
        ├── Breed selector (searchable combobox)
        ├── Sex toggle (Mare | Stallion)
        ├── Price row: "Cost: 1,000 coins" | "Your balance: X coins"
        ├── Buy button (gold, full-width)
        └── Success/error feedback
```

---

#### TASK 6 — Frontend: Create `MarketplaceHubPage.tsx`

**File:** `frontend/src/pages/MarketplaceHubPage.tsx`

Copy the WorldHubPage structure exactly — two LocationCards:

```tsx
const marketplaceLocations = [
  {
    id: 'horse-trader',
    name: 'Horse Trader',
    description: 'Buy a 3-year-old horse of any breed. 320 breeds available. 1,000 coins each.',
    icon: '🐴',
    href: '/marketplace/horse-trader',
    paintingGradient:
      'linear-gradient(160deg, rgba(30,60,20,0.85) 0%, rgba(18,40,10,0.95) 60%, rgba(5,13,26,0.98) 100%)',
  },
  {
    id: 'horse-marketplace',
    name: 'Horse Marketplace',
    description: 'Buy and sell horses with other players. Browse listings or list your own.',
    icon: '🛒',
    href: '/marketplace/horses',
    paintingGradient:
      'linear-gradient(160deg, rgba(14,50,100,0.85) 0%, rgba(8,30,64,0.95) 60%, rgba(5,13,26,0.98) 100%)',
  },
];
```

PageHero: title "Marketplace", subtitle "Buy horses from the store or trade with other players."

Grid: `grid-cols-1 sm:grid-cols-2 gap-5` (only 2 cards — no need for 4-col)

---

#### TASK 7 — Frontend: Update nav-items.tsx

**File:** `frontend/src/nav-items.tsx`

Changes:

1. Import `MarketplaceHubPage` (lazy) — replace existing `HorseMarketplacePage` import at the `/marketplace` nav entry
2. Keep `HorseMarketplacePage` lazy import for the `/marketplace/horses` sub-route
3. Add `HorseTraderPage` lazy import

Update nav entry:

```tsx
// BEFORE:
{ title: 'Marketplace', to: '/marketplace', icon: ..., Page: HorseMarketplacePage }

// AFTER:
{ title: 'Marketplace', to: '/marketplace', icon: ..., Page: MarketplaceHubPage }
// Add sub-routes (no icon, not shown in main nav):
{ to: '/marketplace/horses', Page: HorseMarketplacePage }
{ to: '/marketplace/horse-trader', Page: HorseTraderPage }
```

Check: does nav-items render icon-less entries in the sidebar? If not, sub-routes may need to go directly in App.tsx as additional `<Route>` entries alongside `navItems.map(...)`. Inspect App.tsx to confirm the correct pattern before choosing approach.

---

### Acceptance Criteria

**AC-1: Marketplace Hub**

- Given: user navigates to `/marketplace`
- When: page loads
- Then: two LocationCards are visible — "Horse Trader" and "Horse Marketplace"
- Then: clicking "Horse Trader" navigates to `/marketplace/horse-trader`
- Then: clicking "Horse Marketplace" navigates to `/marketplace/horses`

**AC-2: Breed search**

- Given: user is on `/marketplace/horse-trader`
- When: user types "Arab" in the breed search
- Then: dropdown filters to breeds containing "Arab" (case-insensitive)
- When: user selects a breed
- Then: breed name is shown in the selector and breedId is captured

**AC-3: Successful purchase**

- Given: user has ≥ 1,000 coins and has selected a breed and sex
- When: user clicks "Buy Horse"
- Then: POST `/api/v1/marketplace/store/buy` is called with `{ breedId, sex }`
- Then: user's coin balance decreases by 1,000
- Then: a new 3-year-old horse appears in the user's stable
- Then: success message shows the horse's auto-generated name
- Then: "View in Stable" link is shown

**AC-4: Insufficient funds**

- Given: user has < 1,000 coins
- When: page loads
- Then: Buy button is disabled
- Then: balance is shown in warning style
- When: user somehow submits (e.g. race condition)
- Then: backend returns 400 "Insufficient funds" and frontend shows error message

**AC-5: No breed selected**

- Given: user has not selected a breed
- When: page loads
- Then: Buy button is disabled

**AC-6: Existing marketplace unaffected**

- Given: user navigates to `/marketplace/horses`
- Then: existing HorseMarketplacePage renders correctly with no regressions
- Then: all tabs (Browse, My Listings, Sale History) work as before

**AC-7: Backend stat generation**

- Given: canonical breed (ID 1–12)
- When: horse is created via store
- Then: stats are sampled from BREED_GENETIC_PROFILES[breedId].starter_stats (mean ± std_dev)
- Given: non-canonical breed (ID > 12)
- When: horse is created via store
- Then: stats are each random integers in range 20–45

---

## Additional Context

### Dependencies

- `LocationCard` component — already exists, no changes needed
- `PageHero` component — already exists, no changes needed
- `createHorse()` in horseModel.mjs — already exists, no changes needed
- `GET /api/breeds` — already exists, returns all 320 breeds sorted A–Z
- shadcn/ui `Command` or `Combobox` — check if already in project before adding; if not, implement simple filter-list pattern with a controlled `<input>` + scrollable `<ul>`
- `CinematicMoment` — already exists at `frontend/src/components/feedback/CinematicMoment.tsx`, optional for success state

### Testing Strategy

**Backend (Jest):**

- Unit test `generateStoreStats()`: canonical breed returns stats in expected range; non-canonical returns 20–45
- Integration test `POST /api/v1/marketplace/store/buy`:
  - Happy path: valid breedId + sex + sufficient funds → 201 + horse created + balance decremented
  - Insufficient funds → 400
  - Invalid breedId → 404
  - Invalid sex → 400
  - Unauthenticated → 401

**Frontend (Vitest/MSW):**

- Add MSW handler: `http.post('*/api/v1/marketplace/store/buy', () => HttpResponse.json({ success: true, data: { horse: {...}, pricePaid: 1000, newBalance: 4000 } }))`
- Test `HorseTraderPage`: breed search filters correctly; buy button disabled with no breed; success state shown after purchase
- Test `MarketplaceHubPage`: both cards render with correct hrefs

### Notes

- The `POST /store/buy` path is intentionally nested under `/marketplace/store/buy` (not `/marketplace/buy/:horseId`) to avoid conflict with the existing `POST /buy/:horseId` user-to-user purchase route.
- `createHorse()` is called **outside** the `$transaction` block. This is intentional — Prisma transactions don't support nested client calls easily. The risk of partial failure (coins deducted, horse not created) is accepted for now; a future story can add idempotency/refund logic.
- The Breadcrumb component (`frontend/src/components/layout/Breadcrumb.tsx`) has a hardcoded `marketplace: 'Marketplace'` label. Sub-routes `/marketplace/horses` and `/marketplace/horse-trader` may show generic breadcrumbs — update the breadcrumb map if needed.
