# Equoria - Claude Code Configuration

**Version:** 2.0.0 (Lean)
**Last Updated:** 2026-01-27
**Project:** Web browser-based horse breeding simulation game

---

## 🎯 Current Sprint (Week 3, Day 1)

### Active Priority: Security Testing Phase 1

- **Status:** Tasks 1.2-1.4 complete (JWT hardening, rate limiting)
- **Next:** Complete remaining 38/41 auth migration tests
- **Location:** `backend/__tests__/integration/`

### Project Status

- ✅ **Backend:** 100% Production-Ready (468+ tests, 90.1% pass rate)
- ✅ **Security:** Phase 1 in progress (JWT tokens, rate limiting verified)
- ⚠️ **Frontend:** ~60% complete (React 19 + TypeScript in `/frontend/`)
- ⚠️ **Deployment:** 10% complete

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
- **Target:** 90%+ test pass rate (current: 90.1%)

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

### This Week (Week 3)

1. **Auth Migration:** Migrate 38 remaining test files to real JWT auth
2. **Rate Limiting:** Verify all endpoints respect limits
3. **Token Security:** Clock skew tolerance, fingerprinting

### Next Week (Week 4)

1. **Frontend Auth:** Complete authentication screens
2. **API Integration:** Connect frontend to backend
3. **E2E Testing:** Playwright test suite

---

## 🆘 Emergency Contacts

**Test Failures:** Check balanced mocking (external deps only)
**Import Errors:** Ensure `.js` extensions, ES modules only
**Context Issues:** Use skills (`/security-guide`) instead of loading full docs

---

**For detailed documentation, use `/` skills above.**
**Full docs in `.claude/` - don't load manually unless debugging.**
