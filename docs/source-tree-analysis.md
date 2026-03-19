# Equoria Source Tree Analysis

**Generated:** 2025-12-01
**Last Updated:** 2026-03-19 (Full Rescan)
**Scan Level:** Exhaustive
**Repository Type:** Monorepo (backend + frontend + database)

## Project Structure Overview

```
Equoria/
├── backend/                    # Node.js/Express API Backend (721 .mjs files)
│   ├── modules/                # 18 domain modules (Epic 20 refactor)
│   │   ├── admin/              #   Admin panel endpoints
│   │   ├── auth/               #   Authentication & authorization
│   │   ├── breeding/           #   Breeding mechanics & genetics
│   │   ├── community/          #   Forums, clubs, elections
│   │   ├── competition/        #   Competition entry & results
│   │   ├── docs/               #   API documentation (Swagger)
│   │   ├── grooms/             #   Groom hire, assign, interact
│   │   ├── health/             #   Health checks & monitoring
│   │   ├── horses/             #   Horse CRUD, stats, pedigree
│   │   ├── labs/               #   Experimental/dev features
│   │   ├── leaderboards/       #   Rankings & leaderboard data
│   │   ├── marketplace/        #   Horse & item marketplace
│   │   ├── riders/             #   Rider system
│   │   ├── services/           #   Shared service endpoints
│   │   ├── trainers/           #   Trainer hire & management
│   │   ├── training/           #   Training sessions & cooldowns
│   │   ├── traits/             #   Trait discovery & effects
│   │   └── users/              #   User profiles & progression
│   │       ├── controllers/    #     (each module has this structure)
│   │       ├── routes/         #     Route definitions
│   │       └── tests/          #     Module-specific tests
│   ├── controllers/            # Backward-compat shims (38 files) → modules/*/controllers/
│   ├── routes/                 # Backward-compat shims (46 files) → modules/*/routes/
│   ├── services/               # Business logic services (48 files)
│   ├── middleware/              # Express middleware (20 files)
│   ├── utils/                  # Utility functions (65 files)
│   ├── models/                 # Data models (9 files)
│   ├── logic/                  # Core game logic (2 files)
│   ├── seed/                   # Database seeding scripts (7 files)
│   ├── errors/                 # Custom error classes
│   ├── __tests__/              # Test suites (61 files across subdirectories)
│   │   ├── integration/        #   Integration tests
│   │   ├── unit/               #   Unit tests
│   │   ├── security/           #   OWASP & security tests
│   │   ├── middleware/          #   Middleware tests
│   │   ├── routes/             #   Route tests
│   │   ├── services/           #   Service tests
│   │   ├── utils/              #   Utility tests
│   │   ├── performance/        #   Performance tests
│   │   └── factories/          #   Test data factories
│   ├── docs/                   # Backend-specific docs (swagger.yaml)
│   ├── app.mjs                 # Express app setup
│   └── server.mjs              # ★ ENTRY POINT — HTTP server
│
├── frontend/                   # React 19 + TypeScript + Vite
│   ├── src/
│   │   ├── components/         # React components (356 files across subdirectories)
│   │   │   ├── ui/             #   UI primitives — 23 files (Radix-based + custom)
│   │   │   ├── auth/           #   Auth components (OnboardingGuard, etc.)
│   │   │   ├── breeding/       #   Breeding-related components
│   │   │   ├── common/         #   Shared components (BaseModal, etc.)
│   │   │   ├── competition/    #   Competition UI (PrizeNotificationModal, etc.)
│   │   │   ├── feedback/       #   Feedback overlays (CinematicMoment, LevelUp)
│   │   │   ├── foal/           #   Foal development tracker
│   │   │   ├── groom/          #   Groom cards, panels, badges
│   │   │   ├── horse/          #   Horse-specific components (XPProgressBar)
│   │   │   ├── hub/            #   Hub/dashboard widgets (WhileYouWereGone)
│   │   │   ├── layout/         #   Layout (AsidePanel, Breadcrumb)
│   │   │   ├── leaderboard/    #   Leaderboard displays
│   │   │   ├── onboarding/     #   OnboardingSpotlight
│   │   │   ├── rider/          #   Rider personality badges & panels
│   │   │   ├── theme/          #   Theme provider
│   │   │   ├── trainer/        #   Trainer cards, career, discovery
│   │   │   ├── training/       #   Training dashboard, session modal, stats
│   │   │   ├── traits/         #   Trait cards & displays
│   │   │   └── __tests__/      #   Component tests
│   │   ├── pages/              # Page components (53 files)
│   │   │   ├── breeding/       #   BreedingPairSelection, PredictionsPanel
│   │   │   └── __tests__/      #   Page tests
│   │   ├── hooks/              # Custom React hooks
│   │   │   ├── api/            #   47 API hooks (useHorses, useBreeding, etc.)
│   │   │   ├── useAuth.ts      #   Auth state hook
│   │   │   ├── useHorseFilters.ts
│   │   │   ├── useHorseGenetics.ts
│   │   │   ├── useResponsiveBackground.ts
│   │   │   ├── useRoleGuard.ts
│   │   │   └── useSessionGuard.ts
│   │   ├── contexts/           # React contexts (2 files)
│   │   │   ├── AuthContext.tsx
│   │   │   └── FeatureFlagContext.tsx
│   │   ├── lib/                # Utility libraries
│   │   │   ├── api-client.ts   #   57 API endpoints (all /api/v1/ prefixed)
│   │   │   ├── api/            #   Domain-specific API modules
│   │   │   ├── utils.ts        #   General utilities
│   │   │   ├── utils/          #   Utility sub-modules
│   │   │   ├── sentry.ts       #   Sentry integration
│   │   │   ├── featureFlags.tsx
│   │   │   ├── constants.ts
│   │   │   ├── validations/    #   Validation schemas
│   │   │   └── validation-schemas.ts
│   │   ├── styles/
│   │   │   └── tokens.css      #   Design tokens (CSS custom properties)
│   │   ├── App.tsx             # Root component (routes, guards, Suspense)
│   │   ├── main.tsx            # ★ ENTRY POINT — React DOM render
│   │   └── index.css           # Global styles (18 keyframes, horseshoe borders)
│   ├── public/
│   │   ├── placeholder.svg     # Celestial Night horse silhouette fallback
│   │   ├── assets/horses/      # Horse art assets
│   │   └── images/             # Static images
│   ├── vite.config.ts          # Vite configuration + bundle visualizer
│   └── tailwind.config.ts      # TailwindCSS configuration
│
├── packages/
│   └── database/               # Shared Database Package
│       ├── prisma/
│       │   ├── schema.prisma   # Database schema (43 models, 6 enums)
│       │   └── migrations/     # 45 migration directories
│       ├── prismaClient.js     # ★ ENTRY POINT — Prisma client singleton
│       └── package.json
│
├── docs/                       # Project documentation
│   ├── product/                # PRD documents
│   ├── architecture/           # Architecture docs (ARCH-01-Overview.md, etc.)
│   ├── deployment/             # Railway setup, deployment guides
│   ├── api/                    # API documentation
│   ├── api-contracts-backend/  # Backend API contracts
│   ├── features/               # Feature documentation
│   ├── sprint-artifacts/       # Epic retrospectives
│   ├── ux-spec-sections/       # UX specification (13 sections)
│   ├── ux-mockups/             # UX mockup files
│   ├── technical/              # Technical documentation
│   ├── patterns/               # Design pattern docs
│   ├── diagrams/               # Architecture diagrams
│   ├── history/                # Historical documentation
│   ├── archive/                # Archived docs
│   └── bmm-workflow-status.yaml
│
├── .github/
│   └── workflows/              # CI/CD pipelines (5 workflows)
│       ├── ci-cd.yml           #   Main CI/CD (Docker smoke test + Lighthouse)
│       ├── ci.yml              #   Continuous integration
│       ├── codeql.yml          #   CodeQL security scanning
│       ├── security-scan.yml   #   OWASP ZAP security scans
│       └── test-auth-cookies.yml  # Auth cookie integration tests
│
├── Dockerfile                  # Multi-stage: frontend-builder → production
├── railway.toml                # Railway deploy config (prisma migrate deploy)
├── .lighthouserc.yml           # Lighthouse CI thresholds
├── .claude/                    # Claude Code configuration & rules
├── package.json                # Root monorepo package
└── CLAUDE.md                   # Claude Code project instructions
```

## Critical Directories

### Backend (`backend/`)

| Directory      | Purpose                               | File Count | Key Files                                                          |
| -------------- | ------------------------------------- | ---------- | ------------------------------------------------------------------ |
| `modules/`     | Domain modules (Epic 20 architecture) | 18 modules | Each has controllers/, routes/, tests/                             |
| `controllers/` | Backward-compat shims to modules      | 38         | Re-exports from modules/\*/controllers/                            |
| `routes/`      | Backward-compat shims to modules      | 46         | Re-exports from modules/\*/routes/                                 |
| `services/`    | Business logic & game systems         | 48         | cronJobService, groomPerformanceService, breedingPredictionService |
| `middleware/`  | Express middleware stack              | 20         | auth.mjs, rateLimiting.mjs, security.mjs, gameIntegrity.mjs        |
| `utils/`       | Utility functions                     | 65         | competitionScore.mjs, epigeneticFlags.mjs, groomSystem.mjs         |
| `models/`      | Data access layer                     | 9          | horseModel.mjs, userModel.mjs, foalModel.mjs                       |
| `logic/`       | Core simulation logic                 | 2          | simulateCompetition.mjs, enhancedCompetitionSimulation.mjs         |
| `seed/`        | Database seeding                      | 7          | seedDevData.mjs, horseSeed.mjs, seedShows.mjs                      |
| `__tests__/`   | Test suites                           | 61         | integration/, unit/, security/, performance/                       |

### Frontend (`frontend/src/`)

| Directory              | Purpose                        | File Count | Key Files                                                        |
| ---------------------- | ------------------------------ | ---------- | ---------------------------------------------------------------- |
| `components/`          | React components               | 356 total  | 35 root-level + 18 subdirectories                                |
| `components/ui/`       | UI primitives (Radix + custom) | 23         | GallopingLoader, FenceJumpBar, GlassPanel, StatBar, dialog, tabs |
| `components/feedback/` | Cinematic overlays             | —          | CinematicMoment.tsx, LevelUpCelebrationModal.tsx                 |
| `components/training/` | Training system UI             | —          | TrainingDashboard, TrainingSessionModal, HorseStatsCard          |
| `pages/`               | Route page components          | 53         | Index, StableView, WorldHubPage, HorseDetailPage, BreedingPage   |
| `pages/breeding/`      | Breeding sub-pages             | 2          | BreedingPairSelection.tsx, BreedingPredictionsPanel.tsx          |
| `hooks/api/`           | API data-fetching hooks        | 47         | useHorses, useBreeding, useCompetitions, useGrooms, useClubs     |
| `hooks/`               | General hooks                  | 6          | useAuth, useHorseFilters, useSessionGuard, useRoleGuard          |
| `contexts/`            | React contexts                 | 2          | AuthContext.tsx, FeatureFlagContext.tsx                          |
| `lib/`                 | Utilities & API client         | —          | api-client.ts (57 endpoints), sentry.ts, utils.ts                |
| `styles/`              | Design tokens                  | 1          | tokens.css (CSS custom properties, z-index tokens)               |

### Database (`packages/database/`)

| Directory | Purpose              | Key Files                                             |
| --------- | -------------------- | ----------------------------------------------------- |
| `prisma/` | Schema & migrations  | schema.prisma (43 models, 6 enums), 45 migration dirs |
| Root      | Prisma client export | prismaClient.js                                       |

## Entry Points

| Part       | Entry Point                         | Purpose                 | Command                        |
| ---------- | ----------------------------------- | ----------------------- | ------------------------------ |
| Backend    | `backend/server.mjs`                | Express HTTP server     | `npm run dev` (from backend/)  |
| Frontend   | `frontend/src/main.tsx`             | React DOM render        | `npm run dev` (from frontend/) |
| Database   | `packages/database/prismaClient.js` | Prisma client singleton | `npm run generate`             |
| Production | `Dockerfile`                        | Multi-stage build       | `docker build .`               |

## Integration Points

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                │
│  React 19 + Vite + TailwindCSS + TypeScript                    │
│  47 API hooks → api-client.ts (57 endpoints)                   │
│  Port: 5173 (dev) / embedded in Express (prod)                 │
└─────────────────────┬───────────────────────────────────────────┘
                      │ HTTP REST API
                      │ /api/v1/* (all endpoints versioned)
                      │ JWT auth via httpOnly cookies
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                         BACKEND                                 │
│  Node.js + Express + 18 domain modules                         │
│  43 route files, 36 controllers, 48 services                   │
│  Port: 3001 (dev) / PORT env (prod)                            │
└─────────────────────┬───────────────────────────────────────────┘
                      │ Prisma ORM (prismaClient.js)
                      │ Connection pooling
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                       DATABASE                                  │
│  PostgreSQL                                                     │
│  43 Models, 6 Enums, 45 Migrations (via Prisma)                │
└─────────────────────────────────────────────────────────────────┘
```

### Key Integration Files

| Integration        | File                                | Purpose                                                                        |
| ------------------ | ----------------------------------- | ------------------------------------------------------------------------------ |
| Frontend → Backend | `frontend/src/lib/api-client.ts`    | 57 API endpoints, JWT cookie auth, `VITE_API_URL ?? ''` for relative URLs      |
| Backend → Database | `packages/database/prismaClient.js` | Shared Prisma client singleton                                                 |
| Backend app setup  | `backend/app.mjs`                   | Express static serving + SPA fallback (production)                             |
| Module routing     | `backend/modules/*/routes/*.mjs`    | Domain-specific route handlers                                                 |
| Backward compat    | `backend/routes/*.mjs`              | Shim re-exports to module routes (zero test breakage)                          |
| Deployment         | `Dockerfile`                        | Multi-stage: `frontend-builder` (Vite) → `production` (Express + embedded SPA) |
| Deploy config      | `railway.toml`                      | `prisma migrate deploy` before server start                                    |

## File Counts by Type

| Part     | .mjs | .tsx/.ts                            | .test.\* | Total Source |
| -------- | ---- | ----------------------------------- | -------- | ------------ |
| Backend  | 721  | 0                                   | 61+      | 721          |
| Frontend | 0    | 356+ components, 53 pages, 47 hooks | 30+      | 500+         |
| Database | 1    | 0                                   | 0        | 1            |

## Component Breakdown

### Backend Components

| Category                         | Count | Examples                                                                 |
| -------------------------------- | ----- | ------------------------------------------------------------------------ |
| Domain Modules                   | 18    | auth, horses, breeding, competition, grooms, training, traits, community |
| Controllers (in modules)         | 36    | authController, horseController, groomController, clubController         |
| Route Files (in modules)         | 43    | authRoutes (11 endpoints), horseRoutes, competitionRoutes                |
| Backward-Compat Route Shims      | 46    | Re-exports from modules/\*/routes/                                       |
| Backward-Compat Controller Shims | 38    | Re-exports from modules/\*/controllers/                                  |
| Services                         | 48    | cronJobService, breedingPredictionService, leaderboardService            |
| Middleware                       | 20    | auth, rateLimiting, security, gameIntegrity, csrf, auditLog              |
| Utilities                        | 65    | competitionScore, epigeneticFlags, groomSystem, foalAgeUtils             |
| Models                           | 9     | horseModel, userModel, foalModel, trainingModel, xpLogModel              |
| Logic                            | 2     | simulateCompetition, enhancedCompetitionSimulation                       |
| Seed Scripts                     | 7     | seedDevData, horseSeed, seedShows, userSeed                              |

### Frontend Components

| Category                 | Count      | Examples                                                                                 |
| ------------------------ | ---------- | ---------------------------------------------------------------------------------------- |
| Page Components          | 53         | Index, StableView, WorldHubPage, HorseDetailPage, BreedingPage                           |
| Feature Components       | 35+ (root) | UserDashboard, HorseListView, MainNavigation, CompetitionBrowser                         |
| Component Subdirectories | 18         | ui/, auth/, breeding/, competition/, feedback/, groom/, horse/, hub/, layout/, training/ |
| UI Primitives            | 23         | GallopingLoader, FenceJumpBar, GlassPanel, StatBar, dialog, tabs, tooltip                |
| API Hooks                | 47         | useHorses, useBreeding, useCompetitions, useGrooms, useClubs, useForum                   |
| General Hooks            | 6          | useAuth, useHorseFilters, useHorseGenetics, useSessionGuard                              |
| Contexts                 | 2          | AuthContext, FeatureFlagContext                                                          |

### Database Schema

| Category   | Count | Examples                                                                                             |
| ---------- | ----- | ---------------------------------------------------------------------------------------------------- |
| Models     | 43    | User, Horse, Breed, Show, CompetitionResult, Groom, Rider, Trainer, Club, ForumThread, DirectMessage |
| Enums      | 6     | Role, Sex, Discipline, TraitCategory, ClubType, ElectionStatus                                       |
| Migrations | 45    | Versioned schema changes                                                                             |

## Test Coverage

| Layer    | Framework             | Suites | Tests | Notes                                     |
| -------- | --------------------- | ------ | ----- | ----------------------------------------- |
| Backend  | Jest 29.7 + Supertest | 226    | 3617+ | Pre-push hook active                      |
| Frontend | Vitest + MSW          | —      | —     | `onUnhandledRequest: 'error'` strict mode |
| E2E      | Playwright            | —      | 11+   | Core game flows, auth, breeding           |
| Security | Jest (OWASP suite)    | —      | 400+  | A01–A10 comprehensive coverage            |

## Technology Stack

| Layer                   | Technology             | Version     |
| ----------------------- | ---------------------- | ----------- |
| **Backend Runtime**     | Node.js                | 18.x        |
| **Backend Framework**   | Express                | 4.18.2      |
| **Frontend Framework**  | React                  | 19.1.0      |
| **Frontend Build**      | Vite                   | 5.2.0       |
| **Language (Frontend)** | TypeScript             | 5.2.2       |
| **CSS Framework**       | TailwindCSS            | 3.4.1       |
| **UI Components**       | Radix UI               | Latest      |
| **ORM**                 | Prisma                 | 6.8.2       |
| **Database**            | PostgreSQL             | 15+         |
| **Auth**                | JWT (httpOnly cookies) | 9.0.2       |
| **Backend Testing**     | Jest                   | 29.7.0      |
| **Frontend Testing**    | Vitest                 | Latest      |
| **E2E Testing**         | Playwright             | Latest      |
| **API Testing**         | Supertest              | Latest      |
| **Error Tracking**      | Sentry                 | Opt-in      |
| **Deployment**          | Docker + Railway       | Multi-stage |

## API Endpoint Summary

| Domain               | Module         | Endpoints | Auth Required |
| -------------------- | -------------- | --------- | ------------- |
| Authentication       | auth           | 11        | Partial       |
| Users                | users          | 8         | Yes           |
| Horses               | horses         | 15+       | Yes           |
| Training             | training       | 10+       | Yes           |
| Competition          | competition    | 12+       | Yes           |
| Grooms               | grooms         | 8+        | Yes           |
| Breeding             | breeding       | 10+       | Yes           |
| Traits               | traits         | 8+        | Yes           |
| Riders               | riders         | 5+        | Yes           |
| Trainers             | trainers       | 5+        | Yes           |
| Community (Forums)   | community      | 6+        | Yes           |
| Community (Clubs)    | community      | 10+       | Yes           |
| Community (Messages) | community      | 5+        | Yes           |
| Leaderboards         | leaderboards   | 3+        | Yes           |
| Marketplace          | marketplace    | 5+        | Yes           |
| Admin                | admin          | 5+        | Admin Only    |
| Health               | health         | 2         | No            |
| Docs (Swagger)       | docs           | 2         | No            |
| **Total**            | **18 modules** | **130+**  | —             |

## CI/CD Pipelines

| Workflow      | File                    | Purpose                                  |
| ------------- | ----------------------- | ---------------------------------------- |
| Main CI/CD    | `ci-cd.yml`             | Test → Docker smoke test → Lighthouse CI |
| CI            | `ci.yml`                | Lint + test on push/PR                   |
| CodeQL        | `codeql.yml`            | GitHub CodeQL security analysis          |
| Security Scan | `security-scan.yml`     | OWASP ZAP baseline + API scans           |
| Auth Cookies  | `test-auth-cookies.yml` | Cookie SameSite/Secure integration tests |
