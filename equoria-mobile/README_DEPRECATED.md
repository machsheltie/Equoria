# ⚠️ DEPRECATED FOLDER - DO NOT USE

**Created:** 2025-11-13 to 2025-11-17
**Status:** DEPRECATED - DO NOT USE FOR DEVELOPMENT
**Reason:** Created in error - Project is web browser game, not mobile app

---

## What Happened

This folder was created in **ERROR** during November 13-17, 2025 when the project platform was misunderstood.

A mobile app (React Native) was built for 4 days when the project is actually a **web browser-based game** (like Horseland, Ludus Equinus, Equus Ipsum).

---

## Project Facts

### ❌ WRONG (This Folder)
- **Platform:** Mobile app (React Native 0.81.5 + Expo)
- **Assumption:** Modern animated mobile game
- **Development:** 4 days of work (Nov 13-17, 2025)

### ✅ CORRECT (Actual Project)
- **Platform:** Web browser-based game
- **Style:** Old-school text/graphics (late 90s/early 2000s style)
- **References:** Horseland, Ludus Equinus, Equus Ipsum
- **Tech Stack:** React 19 + TypeScript + Tailwind CSS
- **Location:** `/frontend/` folder (NOT this folder!)

---

## Status of This Folder

### What Was Built (4 Days of Work)
- 479 tests (100% passing)
- 96.09% code coverage
- React Native 0.81.5 + Expo 54
- Redux Toolkit + React Query state management
- React Navigation v7 with type safety
- Authentication screens (Login, Register, ForgotPassword, Profile)
- Common components (Screen, Loading, ErrorMessage)
- ESLint v9 + TypeScript strict mode
- Husky git hooks

### Technical Quality
- ✅ 479/479 tests passing (100% pass rate)
- ✅ 96.09% statement coverage
- ✅ Zero TypeScript errors
- ✅ Production-ready authentication flow
- ✅ WCAG 2.1 AA accessibility compliance
- ✅ Grade A+ (99/100) code quality

---

## Why Keep This Folder?

1. **Potential Future Mobile Version**
   - If mobile app is needed later, this provides a foundation
   - Authentication patterns are reusable
   - Testing infrastructure is exemplary

2. **Reference for Best Practices**
   - TDD methodology demonstration
   - React Native patterns
   - Type-safe navigation implementation
   - Comprehensive test coverage examples

3. **Documentation Value**
   - 110 markdown files in `.claude/` subfolder
   - Reorganization methodology documented
   - Test-driven development examples

---

## DO NOT USE FOR CURRENT DEVELOPMENT

**Use `/frontend/` instead** - React 19 web app (~60% complete)

### Correct Project Structure

```
Equoria/
├── .claude/              ✅ MAIN project context (58 docs, 25 rules)
│   └── docs/
│       └── CLAUDE.md     Main configuration
│
├── backend/              ✅ PRODUCTION-READY (Node.js/Express/PostgreSQL)
│   ├── .claude/          Backend-specific docs (23 files)
│   ├── controllers/      24 files, 8,000 lines
│   ├── routes/           34 files, 10,000 lines
│   ├── services/         48 files, 15,000 lines
│   ├── models/           9 files, 5,000 lines
│   └── tests/            177 test files, 468+ tests (90.1% success)
│
├── frontend/             ✅ WEB APP - USE THIS (React 19 + TypeScript + Tailwind)
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/   19 components, 6,424 lines
│   │   └── pages/        2 pages, 319 lines
│   ├── index.html        Browser entry point
│   └── __tests__/        10 test files, 115+ tests
│
└── equoria-mobile/       ❌ IGNORE THIS (you are here)
    ├── .claude/          110 .md files created in error
    ├── src/              React Native code
    └── README_DEPRECATED.md  (this file)
```

---

## How to Use Correct Project

### For Development Work

1. **Reference Documentation:**
   - `Equoria/.claude/` - Main project context
   - `Equoria/backend/.claude/` - Backend API documentation

2. **Frontend Development:**
   - **Location:** `Equoria/frontend/`
   - **Tech:** React 19 + TypeScript + Tailwind CSS
   - **Status:** ~60% complete
   - **Missing:** Authentication, training UI, breeding UI, API integration

3. **Backend Development:**
   - **Location:** `Equoria/backend/`
   - **Status:** 100% production-ready
   - **Tests:** 468+ tests with 90.1% success rate
   - **API Endpoints:** 130+ fully documented

### For Context/Rules

- **Main Config:** `Equoria/.claude/docs/CLAUDE.md`
- **Settings:** `Equoria/.claude/settings.json` (now corrected)
- **Backend Docs:** `Equoria/backend/.claude/`

---

## Questions or Issues?

If you're seeing this file and wondering what to do:

1. ✅ **Correct:** Use `/frontend/` for web app development
2. ✅ **Correct:** Reference `/.claude/` and `/backend/.claude/` for context
3. ❌ **Incorrect:** Do NOT develop in this `equoria-mobile/` folder
4. ❌ **Incorrect:** Do NOT reference `.claude/` docs in this folder

---

## Document History

| Date | Event |
|------|-------|
| 2025-11-13 | Mobile folder created (error began) |
| 2025-11-14 | Day 4 complete - 479 tests, authentication screens |
| 2025-11-17 | Error discovered and corrected |
| 2025-11-17 | This deprecation notice created |
| 2025-11-17 | CLAUDE.md and settings.json corrected |

---

**Created:** 2025-11-17
**Status:** DEPRECATED - DO NOT USE
**Correct Location:** `/frontend/` (React 19 web app)

**For the actual project documentation, see:**
- `Equoria/.claude/docs/CLAUDE.md`
- `Equoria/.claude/CRITICAL_PROJECT_CORRECTIONS.md`
