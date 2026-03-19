# Equoria Backend Architecture

**Generated:** 2026-03-19
**Framework:** Express.js 4.18
**Runtime:** Node.js 18.x
**ORM:** Prisma 6.8.2
**Module System:** ES Modules (.mjs files only)

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                  │
│                    (Frontend SPA, Mobile Apps, External APIs)               │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           MIDDLEWARE LAYER                                  │
│  ┌─────────┐ ┌────────┐ ┌──────────┐ ┌───────────┐ ┌────────────────────┐ │
│  │ Helmet  │ │  CORS  │ │Rate Limit│ │Cookie/JSON│ │ Request Logger     │ │
│  └─────────┘ └────────┘ └──────────┘ └───────────┘ └────────────────────┘ │
│  ┌─────────────────┐ ┌────────────────┐ ┌─────────────────────────────────┐│
│  │ Auth (JWT)      │ │ CSRF Protection│ │ Resource Mgmt / Perf Monitor   ││
│  └─────────────────┘ └────────────────┘ └─────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      THREE-TIER ROUTER ARCHITECTURE                        │
│                                                                            │
│  publicRouter (no auth)     │ authRouter (JWT required)  │ adminRouter     │
│  ├── /auth                  │ ├── /horses                │ (admin role)    │
│  ├── /docs                  │ ├── /users                 │ └── /admin/*    │
│  └── /user-docs             │ ├── /training              │                 │
│                             │ ├── /competition           │                 │
│                             │ ├── /breeds                │                 │
│                             │ ├── /foals                 │                 │
│                             │ ├── /traits                │                 │
│                             │ ├── /trait-discovery        │                 │
│                             │ ├── /riders                │                 │
│                             │ ├── /trainers              │                 │
│                             │ ├── /grooms/*              │                 │
│                             │ ├── /vet                   │                 │
│                             │ ├── /tack-shop             │                 │
│                             │ ├── /farrier               │                 │
│                             │ ├── /feed-shop             │                 │
│                             │ ├── /inventory             │                 │
│                             │ ├── /forum                 │                 │
│                             │ ├── /messages              │                 │
│                             │ ├── /clubs                 │                 │
│                             │ ├── /marketplace           │                 │
│                             │ ├── /shows                 │                 │
│                             │ ├── /leaderboards          │                 │
│                             │ ├── /milestones            │                 │
│                             │ ├── /next-actions          │                 │
│                             │ ├── /while-you-were-gone   │                 │
│                             │ └── /labs/* (experimental) │                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                   DOMAIN MODULE LAYER (18 modules)                         │
│                      backend/modules/<domain>/                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐│
│  │   auth   │ │  horses  │ │ training │ │competition│ │    breeding      ││
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────────────┘│
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐│
│  │  grooms  │ │  riders  │ │ trainers │ │  traits   │ │   community     ││
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────────────┘│
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐│
│  │  users   │ │leaderboard│ │  admin   │ │   docs   │ │    health       ││
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────────────┘│
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                                  │
│  │   labs   │ │ services │ │marketplace│                                  │
│  └──────────┘ └──────────┘ └──────────┘                                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DATA ACCESS LAYER                                │
│                         Prisma ORM + PostgreSQL                            │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────────┐ │
│  │  prismaClient    │  │  Models (43)     │  │  Connection Pooling      │ │
│  │  Query Builder   │  │  Enums (6)       │  │  Transaction Support     │ │
│  │                  │  │  1299 lines      │  │  JSONB flexibility       │ │
│  └──────────────────┘  └──────────────────┘  └──────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Codebase Statistics

| Metric           | Count |
| ---------------- | ----- |
| Total .mjs files | 721   |
| Domain modules   | 18    |
| Route files      | 43    |
| Controller files | 36    |
| Middleware files | 20    |
| Utility files    | 65    |
| HTTP endpoints   | 130+  |
| Prisma models    | 43    |
| Prisma enums     | 6     |
| Test suites      | 226   |
| Total tests      | 3651+ |

## Entry Point

**File:** `backend/server.mjs`

```javascript
// Startup Sequence:
// 1. Load .env variables
// 2. Validate environment configuration
// 3. Initialize Express app (backend/app.mjs)
// 4. Initialize Sentry (optional, before other middleware)
// 5. Start HTTP server
// 6. Initialize cron jobs (production only)
// 7. Register graceful shutdown handlers
```

**File:** `backend/app.mjs`

Express application factory that configures the three-tier router architecture:

- `publicRouter` — no authentication (auth, docs, user-docs)
- `authRouter` — JWT required + CSRF protection (all game features)
- `adminRouter` — JWT + admin role required + CSRF protection

## Domain Module Architecture

All 18 domain modules live under `backend/modules/`. Each module follows a consistent internal structure:

```
backend/modules/<domain>/
├── routes/         # Express route definitions
├── controllers/    # Request handlers and business logic
├── models/         # Data models (optional)
└── middleware/     # Domain-specific middleware (optional)
```

### Backward Compatibility Shims

Legacy route and controller paths at `backend/routes/` and `backend/controllers/` re-export from their respective modules. This ensures zero test breakage after the Epic 20 modular refactor:

```javascript
// backend/routes/horseRoutes.mjs (shim)
export { default } from '../modules/horses/routes/horseRoutes.mjs';

// backend/controllers/horseController.mjs (shim)
export * from '../modules/horses/controllers/horseController.mjs';
```

### Module Inventory

| Module           | Purpose                                                  | Key Routes                                                                                                    |
| ---------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| **admin**        | System administration                                    | `/admin/*`                                                                                                    |
| **auth**         | JWT login, register, refresh, password reset, onboarding | `/auth/*`                                                                                                     |
| **breeding**     | Breeding operations, foal management, genetics           | `/foals`, `/breeds`, advanced genetics                                                                        |
| **community**    | Forums, direct messages, clubs, elections                | `/forum`, `/messages`, `/clubs`                                                                               |
| **competition**  | Show entry, scoring, results, prize distribution         | `/competition`, `/shows`                                                                                      |
| **docs**         | API documentation, Swagger, user docs                    | `/docs`, `/user-docs`                                                                                         |
| **grooms**       | Groom hire, assign, interact, performance, salary        | `/grooms/*`, `/groom-*`                                                                                       |
| **health**       | Server health checks                                     | `/health`, `/ping`                                                                                            |
| **horses**       | Horse CRUD, stats, pedigree, care                        | `/horses`                                                                                                     |
| **labs**         | Experimental features (non-SLO)                          | `/optimization`, `/memory`, `/environment`, `/compatibility`, `/personality-evolution`, `/enhanced-reporting` |
| **leaderboards** | Rankings and statistics                                  | `/leaderboards`                                                                                               |
| **marketplace**  | Horse buying/selling                                     | `/marketplace`                                                                                                |
| **riders**       | Rider management and assignment                          | `/riders`                                                                                                     |
| **services**     | Veterinarian, tack shop, farrier, feed shop              | `/vet`, `/tack-shop`, `/farrier`, `/feed-shop`                                                                |
| **trainers**     | Trainer management                                       | `/trainers`                                                                                                   |
| **training**     | Training sessions, cooldowns, progression                | `/training`                                                                                                   |
| **traits**       | Trait discovery, epigenetics, ultra-rare traits          | `/traits`, `/trait-discovery`, `/epigenetic-traits`, `/ultra-rare-traits`                                     |
| **users**        | User profiles, dashboards, progress, inventory           | `/users`, `/inventory`, `/next-actions`, `/while-you-were-gone`                                               |

## Middleware Stack

### Security Middleware

| Middleware      | Purpose                           | Configuration                                          |
| --------------- | --------------------------------- | ------------------------------------------------------ |
| `helmet`        | Security headers                  | CSP directives, COEP disabled                          |
| `cors`          | Cross-origin requests             | Whitelist-based + env overrides                        |
| `rateLimiting`  | Request throttling (Redis-backed) | 100 req/15min (10000 in test)                          |
| `cookie-parser` | Cookie handling                   | httpOnly, SameSite env-aware                           |
| `csrf`          | CSRF token protection             | Applied to POST/PUT/DELETE/PATCH on auth/admin routers |

### Authentication Middleware

**File:** `backend/middleware/auth.mjs`

- `authenticateToken` — JWT token verification from Authorization header or httpOnly cookie
- `requireRole(role)` — Role-based access control (e.g., `'admin'`)
- Token refresh handling via `/auth/refresh`

### Security Middleware (Advanced)

| Middleware                   | Purpose                                                              |
| ---------------------------- | -------------------------------------------------------------------- |
| `auditLogger`                | Logs high-sensitivity operations (breeding, transactions, stat mods) |
| `operationDedup`             | Prevents duplicate operations within 5-second window                 |
| `suspiciousActivityDetector` | Detects excessive failures, rapid-fire, multi-IP patterns            |

### Performance Middleware

| Middleware                    | Purpose                           |
| ----------------------------- | --------------------------------- |
| `responseOptimization`        | Response compression              |
| `paginationMiddleware`        | Standardized pagination params    |
| `performanceMonitoring`       | Request timing metrics            |
| `resourceManagement`          | Memory tracking                   |
| `requestTimeout`              | 30-second request timeout         |
| `createCompressionMiddleware` | API response optimization service |

## Route Organization

### Public Routes (No Authentication)

| Route        | Controller              | Purpose                                     |
| ------------ | ----------------------- | ------------------------------------------- |
| `/auth`      | authController          | Login, register, password reset, CSRF token |
| `/docs`      | documentationRoutes     | Swagger/OpenAPI interactive docs            |
| `/user-docs` | userDocumentationRoutes | User-facing documentation                   |

### Authenticated Routes (JWT Required + CSRF)

| Route                  | Controller                 | Purpose                                    |
| ---------------------- | -------------------------- | ------------------------------------------ |
| `/horses`              | horseController            | Horse CRUD, stats, care                    |
| `/users`               | userController             | User profiles, dashboard, progress         |
| `/training`            | trainingController         | Training sessions (7-day cooldown, age 3+) |
| `/competition`         | competitionController      | Show entry, scoring, results               |
| `/breeds`              | breedController            | Breed definitions                          |
| `/foals`               | foalController             | Foal management                            |
| `/traits`              | traitController            | Trait management                           |
| `/trait-discovery`     | traitDiscoveryController   | Progressive trait revelation               |
| `/riders`              | riderController            | Rider management                           |
| `/trainers`            | trainerController          | Trainer management                         |
| `/grooms`              | groomController            | Groom hire, assign, interact               |
| `/grooms/enhanced`     | enhancedGroomController    | Extended groom features                    |
| `/groom-assignments`   | groomAssignmentController  | Horse-groom links                          |
| `/groom-handlers`      | groomHandlerController     | Handler operations                         |
| `/groom-salaries`      | groomSalaryController      | Payment processing                         |
| `/groom-performance`   | groomPerformanceController | Groom metrics                              |
| `/groom-marketplace`   | groomMarketplaceController | Groom hiring market                        |
| `/vet`                 | vetController              | Veterinarian services                      |
| `/tack-shop`           | tackShopController         | Equipment purchasing                       |
| `/farrier`             | farrierController          | Farrier services                           |
| `/feed-shop`           | feedShopController         | Feed purchasing                            |
| `/inventory`           | inventoryController        | Item equip/unequip (JSONB-based)           |
| `/forum`               | forumController            | Message board threads/posts                |
| `/messages`            | messageController          | Direct messaging (inbox/sent/unread)       |
| `/clubs`               | clubController             | Clubs, elections, governance               |
| `/marketplace`         | marketplaceController      | Horse buying/selling                       |
| `/shows`               | showController             | Show management                            |
| `/leaderboards`        | leaderboardController      | Rankings                                   |
| `/milestones`          | milestoneController        | Milestone evaluation                       |
| `/next-actions`        | nextActionsController      | Suggested player actions                   |
| `/while-you-were-gone` | wyagController             | Return-to-game summary                     |
| `/epigenetic-traits`   | epigeneticTraitController  | Epigenetic trait system                    |
| `/flags`               | epigeneticFlagController   | Epigenetic flags                           |
| `/ultra-rare-traits`   | ultraRareTraitController   | Ultra-rare trait management                |

### Labs Routes (Experimental, Non-SLO)

| Route                      | Purpose                                        |
| -------------------------- | ---------------------------------------------- |
| `/optimization`            | API optimization testing                       |
| `/memory`                  | Memory management diagnostics                  |
| `/environment`             | Environmental factor simulation                |
| `/compatibility`           | Dynamic compatibility scoring                  |
| `/personality-evolution`   | Personality evolution system                   |
| Advanced epigenetic routes | Mounted at root `/` for horse-specific paths   |
| Enhanced reporting routes  | Mounted at root `/` for cross-domain reporting |
| Advanced breeding genetics | Mounted at root `/` for breeding mechanics     |

### Admin Routes (Admin Role Required)

| Route      | Purpose                                |
| ---------- | -------------------------------------- |
| `/admin/*` | System administration, user management |

## Game Mechanics (Backend Implementations)

### Competition Scoring Formula

```
FinalScore =
  BaseStatScore (weighted: 50/30/20 by discipline)
+ TraitBonus (+5 if discipline matches horse trait)
+ TrainingScore (0-100, optional)
+ SaddleBonus (flat number)
+ BridleBonus (flat number)
+ RiderBonus (% of subtotal)
- RiderPenalty (% of subtotal)
+ HealthModifier (% adjustment based on rating)
+ RandomLuck (plus or minus 9% for realism)
```

### Training System

- **Global cooldown:** 7-day cooldown per horse (server-side, ms arithmetic to avoid DST skew)
- **Age requirement:** Horses must be 3+ years old
- **Health check:** Injured horses cannot train
- **Discipline validation:** Only valid disciplines accepted
- **Ownership validation:** Only horse owners can train

### Breeding System

- **Cooldown:** 30-day breeding cooldown per horse
- **Biological validation:** Proper sex and age requirements
- **Ownership verification:** Access control for sires and dams
- **Health requirements:** Injured horses cannot breed
- **Self-breeding prevention:** Horses cannot breed with themselves

### Stat System

Horses have 10 core statistics (range 0-100):
Speed, Stamina, Agility, Balance, Precision, Intelligence, Boldness, Flexibility, Obedience, Focus

## Error Handling

**File:** `backend/middleware/errorHandler.mjs`

```javascript
// Error categories:
// - ValidationError (400)
// - AuthenticationError (401)
// - AuthorizationError (403)
// - NotFoundError (404)
// - ConflictError (409)
// - RateLimitError (429)
// - InternalError (500)
```

Response format:

```json
{
  "success": false,
  "message": "Error description",
  "errors": [{ "field": "email", "message": "Required" }]
}
```

CSRF errors are handled by a dedicated `csrfErrorHandler` middleware.

## Database Integration

### Prisma Client

**File:** `packages/database/prismaClient.mjs`

- Singleton instance
- Connection pooling
- Query logging (development)
- Transaction support

### Schema

**File:** `packages/database/prisma/schema.prisma`

- 43 models (Horse, User, Breed, Show, CompetitionResult, Groom, GroomAssignment, Rider, Trainer, ForumThread, ForumPost, DirectMessage, Club, ClubMembership, ClubElection, ClubCandidate, ClubBallot, and more)
- 6 enums
- 1299 lines
- JSONB fields for flexible data (genetics, tack, inventory, settings)
- Indexed for performance (GIN indexes on JSONB columns)

## Logging

**Library:** Winston

**File:** `backend/utils/logger.mjs`

Log levels:

- `error` — Errors requiring attention
- `warn` — Warnings, deprecations
- `info` — General information
- `debug` — Debug information (dev only)

## Error Tracking

**Library:** Sentry (optional, via `SENTRY_DSN` env var)

**File:** `backend/config/sentry.mjs`

- `initializeSentry(app)` — initialized before all other middleware
- `attachSentryErrorHandler(app)` — attached after all routes
- Tracks 14 security event types (auth failures, IDOR attempts, privilege escalation, etc.)
- Configurable alert thresholds by severity

## API Documentation

**Tool:** Swagger/OpenAPI

**File:** `backend/docs/swagger.yaml`

**Endpoint:** `/api-docs`

- Interactive API explorer via Swagger UI
- Servers block includes `/api/v1` prefix
- Request/response examples

## Health Monitoring

**Endpoint:** `GET /health`

```json
{
  "success": true,
  "message": "Server is healthy",
  "timestamp": "2026-03-19T12:00:00Z",
  "uptime": 3600,
  "environment": "production"
}
```

**Endpoint:** `GET /ping` — Simple ping/pong liveness check

## Graceful Shutdown

Handles signals:

- `SIGTERM` — Container orchestration
- `SIGINT` — Manual interrupt
- `uncaughtException` — Unhandled errors
- `unhandledRejection` — Promise rejections

Shutdown sequence:

1. Stop accepting connections
2. Stop cron jobs
3. Disconnect Redis (rate limiter)
4. Disconnect database (Prisma)
5. Exit process

## Testing

**Framework:** Jest with `--experimental-vm-modules` (ES module support)

- **226 test suites**, **3651+ tests** passing
- Balanced mocking strategy: external dependencies only (DB, HTTP, logger)
- Real business logic tested with actual implementations
- Integration tests with Prisma for database operations
- API tests covering all major endpoint groups
- Pre-push hook enforces all tests pass before push

## Security Summary

- JWT authentication (access + refresh tokens, httpOnly cookies)
- bcrypt password hashing (12+ rounds in production)
- Helmet security headers (CSP configured)
- CORS whitelist with environment overrides
- Redis-backed rate limiting (100 req/15min)
- CSRF protection on all state-changing routes
- Input validation via express-validator
- Audit logging for high-sensitivity operations
- Operation deduplication (5-second window)
- Suspicious activity detection (rapid-fire, multi-IP, error-then-success patterns)
- Protected stat fields (cannot be directly modified)
- Server-side timestamps (prevents time manipulation)
