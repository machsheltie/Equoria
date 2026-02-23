# Equoria - Claude Code Configuration

**Version:** 2.2.0
**Last Updated:** 2026-02-23
**Project:** Web browser-based horse breeding simulation game

---

## 🎯 Current Sprint

### Active Priority: Epic 9B — Navigation & World Hub

- **Status:** Epic 9A (Technical Health Sprint) → Complete ✅
- **Next:** Epic 9B — Navigation restructure, World Hub, Horse Care Strip
- **Branch:** `cleanup-session-2026-01-30`

### Project Status

- ✅ **Backend:** 100% complete — 3530+ tests passing, pre-push hook active
- ✅ **Epics 1–9A:** All complete (API integration + technical health done)
- ✅ **E2E Tests:** Playwright suite passing (core-game-flows, auth, breeding)
- ⚠️ **Frontend:** ~70% complete (React 19 + TypeScript in `/frontend/`)
- ⚠️ **Deployment:** 10% complete
- 🔄 **Epic 9B:** Navigation & World Hub (next)

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

### Current Epic (9B): Navigation & World Hub

1. World Hub Page (8 locations)
2. Navigation restructure (place-based vs category-based)
3. Horse Care Status Strip on every horse card
4. Settings Page
5. Wire to live API

---

## 🆘 Emergency Contacts

**Test Failures:** Check balanced mocking (external deps only)
**Import Errors:** Ensure `.js` extensions, ES modules only
**Context Issues:** Use skills (`/security-guide`) instead of loading full docs

---

**For detailed documentation, use `/` skills above.**
**Full docs in `.claude/` - don't load manually unless debugging.**
