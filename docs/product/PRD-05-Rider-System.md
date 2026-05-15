# PRD-05: Rider System

**Version:** 1.0.0
**Last Updated:** 2026-05-15
**Status:** Backend ✅ Complete | Frontend ✅ Complete | PRD ⚠️ Authored after implementation (Equoria-swpv)
**Owner:** Equoria Product
**Source Integration:** `backend/modules/riders/`, `packages/database/prisma/schema.prisma:1046-1115`

---

## 1. Overview

Riders are AI-controlled NPC competitors that the player hires from a marketplace and assigns to specific horses for competition entries. A rider's personality, skill level, and accrued career experience contribute to competition scoring beyond the horse's own stats and the trainer's training-time effects.

Riders complement — they do not replace — trainers:

| Role        | Acts during       | Affects                         | Lifecycle             |
| ----------- | ----------------- | ------------------------------- | --------------------- |
| **Trainer** | Training sessions | Stat gains, discipline scores   | See PRD-06 (Trainers) |
| **Rider**   | Competition runs  | Competition scoring, ride bonus | This PRD              |

This PRD documents requirements that already exist in code. It is the canonical specification for future story-writing, AC validation, and edge-case audits against the rider system.

---

## 2. Functional Requirements

### 2.1 Rider Attributes (FR-RIDER-1)

Each rider has the following persistent attributes (see `Rider` model in schema):

| Field               | Type    | Range / Values                                           | Default | Purpose                                                              |
| ------------------- | ------- | -------------------------------------------------------- | ------- | -------------------------------------------------------------------- |
| `firstName`         | string  | non-empty                                                | —       | Display name                                                         |
| `lastName`          | string  | non-empty                                                | —       | Display name                                                         |
| `personality`       | string  | `daring` \| `methodical` \| `intuitive` \| `competitive` | —       | Influences ride bonus + horse-compatibility                          |
| `skillLevel`        | string  | `rookie` \| `developing` \| `experienced`                | —       | Base competition contribution + weekly-rate band                     |
| `speciality`        | string  | One of the 23 disciplines (see PRD-03 §3.4)              | —       | Discipline match bonus                                               |
| `weeklyRate`        | int     | ≥ 0                                                      | 200     | Currency cost per game-week while on roster                          |
| `experience`        | int     | ≥ 0                                                      | 0       | Career XP                                                            |
| `level`             | int     | 1–10                                                     | 1       | Derived from `experience`; gates `discovery` slot reveal             |
| `careerWeeks`       | int     | ≥ 0                                                      | 0       | Weeks elapsed since hire; drives retirement triggers                 |
| `totalWins`         | int     | ≥ 0                                                      | 0       | Count of 1st-place finishes                                          |
| `totalCompetitions` | int     | ≥ 0                                                      | 0       | Incremented at show execution (every entry, regardless of placement) |
| `prestige`          | int     | 0–100                                                    | 0       | Soft reputation metric used in marketplace listing weighting         |
| `retired`           | boolean | true / false                                             | false   | Once true, rider cannot be assigned to a horse                       |
| `bio`               | string  | nullable                                                 | null    | Flavor text shown on rider detail panel                              |
| `userId`            | string  | UUID, nullable                                           | null    | Owner; null = unowned (marketplace pool)                             |

**AC notes:**

- A retired rider's row remains in the DB. Retirement is a soft state, not a delete.
- `totalCompetitions` is incremented at show-execution time (not entry time), so withdrawn entries do not count.

### 2.2 Marketplace & Hire Flow (FR-RIDER-2)

**Routes** — `backend/modules/riders/routes/riderRoutes.mjs`:

- `GET /api/riders/marketplace` — list refreshable pool of available riders for the calling user
- `POST /api/riders/marketplace/refresh` — manually refresh the marketplace listing; body `{ force?: boolean }`
- `POST /api/riders/marketplace/hire` — body `{ marketplaceId: string }`

**Requirements:**

- Marketplace is per-user (not global). Different users see different marketplace contents.
- Marketplace refresh is gated by a cooldown (specified in `riderMarketplaceController.mjs`). `force: true` is reserved for admin / future paid-refresh feature.
- Hiring transfers a marketplace listing to a `Rider` row owned by `req.user.id`. The marketplace listing is removed atomically.
- A user cannot hire beyond their roster cap (see FR-RIDER-7).

### 2.3 Assignment Flow (FR-RIDER-3)

**Routes:**

- `GET /api/riders/assignments` — list active assignments for current user
- `POST /api/riders/assignments` — body `{ riderId, horseId, notes? }` (notes ≤ 500 chars)
- `DELETE /api/riders/assignments/:id` — soft-delete (sets `isActive: false`)

**Requirements:**

- A `RiderAssignment` row links one `Rider` to one `Horse`. The unique constraint `@@unique([riderId, horseId, isActive])` enforces that the same `(rider, horse, active)` triplet cannot duplicate.
- A rider may be assigned to multiple horses simultaneously (one row per pairing).
- A horse may have at most one active rider assigned (frontend enforces; backend supports multiple but UI displays only the most recent).
- Both rider and horse must be owned by the calling user.
- Retired riders cannot be assigned.
- Assignment notes are display-only; they do not affect scoring.

### 2.4 Dismissal (FR-RIDER-4)

`DELETE /api/riders/:id/dismiss` retires a rider:

- Sets `retired: true` on the `Rider` row
- Deactivates all active `RiderAssignment` rows for the rider
- Owner association persists (`userId` is NOT cleared) — keeps the rider in the user's career history

A dismissed rider is no longer counted against the roster cap (FR-RIDER-7).

### 2.5 Career Progression (FR-RIDER-5)

Riders accrue XP from competition entries:

- A 1st-place finish awards more XP than lower placements (specific amounts in `riderTrainerProgressionService.mjs`)
- `experience` increases monotonically; `level` is derived as `Math.floor(experience / threshold)` capped at 10
- `careerWeeks` ticks on a weekly cron (`backend/utils/cronJobs.mjs`) for every non-retired rider on a user's roster
- `prestige` updates with placements but never exceeds 100

**Retirement triggers** (see Equoria-osum for trainer parallel):

- `careerWeeks ≥ MAX_RIDER_CAREER_WEEKS` (config in `riderConfig.mjs`)
- Manual dismissal via `DELETE /:id/dismiss`

### 2.6 Discovery Slots (FR-RIDER-6)

Each rider has a discovery system that progressively reveals career-affinity traits:

- Discovery slots are persisted on the rider row (or in `Rider`-adjacent JSON; see `getRiderDiscovery` controller)
- One slot is revealed per N levels (matching trainer cadence — see PRD-06 Trainers)
- Slots are read-only display content (no gameplay-affecting modifiers in current scope)
- Route: `GET /api/riders/:id/discovery`

**AC:**

- A rookie rider (level 1) sees 0 slots revealed.
- An experienced rider at max level sees all slots revealed.
- Slot revelation is monotonic — once unlocked, a slot cannot revert.

### 2.7 Roster Cap (FR-RIDER-7)

- Each user may hold at most N non-retired riders simultaneously (N specified in `riderConfig.mjs`).
- Hire attempts that would exceed the cap fail with HTTP 400 and message indicating cap reached.
- Retired riders do not count toward the cap.
- The cap is silent on the marketplace listing (does not pre-filter; the rejection is at hire time).

### 2.8 Per-User Rider Listing (FR-RIDER-8)

`GET /api/riders/user/:userId`:

- Returns all `Rider` rows owned by `userId` (active + retired).
- IDOR-protected: route returns 404 if `userId` !== `req.user.id`. The 404 (not 403) is intentional to prevent enumeration.

---

## 3. Competition Scoring Integration

A rider's contribution to competition score is documented in PRD-03 §3.4 (Competition Scoring). Summary:

- **Rider Bonus**: Percentage applied to subtotal before luck. Magnitude derived from rider skill level + discipline match + personality compatibility.
- **Rider Penalty**: Applied when personality conflicts with horse's temperament (see Equoria-t4p4 trainer PRD for the matrix parallel).
- Riders are skipped from scoring if the entry's horse has no active assignment.

---

## 4. Out of Scope (For Future PRDs)

- Cross-user rider trading / sales (no current marketplace listing endpoint accepts other-user rider listings)
- Rider-specific banner achievements (Hall of Fame)
- Rider-on-rider rivalries (e.g. negative scoring modifiers vs known opponent)
- Manual rider XP injection by admin

These are intentional exclusions. File a new PRD section if scope expands.

---

## 5. Traceability — Spec → Code

| FR         | Backend implementation                                                          |
| ---------- | ------------------------------------------------------------------------------- |
| FR-RIDER-1 | `packages/database/prisma/schema.prisma:1046-1089` (`model Rider`)              |
| FR-RIDER-2 | `backend/modules/riders/controllers/riderMarketplaceController.mjs`             |
| FR-RIDER-3 | `riderController.mjs#assignRider, #getRiderAssignments, #deleteRiderAssignment` |
| FR-RIDER-4 | `riderController.mjs#dismissRider`                                              |
| FR-RIDER-5 | `backend/services/riderTrainerProgressionService.mjs`                           |
| FR-RIDER-6 | `riderController.mjs#getRiderDiscovery`                                         |
| FR-RIDER-7 | `riderConfig.mjs` (roster cap constant)                                         |
| FR-RIDER-8 | `riderController.mjs#getUserRiders`                                             |

**Schema migration:** `packages/database/prisma/migrations/*_add_rider_*`

**Frontend page:** `/riders` — see `frontend/src/pages/RidersPage.tsx`, `frontend/src/components/rider/*.tsx`

---

## 6. Open Questions for Product

Captured during PRD authoring (Equoria-swpv) — non-blocking. Resolve via separate bd issues if/when prioritized:

1. **Marketplace refresh economy** — should manual refresh cost currency or be rate-limited only?
2. **Cross-discipline penalty** — current code applies discipline-match bonus only; should mismatch incur a small penalty?
3. **Rider death** — current model retires riders. Is a permanent removal flow needed (e.g. lore-driven loss)?
4. **Discovery slot gameplay impact** — slots are currently flavor-only. Should they grant small modifiers?

---

## 7. Version History

| Version | Date       | Notes                                                            |
| ------- | ---------- | ---------------------------------------------------------------- |
| 1.0.0   | 2026-05-15 | Initial PRD authored from existing implementation (Equoria-swpv) |
