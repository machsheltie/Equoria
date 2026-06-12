# Equoria Integration Patterns

**Generated:** 2025-12-01
**Last Updated:** 2026-03-19 (Full Rescan)

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React 19)                         │
│                         Dev Port: 3000                              │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐               │
│  │ Components  │  │  44 React    │  │  React Query │               │
│  │ (Radix UI)  │  │  Query Hooks │  │  Cache Layer │               │
│  └──────┬──────┘  └──────┬───────┘  └──────┬───────┘               │
│         │                │                  │                       │
│         └────────────────┼──────────────────┘                       │
│                          │                                          │
│                    ┌─────┴──────┐                                   │
│                    │ API Client │                                   │
│                    │  (fetch)   │                                   │
│                    └─────┬──────┘                                   │
└──────────────────────────┼──────────────────────────────────────────┘
                           │
                           │ Dev: Vite proxy /api → :3001
                           │ Prod: relative URLs (same origin)
                           │ credentials: 'include'
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         BACKEND (Express)                           │
│                         Port: 3001                                  │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    Middleware Stack                          │   │
│  │  Helmet → CORS → RateLimit → CookieParser → CSRF → Auth    │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │               18 Domain Modules (backend/modules/)           │  │
│  │  auth, users, horses, breeding, traits, training,            │  │
│  │  competition, grooms, riders, trainers, community,           │  │
│  │  services, leaderboards, admin, docs, health, labs,          │  │
│  │  marketplace                                                  │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                │
│  │ Controllers │→ │  Services   │→ │   Models    │                │
│  └─────────────┘  └─────────────┘  └──────┬──────┘                │
└────────────────────────────────────────────┼────────────────────────┘
                                             │
                                             │ Prisma ORM
                                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       DATABASE (PostgreSQL)                         │
│  User, Horse, Breed, Stable, Groom, Rider, Trainer, Club,          │
│  ForumThread, ForumPost, DirectMessage, Training, Competition ...   │
└─────────────────────────────────────────────────────────────────────┘
```

## Frontend-to-Backend Communication

### API Client Architecture

The frontend uses a single API client module at `frontend/src/lib/api-client.ts` built on the native `fetch` API (no Axios). It provides:

- **~150 typed endpoint methods** grouped into 26 domain-specific API objects (see table below for the curated set)
- **Automatic response unwrapping** via `fetchWithAuth<T>()`
- **CSRF protection** with double-submit cookie pattern
- **Token refresh** with single-flight deduplication
- **Rate limit handling** with `Retry-After` support

### Base URL Resolution

```typescript
// frontend/src/lib/api-client.ts
const API_BASE_URL = import.meta.env.VITE_API_URL ?? '';
```

- **Development:** Vite dev server proxies (port 3000) `/api` requests to backend at `http://localhost:3001`
- **Production:** Empty string = relative URLs (same origin, Express serves both SPA and API)
- **Split deploy:** Set `VITE_API_URL` to the backend origin

### Vite Proxy Configuration

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

### fetchWithAuth: Core Request Wrapper

All requests flow through `fetchWithAuth<T>()`, which handles:

1. **Cookie credentials:** Every request includes `credentials: 'include'`
2. **CSRF tokens:** Mutations (POST/PUT/DELETE/PATCH) fetch a CSRF token from `/api/auth/csrf-token` and attach it as `X-CSRF-Token` header
3. **401 auto-retry:** On 401, attempts `refreshAccessToken()` once, then retries the original request
4. **403 CSRF retry:** On 403 with `code: INVALID_CSRF_TOKEN`, invalidates cached CSRF token and retries once
5. **429 rate limiting:** Throws an `ApiError` with `retryAfter` seconds from the `Retry-After` header
6. **Response unwrapping:** Parses `{ status, data }` envelope and returns `data` if present, otherwise the full response body

```typescript
// The auto-unwrap behavior:
const data: ApiResponse<T> = await response.json();
return (data.data !== undefined ? data.data : data) as T;
```

This means hooks receive clean typed data directly, not wrapped in `{ status, data }`.

### apiClient Methods

```typescript
export const apiClient = {
  get: <T>(endpoint, options?) => fetchWithAuth<T>(endpoint, { method: 'GET', ...options }),
  post: <T>(endpoint, body?, options?) =>
    fetchWithAuth<T>(endpoint, { method: 'POST', body: JSON.stringify(body), ...options }),
  put: <T>(endpoint, body?, options?) =>
    fetchWithAuth<T>(endpoint, { method: 'PUT', body: JSON.stringify(body), ...options }),
  patch: <T>(endpoint, body?, options?) =>
    fetchWithAuth<T>(endpoint, { method: 'PATCH', body: JSON.stringify(body), ...options }),
  delete: <T>(endpoint, options?) => fetchWithAuth<T>(endpoint, { method: 'DELETE', ...options }),
};
```

### API Surface Objects

| API Object              | Domain            | Example Endpoints                                                                                     |
| ----------------------- | ----------------- | ----------------------------------------------------------------------------------------------------- |
| `authApi`               | Authentication    | login, register, logout, getProfile, refreshToken, verifyEmail, completeOnboarding, advanceOnboarding |
| `horsesApi`             | Horse management  | list, get, getXP, getAge, getStats, getProgression, getStatHistory, update                            |
| `trainingApi`           | Training system   | getTrainableHorses, checkEligibility, train, getDisciplineStatus                                      |
| `breedingApi`           | Breeding/foals    | breedFoal, getFoal, getFoalDevelopment, enrichFoal, revealTraits, graduateFoal                        |
| `competitionsApi`       | Competitions      | list, getDisciplines, checkEligibility, enter                                                         |
| `groomsApi`             | Groom system      | getUserGrooms, getAssignments, getMarketplace, hireGroom, assignGroom                                 |
| `ridersApi`             | Rider system      | getUserRiders, getAssignments, getMarketplace, hireRider, getDiscovery                                |
| `trainersApi`           | Trainer system    | getUserTrainers, getAssignments, hireTrainer, assignTrainer, dismissTrainer                           |
| `userProgressApi`       | User progress     | getProgress, getDashboard, getActivity, getUser                                                       |
| `breedingPredictionApi` | Genetics          | getInbreedingAnalysis, getLineageAnalysis, getGeneticProbability                                      |
| `vetApi`                | Veterinarian      | getServices, bookAppointment                                                                          |
| `tackShopApi`           | Tack shop         | getInventory, purchaseItem                                                                            |
| `farrierApi`            | Farrier           | getServices, bookService                                                                              |
| `feedShopApi`           | Feed shop         | getCatalog, purchaseFeed                                                                              |
| `inventoryApi`          | Inventory         | getInventory, equipItem, unequipItem                                                                  |
| `forumApi`              | Message board     | getThreads, getThread, createThread, createPost, incrementView                                        |
| `messagesApi`           | Direct messages   | getInbox, getSent, getUnreadCount, sendMessage, markRead                                              |
| `clubsApi`              | Clubs/elections   | getClubs, joinClub, createElection, nominate, vote, getResults                                        |
| `horseMarketplaceApi`   | Horse marketplace | browse, listHorse, delistHorse, buyHorse, myListings, saleHistory                                     |
| `breedsApi`             | Breeds catalog    | list                                                                                                  |
| `horseFeedApi`          | Feed system       | feed, equipFeed, unequipFeed, getEquippable                                                           |
| `bankApi`               | Bank / income     | claimWeekly, getClaimStatus, getTransactions                                                          |
| `conformationShowsApi`  | Conformation shows| enter, getEligibility, execute, getTitles                                                             |
| `craftingApi`           | Crafting system   | getMaterials, getRecipes, craftItem                                                                   |
| `usersApi`              | User directory    | search                                                                                                |
| `gameNotificationsApi`  | In-app notifications | getAll, markAllRead                                                                                |

## Authentication Flow

### JWT + HttpOnly Cookie Pattern

```
┌──────────┐     ┌────────────────┐     ┌──────────────────────┐
│  Login   │────▶│ POST /api/auth │────▶│ Set 3 cookies:       │
│  Form    │     │ /login         │     │ - accessToken (15m)  │
│          │     │                │     │ - refreshToken (7d)  │
└──────────┘     └────────────────┘     │ - csrfToken (15m)    │
                                        └──────────┬───────────┘
                                                   │
                                                   ▼
┌──────────┐     ┌────────────────┐     ┌──────────────────────┐
│Protected │◀────│ Cookies auto-  │◀────│ credentials:         │
│  Route   │     │ sent with each │     │ 'include' on fetch   │
│          │     │ request        │     │                      │
└──────────┘     └────────────────┘     └──────────────────────┘
```

### Token Refresh Flow

1. `fetchWithAuth` receives a 401 response
2. Calls `refreshAccessToken()` which POSTs to `/api/auth/refresh-token` (uses refresh cookie)
3. If refresh succeeds (new access + CSRF cookies set), retries the original request
4. If refresh fails, throws a 401 `ApiError`
5. **Single-flight:** Concurrent 401s share one refresh promise (prevents thundering herd)

### CSRF Protection

- **Double-submit cookie pattern:** Backend sets a `csrfToken` cookie (`httpOnly: false`)
- **Frontend reads:** `getCsrfToken()` fetches from `/api/auth/csrf-token` and caches it
- **Mutations include:** `X-CSRF-Token` header on POST/PUT/DELETE/PATCH
- **No test bypass:** Per Epic 21R doctrine, test-only CSRF bypass headers (`x-test-skip-csrf`) are forbidden. Tests acquire a real CSRF token via `/api/auth/csrf-token` like production clients. See `backend/__tests__/middleware/bypassHeaderHardening.test.mjs` for the sentinel.

### Cookie Security Settings

```
backend/utils/cookieConfig.mjs

┌────────────────┬──────────┬──────────┬──────────┬──────────────────────┐
│ Cookie         │ httpOnly │ secure   │ sameSite │ maxAge               │
├────────────────┼──────────┼──────────┼──────────┼──────────────────────┤
│ accessToken    │ true     │ prod     │ lax/     │ 15 min (900,000ms)   │
│                │          │ only     │ strict   │                      │
├────────────────┼──────────┼──────────┼──────────┼──────────────────────┤
│ refreshToken   │ true     │ prod     │ lax/     │ 7 days               │
│                │          │ only     │ strict   │ path: /auth/refresh  │
├────────────────┼──────────┼──────────┼──────────┼──────────────────────┤
│ csrfToken      │ false    │ prod     │ lax/     │ 24 hours             │
│                │          │ only     │ strict   │ (21R-AUTH-2)         │
└────────────────┴──────────┴──────────┴──────────┴──────────────────────┘

sameSite: 'lax' in development (cross-port 3000↔3001), 'strict' in production
```

**21R-AUTH-2 rationale for the 24-hour CSRF TTL:** The CSRF cookie lifetime is intentionally decoupled from the 15-minute access-token lifetime so a user keeps a valid CSRF cookie across silent access-token refreshes. The `csrf-csrf` library's HMAC binds the token to `JWT_SECRET`, not to session identity, so a longer cookie lifetime does not weaken CSRF protection. See `backend/utils/cookieConfig.mjs` lines 108–125.

## React Query Caching Strategy

### Hook Architecture

58 React Query hooks in `frontend/src/hooks/api/` consume the API surface objects (count current as of 2026-05-15; verify with `ls frontend/src/hooks/api/*.ts | wc -l`). Each hook:

- Uses structured query keys (e.g., `['horses']`, `['horses', horseId]`)
- Returns typed data directly (no envelope unwrapping needed, `fetchWithAuth` handles that)
- Provides `isLoading`, `error`, and `data` states to components

### Query Key Factory Pattern

```typescript
// Example from useHorses.ts
const horseKeys = {
  all: ['horses'] as const,
  detail: (horseId: number) => ['horses', horseId] as const,
  trainingHistory: (horseId: number) => ['horses', horseId, 'training-history'] as const,
};
```

### Cache Strategy by Data Type

| Data Type           | staleTime        | Rationale                              |
| ------------------- | ---------------- | -------------------------------------- |
| Horse list          | 2 min            | Core entity, moderate update frequency (`useHorses.ts`) |
| Horse detail        | 60s              | Moderate update frequency              |
| Training history    | 30s              | Changes after training sessions        |
| Leaderboards        | 5 min            | Changes frequently but not real-time   |
| Competition list    | 1 min            | Users browse actively                  |
| Competition results | 10 min           | Historical, rarely changes             |
| User balance        | 30s              | Financial data, must be current        |

### Mutation Pattern

Mutations use `useMutation` with query invalidation on success:

```typescript
// Example from useHorses.ts
export const useUpdateHorse = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ horseId, data }) => horsesApi.update(horseId, data),
    onSuccess: (_result, { horseId }) => {
      queryClient.invalidateQueries({ queryKey: horseKeys.detail(horseId) });
      queryClient.invalidateQueries({ queryKey: horseKeys.all });
    },
  });
};
```

## Error Handling

### ApiError Interface

```typescript
interface ApiError {
  message: string; // Human-readable error message
  status: string; // 'error'
  statusCode: number; // HTTP status code (0 for network errors)
  retryAfter?: number; // Seconds to wait (429 only)
}
```

### Error Handling Chain

1. **fetchWithAuth** catches HTTP errors and wraps them in `ApiError`
2. **React Query** exposes errors via `error` property on hooks
3. **Components** render error states conditionally
4. **Network errors** (no response) get `statusCode: 0`

### HTTP Status Codes

| Code | Usage                                                        |
| ---- | ------------------------------------------------------------ |
| 200  | Success                                                      |
| 201  | Created                                                      |
| 204  | No content (returned as `{}`)                                |
| 400  | Bad request / Validation error                               |
| 401  | Unauthorized (triggers token refresh)                        |
| 403  | Forbidden / Invalid CSRF (triggers CSRF retry for mutations) |
| 404  | Not found                                                    |
| 429  | Rate limited (includes Retry-After)                          |
| 500  | Server error                                                 |

### Backend Error Response Format

```json
{
  "success": false,
  "message": "Error description",
  "path": "/api/endpoint",
  "method": "POST"
}
```

## Testing Patterns

### MSW (Mock Service Worker)

Frontend tests use MSW in strict mode (`onUnhandledRequest: 'error'`). Every API call in tests must have a matching MSW handler or the test fails.

### Test-Specific Headers — FORBIDDEN per Epic 21R doctrine

Test-only bypass headers (`x-test-skip-csrf`, `x-test-bypass-rate-limit`, `x-test-user`, `x-test-bypass-auth`, `x-test-bypass-ownership`) and the `VITE_E2E_TEST` production-code switch are forbidden by the 21R Beta Readiness Doctrine in `CLAUDE.md`. They are not active in this codebase. Sentinel tests fail CI if they are reintroduced:

- `backend/__tests__/middleware/bypassHeaderHardening.test.mjs` — asserts `csrf.mjs` contains no `x-test-skip-csrf` reference.
- `backend/__tests__/rate-limit-no-bypass.test.mjs` — asserts `x-test-bypass-rate-limit` has no effect on the limiter.
- `scripts/doctrine-checks/check-no-bypass-headers.sh` — repo-wide grep for active bypass-header references.

#### Correct test patterns

- **Frontend (Vitest + RTL):** Use MSW handlers in strict mode to intercept API calls. No bypass headers needed — MSW responds before the request leaves the test process.
- **Backend integration (supertest):** Use `backend/tests/helpers/testAuth.mjs` real-token helpers. The helper acquires a real JWT plus a real CSRF token via `/api/auth/csrf-token`, exactly like a production client.
- **Playwright E2E:** Real credentials, real backend, real DB. No route interception to inject bypasses, no `test.skip` on beta-critical paths.

### Backend Test Strategy

- **3617+ tests** across 226 suites
- **Balanced mocking:** External dependencies only (DB, HTTP, logger)
- **Real business logic:** Tests validate actual implementations
- **E2E:** Playwright suite for core game flows, auth, breeding

## Production Deployment

### Monolithic SPA Serving

In production, Express serves both the API and the built frontend:

```javascript
// backend/app.mjs
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(join(__dirname, 'public')));
}

// SPA fallback: non-API routes serve index.html
app.use('*', (req, res) => {
  if (
    !req.path.startsWith('/api') &&
    !req.path.startsWith('/health') &&
    !req.path.startsWith('/api-docs')
  ) {
    return res.sendFile(join(__dirname, 'public', 'index.html'));
  }
  // Otherwise: 404 JSON response
});
```

### Build Pipeline

1. **Vite builds** frontend to `frontend/dist/`
2. **Dockerfile** copies `dist/` into `backend/public/`
3. **Express** serves static assets + SPA fallback
4. **API_BASE_URL** is empty string = relative URLs = same origin

### Chunk Splitting

```typescript
// frontend/vite.config.ts - manualChunks
{
  'vendor-react':  ['react', 'react-dom', 'react-router-dom'],
  'vendor-query':  ['@tanstack/react-query'],
  'vendor-charts': ['recharts'],
  'vendor-radix':  ['@radix-ui/react-dialog', '@radix-ui/react-label', ...],
  'vendor-icons':  ['lucide-react'],
}
```

Initial chunk: ~321KB (with React.lazy code splitting on routes).

## Backend Middleware Stack

### Execution Order (matches `backend/app.mjs`)

```
Request
  → Sentry (initializeSentry)
  → addSecurityHeaders            (21R-SEC: Permissions-Policy + belt-and-suspenders nosniff/HSTS; helmet runs after & owns the rest)
  → helmet(helmetConfig)          (CSP + COEP + HSTS + X-Frame-Options DENY + Referrer-Policy strict-origin-when-cross-origin — Equoria-kckix; X-XSS-Protection 0 from helmet default — Equoria-0kb9a)
  → enforceNoOriginPolicy         (21R-SEC: hard-reject no-origin API mutations)
  → cors(corsOptionsDelegate)
  → apiLimiter                    (rate limiting on /api/*)
  → express.json (verifyJsonBody) (21R-SEC-1/3: raw-bytes duplicate-key + depth-cap scan)
  → express.urlencoded (verifyUrlEncodedBody)  (21R-SEC-5)
  → rejectPollutedRequestBody     (21R-SEC: CWE-1321 body guard)
  → rejectPollutedRequestQuery    (21R-SEC-4 Equoria-iq84: query guard)
  → cookieParser
  → requestLogger
  → addDocumentationHeaders
  → compression + responseOptimization + paginationMiddleware
  → performanceMonitoring
  → createResourceManagementMiddleware  (memory / perf tracking)
  → memoryMonitoringMiddleware
  → databaseConnectionMiddleware (Prisma)
  → requestTimeoutMiddleware (30s)
  → Routers (publicRouter, adminRouter, authRouter, …)
  → errorRequestLogger
  → attachSentryErrorHandler
  → csrfErrorHandler
  → requestBodySecurityErrorHandler  (21R-SEC-6 Equoria-tpbu: RequestBodySecurityError → 400)
  → errorHandler (global)
  → Response
```

**Why the 21R-SEC layers are positioned where they are:** see `.claude/rules/SECURITY.md` § "Prototype Pollution Prevention (CWE-1321)" for the rationale of each guard. The order is intentional and must not be reshuffled without re-reviewing that section.

**CSRF is router-scoped, not global.** `csrfProtection` is mounted by the routers that need it — for example `authRouter` (`backend/modules/auth/routes/authRouter.mjs:160`) and `adminRouter` (`backend/modules/admin/routes/adminRouter.mjs:166`) — so unauthenticated read endpoints under `publicRouter` (e.g. `/health`, `/ready`, `/ping`) and the SPA static fallback are not gated by CSRF. The `csrfErrorHandler` above is a global error tap that converts a thrown CSRF error from any router into a uniform 403 envelope.

### Rate Limiting

- **Global (production):** 100 requests per 15 minutes per IP (`backend/app.mjs:449-454`)
- **Global (beta):** 3000 requests per 15 minutes per IP (per Equoria-obwp follow-up; Playwright E2E suite headroom)
- **Auth endpoints:** 200 failed login attempts per 15 minutes per IP/user (`backend/middleware/rateLimiting.mjs:434-440`). Uses `skipSuccessfulRequests: true` — successful logins do not count toward the cap. Equoria-f5r1 verified this against config.
- **Test mode:** Limits raised via `NODE_ENV === 'test'` configuration (no bypass header — test cap is 20000). The `x-test-bypass-rate-limit` header is FORBIDDEN per Epic 21R doctrine; sentinel test `backend/__tests__/rate-limit-no-bypass.test.mjs` asserts it has no effect.

## API Route Structure

### Endpoint Prefix Convention

All stable endpoints use `/api/v1/` prefix. Some legacy paths without `/v1/` remain for backward compatibility. The frontend API client uses a mix:

- Most mutations and newer endpoints: `/api/v1/...`
- Some older GET endpoints: `/api/...` (mapped to v1 on backend)

### Domain Routes

| Route Prefix           | Description                                                         |
| ---------------------- | ------------------------------------------------------------------- |
| `/api/v1/auth`         | Authentication (login, register, logout, refresh, CSRF, onboarding) |
| `/api/v1/horses`       | Horse CRUD, lineage, stats, XP, progression                         |
| `/api/v1/users`        | User profiles, dashboard, activity, progress                        |
| `/api/v1/training`     | Training sessions, eligibility, cooldowns                           |
| `/api/v1/competition`  | Competitions, disciplines, entry, results                           |
| `/api/v1/breeds`       | Breed definitions                                                   |
| `/api/v1/foals`        | Foal management, development, graduation                            |
| `/api/v1/traits`       | Trait discovery, definitions, competition impact                    |
| `/api/v1/grooms`       | Groom hiring, assignment, marketplace                               |
| `/api/v1/riders`       | Rider hiring, assignment, discovery                                 |
| `/api/v1/trainers`     | Trainer hiring, assignment, dismissal                               |
| `/api/v1/vet`          | Veterinarian services, appointments                                 |
| `/api/v1/tack-shop`    | Tack inventory, purchases                                           |
| `/api/v1/farrier`      | Farrier services, bookings                                          |
| `/api/v1/feed-shop`    | Feed catalog, purchases                                             |
| `/api/v1/inventory`    | Player inventory, equip/unequip                                     |
| `/api/v1/marketplace`  | Horse marketplace (buy/sell/browse)                                 |
| `/api/v1/forum`        | Message board threads, posts                                        |
| `/api/v1/messages`     | Direct messages, inbox, unread count                                |
| `/api/v1/clubs`        | Clubs, memberships, elections                                       |
| `/api/v1/leaderboards` | Per-discipline rankings                                             |
| `/api/v1/admin`        | Admin operations (restricted)                                       |
| `/api/v1/labs`         | Experimental endpoints (no SLO)                                     |

## Database Integration

### Prisma Client

```javascript
// packages/database/prismaClient.mjs — shared across backend
import prisma from '../packages/database/prismaClient.mjs';
```

### Module Structure (Epic 20)

Backend follows domain-driven modular architecture:

```
backend/modules/
  auth/
    routes/authRoutes.mjs
    controllers/authController.mjs
  horses/
    routes/horseRoutes.mjs
    controllers/horseController.mjs
  ... (18 modules total)
```

Backward-compatible shims at `backend/routes/` and `backend/controllers/` re-export from modules for zero test breakage.

## Health Monitoring

### Health Endpoint

```
GET /health

Response:
{
  "success": true,
  "status": "healthy",
  "message": "Server is healthy",
  "timestamp": "2026-03-19T...",
  "uptime": 12345.67,
  "environment": "production",
  "services": {
    "api": "healthy",
    "redis": { "status": "healthy", "...": "..." }
  }
}
```

Source: `backend/app.mjs#publicRouter.get('/health')`. Liveness output is
never cached (`Cache-Control: no-store`, ZAP rule 10049). Database
readiness is exposed at `/ready` instead so the cheap `/health` probe does
not consume Supabase Session-mode pool clients.

### Swagger Documentation

```
GET /api-docs      - Interactive Swagger UI
GET /api-docs.json - OpenAPI specification
```

---

_Generated by BMAD document-project workflow_
