# Equoria Integration Patterns

**Generated:** 2025-12-01
**Last Updated:** 2025-12-01 (Full Rescan)

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React 19)                         │
│                         Port: 3000                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │
│  │ Components  │  │   Hooks     │  │   State     │                 │
│  │  (Radix UI) │  │  (useAuth)  │  │(React Query)│                 │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘                 │
│         │                │                │                         │
│         └────────────────┼────────────────┘                         │
│                          │                                          │
│                    ┌─────┴─────┐                                    │
│                    │ API Client│                                    │
│                    │ (Axios)   │                                    │
│                    └─────┬─────┘                                    │
└──────────────────────────┼──────────────────────────────────────────┘
                           │
                           │ Vite Proxy: /api → :3001
                           │ credentials: 'include'
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         BACKEND (Express)                           │
│                         Port: 3001                                  │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    Middleware Stack                          │   │
│  │  Helmet → CORS → RateLimit → CookieParser → Logger → Auth   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                      API Routes                               │  │
│  │  /api/v1/*  (stable)     /api/v1/labs/* (experimental)       │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │
│  │ Controllers │→ │  Services   │→ │   Models    │                 │
│  │    (23)     │  │    (45)     │  │  (Prisma)   │                 │
│  └─────────────┘  └─────────────┘  └──────┬──────┘                 │
└───────────────────────────────────────────┼─────────────────────────┘
                                            │
                                            │ Prisma ORM
                                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       DATABASE (PostgreSQL)                         │
│                       29 Tables                                     │
│  User, Horse, Breed, Stable, Groom, Training, Competition, etc.    │
└─────────────────────────────────────────────────────────────────────┘
```

## Frontend → Backend Communication

### API Proxy Configuration (Vite)

```typescript
// frontend/vite.config.ts
server: {
    port: 3000,
    proxy: {
        '/api': {
            target: 'http://localhost:3001',
            changeOrigin: true,
        },
    },
}
```

### HTTP Client Pattern

```typescript
// Uses credentials: 'include' for httpOnly cookies
// No localStorage for sensitive tokens (XSS protection)
```

### Authentication Flow

```
┌──────────┐     ┌──────────┐     ┌──────────┐
│  Login   │────▶│ POST /api│────▶│  Set     │
│  Form    │     │ /auth/   │     │ httpOnly │
│          │     │ login    │     │ Cookie   │
└──────────┘     └──────────┘     └──────────┘
                                        │
                                        ▼
┌──────────┐     ┌──────────┐     ┌──────────┐
│Protected │◀────│  Cookie  │◀────│ Automatic│
│  Route   │     │  sent w/ │     │  Include │
│          │     │  request │     │          │
└──────────┘     └──────────┘     └──────────┘
```

### Cookie Security Settings

```javascript
// Backend sets cookies with:
{
  httpOnly: true,           // No JS access (XSS protection)
  sameSite: 'strict',       // CSRF protection
  secure: NODE_ENV === 'production',
  maxAge: 15 * 60 * 1000    // 15 minutes
}
```

## Backend Middleware Stack

### Execution Order

```
Request → Helmet → CORS → RateLimit → BodyParser → CookieParser
       → RequestLogger → DocHeaders → Compression → ResponseOptimization
       → Pagination → PerformanceMonitoring → ResourceManagement
       → MemoryMonitoring → DatabaseConnection → RequestTimeout
       → Routes → ErrorLogger → ErrorHandler → Response
```

### Middleware Details

| Middleware | Purpose | Configuration |
|------------|---------|---------------|
| `helmet` | Security headers | CSP, CORP disabled |
| `cors` | Cross-origin | localhost:3000, :3001 |
| `rateLimit` | Request throttling | 100/15min (10000 in test) |
| `cookieParser` | httpOnly cookies | - |
| `requestLogger` | Request logging | Winston |
| `responseOptimization` | Compression, caching | Gzip |
| `memoryMonitoring` | Memory tracking | 500MB threshold |
| `requestTimeout` | Timeout | 30 seconds |

## API Versioning

### Route Structure

```
/api/v1/*           - Stable API (SLO-backed)
/api/v1/labs/*      - Experimental (no SLO)
/api/*              - Legacy compatibility (maps to v1)
```

### Domain Routes (Stable)

| Route | Description | Endpoints |
|-------|-------------|-----------|
| `/api/v1/auth` | Authentication | login, register, logout, refresh |
| `/api/v1/horses` | Horse management | CRUD, lineage, stats |
| `/api/v1/users` | User profiles | profile, settings, dashboard |
| `/api/v1/training` | Training system | sessions, progress |
| `/api/v1/competition` | Competitions | entry, results, rankings |
| `/api/v1/breeds` | Breed info | list, details |
| `/api/v1/foals` | Foal management | birth, development |
| `/api/v1/traits` | Trait system | discovery, management |
| `/api/v1/grooms` | Groom system | hiring, assignment |
| `/api/v1/milestones` | Achievements | evaluation, tracking |
| `/api/v1/leaderboards` | Rankings | per-discipline |
| `/api/v1/admin` | Admin ops | restricted |

### Labs Routes (Experimental)

| Route | Description |
|-------|-------------|
| `/api/v1/labs/compatibility` | Dynamic compatibility scoring |
| `/api/v1/labs/personality-evolution` | Personality system |
| `/api/v1/labs/optimization` | API optimization |
| `/api/v1/labs/memory` | Memory management |
| `/api/v1/labs/environment` | Environmental factors |

## Service Layer Pattern

### Service Architecture

```
Controller → Service → Prisma (DB)
     ↓           ↓
  Validation  Business Logic
```

### Key Service Categories

| Category | Services | Purpose |
|----------|----------|---------|
| **Core** | authService, userService | Authentication, users |
| **Game** | trainingService, competitionService | Game mechanics |
| **Breeding** | breedingPredictionService, advancedLineageAnalysisService | Genetics |
| **Grooms** | groomService, groomPerformanceService | Groom system |
| **Analytics** | breedingAnalyticsService, carePatternAnalyzer | Analytics |
| **System** | cronJobService, memoryManagementService | Background tasks |

### Common Service Exports

```javascript
// Pattern: Named function exports
export async function calculateInheritanceProbabilities(stallionId, mareId)
export async function analyzeCompatibilityFactors(groomId, horseId)
export function initializeCronJobs()
export function getCronJobStatus()
```

## Database Integration

### Prisma Client

```javascript
// packages/database/prismaClient.mjs
// Shared across backend services
import prisma from '../packages/database/prismaClient.mjs';
```

### Connection Management

```javascript
// Middleware handles connection pooling
app.use(databaseConnectionMiddleware(prisma));
```

### Key Models

| Model | Relationships |
|-------|---------------|
| `User` | has many Horses, Stables |
| `Horse` | belongs to User, Breed, Stable |
| `Groom` | assigned to Horses |
| `Training` | belongs to Horse |
| `Competition` | has many entries |

## Error Handling

### Error Response Format

```json
{
  "success": false,
  "message": "Error description",
  "path": "/api/endpoint",
  "method": "POST"
}
```

### HTTP Status Codes

| Code | Usage |
|------|-------|
| 200 | Success |
| 201 | Created |
| 400 | Bad request / Validation |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not found |
| 429 | Rate limited |
| 500 | Server error |

## Cron Jobs

### Scheduled Tasks

```javascript
// Initialized on app startup
initializeCronJobs();

// Graceful shutdown
process.on('SIGTERM', () => {
  stopCronJobs();
  shutdownMemoryManagement();
});
```

### Tasks

| Job | Schedule | Purpose |
|-----|----------|---------|
| Salary Processing | Daily | Process groom salaries |
| Token Cleanup | Hourly | Clean expired tokens |
| Memory Monitoring | Continuous | Track memory usage |

## Health Monitoring

### Health Endpoint

```
GET /health

Response:
{
  "success": true,
  "message": "Server is healthy",
  "timestamp": "2025-12-01T...",
  "uptime": 12345.67,
  "environment": "production"
}
```

### Memory Thresholds

| Threshold | Value | Action |
|-----------|-------|--------|
| Resource | 100MB | Warning |
| Memory | 500MB | Alert |
| Alert | 80% | Critical |

## Swagger Documentation

```
GET /api-docs     - Interactive documentation
GET /api          - API overview endpoint
```

---

*Generated by BMAD document-project workflow*
