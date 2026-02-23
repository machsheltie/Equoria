# Epic 12: Stable Management Completions

**Status:** Complete (Stories 12-1 through 12-5)
**Completed:** 2026-02-23
**Branch:** cleanup-session-2026-01-30

---

## Overview

Five stories completing the stable management layer of the game UI. Three new standalone
pages (Bank, Inventory, My Stable) plus three new tabs in HorseDetailPage (Pedigree,
Health/Vet, Stud/Sale) and a sticky bottom action bar.

All new standalone pages use the **Celestial Night** theme.
HorseDetailPage tabs use the **parchment/fantasy** theme (matching existing tabs).

---

## Stories

### 12-1: Bank / Currency UI (`/bank`)

**File:** `frontend/src/pages/BankPage.tsx`

- Balance display card (mock balance: 4,850 coins)
- Weekly reward claim button (+500 coins, shows "Claimed" state after click)
- Transaction history list (6 mock entries, credit/debit with icons, date, amount)
- Info panel (5 bullet points)
- Theme accent: celestial-gold

---

### 12-2: Inventory Page (`/inventory`)

**File:** `frontend/src/pages/InventoryPage.tsx`

- Category filter tablist: All / Tack / Consumables / Special
- Item grid (8 mock items across 3 categories)
- Each card shows: icon, name, bonus (if tack), description, quantity, equipped state
- Equipped items show horse name and disabled Unequip button
- Unequipped items show disabled "Equip to Horse" / "Use on Horse" button
- Empty state when filtering produces no results
- Theme accent: violet

---

### 12-3: My Stable Page (`/my-stable`)

**File:** `frontend/src/pages/MyStablePage.tsx`

- Tab 1: "Stable Profile" — banner, stable name/founded/bio, 6 stat blocks, link to /stable
- Tab 2: "Hall of Fame" — 3 mock retired horses with career stats (competitions/wins/earnings)
- Disabled "Edit Profile" button (coming soon)
- Theme accent: celestial-gold / violet

---

### 12-4: Horse Profile Missing Tabs

**File:** `frontend/src/pages/HorseDetailPage.tsx`

Three new inline tab components added (parchment/fantasy theme throughout):

**Pedigree Tab** (`data-testid="pedigree-tab"`)

- Shows sire and dam sections
- If parentIds.sireId exists → clickable link to parent horse page
- If parentIds.damId exists → clickable link to parent horse page
- "No Pedigree Recorded" empty state for horses not bred in-game
- Offspring placeholder section

**Health & Vet Tab** (`data-testid="health-vet-tab"`)

- Current health status display with colour coding (healthy=green, injured=amber)
- 3 mock vet history records (date, type, result, vet name)
- "Book Appointment" panel → links to /vet
- Next recommended check date

**Stud / Sale Tab** (`data-testid="stud-sale-tab"`)

- Current listing status display
- "Offer as Stud Service" button (stallions only, disabled/coming soon)
- "List for Sale" button (all genders, disabled/coming soon)
- Links to /marketplace
- `useState` for optimistic listing type toggle (UI-only for now)

TabType union extended: added `'pedigree' | 'health' | 'stud-sale'`
New lucide imports: `GitBranch`, `Stethoscope`, `Tag`
`Link` added to react-router-dom imports
Removed pre-existing unused imports: `ChevronDown`, `HorseCard`

---

### 12-5: Horse Profile Action Bar

**File:** `frontend/src/pages/HorseDetailPage.tsx`

Sticky bottom action bar (`position: fixed, bottom-0`):

- `data-testid="horse-action-bar"`
- **Feed** — disabled, tooltip "coming soon"
- **Train** — navigates to `/training?horseId=X`
- **Breed** — navigates to `/breeding?horseId=X`
- **Assign Rider** — disabled, tooltip "coming soon"
- **List / Stud** — activates the `stud-sale` tab (scrolls to Stud/Sale view)

`pb-20` added to outermost page div to prevent content hiding behind sticky bar.

---

## Route Registration

`frontend/src/nav-items.tsx` — 3 new routes added under "Epic 12 — Stable management pages":

- `/bank` → `BankPage`
- `/inventory` → `InventoryPage`
- `/my-stable` → `MyStablePage`

All use `icon: null` (route-only, not shown in MainNavigation bar).

---

## Acceptance Criteria Status

- [x] `/bank` route renders BankPage with balance, weekly claim, transaction history
- [x] `/inventory` route renders InventoryPage with category filter and item grid
- [x] `/my-stable` route renders MyStablePage with profile + hall of fame tabs
- [x] HorseDetailPage has Pedigree tab with sire/dam links (or empty state)
- [x] HorseDetailPage has Health & Vet tab with mock history + vet clinic link
- [x] HorseDetailPage has Stud / Sale tab with gender-aware listing options
- [x] HorseDetailPage has sticky bottom action bar (Feed/Train/Breed/Assign/List)
- [x] All standalone pages: breadcrumb, page header, Celestial Night theme
- [x] All HorseDetailPage tabs: parchment/fantasy theme, data-testid attributes
- [x] TypeScript: 0 new errors in Epic 12 files
- [x] ESLint: 0 errors/warnings in all Epic 12 files

---

## Notes

- All backend routes are mock-ready (no API calls yet)
- BankPage balance and transactions use MOCK\_\* constants (labelled for easy replacement)
- InventoryPage items use MOCK_INVENTORY (labelled for easy replacement)
- MyStablePage uses MOCK_STABLE and MOCK_HALL_OF_FAME (labelled for easy replacement)
- HealthVetTab uses MOCK_VET_HISTORY (labelled for easy replacement)
- StudSaleTab listing buttons are disabled pending backend implementation
- Celestial Night theme: `celestial-gold`, `bg-white/5`, `border-white/10`, `text-white/70`
- Parchment theme: `bg-parchment`, `text-aged-bronze`, `text-midnight-ink`, `border-burnished-gold`
