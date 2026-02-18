# Equoria — Future Epics Roadmap

**Created:** 2026-02-18 (Epic 8 Retrospective)
**Last Updated:** 2026-02-18
**Status:** Living document — update as epics complete or scope changes

---

## Overview

This document captures the full planned roadmap beyond Epic 8. It was initiated during the Epic 8 retrospective after a UX specification audit revealed 3–4 epics of features not yet in sprint-status.

**Current State (post-Epic 8):**

- Epics 1–8: Complete ✅
- Epic 9A: Next (Technical Health Sprint)
- Epics 9B–12: Defined below, pending sprint planning

---

## Epic 9A: Technical Health Sprint

**Priority:** P0 — Must complete before Epic 9B
**Purpose:** Clear accumulated technical debt, restore safety gates, update project documentation

### Stories

| #    | Title                                                 | Priority | Key AC                                                                                                                                         |
| ---- | ----------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 9A-1 | Stabilize Flaky Backend Tests + Restore Pre-Push Hook | P0       | `databaseOptimization.test.mjs` p95 ≤ 500ms, `userRoutes.test.mjs` uses randomUUID(), 5 consecutive clean runs, `--no-verify` no longer needed |
| 9A-2 | Playwright E2E for Core Game Flows                    | P1       | Login, session persistence, stable load, training session, competition entry covered by browser tests                                          |
| 9A-3 | Project Health Pass                                   | P1       | CLAUDE.md current, Epic 8 stories → completed, nul artifact removed, sprint-status fields updated                                              |

### Quick Action Items (bundle, ~1 hour)

- Add `_` prefix rule to PATTERN_LIBRARY.md (AI-7-2)
- Add `within()` scoping pattern to PATTERN_LIBRARY.md (AI-7-3)
- Add `bd ready` to session start checklist (AI-7-4)
- Add path registry comment block to `handlers.ts` (AI-8-1)

---

## Epic 9B: Navigation & World Hub

**Priority:** P0
**Purpose:** Restructure navigation to match UX spec's place-based architecture. Create the central "World" location system that connects all game services.

**UX Spec References:** `samples/Complete project plan.docx`, `samples/More UI Design.docx`

### Stories

| #    | Title                      | Priority | Description                                                                                                                                                                                           |
| ---- | -------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 9B-1 | World Hub Page             | P0       | Create `/world` page with 8 location cards (Vet, Farrier, Tack Shop, Feed Shop, Training Center, Grooms, Riders, Breeding Specialist). Each card shows action alerts (e.g., "3 horses need shoeing"). |
| 9B-2 | Navigation Restructure     | P0       | Add World, Competitions, Leaderboards, Settings to main nav. Current nav (Home, Stable, Training, Breeding, Profile) is incomplete relative to UX spec.                                               |
| 9B-3 | Horse Care Status Strip    | P0       | Add care status bar to every `HorseCard.tsx` showing: Last Shod, Last Fed, Last Trained, Last Foaled (mares only). Exact dates, no hover required.                                                    |
| 9B-4 | Settings Page              | P1       | Account preferences page at `/settings`. Account details, notification preferences, display options.                                                                                                  |
| 9B-5 | Wire World Hub to Live API | P1       | Connect care status data, location alert badges, and action item counts to real backend endpoints (Epic 8 wiring pattern).                                                                            |

---

## Epic 9C: Rider System

**Priority:** P0
**Purpose:** Complete the staff system. Grooms (Epic 7) established the pattern: Hire → Assign → Discover → Retire. Riders follow the identical pattern.

**UX Spec References:** `samples/Equoria Rider Systems Overview.docx`

**Pattern:** Mirrors Groom system entirely. Once a player understands Grooms, Riders should be immediately recognizable.

### Stories

| #    | Title                         | Priority | Description                                                                                                   |
| ---- | ----------------------------- | -------- | ------------------------------------------------------------------------------------------------------------- |
| 9C-1 | Rider Hiring Interface        | P0       | Hire riders with skill/personality selection. Mirrors `GroomHiringInterface`.                                 |
| 9C-2 | Rider Assignment + Management | P0       | Assign riders to horses. Rider management dashboard. Mirrors `MyGroomsDashboard` / `AssignGroomModal`.        |
| 9C-3 | Rider Discovery System        | P1       | Hidden trait reveal: discipline affinities, temperament compatibility, gait affinity. 3 discovery categories. |
| 9C-4 | Rider Career + Legacy         | P1       | XP/level progression, retirement mechanics, legacy bonuses. Mirrors `GroomCareerPanel` / `GroomLegacyPanel`.  |
| 9C-5 | Wire Rider Hooks to Live API  | P1       | Connect rider hooks to real backend endpoints (Epic 8 pattern).                                               |

---

## Epic 10: World Locations (Service Hubs)

**Priority:** P1
**Purpose:** Build out each of the 8 World locations as functional game screens. Players navigate to locations to perform horse care actions.

**UX Spec References:** `samples/Complete project plan.docx`, `samples/More UI Design.docx`

### Locations to Build

| Location                | Priority | Description                                                                           |
| ----------------------- | -------- | ------------------------------------------------------------------------------------- |
| **Training Center**     | P0       | Training UI already exists; needs World Hub integration and location-card entry point |
| **Grooms**              | P0       | Groom UI exists (Epic 7); needs World Hub entry point                                 |
| **Veterinarian**        | P0       | Health checks, treatments, vetting results, genetics analysis. Backend exists.        |
| **Farrier**             | P1       | Shoeing interface, hoof care, shoeing history. Backend likely exists.                 |
| **Feed Shop**           | P1       | Nutrition selection, feed inventory, feeding schedule.                                |
| **Tack Shop**           | P1       | Equipment purchase (saddles, bridles), tack inventory.                                |
| **Riders**              | P1       | Rider hub (delivered in Epic 9C; needs World entry point)                             |
| **Breeding Specialist** | P1       | Breeding services; Breeding UI exists (Epic 6); needs World entry point               |

### Stories

| #    | Title                            | Priority |
| ---- | -------------------------------- | -------- |
| 10-1 | Veterinarian Location UI         | P0       |
| 10-2 | Farrier Location UI              | P1       |
| 10-3 | Feed Shop Location UI            | P1       |
| 10-4 | Tack Shop Location UI            | P1       |
| 10-5 | Wire World Locations to Live API | P1       |

---

## Epic 11: Community Features

**Priority:** P1
**Purpose:** Add the social/community layer. Message Board for player communication. Clubs for organized groups with governance.

**UX Spec References:** `samples/Complete project plan.docx`

### Message Board (5 Sections)

| Section                | Description                         |
| ---------------------- | ----------------------------------- |
| 💬 General Chat        | Open discussion                     |
| 🎨 Art and Photography | Horse art, screenshots, photography |
| 🐴 Horse Sales         | Buying and selling horses           |
| 🛠️ Services            | Stud services, groom/rider offers   |
| 😤 Venting             | Off-topic, community venting        |

### Clubs System

- **Discipline Associations** — groups organized by competition discipline
- **Breed Clubs** — groups organized by breed
- **Governance** — Quarterly presidential elections
- **Club Features:** Community News, Member Directory, Club Leaderboard, Educational Content, Breed Registration, Club-Held Competitions

### Stories

| #    | Title                                         | Priority |
| ---- | --------------------------------------------- | -------- |
| 11-1 | Message Board — Core Structure + General Chat | P1       |
| 11-2 | Message Board — All 5 Sections                | P1       |
| 11-3 | Clubs System — Discipline Associations        | P1       |
| 11-4 | Clubs System — Breed Clubs + Registration     | P1       |
| 11-5 | Clubs — Governance (Elections + Leaderboard)  | P2       |
| 11-6 | Notifications Bell + Persistent Header Badge  | P1       |
| 11-7 | Messages/Inbox System                         | P1       |

---

## Epic 12: Stable Management Completions

**Priority:** P1
**Purpose:** Complete the Stable sub-navigation items described in the UX spec but not yet built.

**UX Spec References:** `samples/Horse Profile Screen Design.docx`, `samples/More UI Design.docx`

### Stories

| #    | Title                        | Priority | Description                                                                                                                           |
| ---- | ---------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 12-1 | Bank / Currency UI           | P1       | Weekly Coins allowance collection point, balance display, transaction history. The balance exists in the backend but no dedicated UI. |
| 12-2 | Inventory Page               | P1       | Items, tack, consumables management. Browse owned items, equip tack to horses.                                                        |
| 12-3 | My Page (Stable Profile)     | P1       | Customizable player/stable profile, Legacy Hall of Fame for retired horses.                                                           |
| 12-4 | Horse Profile — Missing Tabs | P1       | Add Pedigree (full tab), Health/Vet, Stud/Sale tabs to Horse Detail Page.                                                             |
| 12-5 | Horse Profile — Action Bar   | P1       | Bottom action bar: Feed, Train, Breed, Assign Rider — visible on Horse Detail Page.                                                   |

---

## Epic 13: Trainer System

**Priority:** P2
**Purpose:** Third and final staff pillar. Trainers follow the identical Hire → Assign → Discover → Retire pattern as Grooms (Epic 7) and Riders (Epic 9C).

### Stories

| #    | Title                           | Priority |
| ---- | ------------------------------- | -------- |
| 13-1 | Trainer Hiring Interface        | P2       |
| 13-2 | Trainer Assignment + Management | P2       |
| 13-3 | Trainer Discovery System        | P2       |
| 13-4 | Trainer Career + Legacy         | P2       |
| 13-5 | Wire Trainer Hooks to Live API  | P2       |

---

## Epic 14: Deployment & Production

**Priority:** P0 (must complete before public launch)
**Purpose:** Build the deployment pipeline. Currently at ~10% complete.

### Stories

| #    | Title                       | Priority | Description                                              |
| ---- | --------------------------- | -------- | -------------------------------------------------------- |
| 14-1 | CI/CD Pipeline Setup        | P0       | GitHub Actions workflow: lint, test, build, deploy       |
| 14-2 | Staging Environment         | P0       | Staging deploy target with real database                 |
| 14-3 | Production Environment      | P0       | Production deploy config, environment variables, secrets |
| 14-4 | Database Migration Pipeline | P0       | Prisma migration strategy for production                 |
| 14-5 | Monitoring + Error Tracking | P1       | Sentry integration for frontend, logging pipeline        |
| 14-6 | Performance Audit           | P1       | Lighthouse scores, bundle size, Core Web Vitals          |

---

## Epic 15: Onboarding & Polish

**Priority:** P2
**Purpose:** Guided onboarding quest and visual polish to complete the Celestial Night identity.

### Onboarding Quest (8 Steps per UX Spec)

1. Market/Store — purchase first horse
2. World > Riders — hire first rider
3. World > Grooms — hire first groom
4. World > Training Center — first training session
5. World > Farrier — shoe the horse
6. World > Feed Shop — select nutrition
7. World > Veterinarian — health check + genetics
8. Competitions — enter first competition

### Visual Polish

- Galloping horse loading animation (currently standard spinner)
- Fence-jump progress bars
- Ribbon unfurling achievements
- Cinematic moments: ultra-rare trait discovery, foal birth, seasonal cup wins
- Horseshoe-shaped button borders

---

## Roadmap Summary

| Epic   | Title                          | Priority | Prerequisite                 |
| ------ | ------------------------------ | -------- | ---------------------------- |
| **9A** | Technical Health Sprint        | P0       | —                            |
| **9B** | Navigation & World Hub         | P0       | 9A                           |
| **9C** | Rider System                   | P0       | 9A                           |
| **10** | World Locations (Service Hubs) | P1       | 9B                           |
| **11** | Community Features             | P1       | 9B                           |
| **12** | Stable Management Completions  | P1       | 9B                           |
| **13** | Trainer System                 | P2       | 9C                           |
| **14** | Deployment & Production        | P0       | 9A (can parallel with 9B/9C) |
| **15** | Onboarding & Polish            | P2       | 10, 11, 12                   |

---

## Feature Completion Status (post-Epic 8)

| System                    | Complete | Partial    | Missing                         |
| ------------------------- | -------- | ---------- | ------------------------------- |
| Authentication            | ✅       |            |                                 |
| User Dashboard            | ✅       |            |                                 |
| Horse Management          | ✅       |            | Care Status Strip               |
| Training System           | ✅       |            |                                 |
| Competition System        | ✅       |            |                                 |
| Breeding System           | ✅       |            |                                 |
| Foal Development          | ✅       |            |                                 |
| Groom System              | ✅       |            |                                 |
| Rider System              |          | ⚠️ ~40%    | Hire/Manage/Discover            |
| Trainer System            |          |            | ❌ 0%                           |
| World Hub                 |          |            | ❌ 0%                           |
| Navigation (full)         |          | ⚠️ 71%     | World, Settings                 |
| Horse Profile (full tabs) |          | ⚠️ Partial | Pedigree, Health/Vet, Stud/Sale |
| Leaderboards              |          | ⚠️ 60%     | Rider view, time filters        |
| Message Board             |          |            | ❌ 0%                           |
| Clubs System              |          |            | ❌ 0%                           |
| Notifications             |          |            | ❌ 0%                           |
| Bank/Currency UI          |          |            | ❌ 0%                           |
| Inventory                 |          |            | ❌ 0%                           |
| Deployment Pipeline       |          | ⚠️ 10%     |                                 |
| Onboarding Quest          |          |            | ❌ 0%                           |
| Visual Polish (cinematic) |          |            | ❌ 0%                           |

**Overall estimate: ~72% feature complete toward full UX spec**

---

_Created during Epic 8 Retrospective — 2026-02-18_
_Source: UX Agent audit of `samples/` folder against `frontend/src/`_
_Maintain this document: update % complete and epic statuses as work progresses_
