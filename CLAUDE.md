# Equoria - Claude Code Configuration

**Version:** 3.1.0
**Last Updated:** 2026-02-27
**Project:** Web browser-based horse breeding simulation game

---

## 🎯 Current Sprint

### Active Priority: Epic 18 — Visual Polish & Cinematic Moments ✅ COMPLETE

- **Status:** Epics 1–18 all complete ✅ — production-ready
- **Stories:** 18-1 GallopingLoader, 18-2 FenceJumpBar, 18-3 Ribbon Unfurl, 18-4 CinematicMoment, 18-5 Horseshoe Borders (all complete)
- **Next:** Production launch (Railway deploy) or Epic 19
- **Branch:** `cleanup-session-2026-01-30`

### Epic 18 Deliverables

- `frontend/src/components/ui/GallopingLoader.tsx` — Animated horse Suspense fallback (replaces CSS spinner in App.tsx)
- `frontend/src/components/ui/FenceJumpBar.tsx` — XP progress bar with fence markers at 25/50/75/100% + jumping 🐎
- `frontend/src/components/feedback/CinematicMoment.tsx` — Fullscreen overlay for trait-discovery / foal-birth / cup-win
- `frontend/src/components/feedback/LevelUpCelebrationModal.tsx` — Ribbon unfurl banner behind trophy (18-3)
- `frontend/src/components/horse/XPProgressBar.tsx` — Uses FenceJumpBar for XP fill (18-2)
- `frontend/src/components/competition/PrizeNotificationModal.tsx` — CinematicMoment for 1st-place wins (18-4)
- `frontend/src/components/foal/FoalDevelopmentTracker.tsx` — CinematicMoment on trait reveal (18-4)
- `frontend/src/pages/breeding/BreedingPairSelection.tsx` — CinematicMoment on foal birth (18-4)
- `frontend/src/index.css` — All 18 keyframes + .btn-cobalt horseshoe ::before/::after (18-5)

### Epic 17 Deliverables (Hybrid Onboarding Tutorial + Z-Index Token System)

- Z-index token system in `tokens.css` — `--z-*` variables replacing magic numbers
- Onboarding tutorial overlay system integrated with Epic 16 OnboardingPage

### Epic 16 Deliverables

- `backend/controllers/inventoryController.mjs` — GET /api/inventory, POST /equip, POST /unequip (JSONB-based)
- `backend/routes/inventoryRoutes.mjs` — Inventory routes with auth
- `frontend/src/hooks/api/useInventory.ts` — useInventory / useEquipItem / useUnequipItem
- `frontend/src/pages/InventoryPage.tsx` — Live API, HorsePicker modal for tack equip
- `frontend/src/pages/OnboardingPage.tsx` — 3-step wizard (Welcome → Starter Kit → Ready)
- `frontend/src/components/auth/OnboardingGuard.tsx` — Redirect if `completedOnboarding === false`
- `frontend/src/App.tsx` — OnboardingGuard + `/onboarding` route added
- `frontend/public/placeholder.svg` — Celestial Night horse silhouette SVG
- `frontend/public/assets/horses/README.md` — Art asset naming conventions

### Epic 14 Deliverables

- `Dockerfile` — Multi-stage: `frontend-builder` (Vite) → `production` (Express + embedded SPA)
- `railway.toml` — Railway build + deploy config; `prisma migrate deploy` before server start
- `backend/app.mjs` — `express.static(public/)` + SPA `index.html` fallback (production only)
- `frontend/src/lib/api-client.ts` — `VITE_API_URL ?? ''` for relative API URLs
- `frontend/src/lib/sentry.ts` — `initSentry()` + `SentryErrorBoundary` (opt-in via env var)
- `frontend/src/App.tsx` — Sentry ErrorBoundary wrapper
- `frontend/vite.config.ts` — `rollup-plugin-visualizer` → `dist/bundle-stats.html`
- `.github/workflows/ci-cd.yml` — Jobs 10 (Docker smoke test) + 11 (Lighthouse CI)
- `.lighthouserc.yml` — Lighthouse CI thresholds (a11y error ≥0.85, perf warn ≥0.6)
- `docs/deployment/RAILWAY_SETUP.md` — Step-by-step Railway setup guide

### Epic 13 Deliverables

- `TrainersPage.tsx` (`/trainers`) — Two tabs: Manage / Hire, World sub-location
- `TrainerList.tsx` — 6 mock trainers, filters, hire buttons disabled
- `MyTrainersDashboard.tsx` — 2 hired trainers, slot counter, expandable career/discovery
- `trainer/TrainerPersonalityBadge.tsx` — 5 personalities (focused/encouraging/technical/competitive/patient)
- `trainer/TrainerPersonalityDisplay.tsx` — Discipline tendencies + horse compatibility
- `trainer/TrainerAssignmentCard.tsx` — Assigned horse chip with disabled unassign
- `trainer/TrainerCareerPanel.tsx` — XP bar, milestones, retirement warning
- `trainer/TrainerDiscoveryPanel.tsx` — 3 categories × 2 discovery slots
- `WorldHubPage.tsx` — Added 9th location card (Trainers 🎓)
- `nav-items.tsx` — `/trainers` route registered (icon: null)

### Epic 11 Deliverables

- `CommunityPage.tsx` (`/community`) — Hub with 3 feature cards + activity feed
- `MessageBoardPage.tsx` (`/message-board`) — 5 section tabs, mock threads, "New Post" disabled
- `ClubsPage.tsx` (`/clubs`) — Discipline clubs, breed clubs, governance + elections
- `MessagesPage.tsx` (`/messages`) — Inbox/Sent tabs, unread badge, "Compose" disabled
- `MainNavigation.tsx` — Bell → Link to /messages, "Community" added to nav
- `nav-items.tsx` — 4 new routes registered

### Epic 12 Deliverables

- `BankPage.tsx` (`/bank`) — Balance card, weekly claim, transaction history
- `InventoryPage.tsx` (`/inventory`) — Category filter, item grid, equip buttons (mock-ready)
- `MyStablePage.tsx` (`/my-stable`) — Stable profile + Hall of Fame tabs
- `HorseDetailPage.tsx` — Added Pedigree, Health & Vet, Stud / Sale tabs (parchment theme)
- `HorseDetailPage.tsx` — Sticky bottom action bar (Feed/Train/Breed/Assign/List)

### Project Status

- ✅ **Backend:** 100% complete — 3617 tests passing (226 suites), pre-push hook active
- ✅ **Epics 1–18:** All complete (auth + horses + training + competition + breeding + grooms + riders + world + community + trainers + deployment + onboarding + inventory + visual polish)
- ✅ **E2E Tests:** Playwright suite passing (core-game-flows, auth, breeding)
- ✅ **Deployment:** Railway-ready — multi-stage Docker, railway.toml, migrate deploy pipeline
- ✅ **Frontend:** 100% complete (React 19 + TypeScript in `/frontend/`)

### Session Start Checklist

```bash
bd ready            # ALWAYS run this first — find available work
bd show <id>        # Review issue before claiming
bd update <id> --status=in_progress  # Claim before starting
```

---

## ⚡ Core Rules (Essential Only)

### ES Modules Only

```javascript
// ✅ ALWAYS
import express from 'express';
export default myFunction;

// ❌ NEVER
const express = require('express');
module.exports = myFunction;
```

### Naming Standards

- camelCase: variables, functions, properties
- PascalCase: classes, React components
- kebab-case: file names

### Testing Philosophy

- **Balanced mocking:** External dependencies only (DB, HTTP, logger)
- **Real business logic:** Test actual implementations
- **Backend:** 3530+ tests passing (221 suites)
- **Frontend:** Vitest + MSW (`onUnhandledRequest: 'error'` strict mode)
- **E2E:** Playwright (Epic 9A-2)

### Issue Tracking

Use `bd` commands (not markdown TODOs):

```bash
bd ready              # Find available work
bd create "Task"      # Create issue
bd update ID --status in_progress
bd close ID           # Mark complete
```

---

## 📚 Documentation Skills (Call When Needed)

Use `/` commands to load detailed docs:

### Security & Standards

- `/security-guide` - Full security documentation (SECURITY.md)
- `/es-modules-guide` - ES Modules detailed guide
- `/contributing` - Full contribution guidelines

### Architecture & Systems

- `/backend-api` - Backend API layer documentation
- `/test-architecture` - Testing strategy & patterns
- `/groom-system` - Groom system implementation

### Configuration

- `/mcp-setup` - MCP server configuration guide
- `/agent-config` - Agent & skill configuration
- `/deployment-guide` - Production deployment procedures

---

## 🚀 Quick Commands

### Development

```bash
npm run dev          # Start dev server
npm test            # Run tests
npm run lint:fix    # Auto-fix linting
```

### Testing

```bash
npm test -- --watch                    # Watch mode
npm test -- auth                       # Specific pattern
npm test -- --detectOpenHandles        # Debug leaks
```

### Beads Workflow

```bash
bd ready            # Available tasks
bd show ID          # Task details
bd sync             # Sync with remote
```

---

## 📁 Project Structure

```
equoria/
├── backend/              # Node.js + Express (100% complete)
│   ├── controllers/      # Business logic
│   ├── routes/          # API endpoints
│   ├── models/          # Data models
│   └── __tests__/       # 468+ tests
├── frontend/            # React 19 browser game (~60% complete)
│   └── src/
├── packages/database/   # Prisma ORM + PostgreSQL
└── .claude/            # Documentation (call via skills)
```

---

## 🔧 Current Focus Areas

### Epic 9A: Technical Health Sprint ✅ COMPLETE

1. **9A-1** ✅ Stabilize flaky tests + restore pre-push hook
2. **9A-2** ✅ Playwright E2E for core game flows (11 pass, 4 graceful skips)
3. **9A-3** ✅ Project Health Pass (CLAUDE.md, sprint-status sync)
4. **Quick Actions Bundle** ✅ AI-7-2, AI-7-3, AI-7-4, AI-8-1

### Epic 9B: Navigation & World Hub ✅ COMPLETE

1. **9B-1** ✅ World Hub Page (`/world`) — 8 location cards
2. **9B-2** ✅ Navigation Restructure — fixed routes, added World/Leaderboards/Settings
3. **9B-3** ✅ Horse Care Status Strip — `careStatus` prop on HorseCard
4. **9B-4** ✅ Settings Page (`/settings`) — Account / Notifications / Display

### Epic 9C: Rider System ✅ COMPLETE

1. **9C-1** ✅ Rider Type System — 4 personalities, 3 skill levels, personality badge/display
2. **9C-2** ✅ Rider Dashboard — slot counter, rider cards, AssignRiderModal
3. **9C-3** ✅ Career & Discovery — XP/level progress, 3 discovery categories (6 slots)
4. **9C-4** ✅ Rider Marketplace — RiderList with filter/sort, hire flow, RidersPage
5. **9C-5** ⏭️ Wire to Live API — deferred (no backend rider endpoints yet)

### Next Epic: TBD (Epic 10)

---

## 🆘 Emergency Contacts

**Test Failures:** Check balanced mocking (external deps only)
**Import Errors:** Ensure `.js` extensions, ES modules only
**Context Issues:** Use skills (`/security-guide`) instead of loading full docs

---

**For detailed documentation, use `/` skills above.**
**Full docs in `.claude/` - don't load manually unless debugging.**
