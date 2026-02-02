# Equoria Source Tree Analysis

**Generated:** 2025-12-01
**Last Updated:** 2025-12-01 (Full Rescan)
**Scan Level:** Exhaustive
**Repository Type:** Monorepo

## Project Structure Overview

```
Equoria/
├── backend/                    # Node.js/Express API Backend
│   ├── controllers/            # Request handlers (23 files)
│   ├── routes/                 # API route definitions (35 files, 130+ endpoints)
│   ├── services/               # Business logic (45 files)
│   ├── middleware/             # Express middleware (auth, validation)
│   ├── models/                 # Data models/utilities
│   ├── seed/                   # Database seeding scripts
│   ├── scripts/                # Utility scripts
│   ├── tests/                  # Test files
│   ├── __tests__/              # Additional test files
│   └── server.mjs              # Entry point
│
├── frontend/                   # React/Vite Web Frontend
│   ├── src/
│   │   ├── components/         # React components (25+ files)
│   │   │   ├── ui/             # UI primitives (Radix-based)
│   │   │   └── __tests__/      # Component tests
│   │   ├── pages/              # Page components
│   │   ├── hooks/              # Custom React hooks
│   │   ├── lib/                # Utility functions
│   │   ├── App.tsx             # Root component
│   │   └── main.tsx            # Entry point
│   ├── vite.config.ts          # Vite configuration
│   └── tailwind.config.ts      # TailwindCSS configuration
│
├── packages/
│   └── database/               # Shared Database Package
│       ├── prisma/
│       │   └── schema.prisma   # Database schema (29 models)
│       └── package.json
│
├── docs/                       # Documentation
│   ├── product/                # PRD documents
│   ├── history/                # Historical documentation
│   └── bmm-workflow-status.yaml
│
├── .github/
│   └── workflows/              # CI/CD pipelines
│       ├── ci-cd.yml
│       ├── codeql.yml
│       └── test-auth-cookies.yml
│
├── config/                     # Configuration files
├── .claude/                    # Claude Code configuration
├── .bmad/                      # BMAD workflow configuration
└── package.json                # Root monorepo package
```

## Critical Directories

### Backend (`backend/`)

| Directory | Purpose | Key Files |
|-----------|---------|-----------|
| `controllers/` | Request handlers | authController.mjs, horseController.mjs, groomController.mjs |
| `routes/` | API endpoints | authRoutes.mjs (11 endpoints), horseRoutes.mjs, groomRoutes.mjs |
| `services/` | Business logic | cronJobService.mjs, groomPerformanceService.mjs, traitHistoryService.mjs |
| `middleware/` | Express middleware | auth.mjs, validationErrorHandler.mjs, authRateLimiter.mjs |
| `seed/` | Database seeding | seedDatabase.mjs |

### Frontend (`frontend/src/`)

| Directory | Purpose | Key Files |
|-----------|---------|-----------|
| `components/` | React components | UserDashboard.tsx, HorseListView.tsx, MyGroomsDashboard.tsx |
| `components/ui/` | UI primitives | dialog.tsx, tabs.tsx, tooltip.tsx (Radix-based) |
| `pages/` | Route pages | Index.tsx, StableView.tsx |
| `hooks/` | Custom hooks | useAuth.tsx |

### Database (`packages/database/`)

| Directory | Purpose | Key Files |
|-----------|---------|-----------|
| `prisma/` | Schema & migrations | schema.prisma (29 models, 900+ lines) |

## Entry Points

| Part | Entry Point | Command |
|------|-------------|---------|
| Backend | `backend/server.mjs` | `npm run dev-backend` |
| Frontend | `frontend/src/main.tsx` | `npm run dev` (from frontend/) |
| Database | N/A (library) | `npm run generate` |

## Integration Points

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                │
│  React 19 + Vite + TailwindCSS                                 │
│  Port: 3000                                                     │
└─────────────────────┬───────────────────────────────────────────┘
                      │ HTTP REST API
                      │ /api/* proxy → localhost:3001
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                         BACKEND                                 │
│  Node.js + Express + JWT Auth                                  │
│  Port: 3001                                                     │
└─────────────────────┬───────────────────────────────────────────┘
                      │ Prisma ORM
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                       DATABASE                                  │
│  PostgreSQL                                                     │
│  29 Tables (via Prisma)                                        │
└─────────────────────────────────────────────────────────────────┘
```

## File Counts by Type

| Part | .mjs | .tsx/.ts | .test.* | .md |
|------|------|----------|---------|-----|
| Backend | 471 | 0 | 229 | 25+ |
| Frontend | 0 | 49 | 15+ | 5 |
| Database | 0 | 0 | 0 | 4 |

## Component Breakdown

### Backend Components
| Category | Count | Examples |
|----------|-------|----------|
| Controllers | 23 | authController, horseController, groomController |
| Routes | 35 | authRoutes (11 endpoints), horseRoutes, groomRoutes |
| Services | 45 | cronJobService, groomPerformanceService, traitService |
| Middleware | 12 | auth, validation, rateLimiter, errorHandler |
| Models | 8 | User utilities, validation helpers |

### Frontend Components
| Category | Count | Examples |
|----------|-------|----------|
| Feature Components | 19 | UserDashboard, HorseListView, MyGroomsDashboard |
| UI Primitives | 9 | dialog, tabs, tooltip, button, card (Radix-based) |
| Pages | 2 | Index, StableView |
| Hooks | 2 | useAuth, custom hooks |

## Test Coverage

- **Backend:** Jest 29.7 with Supertest for API testing (229 test files)
- **Frontend:** Jest with React Testing Library
- **E2E:** Playwright available at root level

## Technology Stack

| Layer | Technology | Version |
|-------|------------|---------|
| **Backend Runtime** | Node.js | 18.x |
| **Backend Framework** | Express | 4.18.2 |
| **Frontend Framework** | React | 19.1.0 |
| **Frontend Build** | Vite | 5.2.0 |
| **Language** | TypeScript | 5.2.2 |
| **CSS Framework** | TailwindCSS | 3.4.1 |
| **UI Components** | Radix UI | Latest |
| **ORM** | Prisma | 6.8.2 |
| **Database** | PostgreSQL | 15+ |
| **Auth** | JWT | 9.0.2 |
| **Testing** | Jest | 29.7.0 |
| **API Testing** | Supertest | Latest |

## API Endpoint Summary

| Domain | Endpoints | Auth Required |
|--------|-----------|---------------|
| Authentication | 11 | Partial |
| Users | 8 | Yes |
| Horses | 15+ | Yes |
| Training | 10+ | Yes |
| Competition | 12+ | Yes |
| Grooms | 8+ | Yes |
| Breeding | 10+ | Yes |
| Admin | 5+ | Admin Only |
| Health | 2 | No |
| **Total** | **130+** | - |
