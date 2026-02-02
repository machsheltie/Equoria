# Equoria Backend Architecture

**Generated:** 2025-12-01
**Framework:** Express.js 4.18
**Runtime:** Node.js 18.x
**ORM:** Prisma 6.8.2

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                    │
│                    (Frontend, Mobile Apps, External APIs)                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           MIDDLEWARE LAYER                                   │
│  ┌─────────┐ ┌────────┐ ┌──────────┐ ┌───────────┐ ┌────────────────────┐  │
│  │ Helmet  │ │  CORS  │ │Rate Limit│ │Cookie/JSON│ │ Request Logger     │  │
│  └─────────┘ └────────┘ └──────────┘ └───────────┘ └────────────────────┘  │
│  ┌─────────────────┐ ┌────────────────┐ ┌─────────────────────────────────┐ │
│  │ Auth Middleware │ │ Response Opt.  │ │ Resource Management             │ │
│  └─────────────────┘ └────────────────┘ └─────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              ROUTE LAYER                                     │
│  /api/v1 (Stable)                    │ /api/v1/labs (Experimental)          │
│  ├── /auth                           │ ├── /compatibility                   │
│  ├── /horses                         │ ├── /personality-evolution           │
│  ├── /users                          │ ├── /optimization                    │
│  ├── /training                       │ ├── /memory                          │
│  ├── /competition                    │ ├── /environment                     │
│  ├── /grooms/*                       │ └── /advanced-epigenetic             │
│  ├── /traits                         │                                      │
│  ├── /milestones                     │                                      │
│  └── /leaderboards                   │                                      │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CONTROLLER LAYER                                   │
│  Handles request validation, response formatting, and business logic calls  │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌────────────────────┐  │
│  │authController│ │horseController│ │groomController│ │competitionController│
│  └──────────────┘ └──────────────┘ └──────────────┘ └────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            SERVICE LAYER                                     │
│  Core Business Logic (45 Services)                                           │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ GROOM SERVICES                                                          ││
│  │ groomPerformanceService, groomSalaryService, groomAssignmentService,    ││
│  │ groomProgressionService, groomTalentService, groomRetirementService     ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ GENETICS/TRAITS SERVICES                                                ││
│  │ traitHistoryService, traitTimelineService, enhancedGeneticProbability,  ││
│  │ geneticDiversityTracking, advancedLineageAnalysis                       ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ SYSTEM SERVICES                                                         ││
│  │ cronJobService, memoryResourceManagement, apiResponseOptimization,      ││
│  │ databaseOptimization, performanceAnalytics                              ││
│  └─────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DATA ACCESS LAYER                                  │
│                         Prisma ORM + PostgreSQL                              │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────────┐   │
│  │  prismaClient    │  │   Models (29)    │  │  Connection Pooling      │   │
│  │  Query Builder   │  │   Migrations     │  │  Transaction Support     │   │
│  └──────────────────┘  └──────────────────┘  └──────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Entry Point

**File:** `backend/server.mjs`

```javascript
// Startup Sequence:
// 1. Load .env variables
// 2. Validate environment configuration
// 3. Initialize Express app
// 4. Start HTTP server
// 5. Initialize cron jobs (production only)
// 6. Register graceful shutdown handlers
```

## Middleware Stack

### Security Middleware

| Middleware | Purpose | Configuration |
|------------|---------|---------------|
| `helmet` | Security headers | CSP, COEP disabled |
| `cors` | Cross-origin requests | Whitelist-based |
| `rate-limit` | Request throttling | 100 req/15min (10000 in test) |
| `cookie-parser` | Cookie handling | httpOnly cookies |

### Authentication Middleware

**File:** `backend/middleware/auth.mjs`

- JWT token verification
- Role-based access control
- Token refresh handling

### Performance Middleware

| Middleware | Purpose |
|------------|---------|
| `responseOptimization` | Response compression |
| `paginationMiddleware` | Standardized pagination |
| `performanceMonitoring` | Request timing |
| `resourceManagement` | Memory tracking |
| `requestTimeout` | 30-second timeout |

## Route Organization

### Stable API (`/api/v1`)

| Route | Controller | Purpose |
|-------|------------|---------|
| `/auth` | authController | Authentication (login, register, refresh) |
| `/horses` | horseController | Horse CRUD, stats |
| `/users` | userController | User profiles |
| `/training` | trainingController | Training sessions |
| `/competition` | competitionController | Shows, results |
| `/grooms` | groomController | Groom management |
| `/groom-assignments` | groomAssignmentController | Horse-groom links |
| `/groom-performance` | groomPerformanceController | Groom metrics |
| `/groom-salaries` | groomSalaryController | Payment processing |
| `/traits` | traitController | Trait management |
| `/milestones` | milestoneController | Milestone evaluation |
| `/leaderboards` | leaderboardController | Rankings |

### Labs API (`/api/v1/labs`)

Experimental features (non-SLO):
- Advanced epigenetic analysis
- Enhanced reporting
- Dynamic compatibility scoring
- Personality evolution system
- API optimization testing
- Environmental factors

## Service Architecture

### Groom Domain Services

```
groomPerformanceService.mjs
├── calculatePerformanceScore()
├── getPerformanceHistory()
├── updateMetrics()
└── aggregateWeeklyStats()

groomSalaryService.mjs
├── processPayment()
├── calculateSalary()
├── getSalaryHistory()
└── handleMissedPayment()

groomAssignmentService.mjs
├── assignGroom()
├── unassignGroom()
├── getAssignments()
└── validateAssignment()
```

### Genetics Domain Services

```
traitHistoryService.mjs
├── logTraitAcquisition()
├── getTraitTimeline()
└── analyzeTraitProgression()

enhancedGeneticProbabilityService.mjs
├── calculateInheritance()
├── predictOffspringTraits()
└── analyzeGeneticDiversity()

advancedLineageAnalysisService.mjs
├── buildFamilyTree()
├── calculateInbreeding()
└── findCommonAncestors()
```

### System Services

```
cronJobService.mjs
├── initializeCronJobs()
├── stopCronJobs()
├── scheduleJob()
└── runJob()

memoryResourceManagementService.mjs
├── initializeMemoryManagement()
├── shutdownMemoryManagement()
├── monitorMemory()
└── triggerGC()

apiResponseOptimizationService.mjs
├── createCompressionMiddleware()
├── cacheResponse()
└── optimizePayload()
```

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

## Database Integration

### Prisma Client

**File:** `packages/database/prismaClient.mjs`

- Singleton instance
- Connection pooling
- Query logging (development)
- Transaction support

### Schema Location

**File:** `packages/database/prisma/schema.prisma`

- 29 models
- 915+ lines
- Indexed for performance

## Logging

**Library:** Winston

**File:** `backend/utils/logger.mjs`

Log levels:
- `error` - Errors requiring attention
- `warn` - Warnings, deprecations
- `info` - General information
- `debug` - Debug information (dev only)

## API Documentation

**Tool:** Swagger/OpenAPI

**Endpoint:** `/api-docs`

- Auto-generated from JSDoc comments
- Interactive API explorer
- Request/response examples

## Health Monitoring

**Endpoint:** `GET /health`

```json
{
  "success": true,
  "message": "Server is healthy",
  "timestamp": "2025-12-01T12:00:00Z",
  "uptime": 3600,
  "environment": "production"
}
```

## Graceful Shutdown

Handles signals:
- `SIGTERM` - Container orchestration
- `SIGINT` - Manual interrupt
- `uncaughtException` - Unhandled errors
- `unhandledRejection` - Promise rejections

Shutdown sequence:
1. Stop accepting connections
2. Stop cron jobs
3. Disconnect database
4. Exit process
