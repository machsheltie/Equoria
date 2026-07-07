# PRD-06: Trainer System

**Version:** 1.0.0
**Last Updated:** 2026-05-15
**Status:** Backend ✅ Complete | Frontend ✅ Complete (Epic 13) | PRD ⚠️ Authored after implementation (Equoria-t4p4)
**Owner:** Equoria Product
**Source Integration:** `backend/modules/trainers/`, `packages/database/prisma/schema.prisma:1118-1187`

---

## 1. Overview

Trainers are AI-controlled NPC specialists that the player hires from a marketplace and assigns to specific horses. A trainer's specialty, personality, and accrued career experience contribute to **stat gains and discipline-score progression during training sessions** — distinct from riders, who contribute to competition scoring.

Trainers complement — they do not replace — riders. See PRD-05 (Rider System) for the parallel system.

| Role        | Acts during       | Affects                         | Lifecycle           |
| ----------- | ----------------- | ------------------------------- | ------------------- |
| **Trainer** | Training sessions | Stat gains, discipline scores   | This PRD            |
| **Rider**   | Competition runs  | Competition scoring, ride bonus | See PRD-05 (Riders) |

This PRD documents requirements that already exist in code. It is the canonical specification for future story-writing, AC validation, and edge-case audits against the trainer system. Schema-drift work in Equoria-0tqa and Equoria-6prf depends on this canonical spec.

---

## 2. Functional Requirements

### 2.1 Trainer Attributes (FR-TRAINER-1)

Each trainer has the following persistent attributes (see `Trainer` model in schema):

| Field            | Type    | Range / Values                                                          | Default | Purpose                                                |
| ---------------- | ------- | ----------------------------------------------------------------------- | ------- | ------------------------------------------------------ |
| `firstName`      | string  | non-empty                                                               | —       | Display name                                           |
| `lastName`       | string  | non-empty                                                               | —       | Display name                                           |
| `personality`    | string  | `focused` \| `encouraging` \| `technical` \| `competitive` \| `patient` | —       | Influences training bonus + horse-compatibility        |
| `skillLevel`     | string  | `novice` \| `developing` \| `expert`                                    | —       | Base training contribution + session-rate band         |
| `speciality`     | string  | One of the 23 disciplines (see PRD-03 §3.4)                             | —       | Discipline-match training bonus                        |
| `sessionRate`    | int     | ≥ 0                                                                     | 150     | Currency cost per training session                     |
| `experience`     | int     | ≥ 0                                                                     | 0       | Career XP                                              |
| `level`          | int     | 1–10                                                                    | 1       | Derived from `experience`; gates discovery slot reveal |
| `careerWeeks`    | int     | ≥ 0                                                                     | 0       | Weeks elapsed since hire; drives retirement triggers   |
| `retired`        | boolean | true / false                                                            | false   | Once true, trainer cannot be assigned to a horse       |
| `bio`            | string  | nullable                                                                | null    | Flavor text                                            |
| `discoverySlots` | JSON    | Array of 6 slot descriptors (3 categories × 2 slots — see FR-TRAINER-6) | `[]`    | Persisted trait pool, visibility computed at read time |
| `userId`         | string  | UUID, nullable                                                          | null    | Owner; null = unowned (marketplace pool)               |

**AC notes:**

- A retired trainer's row remains in the DB. Retirement is a soft state, not a delete.
- `discoverySlots` is JSONB. The schema default `"[]"` MUST be preserved on hire — write the generated slots immediately after hire (see Equoria-0tqa / 6prf).

### 2.2 Marketplace & Hire Flow (FR-TRAINER-2)

**Routes** — `backend/modules/trainers/routes/trainerRoutes.mjs`:

- `GET /api/trainers/marketplace` — list refreshable pool of available trainers for the calling user
- `POST /api/trainers/marketplace/refresh` — manually refresh; body `{ force?: boolean }`
- `POST /api/trainers/marketplace/hire` — body `{ marketplaceId: string }`

**Requirements:**

- Marketplace is per-user (not global).
- Marketplace refresh is gated by a cooldown.
- Hiring transfers a marketplace listing to a `Trainer` row owned by `req.user.id`. Marketplace listing is removed atomically.
- On hire, `discoverySlots` MUST be generated immediately via `trainerDiscoveryService.generateDiscoverySlots()` and persisted. A trainer with `discoverySlots: []` and `level > 1` is a defect (Equoria-0tqa).
- A user cannot hire beyond their roster cap (see FR-TRAINER-7).

### 2.3 Assignment Flow (FR-TRAINER-3)

**Routes:**

- `GET /api/trainers/assignments` — list active assignments for current user
- `POST /api/trainers/assignments` — body `{ trainerId, horseId, notes? }` (notes ≤ 500 chars)
- `DELETE /api/trainers/assignments/:id` — soft-delete (sets `isActive: false`)

**Requirements:**

- A `TrainerAssignment` row links one `Trainer` to one `Horse`. Unique constraint `@@unique([trainerId, horseId, isActive])` prevents duplicates.
- A trainer may be assigned to multiple horses simultaneously.
- A horse may have at most one active trainer assigned (frontend enforces).
- Both trainer and horse must be owned by the calling user.
- Retired trainers cannot be assigned.

### 2.4 Dismissal (FR-TRAINER-4)

`DELETE /api/trainers/:id/dismiss`:

- Sets `retired: true`
- Deactivates all active `TrainerAssignment` rows for the trainer
- Owner association persists (`userId` is NOT cleared) — kept for career history

A dismissed trainer is no longer counted against the roster cap.

### 2.5 Career Progression (FR-TRAINER-5)

Trainers accrue XP from training sessions:

- Each session awards XP via `awardTrainerSessionXP()` in `riderTrainerProgressionService.mjs`
- `experience` increases monotonically; `level` = `Math.floor(experience / threshold)` capped at 10
- `careerWeeks` ticks on a weekly cron for every non-retired trainer
- Discovery slots reveal as level climbs (see FR-TRAINER-6)

**Retirement triggers** (tracked via Equoria-osum):

- `careerWeeks ≥ MAX_TRAINER_CAREER_WEEKS` (config in `trainerConfig.mjs`)
- Manual dismissal via `DELETE /:id/dismiss`

### 2.6 Discovery System (FR-TRAINER-6)

Each trainer has **6 discovery slots organized into 3 categories × 2 slots each**:

| Slot Index | Category                    | Source                                                    |
| ---------- | --------------------------- | --------------------------------------------------------- |
| 0          | `discipline_specialization` | First entry from discipline pool keyed off `speciality`   |
| 1          | `discipline_specialization` | Second entry from discipline pool                         |
| 2          | `training_method`           | First entry from personality pool keyed off `personality` |
| 3          | `training_method`           | Second entry from personality pool                        |
| 4          | `horse_compatibility`       | Compatibility pair element 1 (varies by speciality index) |
| 5          | `horse_compatibility`       | Compatibility pair element 2 (`strength: 'strong'`)       |

**Visibility rules:**

- Slots are stored in `discoverySlots` JSON column (backed by migration `20260513140000_add_trainer_discovery_slots`).
- Visibility is computed at read time: one slot revealed per 2 levels, capped at 6 at level 10.
  - Level 1: 0 slots revealed
  - Level 3: 1 slot revealed
  - Level 5: 2 slots
  - Level 7: 3 slots
  - Level 9: 4 slots
  - Level 10: 5 slots (cap reached at next level transition — final slot revealed when `level === 10`)
- Slots are read-only display content. Discovered slots may evolve to grant gameplay modifiers in a future scope expansion (currently flavor-only).
- Route: `GET /api/trainers/:id/discovery`

**AC:**

- A novice trainer (level 1) sees 0 slots revealed.
- An expert trainer at level 10 sees all 6 slots revealed.
- Slot revelation is monotonic — once unlocked, a slot cannot revert.
- Slot content (pre-seeded at hire time) cannot change post-hire.

### 2.7 Roster Cap (FR-TRAINER-7)

- Each user may hold at most N non-retired trainers simultaneously, where N
  **scales by stable level** (Equoria-oey96.8, ratified 2026-07-07). The cap map
  lives in `backend/modules/trainers/config/trainerConfig.mjs`
  (`TRAINER_ROSTER_CAP_BY_STABLE_LEVEL = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 }` —
  one below riders at every level, since trainers multi-assign across horses).
- Stable level is derived from `User.level` via the single exported
  `getStableLevel(user) = clamp(ceil(user.level / 4), 1, 5)` in the users module
  (no `stableLevel` schema column).
- Hire attempts that would exceed the cap fail with HTTP 400. Enforcement is at
  hire time only (grandfathering: no forced retirement).
- Retired trainers do not count toward the cap.
- Enforcement is a pre-tx fast-path count PLUS an authoritative post-lock in-tx
  re-count so two concurrent hires at cap−1 cannot both succeed.

### 2.8 Per-User Trainer Listing (FR-TRAINER-8)

`GET /api/trainers/user/:userId`:

- Returns all `Trainer` rows owned by `userId` (active + retired).
- IDOR-protected: returns 404 if `userId` !== `req.user.id` (404 not 403 to prevent enumeration).

---

## 3. Training Session Integration

A horse's active trainer modifies the **discipline-score gain** of each training
session. The formula is `computeTrainerModifiers({ trainer, discipline,
horseTemperament }) → { bonusPercent, penaltyPercent }` in
`backend/modules/trainers/services/trainerModifiers.mjs` (exported through the
trainers module barrel; consumed by `trainingController.trainHorse`). It is the
ratified formula from `docs/design/2026-07-07-game-balance-formulas.md §2`
(user-ratified 2026-07-07 on Equoria-oey96.7).

**Bonus** (each term additive, then capped at **+20%**):

- Skill level base: `novice` +2%, `developing` +5%, `expert` +10%.
- Trainer level (1–10): +0.5% per level above 1 (this term maxes at +4.5%).
- Discipline match: +5% when `trainer.speciality === discipline`.
- Positive personality×temperament compatibility (matrix below).

**Penalty** (capped at **−8%**): the negative side of the compatibility matrix
(e.g. `competitive` trainer + `Nervous` horse = −4%). A **retired** trainer is a
defensive dead-end → no bonus retained, penalty at the −8% cap (never
net-positive). A malformed / absent trainer (the no-trainer path) returns
`{0,0}` — the session is byte-identical to an unstaffed horse.

**Compatibility matrix** (5 personalities × 11 temperaments, decimals in
[−0.04, +0.04]; unlisted pairs = 0; personality and temperament are validated
against their canonical sets before lookup, so a typo'd value silently
contributes 0, never a bonus):

| personality   | positive pairs                                                  | negative pairs                    |
| ------------- | --------------------------------------------------------------- | --------------------------------- |
| `focused`     | Playful +0.03, Spirited +0.02, Reactive +0.02                   | Lazy −0.02                        |
| `encouraging` | Nervous +0.04, Lazy +0.03, Playful +0.02                        | Aggressive −0.02                  |
| `technical`   | Calm +0.03, Steady +0.03, Independent +0.02                     | Reactive −0.03, Nervous −0.02     |
| `competitive` | Bold +0.04, Spirited +0.03, Aggressive +0.02                    | **Nervous −0.04**, Reactive −0.02 |
| `patient`     | Stubborn +0.04, Nervous +0.03, Reactive +0.03, Aggressive +0.02 | _(none)_                          |

**Application point (normative):** the discipline-score gain composes
traits → temperament → trainer with a **single terminal round**:

```
gain = max(1, round( 5 · (1 + traitMod) · (1 + temperamentScoreMod) · (1 + net) ))
```

where `net = bonusPercent − penaltyPercent`. The trainer modifier applies to the
**discipline-score gain ONLY** — NOT to user XP (paid staff must not inflate
account progression) and NOT to the 15% stat-gain chance. The `POST /train`
response surfaces the contribution as `trainerModifier: { bonusPercent,
penaltyPercent, net }`. Training without an assigned trainer falls back to the
base gain (no bonus / no penalty).

**Honest magnitude:** with a base gain of 5, a single session's trainer delta is
0–1 points after rounding. The trainer's real product is the _lifetime_ delta —
an expert matched trainer adds ≈ +13–18 discipline points over a horse's
~18-session career (≈ +15–20%). The surface where the player sees the effect is
the response-payload percentage and the lifetime curve, not every +5 becoming
+6.

> Note: `getTemperamentTrainingModifiers()` in `temperamentService.mjs` supplies
> only the **temperament** stage of the composition above; the trainer stage is
> `computeTrainerModifiers`. PRD updates that change the trainer matrix or caps
> MUST keep `trainerModifiers.mjs` (and `game-balance-formulas.md §2`) in sync.

---

## 4. Out of Scope (For Future PRDs)

- Cross-user trainer trading / sales
- Trainer-specific banner achievements (Hall of Fame)
- Manual trainer XP injection by admin
- Discovery slot gameplay modifiers (currently flavor-only)
- Multi-trainer-per-horse stacking

These are intentional exclusions.

---

## 5. Traceability — Spec → Code

| FR           | Backend implementation                                                                                                                                                                                                |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-TRAINER-1 | `packages/database/prisma/schema.prisma:1118-1160` (`model Trainer`)                                                                                                                                                  |
| FR-TRAINER-2 | `backend/modules/trainers/controllers/trainerMarketplaceController.mjs`                                                                                                                                               |
| FR-TRAINER-3 | `trainerController.mjs#assignTrainer, #getTrainerAssignments, #deleteTrainerAssignment`                                                                                                                               |
| FR-TRAINER-4 | `trainerController.mjs#dismissTrainer`                                                                                                                                                                                |
| FR-TRAINER-5 | `backend/services/riderTrainerProgressionService.mjs#awardTrainerSessionXP`                                                                                                                                           |
| FR-TRAINER-6 | `backend/modules/trainers/services/trainerDiscoveryService.mjs`                                                                                                                                                       |
| FR-TRAINER-7 | `backend/modules/trainers/config/trainerConfig.mjs` (`TRAINER_ROSTER_CAP_BY_STABLE_LEVEL`) + `getStableLevel` (users module) + hire-time enforcement in `trainerMarketplaceController.mjs#hireTrainerFromMarketplace` |
| FR-TRAINER-8 | `trainerController.mjs#getUserTrainers`                                                                                                                                                                               |

**Schema migration:** `packages/database/prisma/migrations/20260513140000_add_trainer_discovery_slots/`

**Frontend page:** `/trainers` — see `frontend/src/pages/TrainersPage.tsx` and Epic 13 deliverables (TrainerList.tsx, MyTrainersDashboard.tsx, TrainerPersonalityBadge.tsx, etc.)

---

## 6. Open Questions for Product

Captured during PRD authoring (Equoria-t4p4) — non-blocking:

1. **Marketplace refresh economy** — same question as Riders (PRD-05 §6.1). Resolve in tandem.
2. **Discovery slot gameplay impact** — currently flavor-only. Should discovered slots grant small training-bonus modifiers?
3. **Trainer–rider interaction** — should a trainer assigned to a horse affect that horse's competition performance indirectly (e.g. via "well-prepared" trait)?
4. **Discovery slot rebalance on retire/re-hire** — if a trainer is dismissed and re-hired (not currently possible), should slots regenerate?

---

## 7. Version History

| Version | Date       | Notes                                                            |
| ------- | ---------- | ---------------------------------------------------------------- |
| 1.0.0   | 2026-05-15 | Initial PRD authored from existing implementation (Equoria-t4p4) |
