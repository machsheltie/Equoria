# Epic 10: World Locations (Service Hubs)

**Status:** Complete (Stories 10-1 through 10-4)
**Completed:** 2026-02-23
**Branch:** cleanup-session-2026-01-30
**Story 10-5 (Wire API):** Deferred — no backend routes exist yet

---

## Overview

Five World Hub sub-location pages, each accessible from the World Hub (`/world`) via a
location card. Each page follows the same tabbed layout pattern established by `RidersPage.tsx`:

- Breadcrumb: World / Location Name
- Page header with back arrow, emoji h1, subtitle
- Two tabs: `role="tablist"` with `role="tab"` buttons
- Tab content in `role="tabpanel"`
- Info panel with 5 bullet points

Backend routes are mock-ready (no API calls yet). All buttons are disabled with
"Select a Horse to Book/Purchase" tooltips pending Story 10-5.

---

## Stories

### 10-1: Vet Clinic (`/vet`)

**File:** `frontend/src/pages/VeterinarianPage.tsx`

- Tab 1: "My Horses" — empty state + link to `/stable`
- Tab 2: "Services" — 4 service cards
  - Health Check ($150, 30 min) 🩺
  - Injury Treatment ($400, 1–3 days) 💊
  - Genetics Analysis ($800, 2 days) 🧬
  - Vetting Certificate ($250, 1 day) 📋
- Theme accent: emerald

---

### 10-2: Farrier (`/farrier`)

**File:** `frontend/src/pages/FarrierPage.tsx`

- Tab 1: "My Horses" — empty state + link to `/stable`
- Tab 2: "Services" — 4 service cards
  - Hoof Trim ($75, 20 min) ✂️
  - Standard Shoeing ($200, 45 min) 🧲
  - Corrective Shoeing ($450, 1–3 days) 🔧
  - Emergency Shoe Removal ($100, 30 min) ⚠️
- Theme accent: amber

---

### 10-3: Feed Shop (`/feed-shop`)

**File:** `frontend/src/pages/FeedShopPage.tsx`

- Tab 1: "My Horses" — empty state + link to `/stable`
- Tab 2: "Shop" — 4 item cards
  - Basic Feed ($50/week) 🌾
  - Performance Mix ($120/week) ⚡
  - Vitamin Supplement ($80/month) 💊
  - Custom Diet Plan ($300, one-time) 📋
- Theme accent: lime

---

### 10-4: Tack Shop (`/tack-shop`)

**File:** `frontend/src/pages/TackShopPage.tsx`

- Tab 1: "My Horses" — empty state + link to `/stable`
- Tab 2: "Shop" — 4 item cards in 2 sections (Saddles / Bridles)
  - Training Saddle ($500, +5% training efficiency) 🪣
  - Competition Saddle ($1,200, +8% competition score) 🏆
  - Standard Bridle ($350, +3% obedience) 🔗
  - Competition Bridle ($800, +6% competition score) ⭐
- Theme accent: sky

---

### Grooms Page (`/grooms`)

**File:** `frontend/src/pages/GroomsPage.tsx`

- Wraps existing `MyGroomsDashboard` + `GroomList` components (Epic 7)
- Tab 1: "Manage Grooms" → `<MyGroomsDashboard userId={userId} />`
- Tab 2: "Hire Grooms" → `<GroomList userId={userId} />`
- Mirrors `RidersPage.tsx` pattern exactly

---

### 10-5: Wire World Locations to Live API

**Status: Deferred** — No backend routes exist for vet/farrier/feed-shop/tack-shop.
All pages are mock-ready with disabled action buttons pointing at expected API paths.

---

## Navigation Integration

- `WorldHubPage.tsx` — 5 broken `/stable` hrefs fixed:
  - `vet` → `/vet`
  - `farrier` → `/farrier`
  - `tack-shop` → `/tack-shop`
  - `feed-shop` → `/feed-shop`
  - `grooms` → `/grooms`
- `nav-items.tsx` — 5 new routes registered for `App.tsx` route mapping
  (World sub-locations do not appear in main nav bar — `MainNavigation` uses its own hardcoded list)

---

## Acceptance Criteria Status

- [x] `/vet` route renders `VeterinarianPage`
- [x] `/farrier` route renders `FarrierPage`
- [x] `/feed-shop` route renders `FeedShopPage`
- [x] `/tack-shop` route renders `TackShopPage`
- [x] `/grooms` route renders `GroomsPage`
- [x] World Hub location cards link to correct routes (not `/stable`)
- [x] All pages: breadcrumb + back arrow + tablist + tabpanel + info panel
- [x] Services/shop items show cost, duration/billing, disabled book/purchase button
- [x] TypeScript: 0 errors in all Epic 10 files
- [x] ESLint: 0 errors/warnings in all Epic 10 files

---

## Notes

- No backend exists yet for any of these locations (except Grooms which has existing Epic 7 hooks)
- Grooms page wires directly to live API via existing `useGrooms` hooks
- All other pages are forward-looking UI with disabled actions
- Celestial Night theme tokens used consistently throughout
