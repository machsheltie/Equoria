# Feed System Redesign — Design Doc

**Status:** Approved (brainstorm complete, ready for implementation plan)
**Date:** 2026-04-29
**Author:** brainstorm session — heirregular@yahoo.com + Claude
**Scope:** Backend + frontend + schema migration. Replaces the current per-horse feed-purchase model with a separate inventory + manual daily-feeding loop.

---

## 1. Problem

The current feed system has three structural defects:

1. The **Feed button on the horse page navigates to the Feed Shop** instead of feeding the horse. The shop is the wrong destination — the shop is for buying, the horse page is for action.
2. The **purchase flow is per-horse**: every transaction is `{horseId, feedId} → debit money + apply feed in one shot`. There's no inventory layer. Players can never run out of feed for a specific horse, and feed isn't a managed resource.
3. **Feeding is implicitly automated** — buying _is_ feeding. There's no manual "feed today" action that a player must perform daily.

The redesign separates concerns:

- The **Feed Shop** sells feed in bulk (100-unit packs). It lives in the World hub; the horse page no longer redirects there.
- **Inventory** holds owned feed units, pooled across the player (not per-horse).
- **Equipping** a feed type to a horse is persistent and decoupled from purchase.
- **Feeding** is a manual, once-per-day action initiated from the horse page. It consumes 1 unit of the equipped feed.
- **Health** is a derived projection of "days since last feeding." Neglected horses degrade, recover instantly on the next feeding, and lock out of breeding/competition at `Critical`.

## 2. Goals & Non-Goals

**Goals**

- Manual daily feeding loop with meaningful resource management.
- Five-tier feed catalog with differentiated effects (random stat-boost rolls + pregnancy epigenetic bonuses).
- Visible health bands tied to feeding consistency.
- Hard gate: critical-health horses cannot breed or enter competitions.

**Non-Goals**

- Auto-feed automation, scheduled-feeding cron, or "set and forget" toggles.
- Feed expiration or spoilage.
- Per-discipline feed bonuses (the stat-boost roll is uniform across all 12 stats).
- Migration of existing live data (the player base is one tester with two test horses; wipe is acceptable).

## 3. Decisions Log

| #   | Question                                  | Decision                                                                                                                                                                                                                                                                                                                                            |
| --- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | What do the 5 tiers do mechanically?      | All prevent the no-feed penalty. Higher tiers add a random per-feeding stat-boost roll (Performance 10%, Performance Plus 15%, High Performance 20%, Elite 25%) and a pregnancy epigenetic bonus (Performance +5%, Performance Plus +10%, High Performance +15%, Elite +20%). Basic is neutral.                                                     |
| 2   | How much feed does one feeding consume?   | 1 unit, regardless of tier.                                                                                                                                                                                                                                                                                                                         |
| 3   | What happens if the user doesn't feed?    | Health degrades through Excellent → Good → Fair → Poor → Critical. Horses do not die. Pregnant mares accrue missed-day penalties to the foal's epigenetic outcome (5% negative-trait chance per missed day). At age 21+, horses retire and feeding is no longer required.                                                                           |
| 4   | Daily feeding UX                          | The horse page Feed button calls a feed mutation directly. The Equip button (renamed from "Equip Tack") routes to a new per-horse Equip page that lists tack (filtered: not equipped on other horses) and feed (always shown). Empty feed state: "No feed currently selected. Please purchase feed from the feed store and equip it to your horse." |
| 5   | Inventory link placement                  | Add Inventory to the sidebar. Remove Training (still in the World hub).                                                                                                                                                                                                                                                                             |
| 6   | Existing data                             | Wipe. Existing `currentFeed`, `energyLevel`, and prior feed transaction states are dropped. The player has two test horses; no production data to preserve.                                                                                                                                                                                         |
| 7   | Feed history during pregnancy (option C2) | Counter on the pregnancy record: `feedingsByTier: {basic: n, performance: n, ...}`. Incremented on each feeding while the mare is in-foal. At foaling, weighted average produces positive trait chance; missed days produce negative.                                                                                                               |
| 8   | Mixed-feeding fairness                    | Linear weighted average. `positive_chance = Σ(count × bonus_pct) / max(7, total_feedings)`. `negative_chance = unfed_days × 5%`. Both rolls independent.                                                                                                                                                                                            |
| 9   | Daily rollover boundary                   | UTC midnight (server-authoritative, deterministic).                                                                                                                                                                                                                                                                                                 |
| 10  | Stat cap                                  | None. Stats are unbounded. The boost picks uniformly from all 12 stats with no filtering.                                                                                                                                                                                                                                                           |
| 11  | Beta-readiness scheduling                 | Land in parallel with the 21R lockdown (option B). The readiness gate re-runs against the new feed surface before signoff.                                                                                                                                                                                                                          |

## 4. Architecture

```
┌─────────────────────┐
│   Feed Shop (World) │── GET /api/feed-shop/catalog
│   bulk 100-packs    │── POST /api/feed-shop/purchase  ─┐
└─────────────────────┘                                  │ debits money
                                                         │ accumulates
                                                         ▼
┌─────────────────────────────────────────────────────────────┐
│ User.settings.inventory  (JSONB — existing)                  │
│   feed-{tier} rows: { quantity: N, category: 'feed', ... }   │
└─────────────────────────────────────────────────────────────┘
            ▲                            │
            │ buy / decrement            │ read for Equip page
            │                            ▼
            │              ┌─────────────────────────────────────┐
            │              │ HorseEquipPage (/horses/:id/equip)  │
            │              │   tack: filtered to this-or-free    │
            │              │   feed: all in inventory            │
            │              └─────────────────────────────────────┘
            │                            │ POST equip-feed
            │                            ▼
            │              ┌─────────────────────────────────────┐
            │              │ Horse.equippedFeedType (new column) │
            │              └─────────────────────────────────────┘
            │                            │
            │                            ▼
            │              ┌─────────────────────────────────────┐
            │              │ Feed button on Horse page           │
            └──────────────│   POST /api/horses/:id/feed         │
              decrement 1  │   - validates equipped + units       │
                           │   - sets lastFedDate = now           │
                           │   - rolls stat boost (server RNG)    │
                           │   - increments pregnancy counter     │
                           │     if mare is in-foal               │
                           └─────────────────────────────────────┘
                                         │
                                         ▼
                           ┌─────────────────────────────────────┐
                           │ Health = derived from lastFedDate   │
                           │   read-time only, never stored      │
                           │   gates breeding + competition      │
                           └─────────────────────────────────────┘
```

## 5. Data Model

### 5.1 `User.settings.inventory` (JSONB — existing, extended)

Feed lives alongside tack. New row shape:

```json
{
  "id": "feed-basic",
  "itemId": "basic",
  "category": "feed",
  "name": "Basic Feed",
  "quantity": 100
}
```

- ID is stable per-tier (not per-purchase). Buying another pack of the same tier increments `quantity` on the existing row.
- Feeding decrements `quantity`. When `quantity ≤ 0`, the row is pruned AND `Horse.equippedFeedType` is auto-cleared on any horse pointing to that tier.

### 5.2 `Horse` model (Prisma — schema change)

| Field                     | Action   | Type                  | Notes                                                                                                                        |
| ------------------------- | -------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `equippedFeedType`        | **ADD**  | `String?`             | `'basic' \| 'performance' \| 'performancePlus' \| 'highPerformance' \| 'elite' \| null`                                      |
| `lastFedDate`             | KEEP     | `DateTime?`           | Drives feed-health bands and once-per-day check                                                                              |
| `lastVettedDate`          | KEEP     | `DateTime?`           | Drives vet-health bands (recon Finding 2 → α: weekly decay)                                                                  |
| `healthStatus`            | KEEP     | `String?`             | **Vet-override**. When non-null, overrides the lastVettedDate-derived band. Used by existing vet-finding outcomes (illness). |
| `inFoalSinceDate`         | **ADD**  | `DateTime?`           | Set on conception (Phase B). NULL = mare is not in-foal.                                                                     |
| `pregnancySireId`         | **ADD**  | `Int?`                | Sire of the active pregnancy. Cleared at foaling. Recon Finding 3 → P1+ extension.                                           |
| `pregnancyFeedingsByTier` | **ADD**  | `Json @default("{}")` | Feed-tier counter accumulator. `{basic: n, performance: n, ...}`. Reset to `{}` at foaling.                                  |
| `currentFeed`             | **DROP** | —                     | Redundant with `equippedFeedType`                                                                                            |
| `energyLevel`             | **DROP** | —                     | Feed-health is derived from `lastFedDate`; no separate stat                                                                  |
| `coordination`            | **DROP** | —                     | Recon Finding 1 → B: removed from schema entirely. Cleanup task scans for any remaining reads/writes.                        |

### 5.3 In-foal state (columns on `Horse`, recon Finding 3 → P1+)

Per recon Finding 3: the codebase has no `Pregnancy` model. The in-foal window is a transient property of the dam, so it lives as three columns on `Horse`:

- `inFoalSinceDate`: set when breeding occurs (Phase B), cleared when foal is born.
- `pregnancySireId`: foreign key to the sire of the active pregnancy. Cleared at foaling. Lets the foaling job correctly attribute the resulting foal's `sireId`.
- `pregnancyFeedingsByTier`: incremented on each feeding while `inFoalSinceDate IS NOT NULL`. Reset to `{}` at foaling.

The current `createFoal` endpoint (`backend/modules/horses/controllers/horseController.mjs:234`) creates foals **instantly** with no delay. **Phase B** of the implementation plan refactors that to:

1. Breeding endpoint sets `dam.inFoalSinceDate = now`, `dam.pregnancySireId = sireId`. No foal record created yet.
2. A scheduled foaling job (cron or on-read poll) fires at `inFoalSinceDate + 7 days`.
3. The job reads `pregnancyFeedingsByTier`, runs the formula (§8.2), rolls positive/negative epigenetic traits, creates the foal record (using existing `createFoal` logic minus the synchronous-create scaffold), and resets the dam's pregnancy columns to `null`/`{}`.

The resulting foal record itself becomes the historical audit (it has `damId`, `sireId`, and `createdAt` — gestation can be reconstructed by correlating `createdAt − 7 days` with the dam's `lastBredDate`). No separate audit table needed.

### 5.3.1 Combined health model (recon Finding 2 → α: symmetric two-derived + min)

Both vet-health and feed-health are **derived**, never stored. The displayed health is the **worse of the two** — worst factor wins.

- **`getVetHealth(horse)`** — computed from `lastVettedDate` with weekly decay; overridable by `healthStatus` for vet-finding outcomes:

  - If `healthStatus` is non-null → return `healthStatus` (vet-finding override).
  - Else if `horse.age >= 21` → `'retired'`.
  - Else if `lastVettedDate IS NULL` → `'critical'`.
  - Else compute days-since-last-vet (UTC) → bands:
    - `≤ 7 days` → `'excellent'`
    - `8–14` → `'good'`
    - `15–21` → `'fair'`
    - `22–28` → `'poor'`
    - `29+` → `'critical'`

- **`getFeedHealth(horse)`** — computed from `lastFedDate` with daily decay (see §5.4 below).

- **`getDisplayedHealth(horse) = worseOf(vetHealth, feedHealth)`** where `worseOf` returns the band closer to `'critical'` on the order `excellent < good < fair < poor < critical`. (`'retired'` is special: if either side returns `'retired'`, the displayed health is `'retired'` — overrides both.)

The breeding and competition-entry gates check **`displayedHealth === 'critical'`**.

Horse JSON exposes all three bands so the UI can show what's going on:

```jsonc
{
  "id": 42,
  "name": "Star",
  "feedHealth": "good",      // derived from lastFedDate
  "vetHealth": "fair",       // derived from lastVettedDate (or healthStatus override)
  "displayedHealth": "fair", // min of the two — what gates check, what badge shows
  ...
}
```

### 5.4 Feed-health (computed, never stored)

```js
function getFeedHealth(horse, now = new Date()) {
  if (horse.age >= 21) return 'retired';
  if (!horse.lastFedDate) return 'critical';
  const days = Math.floor((startOfUtcDay(now) - startOfUtcDay(horse.lastFedDate)) / 86400000);
  if (days <= 2) return 'excellent';
  if (days <= 4) return 'good';
  if (days <= 6) return 'fair';
  if (days <= 8) return 'poor';
  return 'critical';
}
```

Lives in `backend/utils/horseHealth.mjs` (alongside `getVetHealth` and `getDisplayedHealth`). Used by horse-read serializers, plus the breeding and competition-entry gates.

### 5.5 Feed catalog (replaces existing `FEED_CATALOG`)

| ID                | Name                  | Pack price | Per unit | Stat-roll % | Pregnancy bonus % |
| ----------------- | --------------------- | ---------- | -------- | ----------- | ----------------- |
| `basic`           | Basic Feed            | 100        | 1.00     | 0%          | 0%                |
| `performance`     | Performance Feed      | 125        | 1.25     | 10%         | +5%               |
| `performancePlus` | Performance Plus Feed | 150        | 1.50     | 15%         | +10%              |
| `highPerformance` | High Performance Feed | 175        | 1.75     | 20%         | +15%              |
| `elite`           | Elite Feed            | 200        | 2.00     | 25%         | +20%              |

All packs sold in 100-unit increments. No singletons.

## 6. Backend API Surface

### 6.1 Feed Shop (rewritten — bulk only, no per-horse)

**`GET /api/feed-shop/catalog`**

Returns the 5-tier catalog. No horse data. Every entry includes id, name, description, packPrice, perUnit, statRollPct, pregnancyBonusPct.

**`POST /api/feed-shop/purchase`**

Body: `{ feedTier, packs }`

- Validates `feedTier` is in catalog.
- Validates `packs` is integer ≥ 1.
- Validates user balance ≥ `packPrice × packs`.
- Single transaction: debit `packPrice × packs` coins, increment `inventory[feed-{tier}].quantity` by `100 × packs`, record financial transaction with `category: 'feed_purchase'`.
- Returns: updated inventory row, remaining balance.

### 6.2 Per-horse feed actions

**`POST /api/horses/:id/equip-feed`** — Body: `{ feedType }`

- Ownership check.
- Validates user has ≥ 1 unit of `feedType` in inventory.
- Sets `Horse.equippedFeedType`. Idempotent.

**`POST /api/horses/:id/unequip-feed`**

- Ownership check.
- Sets `equippedFeedType = null`.

**`POST /api/horses/:id/feed`** — the daily feed action

```
1. Ownership check.
2. If horse.age >= 21          → 200 { skipped: 'retired' }, no mutations.
3. If equippedFeedType is null → 400 "No feed currently selected.
                                 Please purchase feed from the feed store
                                 and equip it to your horse."
4. If alreadyFedToday(horse.lastFedDate) → 400 "Already fed today.
                                            Try again tomorrow."
5. If inventory[feed-{tier}].quantity < 1 → 400 "Out of {Tier Name}.
                                             Purchase more from the feed shop."
6. Begin transaction:
   a. Decrement inventory[feed-{tier}].quantity by 1.
      If quantity hits 0, prune the row AND clear horse.equippedFeedType.
   b. Set horse.lastFedDate = now.
   c. Roll stat boost (server-side RNG, statRollPct from catalog).
      On success: pick 1 of 12 stats uniform-random, increment by 1.
   d. If horse is in-foal: increment pregnancy.feedingsByTier[tier] by 1.
7. Return:
   {
     success: true,
     horse: { id, name, lastFedDate, equippedFeedType, health, ... },
     feed: { tier, name },
     remainingUnits: <int>,
     statBoost: { stat: 'speed', amount: 1 } | null,
     pregnancyUpdate: { feedingsByTier } | null,
     equippedFeedClearedDueToEmpty: true | false
   }
```

### 6.3 Equippable view

**`GET /api/horses/:id/equippable`**

Returns `{ tack: [...], feed: [...] }` filtered for THIS horse:

- **Tack:** items where `category != 'feed'` AND (`equippedToHorseId` is null OR `equippedToHorseId === :id`). Items equipped to other horses are excluded.
- **Feed:** all feed-category inventory rows. Each includes `{ feedType, name, quantity, isCurrentlyEquippedToThisHorse }`. Multi-horse sharing OK.

### 6.4 Cross-cutting modifications

- **Horse read endpoints** (list + detail + full): inject `feedHealth`, `vetHealth`, and `displayedHealth` fields on every response (computed via `backend/utils/horseHealth.mjs`).
- **Breeding controller**: pre-flight check at `POST /api/breeding/breed`. Reject if `getDisplayedHealth(sire) === 'critical'` OR `getDisplayedHealth(dam) === 'critical'` with 400 and which-horse error.
- **Competition entry controller**: pre-flight check at `POST /api/competition/enter`. Reject if `getDisplayedHealth(horse) === 'critical'` with 400.
- **No re-check** at scheduled-action time (cron-driven competition runs and foal births). The gate is one-way at entry time. In-flight pregnancies and entries proceed to completion regardless of subsequent health changes.

### 6.5 Recovery & gate semantics

A single feeding sets `lastFedDate = now` → health → `excellent` immediately. No recovery period. A critical-health horse fed once is competition-eligible the same minute.

## 7. Frontend Pages & Components

### 7.1 Sidebar (`frontend/src/lib/nav-items.tsx`)

| Change | Item      | Path                         |
| ------ | --------- | ---------------------------- |
| Add    | Inventory | `/inventory`                 |
| Remove | Training  | `/training` (still in World) |

### 7.2 HorseDetailPage action bar

The sticky bottom action bar (currently around line 659 in `HorseDetailPage.tsx`):

**Feed button** (current line ~669-683):

- ❌ Today: `onClick={() => navigate('/feed-shop?horseId=' + horse.id)}`
- ✅ New: `onClick={() => feedHorse(horse.id)}` — calls `useFeedHorse` mutation.
- Disabled with tooltip when:
  - `equippedFeedType === null` → "No feed selected. Click Equip first."
  - already-fed-today → "Fed today. Available again at UTC midnight."
  - retired → "Retired."
- Success toast: `"Fed {horse.name} with {feedName}. {remaining} units left."`
- Stat-boost rolled: inline sparkle toast `"+1 Speed!"`. (Plain toast, not full `CinematicMoment` — that's reserved for foal-birth/cup-win.)

**Equip Tack button** (somewhere on the horse page today):

- Rename label: `Equip`.
- ❌ Today: navigates to tack shop.
- ✅ New: `navigate('/horses/' + horse.id + '/equip')`.

**Health badge** in the horse header:

- New chip near the name: `Excellent | Good | Fair | Poor | Critical | Retired`, color-coded.
- `Critical`: red, subtle pulse, one-line warning "Cannot breed or compete until fed."

### 7.3 New page: HorseEquipPage

Route: `/horses/:id/equip`. Title: `Equip — {horseName}`.

**Tack section**: items where `equippedToHorseId ∈ {null, this horse}`. Each row: name, bonus, equip/unequip button.

**Feed section**:

- If `horse.equippedFeedType === null`: empty-state card with the exact copy "No feed currently selected. Please purchase feed from the feed store and equip it to your horse." + primary button "Go to Feed Shop" → `/feed-shop`.
- Otherwise: top card shows currently-equipped feed with `Unequip` button.
- Below: list of all feed types in inventory with quantities. Each row has `Equip` (or `Equipped ✓` badge if it's this horse's pick). Quantity-zero rows not shown.

### 7.4 Rewritten FeedShopPage

Strip the "My Horses" tab entirely. Single screen — list of 5 cards:

```
[Banner image]
[Your balance: 12,450 coins]

Basic Feed              100 coins / 100-unit pack
[description, stat-roll %, pregnancy bonus %]
Packs: [- 1 +]    Total: 100 coins   [Buy 100 units →]

Performance Feed        125 coins / 100-unit pack
…
Performance Plus Feed   150 coins / 100-unit pack
…
High Performance Feed   175 coins / 100-unit pack
…
Elite Feed              200 coins / 100-unit pack
…
```

- Pack stepper (default 1, min 1, max gated by user balance).
- Buy button shows total cost: `Buy 300 units (300 coins)`.
- Success toast: `"Purchased 300 units of Performance Feed."` Invalidates `['inventory']` and `['user', 'balance']`.
- The existing onboarding anchor `data-onboarding-target="feed-shop-purchase-button"` moves to the Basic Feed buy button.

### 7.5 InventoryPage updates

- Add `Feed` category tab (separate from `Consumables`). Categories: `All | Saddle | Bridle | Feed | Consumables | Special`.
- Feed rows render as `{name} ×{quantity}` with no Equip button. (Feed is equipped from the horse's Equip page, not from inventory.)

### 7.6 Pregnancy feed visibility

On `HorseDetailPage` for an in-foal mare, in the breeding/health section:

```
In foal — gestation day 4 of 7
Feedings so far:
  • Elite × 3
  • Performance × 1
  • Missed × 0
Projected positive trait chance: ~9.3%   (= (3×20 + 1×5) / 7)
Projected negative trait chance: 0%
```

Makes the weighted-average decision visible to the player.

### 7.7 React Query hooks

- `useFeedCatalog()` — refactored, new shape.
- `usePurchaseFeed()` — `mutate({ feedTier, packs })`. Invalidates `['inventory']`, `['user', 'balance']`.
- `useFeedHorse(horseId)` — new. Invalidates `['inventory']`, `['horses', horseId]`, `['horses']`, `['pregnancy', horseId]` if applicable.
- `useEquipFeed(horseId)` / `useUnequipFeed(horseId)` — new.
- `useEquippableForHorse(horseId)` — new. `staleTime: 30s`.

## 8. Game Mechanics & Formulas

### 8.1 Stat-boost roll

```js
const ROLL_PCT = { basic: 0, performance: 10, performancePlus: 15, highPerformance: 20, elite: 25 };

// 12 stat fields on Horse, post-coordination removal (recon Finding 1 → B).
// Names match schema.prisma:131-144 minus `coordination`.
const STATS = [
  // Base stats (6)
  'precision',
  'strength',
  'speed',
  'agility',
  'endurance',
  'intelligence',
  // Additional competition stats (6, post-coordination drop)
  'stamina',
  'balance',
  'boldness',
  'flexibility',
  'obedience',
  'focus',
];

function rollStatBoost(feedTier) {
  const chance = ROLL_PCT[feedTier];
  if (chance === 0) return null;
  if (Math.random() * 100 >= chance) return null;
  const stat = STATS[Math.floor(Math.random() * STATS.length)];
  return { stat, amount: 1 };
}
```

- Server-side only. Never trust client-supplied "I rolled X" claims.
- Stats are uncapped — uniform random pick across all 10.
- Single transaction with the inventory decrement and `lastFedDate` update.

### 8.2 Pregnancy bonus formula (at foaling)

```js
const PREGNANCY_BONUS_PCT = {
  basic: 0,
  performance: 5,
  performancePlus: 10,
  highPerformance: 15,
  elite: 20,
};
const NEG_PER_MISSED_DAY = 5;
const GESTATION_DAYS = 7;

function calculatePregnancyEpigeneticChances(feedingsByTier) {
  const totalFeedings = Object.values(feedingsByTier).reduce((a, b) => a + b, 0);
  const divisor = Math.max(GESTATION_DAYS, totalFeedings);

  const weightedSum = Object.entries(feedingsByTier).reduce(
    (sum, [tier, n]) => sum + n * PREGNANCY_BONUS_PCT[tier],
    0
  );

  const positive_chance = weightedSum / divisor;

  const unfed_days = Math.max(0, GESTATION_DAYS - totalFeedings);
  const negative_chance = unfed_days * NEG_PER_MISSED_DAY;

  return { positive_chance, negative_chance };
}
```

At foaling: two independent rolls. Both can succeed (foal gets one of each), both can fail. Selection of which positive/negative trait is delegated to the existing trait-discovery system.

**Worked examples:**

| Pattern              | positive% | negative% |
| -------------------- | --------- | --------- |
| 7× elite             | 20.0%     | 0%        |
| 4× elite + 3× basic  | 11.4%     | 0%        |
| 3× elite + 4× basic  | 8.6%      | 0%        |
| 7× performance       | 5.0%      | 0%        |
| 7× basic             | 0%        | 0%        |
| 5× elite + 2× missed | 14.3%     | 10%       |
| 0 feedings           | 0%        | 35%       |

### 8.3 `alreadyFedToday`

```js
function alreadyFedToday(lastFedDate, now = new Date()) {
  if (!lastFedDate) return false;
  return startOfUtcDay(lastFedDate).getTime() === startOfUtcDay(now).getTime();
}
```

UTC midnight is the rollover. Server is authoritative.

### 8.4 Inventory race conditions

The feed transaction does (in Prisma terms):

- Read `inventory[feed-{tier}].quantity` inside transaction.
- If `quantity < 1` → throw → 400 "out of feed".
- Otherwise decrement.

Two parallel feed requests with quantity=1 → exactly one wins; the other 400s. No double-spend.

### 8.5 New-horse default `lastFedDate`

| Origin                   | Default      | Why                                       |
| ------------------------ | ------------ | ----------------------------------------- |
| Foal birth               | `new Date()` | Mother provided. Avoids day-1 critical.   |
| Marketplace purchase     | `new Date()` | New buyer shouldn't inherit a sick horse. |
| Test seed / admin create | `new Date()` | Same default.                             |

Every new horse starts at `excellent` health.

### 8.6 Edge-case matrix

| Scenario                                             | Behavior                                                                                                     |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Feed when retired (≥ 21)                             | 200 OK, body `{ skipped: 'retired' }`. No inventory decrement. No `lastFedDate` change. Informational toast. |
| Feed with no equipped tier                           | 400 — empty-state message.                                                                                   |
| Feed with 0 units of equipped tier                   | 400 + auto-clear `equippedFeedType`. UI re-renders with empty state.                                         |
| Equip a tier with 0 units                            | 400 — "you don't own any of this feed". Prevents soft-locked equipped state.                                 |
| Pregnancy + mare hits critical mid-gestation         | Counters keep accruing or stay still depending on whether she's fed. No retroactive lockout.                 |
| Pregnancy + `equippedFeedType` cleared mid-gestation | Subsequent days are missed-days. Re-equip + feed resumes counter.                                            |
| 8th calendar day in 7-day gestation                  | Divisor = `max(7, totalFeedings)`. Bonus stays bounded.                                                      |

## 9. Migration & Rollout

### 9.1 Schema migration

`packages/database/prisma/migrations/<timestamp>_feed_system_redesign/migration.sql`:

```sql
-- Phase A migration: feed loop + health + coordination cleanup
ALTER TABLE "horses" ADD COLUMN "equippedFeedType" TEXT;
ALTER TABLE "horses" DROP COLUMN "currentFeed";
ALTER TABLE "horses" DROP COLUMN "energyLevel";
ALTER TABLE "horses" DROP COLUMN "coordination";  -- Recon Finding 1 → B

-- Phase B migration: in-foal state (recon Finding 3 → P1+ extension)
ALTER TABLE "horses" ADD COLUMN "inFoalSinceDate" TIMESTAMP(3);
ALTER TABLE "horses" ADD COLUMN "pregnancySireId" INTEGER;
ALTER TABLE "horses" ADD COLUMN "pregnancyFeedingsByTier" JSONB NOT NULL DEFAULT '{}';

-- Note: lastVettedDate already exists on horses (used by recon Finding 2 → α).
-- Note: healthStatus already exists; treated as a vet-override (non-null
--       beats lastVettedDate decay) per §5.3.1.

-- Optional backfill so existing test horses start at "excellent" feed-health.
UPDATE "horses" SET "lastFedDate" = NOW() WHERE "lastFedDate" IS NULL;
```

Phase A and Phase B can be a single migration (deployed together) or two sequential migrations (Phase A first, Phase B when the breeding-flow refactor lands). The implementation plan handles both as separate Prisma migration files.

`schema.prisma` updates accordingly.

### 9.2 Code deletions (must land in same change)

- `FEED_CATALOG` (4-entry old constant) in `feedShopController.mjs`.
- `purchaseFeed` body assuming `{horseId, feedId}` shape.
- `HorsesNutritionTab` component in `FeedShopPage.tsx`.
- Per-horse purchase flow in `useFeedShop.ts`.
- Feed button's `navigate('/feed-shop?horseId=...')` redirect.
- Equip Tack button's redirect to tack shop.
- All `Horse.currentFeed` and `Horse.energyLevel` reads in services, controllers, serializers, and non-legacy tests.

Pre-flight grep before merge:

```bash
grep -rn "currentFeed\|energyLevel" backend frontend \
  --exclude-dir=node_modules --exclude-dir=__tests__/legacy
```

Must return zero hits in production paths.

### 9.3 Cutover order

1. Schema migration applied (local + dev DB).
2. Shared health helper landed (`backend/utils/horseHealth.mjs`).
3. Backend endpoints (Section 6.1–6.3). Old endpoints removed in same change — no dual-codepath.
4. Critical-health gates wired into breeding + competition controllers.
5. Frontend rewrites: sidebar, FeedShopPage, InventoryPage, HorseDetailPage action bar, new HorseEquipPage.
6. Tests at every layer.
7. Manual smoke: buy → equip → feed → see stat boost → let one horse decay → confirm gate fires → recover.

### 9.4 Beta-readiness scheduling (decision: option B)

This is net-new feature work landing in parallel with the 21R beta-readiness lockdown. It does not violate doctrine (no skips, no bypasses, no hidden routes). The readiness gate (`bash scripts/check-beta-readiness.sh`) re-runs against the new feed surface before signoff.

### 9.5 Documentation updates (per General Rules)

- `PROJECT_MILESTONES.md` — new entry "Feed System Redesign" with date and summary.
- `DEV_NOTES.md` — implementation decisions, the C2 weighted-average rationale, the `max(7, totalFeedings)` divisor edge case.
- `TODO.md` — moved to "Recently Completed" once shipped.
- `PATTERN_LIBRARY.md` — only if a reusable pattern emerges (likely not — this is mostly domain logic).

## 10. Test Plan

Per project rules: **no `vi.mock` of API client, no `it.skip`, no bypass headers, real DB for backend tests, real backend for E2E.**

### 10.1 Backend unit tests (`backend/__tests__/units/`)

- `feedHealth.test.mjs` — health bands, retirement age, null `lastFedDate`, UTC boundary precision.
- `pregnancyBonus.test.mjs` — every worked example from §8.2 plus the 8-day gestation edge.
- `statBoostRoll.test.mjs` — RNG injected as parameter for determinism. Verifies tier=basic never rolls, tier=elite rolls at 25%, picks uniformly across all 12 stats.
- `alreadyFedToday.test.mjs` — UTC boundary exact behavior.

### 10.2 Backend integration tests (`backend/__tests__/integration/feed/`)

- `feedShopPurchase.test.mjs` — bulk happy path, insufficient funds, invalid tier, large pack count.
- `feedHorse.test.mjs` — happy path with stat boost, no-equip 400, already-fed-today 400, no-inventory 400 + auto-clear, retired no-op, ownership rejection.
- `feedHorseRaceCondition.test.mjs` — two parallel feed requests with quantity=1; exactly one succeeds.
- `equipFeed.test.mjs` — equip, swap, unequip, equip-with-zero-units 400.
- `equippableForHorse.test.mjs` — tack filter excludes other-horse-equipped, feed shows always.
- `criticalHealthGate-breeding.test.mjs` — sire critical → 400, dam critical → 400, both healthy → success, in-flight pregnancy unaffected when mare hits critical mid-gestation.
- `criticalHealthGate-competition.test.mjs` — same shape.
- `pregnancyFoaling.test.mjs` — drives the full 7-day cycle, varies feed pattern, asserts resulting epigenetic chances match the formula.

### 10.3 Frontend Playwright E2E (`tests/e2e/`)

- `feed-system.spec.ts` — full loop: buy from feed shop → see in inventory → navigate to horse → equip feed → click Feed → toast appears with remaining count → next-day boundary → feed again.
- `feed-empty-state.spec.ts` — equip page shows the empty-state copy when no feed; "Go to Feed Shop" link works.
- `feed-stat-boost.spec.ts` — with seeded high-roll RNG, see stat-boost toast.
- `feed-critical-gate.spec.ts` — let horse decay to critical; assert breeding and competition entry are blocked with the exact error copy.
- `feed-retired.spec.ts` — age-21 horse shows Retired badge, Feed button shows "Retired" tooltip.

All Playwright runs use real credentials, hit the real backend, no `x-test-*` headers.

## 11. Open Implementation TBDs

These are not design decisions — they are details to confirm during implementation, not now:

1. **Exact `Equip Tack` button line in `HorseDetailPage.tsx`**: the redesign agrees the button exists and is currently routed to the tack shop. Locate during implementation and rename + reroute.
2. **Health-color tokens**: the design names color semantics (red for critical, etc.); the tokens.css palette has the actual variables. Pick the matching tokens during implementation, don't hard-code.
3. **`CinematicMoment` reuse**: confirmed for foal-birth and cup-win-tier moments only. Plain toast for stat-boost rolls.
4. **`coordination` column cleanup grep audit (recon Finding 1 → B)**: before dropping the column, grep all of `backend/` and `frontend/` for `coordination` reads/writes. Any code that increments/reads it must be updated. Tests that exercise it must be deleted or updated.
5. **Foaling job mechanism (Phase B)**: scheduled cron vs. on-read poll. Either works for a 7-day window; pick whichever pattern matches existing scheduled-job conventions in the codebase.

Recon decisions captured (no longer open):

- ✅ Finding 1 → B (drop `coordination` column entirely; 12 stats in boost pool).
- ✅ Finding 2 → α (symmetric two-derived + min: `vetHealth` + `feedHealth` → `displayedHealth`).
- ✅ Finding 3 → P1+ (in-foal state on `Horse` columns: `inFoalSinceDate`, `pregnancySireId`, `pregnancyFeedingsByTier`).
- ✅ Finding 4 (recon during plan write) → split implementation into Phase A (feed loop, ships independently) + Phase B (pregnancy delay refactor of `createFoal` + counter integration + foaling job).

## 12. Out of Scope

- Auto-feed automation, "set and forget" toggles, scheduled-feeding cron.
- Per-discipline feed-bonus weighting (e.g., "elite feed gives stamina bonus only").
- Feed expiration / spoilage.
- Bulk-feed-all-horses button (might be a future quality-of-life addition).
- Migration of existing live data beyond the wipe (player base is one tester, two horses).
- Replacing `auditLog.mjs sanitizeLogData` substring matching (separate scope, separate bd issue).
- Centralised redaction in the Winston format chain (separate scope per 21R-OBS-2 rules).
