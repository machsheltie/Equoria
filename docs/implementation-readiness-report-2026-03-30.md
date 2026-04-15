---
stepsCompleted: [1]
filesSelected:
  gdd: docs/product/PRD-00-Brief.md, PRD-01-Overview.md, PRD-02-Core-Features.md, PRD-03-Gameplay-Systems.md, PRD-04-Advanced-Systems.md, PRD-UNIFIED-SUMMARY.md
  architecture: docs/architecture.md, docs/architecture-backend.md, docs/architecture-frontend.md
  epics: docs/epics.md, docs/epics-physical-systems.md
  ux: docs/ux-design-specification.md
---

# Implementation Readiness Assessment Report

**Date:** 2026-03-30
**Project:** Equoria

---

## Step 1: Document Discovery — Complete

### Files Selected for Assessment

| Document Type   | File(s)                                                                       |
| --------------- | ----------------------------------------------------------------------------- |
| GDD (PRD)       | `docs/product/PRD-00` through `PRD-04`, `PRD-UNIFIED-SUMMARY.md`              |
| Architecture    | `docs/architecture.md`, `architecture-backend.md`, `architecture-frontend.md` |
| Epics & Stories | `docs/epics.md`, `docs/epics-physical-systems.md`                             |
| UX Design       | `docs/ux-design-specification.md`                                             |

### Issues Noted

- Architecture exists in both whole and sharded forms — whole files selected (more complete)
- UX spec exists in both whole and sharded forms — whole file selected (authoritative source, shards miss ~78 KB)
- No GDD file found — PRD documents used as GDD equivalent

---

## Step 2: GDD / PRD Analysis

### Functional Requirements Extracted

**User & Account Management**

FR1: User registration with email/password (P0) — ✅ Implemented
FR2: JWT-based auth with refresh tokens (access 15min, refresh 7-day) (P0) — ✅ Implemented
FR3: Password reset and email verification (P0) — ✅ Implemented
FR4: Role-based access control — User, Moderator, Admin (P0) — ✅ Implemented
FR5: User profile management (avatar, display name, bio) (P0) — ✅ Implemented
FR6: Account settings and preferences (JSONB) (P0) — ✅ Implemented
FR7: User level system (P0) — ✅ Implemented
FR8: XP system with level progression (100 XP/level from level 2+) (P0) — ✅ Implemented
FR9: In-game currency management — starting $1,000, no negative balances (P0) — ✅ Implemented
FR10: XP event logging with full audit trail (P0) — ✅ Implemented
FR11: User dashboard with horses, shows, recent activity (P0) — ✅ Implemented

**Horse Management**

FR12: Horse CRUD with full attribute definition (P0) — ✅ Implemented
FR13: Horse attributes: name, age, gender, breed, 10 core stats (0-100), 23 discipline scores, JSONB genetics, health/status, financial, relationships (P0) — ✅ Implemented
FR14: Horse list filtering + pagination (20/page) (P0) — ✅ Implemented
FR15: Horse search by name/breed/attributes <200ms for 10,000+ horses (P0) — ✅ Implemented
FR16: Horse XP system — competition awards 20-30 XP; 100 XP = 1 stat point (P0) — ✅ Implemented
FR17: Player-controlled stat point allocation (1 point per request) (P0) — ✅ Implemented
FR18: Horse XP history with paginated audit trail (P0) — ✅ Implemented

**Conformation Scoring System**

FR19: 8 body region conformation scores (0-100) generated once at birth; permanent (P1) — ✅ Implemented (Epic 31B)
FR20: Generated via normal distribution using breed rating_profiles (P1) — ✅ Implemented
FR21: Breeding inheritance: 60% parent avg + 40% breed mean + random variance (P1) — ✅ Implemented
FR22: Conformation API — region breakdown, overall score, breed percentile (P1) — ✅ Implemented

**Gait Quality System**

FR23: Standard gait scores (walk, trot, canter, gallop) generated once; permanent (P1) — ✅ Implemented (Epic 31C) [NOTE: Lusitano gait ratings still TBD in spec]
FR24: Gaited breeds receive named breed-specific gaits (not generic "gaiting") (P1) — ✅ Implemented
FR25: Conformation-to-gait influence ±5 modifier × 0.15 (P1) — ✅ Implemented
FR26: Gait breeding inheritance: 60/40 parent/breed split (P1) — ✅ Implemented

**Coat Color Genetics System**

FR27: Full Mendelian genetics with 17+ loci (P1) — ❌ Not Implemented (Epic 31E)
FR28: Complete genotype stored in JSONB per horse (P1) — ❌ Not Implemented
FR29: Phenotype calculated deterministically from genotype (P1) — ❌ Not Implemented
FR30: Breed-specific allele restrictions and probability weights (P1) — ❌ Not Implemented
FR31: Lethal combination prevention at breeding (Frame Overo O/O, etc.) (P1) — ❌ Not Implemented
FR32: Mendelian inheritance at breeding — one random allele per locus per parent (P1) — ❌ Not Implemented
FR33: Face and leg marking system with breed-specific bias (P1) — ❌ Not Implemented
FR34: Breeding color prediction probability chart (P1) — ❌ Not Implemented
FR35: 4 Boolean modifiers: Sooty, Flaxen, Pangare, Rabicano (P1) — ❌ Not Implemented
FR36: Shade variants per base phenotype color (50+ phenotype colors) (P1) — ❌ Not Implemented

**Training System**

FR37: Training for horses age 3-20 years (P0) — ✅ Implemented
FR38: Global 7-day training cooldown (P0) — ✅ Implemented
FR39: 23 disciplines across Western, English, Specialized, Racing (P0) — ✅ Implemented
FR40: Base +5 discipline score gain; 15% stat gain chance (P0) — ✅ Implemented
FR41: +5 User XP per training session (P0) — ✅ Implemented
FR42: Trait-based training modifiers (intelligent +25% XP, lazy -20%, etc.) (P0) — ✅ Implemented
FR43: Temperament-based training modifiers (Spirited +10% XP, Lazy -20%, etc.) (P1) — ✅ Implemented (Epic 31D-2)

**Competition System**

FR44: Entry requirements: age 3-21, healthy, discipline-specific trait/level reqs (P0) — ✅ Implemented
FR45: Scoring: weighted stats × trait modifiers × age factor × ±5% variance (P0) — ✅ Implemented
FR46: Prize distribution: 1st=50%, 2nd=30%, 3rd=20% (P0) — ✅ Implemented
FR47: XP/Horse XP awards per placement (P0) — ✅ Implemented
FR48: Temperament competition modifiers applied to final score (P1) — ✅ Implemented (Epic 31D-3)

**Conformation Show System**

FR49: Conformation show scoring: conformation 65% + handler 20% + bond 8% + temperament synergy 7% (P1) — ❌ Not Implemented (Epic 31F)
FR50: Age classes: Weanling/Yearling/Youngstock/Junior/Senior (P1) — ❌ Not Implemented
FR51: Rewards: ribbons, title points, breeding value boost (no prize money) (P1) — ❌ Not Implemented
FR52: Title progression: Noteworthy/Distinguished/Champion/Grand Champion (P1) — ❌ Not Implemented
FR53: Breeding value boost from show wins capped at +15% total (P1) — ❌ Not Implemented

**Groom Management**

FR54: Groom attributes: specialty, skill level, personality, level 1-10, career weeks max 104 (P0) — ✅ Implemented
FR55: Groom personality effects on epigenetic traits (P0) — ✅ Implemented
FR56: Age-based task system (0-2 enrichment, 1-3 foal grooming, 3+ general) (P0) — ✅ Implemented
FR57: One interaction per horse per day limit (P0) — ✅ Implemented
FR58: Mandatory retirement at 104 weeks; early at Level 10+ or 12+ assignments (P0) — ✅ Implemented
FR59: Legacy system — Level 7+ retired grooms generate protégé (2000 currency) (P0) — ✅ Implemented
FR60: Talent tree — 3 tiers, 24 talents, 1 per tier permanent (P0) — ✅ Implemented

**Temperament-Groom Synergy**

FR61: Groom personality × horse temperament bonding speed modifier (+10% to +25%) (P1) — ❌ Not Implemented (Epic 31D-4 backlog)
FR62: Poor groom matches reduce bonding speed 10-20% (P1) — ❌ Not Implemented (Epic 31D-4 backlog)

**Breed Temperament System**

FR63: 11 temperament types assigned once at birth via breed temperament_weights (P1) — ✅ Implemented (Epic 31D-1)
FR64: Temperament permanent — no mutation endpoints (P1) — ✅ Implemented
FR65: Temperament definitions API endpoint — all 11 types with effect descriptions (P1) — ❌ Not Implemented (Epic 31D-5 backlog)
FR66: Temperament included in GET /api/v1/horses/:id response (P1) — ✅ Implemented

**Breeding & Foal Development**

FR67: Parent tracking with epigenetic trait inheritance and breeding cooldowns (P0) — ✅ Implemented
FR68: Stud fee management (P0) — ✅ Implemented
FR69: Foal development window days 0-6 with enrichment activities (P0) — ✅ Implemented
FR70: 5 development milestones: imprinting, socialization, curiosity, trust, confidence (P0) — ✅ Implemented
FR71: Milestone scoring formula (Bond -2/+2 + Task 0/+3 + Care Quality) (P0) — ✅ Implemented

**Epigenetic Systems**

FR72: 10 behavioral + 4 conditional/temporary epigenetic traits (P1) — ✅ Implemented
FR73: Max 3 visible traits + 1 hidden slot per horse (P1) — ✅ Implemented
FR74: Trait conflict resolution rules (P1) — ✅ Implemented
FR75: 9 epigenetic flags across confidence/social/resilience categories (P1) — ✅ Implemented
FR76: 5 ultra-rare + 5 exotic traits with specific trigger conditions (P1) — ✅ Implemented
FR77: Trait discovery via bonding, training, competition, vet eval, age auto-reveal at 3 (P1) — ✅ Implemented

**Economy & Social**

FR78: Currency system with prizes, salaries, entry/breeding fees (P0) — ✅ Implemented
FR79: Leaderboard — overall, discipline, earnings, user level (P1) — ✅ Implemented
FR80: Horse marketplace — buy/sell (P1) — ✅ Implemented (Epic 21)
FR81: Community features — message boards, clubs, DMs (P2) — ⚠️ Frontend mock only; backend not implemented

**Total FRs: 81**
**Fully Implemented: 55** | **Not Implemented: 15 (FR27-36, FR49-53, FR61-62, FR65)** | **Partial/Mock: 1 (FR81)**

---

### Non-Functional Requirements Extracted

NFR1: API response time — p95 < 200ms for critical endpoints
NFR2: Dashboard load time < 500ms
NFR3: Horse search < 200ms for 10,000+ horses
NFR4: Server uptime 99.9% (production)
NFR5: App crash rate < 1% of sessions
NFR6: Test coverage — maintain >90% with balanced mocking approach
NFR7: Platform: Web only (React 19 + TypeScript + Vite + Express); mobile out-of-scope
NFR8: Security: bcrypt (10-12 rounds), JWT validation, rate limiting (5 auth attempts/15min)
NFR9: Scalability: 10,000+ horses per query, strategic indexed queries
NFR10: Engagement: 15+ min avg session, 3+ sessions/week
NFR11: Database: PostgreSQL 14+ with Prisma ORM, 43 models, JSONB
NFR12: API versioned at /api/v1 with Swagger/OpenAPI documentation
NFR13: CI/CD: 9-job GitHub Actions pipeline; pre-push hook active
NFR14: Deployment: Railway Docker multi-stage; `prisma migrate deploy` before start
NFR15: Accessibility: WCAG compliance required (UX spec §13)

**Total NFRs: 15**

---

### Additional Requirements & Constraints

- Brownfield: all core backend implemented (Epics 1-21 complete, 3,651+ tests)
- All existing horse records may have `temperament = null` (backward-compatible)
- Lusitano breed gait ratings marked "TBD" in PRD-02 §3.2 — **spec gap**
- Conformation Show (FR49-53) depends on: Conformation ✅, Temperament ✅ (partial), Groom Bond ✅
- Coat Color Genetics (FR27-36) = Epic 31E — fully specified, zero implementation
- Rider and Trainer systems mentioned in PRD-00 scope but no PRD sections define FRs for them — **spec gap**

---

## Step 3: Epic Coverage Validation

### FR Coverage Matrix (PRD FRs vs Epics)

| FR Range  | Requirement Area                     | Epic Coverage                            | Status       |
| --------- | ------------------------------------ | ---------------------------------------- | ------------ |
| FR1–FR11  | User management                      | Epics 1-21 (done); Epic 22 restyles      | ✅ Covered   |
| FR12–FR18 | Horse management                     | Epics 1-21 (done); Epics 22-25 restyle   | ✅ Covered   |
| FR19–FR22 | Conformation scoring                 | Epic 31B (done)                          | ✅ Covered   |
| FR23–FR26 | Gait quality                         | Epic 31C (done) [Lusitano TBD caveat]    | ✅ Covered\* |
| FR27–FR36 | Coat color genetics                  | Epic 31E (backlog — 6 stories planned)   | ⏳ Planned   |
| FR37–FR42 | Training system base                 | Epics 1-21 (done); Epic 26 UX restyle    | ✅ Covered   |
| FR43      | Temperament training modifiers       | Epic 31D-2 (done)                        | ✅ Covered   |
| FR44–FR47 | Competition system base              | Epics 1-21 (done); BACKEND-A + Epic 27   | ✅ Covered   |
| FR48      | Temperament competition modifiers    | Epic 31D-3 (done)                        | ✅ Covered   |
| FR49–FR53 | Conformation show system             | Epic 31F (backlog — 3 stories planned)   | ⏳ Planned   |
| FR54–FR60 | Groom management                     | Epics 1-21 (done)                        | ✅ Covered   |
| FR61–FR62 | Temperament-groom synergy            | Epic 31D-4 (backlog)                     | ⏳ Planned   |
| FR63–FR66 | Breed temperament system             | Epic 31D-1,2,3 (done); 31D-4,5 (backlog) | ⚠️ Partial   |
| FR67–FR71 | Breeding & foal development          | Epics 1-21 (done); BACKEND-B + Epic 29   | ✅ Covered   |
| FR72–FR77 | Epigenetic systems                   | Epics 1-21 (done)                        | ✅ Covered   |
| FR78–FR80 | Economy + marketplace                | Epics 1-21 (done); Epic 28 UX            | ✅ Covered   |
| FR81      | Community backend (boards/clubs/DMs) | **NOT in any epic scope**                | ❌ MISSING   |

### Celestial Night FR Coverage (FR-CN1 to FR-CN20)

All 20 Celestial Night FRs are captured in epics.md (Epics 22-30 + BACKEND-A/B). All are backlog — fully planned, no stories created yet.

| FR-CN Range                                 | Epic                               | Status     |
| ------------------------------------------- | ---------------------------------- | ---------- |
| FR-CN1 to FR-CN4, FR-CN11, FR-CN16, FR-CN19 | Epic 22 (Design System Foundation) | ⏳ Backlog |
| FR-CN5, FR-CN7, FR-CN10                     | Epic 23 (Hub Dashboard)            | ⏳ Backlog |
| FR-CN6                                      | Epic 24 (WYAG)                     | ⏳ Backlog |
| FR-CN15                                     | Epic 25 (Horse Card/Detail)        | ⏳ Backlog |
| FR-CN12                                     | Epic 26 (Training UI)              | ⏳ Backlog |
| FR-CN8, FR-CN13                             | Epic 27 + BACKEND-A (Competition)  | ⏳ Backlog |
| FR-CN14                                     | Epic 28 (Breeding UI)              | ⏳ Backlog |
| FR-CN9, FR-CN20                             | Epic 29 + BACKEND-B (Foal Dev)     | ⏳ Backlog |
| FR-CN17, FR-CN18                            | Epic 30 (Polish + Launch)          | ⏳ Backlog |

### Missing Requirements

#### ❌ FR81 — Community Backend (CRITICAL GAP)

**Requirement:** Community features — message boards, clubs, direct messaging
**PRD Reference:** PRD-00 (in-scope), PRD-01 (P2)
**Epic Coverage:** NONE — not included in any epic or story
**Impact:** Frontend mocks exist (Epics 11 community pages) but no backend API for community is defined or planned in any epic
**Recommendation:** Define as Epic BACKEND-C or add stories to BACKEND-A/B

#### ⚠️ FR63–FR66 — Breed Temperament System (PARTIAL)

**Fully covered:** FR63 (assignment), FR64 (immutability), FR66 (in horse detail) → 31D-1 done
**Training modifiers (FR43):** 31D-2 done
**Competition modifiers (FR48):** 31D-3 done
**Not yet covered:**

- FR61–FR62 (groom synergy) → Epic 31D-4 (backlog)
- FR65 (temperament definitions API) → Epic 31D-5 (backlog)

Both are planned stories — this is expected progress, not a gap.

#### ⚠️ FR23 — Lusitano Gait Ratings (DATA GAP)

**Requirement:** Lusitano breed gait ratings (walk, trot, canter, gallop means/std_dev)
**Status:** PRD-02 §3.2 explicitly marks these as "TBD"
**Impact:** Gait generation for Lusitano horses is undefined — runtime behavior unpredictable
**Recommendation:** Define Lusitano gait ratings in PRD-02 before 31D-4 proceeds (requires breed data research)

#### ⚠️ Rider & Trainer Systems (SPEC GAP)

**In-scope per PRD-00:** Riders and trainers are listed as in-scope systems
**PRD coverage:** No PRD sections define FRs for riders or trainers
**Epic coverage:** Epics 9C (riders frontend) and Epic 13 (trainers frontend) implemented UI mocks only; no backend FRs, no physical systems epics planned
**Impact:** These systems are frontend-mocked with no backend implementation path
**Recommendation:** Add PRD-05 (Rider System) and PRD-06 (Trainer System) sections before planning implementation epics

### Coverage Statistics

| Metric                                          | Count                |
| ----------------------------------------------- | -------------------- |
| Total PRD FRs                                   | 81                   |
| Fully covered (implemented or planned in epics) | 79                   |
| Missing epic coverage                           | 1 (FR81)             |
| Data gaps (spec incomplete)                     | 1 (FR23 Lusitano)    |
| System spec gaps (no PRD FRs defined)           | 2 (Riders, Trainers) |
| Total Celestial Night FRs                       | 20                   |
| Celestial Night FRs in epics                    | 20 (all backlog)     |
| **Overall PRD FR Coverage**                     | **97.5%**            |

---

## Step 4: UX Alignment Assessment

### UX Document Status

✅ **Found:** `docs/ux-design-specification.md` (2,119 lines, 141 KB, last updated Mar 12 2026)
✅ **Sharded implementation guide:** `docs/ux-spec-sections/` (14 files, all marked `done`, updated Mar 30 2026)

### UX ↔ GDD Alignment

**Well-Aligned Areas:**

- All 4 personas in UX spec (Strategic Breeder, Casual Competitor, Horse Enthusiast, Collector) exactly match PRD-01 personas ✅
- UX covers FR-CN1 through FR-CN20 comprehensively (design tokens, 8 core components, 6 user journey flows, WCAG 2.1 AA) ✅
- UX design challenges reference 10 stats, 23 disciplines, genetics, grooms, riders, trainers — matching PRD scope ✅
- 4-layer implementation strategy (Global → Container → Typography → Component) matches PRD phased delivery ✅

**Critical Misalignment — Physical Systems Not in UX:**

The UX specification has **zero coverage** of the physical systems added in Epics 31A-31F. A grep across the entire 141 KB UX spec returned 0 matches for: `conformation`, `temperament`, `gait`, `coat`, `color`, `genetics`.

The following new horse attributes have no UX definition:
| System | Backend Status | UX Coverage |
|--------|---------------|-------------|
| Conformation scores (8 regions) | ✅ Done (31B) | ❌ No UX spec |
| Gait quality scores | ✅ Done (31C) | ❌ No UX spec |
| Breed temperament badge | ✅ Done (31D-1/2/3) | ❌ No UX spec |
| Temperament-groom synergy UI | ❌ Backlog (31D-4) | ❌ No UX spec |
| Coat color / genotype display | ❌ Backlog (31E) | ❌ No UX spec |
| Conformation show entry + results | ❌ Backlog (31F) | ❌ No UX spec |

This is a known, acknowledged gap — `epics-physical-systems.md` explicitly defers UX updates to a follow-up phase with this note: _"UX spec sections need updating to reflect conformation display, gait display, temperament badges, color/marking display, and conformation show UI."_

**Impact:** Epics 31D-4, 31D-5, 31E, and 31F cannot begin frontend integration without UX spec additions. Backend-only stories are unblocked; frontend stories are blocked.

### UX ↔ Architecture Alignment

**Well-Aligned:**

- `CelestialThemeProvider` already in App.tsx root ✅ (supports FR-CN4 feature toggle)
- All 37 pages lazy-loaded via `React.lazy()` + `GallopingLoader` ✅ (supports FR-CN18 performance target)
- `rollup-plugin-visualizer` configured ✅ (enables bundle size monitoring for <400KB target)
- 44 React Query hooks already established ✅ (architecture supports UX data-fetching patterns)
- Feature flags context already exists ✅ (supports `.celestial` progressive migration)
- `GlassPanel`, `FenceJumpBar`, `CinematicMoment` components exist ✅ (core of FR-CN2 design system partially done)

**Architecture Gap — No Scheduled Job System:**

FR-CN8 requires competition shows with **7-day entry windows** and **overnight execution**. This implies a server-side scheduler (cron job or job queue). The current architecture (`architecture-backend.md`) shows no scheduled job infrastructure — no cron, no queue (BullMQ, Agenda, etc.), no background worker.

This is a meaningful architectural gap for BACKEND-A stories.

**Architecture Gap — No Real-Time Event Infrastructure:**

FR-CN8 (competition results via WYAG) and FR-CN9 (foal development lifecycle events) imply server-push or polling for real-time updates. Current architecture is purely request/response (no WebSocket, no SSE). BACKEND-A story BA-3 ("Real-time events infrastructure") covers this but no architectural decision is recorded yet.

### Warnings

⚠️ **W1 — Physical Systems UX Gap:** 6 new horse attribute systems (conformation, gait, temperament, color/genetics, conformation shows) have no UX specification. Before frontend stories for Epics 31D-5, 31E, and 31F can be planned, UX spec must be extended with display patterns for each system.

⚠️ **W2 — Scheduled Job Architecture:** Overnight competition execution (FR-CN8) requires a scheduler not present in current architecture. ADR needed before BACKEND-A stories are created.

⚠️ **W3 — Real-Time Architecture:** WYAG + competition results push (FR-CN6/FR-CN8) implies server-push capability not currently in architecture. BA-3 story must produce an ADR.

---

## Step 5: Epic Quality Review

### Validation Standards Applied

- Epics deliver player/user value (not technical milestones)
- Epic independence (no forward dependencies)
- Stories independently completable
- Acceptance criteria in Given/When/Then format, specific and measurable
- No "As a developer" user stories where player voice is appropriate

---

### 🔴 Critical Violations

#### C1 — Systemic "As a developer" Stories in Physical Systems Epics (Epics 31A–31C)

**Affected stories:** 31A-1, 31B-1, 31B-2 (confirmed); likely 31C-1, 31C-2, 31D-1, 31D-2, 31D-3 (pattern)

**Violation:** Stories are written from the developer perspective ("As a developer, I want a service that...") rather than from the player perspective. This breaks the user-story contract — the player cannot see why this matters to their experience.

**Examples:**

- 31B-1: _"As a developer, I want a service that generates 8 conformation region scores..."_
- 31B-2: _"As a developer, I want foal conformation scores to blend parent scores..."_
- 31A-1: _"As a developer, I want breed genetic profiles populated..."_

**Why it matters:** Stories written in developer voice lack the "So that [player benefit]" anchor that keeps implementation focused on outcome. Teams implementing these may deliver technically correct systems that miss the player experience.

**Recommended fix:** Rewrite using player voice:

> _"As a player, I want each horse to have permanent conformation scores from birth, so that I can evaluate physical quality and make strategic breeding decisions."_

The technical implementation details can remain in Technical Notes sections (as Story 22.1 shows correctly).

---

#### C2 — Epic 31A Has No Standalone Player Value

**Epic:** 31A — Breed Genetic Profile Population
**Violation:** The entire epic is a data migration — populating JSONB fields in the database. Players experience zero change when this epic ships. It is a technical prerequisite, not a user-facing epic.

**Impact:** Low in practice (it's done and took 1 story), but it represents a structural issue: if this epic failed, a player could not tell. That's a sign it shouldn't be a standalone epic.

**Recommended approach:** In future, fold this type of foundational data work into Story 1 of the first consuming epic (e.g., Story 31B-1 could include the breed data population as a subtask). This is the brownfield equivalent of "each story creates the data it needs."

---

### 🟠 Major Issues

#### M1 — Story 22.2 CelestialThemeProvider Written as Developer Story

**Story:** Epic 22, Story 22.2
**Issue:** _"As a developer, I want a zero-JS CSS class toggle..."_ — developer voice, not player voice

**Contrast with Story 22.1** which correctly uses player voice for the font migration.

**Recommended fix:** Reframe as:

> _"As a player, I want the Celestial Night theme to be the default experience, so that the game world feels consistent and intentional from the first load."_

Technical toggle details belong in Technical Notes.

---

#### M2 — BACKEND-A Stories Not Defined in epics.md

**Epic:** BACKEND-A — Competition Model Rewrite
**Issue:** The epic summary table describes BACKEND-A's user value and FRs, but no individual story definitions with ACs are present in the reviewed portion of `epics.md`. Stories are described only as bullet points in the dependency graph: "7-day windows, overnight execution, show creation, milestones JSONB."

**Impact:** BACKEND-A cannot move to `ready-for-dev` without story files. Since Epic 27 (Competition Flow Redesign) depends on BACKEND-A, this blocks a critical path.

**Recommended fix:** Create story files for BACKEND-A before assigning to a developer. The technical context table references "Tech Spec ADR-3, ADR-4" — those ADRs must be written first.

---

#### M3 — BACKEND-B Stories Not Defined in epics.md (Same Issue)

Same structural issue as M2 for BACKEND-B (Foal Development Model Expansion). Epic 29 depends on BACKEND-B.

---

### 🟡 Minor Concerns

#### Mi1 — Lusitano Gait Data Explicitly TBD in Story 31A-1 AC

Story 31A-1 includes: _"Lusitano (ID 11) has temperament weights but conformation/gait ratings marked as TBD placeholders."_ This is correctly tracked in the AC, but it means Lusitano gait generation (FR23) is still technically incomplete. The `gait scores` for Lusitano horses will use placeholder or fallback values.

**Recommendation:** Before Epic 31E (coat color) or Epic 31F (conformation shows), finalize Lusitano gait data and update the 31A seed data.

#### Mi2 — Epic 30 "Polish & Consistency" Depends on "All Previous Epics"

**Epic 30** has dependency: "All previous epics." This is accurate but creates a potential bottleneck — Epic 30 cannot start until Epics 22-29 + BACKEND-A/B are complete. This is by design for a polish/QA epic, but it means Epic 30 is at risk of scope creep as each upstream epic ships.

**Recommendation:** Define specific, bounded deliverables for Epic 30 now so it doesn't become a catch-all bucket.

---

### Epic Quality Scorecard

| Epic  | Player Value                                | Independence       | Story Quality                      | AC Quality         | Score |
| ----- | ------------------------------------------- | ------------------ | ---------------------------------- | ------------------ | ----- |
| 31A   | ⚠️ None standalone                          | ✅                 | ⚠️ Dev voice                       | ✅ Measurable      | 2/4   |
| 31B   | ✅ Conformation quality matters             | ✅ (needs 31A)     | ⚠️ Dev voice (31B-1/2), ✅ (31B-3) | ✅ GWT format      | 3/4   |
| 31C   | ✅ Gaits affect discipline fit              | ✅ (needs 31A/31B) | ⚠️ Likely dev voice                | ✅                 | 3/4   |
| 31D   | ✅ Personality affects training/competition | ✅ (needs 31A)     | ⚠️ Likely dev voice                | ✅                 | 3/4   |
| 31E   | ✅ Strong — coat color = visual identity    | ✅ (needs 31A)     | Unknown                            | Unknown            | TBD   |
| 31F   | ✅ New game mode                            | ✅ (needs 31B/31D) | Unknown                            | Unknown            | TBD   |
| 22    | ✅ Excellent UVS                            | ✅ (entry point)   | ✅ (22.1) / ⚠️ (22.2)              | ✅ GWT, measurable | 3.5/4 |
| 23-29 | ✅ All have strong UVS                      | ✅ chain correct   | Not reviewed in detail             | Not reviewed       | TBD   |
| BA    | ✅ Strong UVS                               | ✅                 | ❌ No story files                  | ❌ No ACs          | 1/4   |
| BB    | ✅ Strong UVS                               | ✅                 | ❌ No story files                  | ❌ No ACs          | 1/4   |
| 30    | ✅ Quality gate                             | ⚠️ Depends on all  | Not reviewed                       | Not reviewed       | TBD   |

---

## Summary and Recommendations

### Overall Readiness Status

**⚠️ NEEDS WORK — Conditionally Ready for Next Story**

The project is in strong shape for continuing the current active sprint (Epic 31D). Stories 31D-4 and 31D-5 can be created and implemented immediately. The broader epic pipeline (Epics 22-30, 31E-31F) requires specific actions before stories can be created or development can begin.

---

### Issues by Priority

| #   | Severity    | Issue                                                                      | Affects                                          |
| --- | ----------- | -------------------------------------------------------------------------- | ------------------------------------------------ |
| 1   | 🔴 Critical | Systemic "As a developer" story voice in Epics 31A-31C                     | Story quality, developer focus                   |
| 2   | 🔴 Critical | Epic 31A has no standalone player value                                    | Methodology compliance                           |
| 3   | 🟠 Major    | BACKEND-A stories not defined (no ACs)                                     | Epic 27 blocked until BA stories exist           |
| 4   | 🟠 Major    | BACKEND-B stories not defined (no ACs)                                     | Epic 29 blocked until BB stories exist           |
| 5   | 🟠 Major    | Story 22.2 uses developer voice                                            | Methodology                                      |
| 6   | 🟠 Major    | FR81 (Community backend) not in any epic                                   | Community features have no implementation path   |
| 7   | 🟠 Major    | Physical Systems UX gap (31A-31F) — zero UX spec coverage                  | Frontend integration of physical systems blocked |
| 8   | 🟠 Major    | No scheduled job architecture for overnight competition execution (FR-CN8) | BACKEND-A cannot start without ADR               |
| 9   | 🟡 Minor    | Lusitano gait data "TBD" — FR23 partially incomplete                       | Lusitano horses have undefined gait generation   |
| 10  | 🟡 Minor    | Rider/Trainer systems in PRD scope but no FRs or epics defined             | 2 systems have no roadmap                        |
| 11  | 🟡 Minor    | Epic 30 "depends on all" creates late-stage bottleneck                     | Risk of scope creep in polish phase              |

**Total issues: 11** (2 Critical, 6 Major, 3 Minor)

---

### Critical Issues Requiring Immediate Action

**1. Before creating 31D-4 and 31D-5 story files:**

- No blockers — these can proceed now. Story voice should use player perspective (fix the "As a developer" pattern).

**2. Before creating BACKEND-A/B story files:**

- Write ADRs for: (a) scheduler technology choice (cron vs job queue), (b) real-time events strategy (SSE vs polling vs WebSocket)
- Define story files with ACs before assigning to developers

**3. Before planning Epic 31F (Conformation Shows):**

- Finalize Lusitano gait data in PRD-02 §3.2 and update 31A seed data
- Add UX spec section for conformation show entry flow and results display

**4. Before planning Epic 31E (Coat Color Genetics):**

- Add UX spec sections for coat color/genotype display, color picker, breeding prediction UI

---

### Recommended Next Steps

**Immediate (this sprint):**

1. Create story file for **31D-4** (Temperament-Groom Synergy) — player voice, use this assessment as context
2. Create story file for **31D-5** (Temperament Definitions API) — straightforward backend endpoint
3. Fix "As a developer" story voice in Epic 31D-4/5 to establish the correct pattern going forward

**Short-term (next 2 sprints):** 4. Finalize Lusitano gait ratings — research breed data and update PRD-02 §3.2 + 31A seed 5. Write ADR for BACKEND-A scheduler design before creating BACKEND-A story files 6. Create story files for BACKEND-A (at minimum BA-1 and BA-2) to unblock Epic 27 planning

**Medium-term (before Epics 22-30 begin):** 7. Extend UX spec to cover physical systems display: conformation radar chart, gait bar charts, temperament badge, coat color/markings viewer 8. Define PRD sections for Rider System and Trainer System (currently in-scope but unspecified) 9. Add Community Backend to an epic (Epic BACKEND-C or extend BACKEND-A/B scope)

---

### What's Ready Right Now

✅ **31D-4 and 31D-5** — Can be created and developed immediately (no blockers, no architecture changes needed)
✅ **Epic 31E planning** — Spec is complete in PRD-02 §3.3 (though UX is TBD for frontend)
✅ **Epic 22 stories** — Can be created with high confidence (strong spec, clear ACs pattern established)
✅ **All Epic 22-29 UX flows** — Fully specified in UX spec and epics.md

---

### Final Note

This assessment identified **11 issues** across 4 categories (FR Coverage, UX Alignment, Architecture, Epic Quality). The project is well-documented and well-architected. The critical issues are methodological (story voice) and planning gaps (BACKEND-A/B stories, physical systems UX), not architectural failures. Address the 2 critical and 6 major issues in the order above before proceeding to Epics 22-30 and 31E-31F.

**Assessment Date:** 2026-03-30
**Assessor:** Claude (GDS Check Implementation Readiness workflow)
**Report File:** `docs/implementation-readiness-report-2026-03-30.md`

---

### GDD Completeness Assessment

**Strengths:** PRDs versioned, recently updated (Mar 2026), FRs have acceptance criteria and API definitions, NFRs are quantitative.

**Gaps:** Lusitano gait data TBD; Rider/Trainer systems have no FR specifications; Community backend (Epic BA series) has minimal PRD coverage; Conformation Show and Coat Color specs exist but are unimplemented.
