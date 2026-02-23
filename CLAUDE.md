# Equoria - Claude Code Configuration

**Version:** 2.6.0
**Last Updated:** 2026-02-23
**Project:** Web browser-based horse breeding simulation game

---

## 🎯 Current Sprint

### Active Priority: Epic 12 — Stable Management Completions ✅ COMPLETE

- **Status:** Epic 12 (Stable Management Completions) → Complete ✅
- **Stories:** 12-1 Bank, 12-2 Inventory, 12-3 My Stable, 12-4 Horse Profile Tabs, 12-5 Action Bar
- **Next:** Epic 11 — Community Features (deferred — circle back now)
- **Branch:** `cleanup-session-2026-01-30`

### Epic 12 Deliverables

- `BankPage.tsx` (`/bank`) — Balance card, weekly claim, transaction history
- `InventoryPage.tsx` (`/inventory`) — Category filter, item grid, equip buttons (mock-ready)
- `MyStablePage.tsx` (`/my-stable`) — Stable profile + Hall of Fame tabs
- `HorseDetailPage.tsx` — Added Pedigree, Health & Vet, Stud / Sale tabs (parchment theme)
- `HorseDetailPage.tsx` — Sticky bottom action bar (Feed/Train/Breed/Assign/List)
- `nav-items.tsx` — 3 new routes registered (/bank, /inventory, /my-stable)

### Project Status

- ✅ **Backend:** 100% complete — 3530+ tests passing, pre-push hook active
- ✅ **Epics 1–10, 12:** All complete (API integration + technical health + nav/world hub + riders + world locations + stable management)
- ✅ **E2E Tests:** Playwright suite passing (core-game-flows, auth, breeding)
- ⚠️ **Frontend:** ~87% complete (React 19 + TypeScript in `/frontend/`)
- ⚠️ **Deployment:** 10% complete
- 🔄 **Epic 11:** Community Features (next — was deferred, circle back now)

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
