# Equoria API Contracts - Backend

**Version:** 2.0.0
**Generated:** 2025-12-01
**Base URL:** `/api` (v1: `/api/v1`)
**Authentication:** JWT Bearer Token
**Source Integration:** Consolidated from docs/history/claude-api/

---

## Overview

The Equoria backend provides a comprehensive REST API for the horse breeding simulation game. All endpoints follow consistent patterns for authentication, validation, error handling, and response formatting.

### Base Configuration

| Environment | URL | Port |
|-------------|-----|------|
| Development | `http://localhost:3001/api` | 3001 |
| Production | `https://api.equoria.com/api` | 443 |

### Response Format

All API responses follow a consistent format:

```json
{
  "success": true|false,
  "message": "Descriptive message",
  "data": { ... } | null,
  "error": null | "Error description"
}
```

---

## Authentication Endpoints

**Base Path:** `/api/auth` or `/api/v1/auth`

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/auth/register` | Register new user | No |
| POST | `/auth/login` | Login user | No |
| POST | `/auth/refresh` | Refresh access token | No |
| POST | `/auth/logout` | Logout user | Yes |
| GET | `/auth/profile` | Get user profile | Yes |
| PUT | `/auth/profile` | Update user profile | Yes |
| GET | `/auth/verify-email` | Verify email address | No |
| POST | `/auth/resend-verification` | Resend verification email | Yes |
| GET | `/auth/verification-status` | Get verification status | Yes |

### Register Request
```json
{
  "email": "user@example.com",
  "username": "johndoe",
  "password": "securePassword123",
  "firstName": "John",
  "lastName": "Doe"
}
```

### Login Response
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": { "id": "uuid", "email": "...", "username": "..." },
    "accessToken": "eyJ...",
    "refreshToken": "eyJ..."
  }
}
```

### Security Features
- **bcrypt password hashing** with 10+ salt rounds
- **JWT access tokens** (15-minute expiry)
- **Refresh tokens** (7-day expiry with rotation)
- **Rate limiting:** 5 attempts per 15 minutes
- **Role-based claims** (user, admin, moderator)

---

## User Endpoints

**Base Path:** `/api/users` or `/api/v1/users`

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/users` | List users | Yes |
| GET | `/users/:id` | Get user by ID | Yes |
| PUT | `/users/:id` | Update user | Yes |
| DELETE | `/users/:id` | Delete user | Yes |
| GET | `/users/:id/horses` | Get user with all horses | Yes |
| GET | `/users/:id/progress` | Get user level/XP progress | Yes |
| GET | `/users/dashboard` | Comprehensive user dashboard | Yes |
| POST | `/users/:id/award-xp` | Award XP for activities | Yes |
| GET | `/users/:id/xp-history` | Get XP history log | Yes |

### User Progression
```javascript
// Level Formula
Current Level = Math.floor(totalXP / 100) + 1
XP for Next Level = (currentLevel * 100)
Progress % = ((totalXP % 100) / 100) * 100
```

---

## Horse Endpoints

**Base Path:** `/api/horses` or `/api/v1/horses`

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/horses` | List user's horses | Yes |
| GET | `/horses/:id` | Get horse details | Yes |
| POST | `/horses` | Create horse | Yes |
| PUT | `/horses/:id` | Update horse | Yes |
| DELETE | `/horses/:id` | Delete horse | Yes |
| GET | `/horses/:id/training-history` | Training log retrieval | Yes |
| GET | `/horses/:id/competition-history` | Competition results | Yes |
| GET | `/horses/:id/xp` | Get horse XP status | Yes |
| POST | `/horses/:id/allocate-stat` | Allocate stat points | Yes |
| GET | `/horses/:id/xp-history` | Paginated horse XP history | Yes |
| GET | `/horses/:id/conformation` | Get conformation breakdown | Yes |

### Create Horse Request
```json
{
  "name": "Thunderbolt",
  "age": 3,
  "breedId": 1,
  "ownerId": "uuid",
  "stableId": 1
}
```

### Horse XP System
```javascript
// XP to Stat Conversion: 100 Horse XP = 1 allocable stat point
baseXP = 20
placementBonus = placement === 1 ? 10 : placement === 2 ? 7 : placement === 3 ? 5 : 0
totalHorseXP = baseXP + placementBonus
availableStatPoints = Math.floor(horse.totalXP / 100)
```

---

## Training Endpoints

**Base Path:** `/api/training` or `/api/v1/training`

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/training/check-eligibility` | Validate horse training eligibility | Yes |
| POST | `/training/train` | Execute training session | Yes |
| GET | `/training/status/:horseId/:discipline` | Individual discipline status | Yes |
| GET | `/training/horse/:horseId/all-status` | Multi-discipline status overview | Yes |
| GET | `/training/trainable-horses/:userId` | Get trainable horses | Yes |

### Training Request
```json
{
  "horseId": 1,
  "discipline": "dressage"
}
```

### Training Response
```json
{
  "success": true,
  "message": "Training completed successfully",
  "updatedScore": 35,
  "nextEligibleDate": "2025-12-08T00:00:00Z"
}
```

### Business Rules
- **Age Requirement:** Horses must be 3+ years old
- **Global Cooldown:** 7-day cooldown per horse (any discipline)
- **Score Progression:** +5 points per training session

---

## Competition Endpoints

**Base Path:** `/api/competition` or `/api/v1/competition`

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/competitions` | List competitions | Yes |
| GET | `/competitions/:id` | Get competition details | Yes |
| POST | `/competitions/:id/enter` | Enter horse in competition | Yes |
| GET | `/competitions/:id/results` | Get competition results | Yes |
| POST | `/competition/enter-show` | Enter horses in competition | Yes |
| GET | `/competition/show/:showId/results` | Get show results | Yes |
| GET | `/competition/horse/:horseId/results` | Get horse competition history | Yes |
| GET | `/competition/shows/available` | Available competitions listing | Yes |

### Enter Show Request
```json
{
  "showId": 1,
  "horseIds": [1, 2, 3]
}
```

### Competition Eligibility
- Age 3-20 years
- Level restrictions per show
- No duplicate entries
- Health status must be healthy

---

## Groom Endpoints

**Base Path:** `/api/grooms` or `/api/v1/grooms`

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/grooms` | List grooms | Yes |
| GET | `/grooms/:id` | Get groom details | Yes |
| POST | `/grooms` | Hire groom | Yes |
| PUT | `/grooms/:id` | Update groom | Yes |
| DELETE | `/grooms/:id` | Remove groom | Yes |
| GET | `/grooms/definitions` | System definitions | Yes |
| GET | `/grooms/user/:userId` | Get user's grooms | Yes |

### Groom Assignment
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/groom-assignments` | Assign groom to horse | Yes |
| GET | `/groom-assignments/:foalId` | Get assignments for horse | Yes |
| DELETE | `/groom-assignments/:id` | Remove assignment | Yes |
| POST | `/grooms/assign` | Assign groom to foal | Yes |
| GET | `/grooms/foal/:id` | Get foal's groom assignments | Yes |

### Groom Interaction
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/grooms/interact` | Record groom interaction | Yes |

### Hire Groom Request
```json
{
  "name": "Sarah Johnson",
  "speciality": "foal_care",
  "skill_level": "expert",
  "personality": "gentle",
  "experience": 8,
  "session_rate": 25.0,
  "bio": "Experienced foal care specialist"
}
```

### Groom Interaction Request
```json
{
  "foalId": 1,
  "groomId": 1,
  "taskType": "trust_building",
  "duration": 30,
  "notes": "Foal responded well to gentle handling"
}
```

### Age Gating Rules
| Age Range | Allowed Tasks |
|-----------|---------------|
| 0-2 years | Enrichment only (trust_building, desensitization) |
| 1-3 years | Foal grooming + enrichment |
| 3+ years | All tasks (general grooming, hand-walking, etc.) |

### Groom Career Management
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/grooms/:id/retirement/eligibility` | Check retirement eligibility | Yes |
| POST | `/grooms/:id/retirement/process` | Process retirement | Yes |
| GET | `/grooms/retirement/approaching` | Get approaching retirements | Yes |
| GET | `/grooms/retirement/statistics` | Get retirement statistics | Yes |

### Groom Legacy System
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/grooms/:id/legacy/eligibility` | Check legacy eligibility | Yes |
| POST | `/grooms/:id/legacy/create` | Create protégé | Yes |
| GET | `/grooms/legacy/history` | Get legacy history | Yes |

### Groom Talent Tree
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/grooms/talents/definitions` | Get talent definitions | Yes |
| GET | `/grooms/:id/talents` | Get groom talents | Yes |
| POST | `/grooms/:id/talents/select` | Select talent | Yes |

---

## Foal & Breeding Endpoints

**Base Path:** `/api/foals` or `/api/v1/foals`

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/breeding/breed` | Create foal from breeding pair | Yes |
| GET | `/foals/:id` | Foal details with genetics | Yes |
| GET | `/foals/:id/development` | Get foal development status | Yes |
| POST | `/foals/:id/activity` | Log foal activity | Yes |
| GET | `/foals/:id/activities` | Get foal activities | Yes |
| POST | `/foals/:id/enrich` | Foal enrichment activities | Yes |
| GET | `/foals/:id/traits` | Trait discovery status | Yes |
| POST | `/foals/:id/reveal-traits` | Manual trait revelation | Yes |
| PUT | `/foals/:id/develop` | Foal development progression | Yes |

### Breeding Request
```json
{
  "sireId": 1,
  "damId": 2,
  "userId": "uuid"
}
```

### Foal Activity Request
```json
{
  "activity": "trust_building",
  "duration": 30
}
```

---

## Trait Endpoints

**Base Path:** `/api/traits` or `/api/v1/traits`

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/traits/:horseId` | Get horse traits | Yes |
| GET | `/traits/:horseId/history` | Get trait history | Yes |
| GET | `/traits/:horseId/epigenetic` | Get epigenetic flags | Yes |
| GET | `/traits/definitions` | Trait definition reference | Yes |
| POST | `/traits/discover/:horseId` | Trigger discovery | Yes |
| GET | `/traits/discovery-status/:id` | Get discovery status | Yes |
| POST | `/traits/batch-discover` | Batch discovery | Yes |
| GET | `/traits/competition-impact/:horseId` | Competition impact | Yes |
| GET | `/traits/competition-comparison/:horseId` | Competition comparison | Yes |

### Ultra-Rare Traits
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/ultra-rare-traits/definitions` | Get definitions | Yes |
| GET | `/ultra-rare-traits/:horseId` | Get ultra-rare traits | Yes |
| POST | `/ultra-rare-traits/evaluate/:horseId` | Evaluate for traits | Yes |
| GET | `/ultra-rare-traits/events/:horseId` | Get trait events | Yes |
| POST | `/ultra-rare-traits/check-conditions/:horseId` | Check conditions | Yes |
| GET | `/ultra-rare-traits/groom-perks/:groomId` | Get groom perks | Yes |

### Epigenetic Traits
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/epigenetic-traits/definitions` | Get definitions | Yes |
| POST | `/epigenetic-traits/evaluate-milestone/:horseId` | Evaluate milestone | Yes |
| POST | `/epigenetic-traits/log-trait` | Log trait | Yes |
| GET | `/epigenetic-traits/history/:horseId` | Get history | Yes |
| GET | `/epigenetic-traits/summary/:horseId` | Get summary | Yes |
| GET | `/epigenetic-traits/breeding-insights/:horseId` | Breeding insights | Yes |

### Epigenetic Flags
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/flags/evaluate` | Evaluate flags for horse | Yes |
| GET | `/horses/:id/flags` | Get horse flags | Yes |
| GET | `/flags/definitions` | Get flag definitions | Yes |

---

## Milestone Endpoints

**Base Path:** `/api/milestones` or `/api/v1/milestones`

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/traits/evaluate-milestone` | Evaluate milestone | Yes |
| GET | `/traits/milestone-status/:horseId` | Get milestone status | Yes |
| GET | `/milestones/milestone-definitions` | Get milestone definitions | Yes |

---

## Leaderboard Endpoints

**Base Path:** `/api/leaderboards` or `/api/v1/leaderboards`

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/leaderboard` | Get global leaderboard | No |
| GET | `/leaderboard/discipline/:discipline` | Get discipline leaderboard | No |

---

## Admin Endpoints

**Base Path:** `/api/admin` or `/api/v1/admin`

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/admin/users` | List all users | Admin |
| GET | `/admin/stats` | Get system stats | Admin |
| PUT | `/admin/users/:id/role` | Role assignment | Admin |
| GET | `/admin/horses/all` | Global horse overview | Admin |
| POST | `/admin/shows/create` | Show creation | Admin |
| GET | `/admin/stats/system` | System statistics | Admin |
| POST | `/admin/maintenance/backup` | Database backup | Admin |

---

## XP Endpoints

**Base Path:** `/api/xp`

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/xp/user` | Get user XP | Yes |
| GET | `/xp/horse/:horseId` | Get horse XP | Yes |

---

## Health Check Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/ping` | Basic ping/pong | No |
| GET | `/health` | Comprehensive health check | No |

---

## Breed Endpoints

**Base Path:** `/api/breeds`

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/breeds` | Breed listing with characteristics | Yes |
| GET | `/breeds/:id` | Individual breed details | Yes |
| GET | `/breeds/:id/horses` | Horses of specific breed | Yes |

---

## Input Validation Rules

### Common Validations
| Field | Rule | Message |
|-------|------|---------|
| Horse ID | Positive integer | "ID must be positive integer" |
| Email | Valid format, unique | "Valid email required" |
| Name | 2-50 characters | "Name must be 2-50 characters" |
| Discipline | Valid from statMap | "Invalid discipline" |
| Money/Scores | Non-negative | "Must be non-negative" |

### Business Rule Validations
| Rule | Description |
|------|-------------|
| Training Age | Horses must be 3+ years old |
| Training Cooldown | 7-day global cooldown per horse |
| Competition Age | Age 3-20, level restrictions |
| Breeding | Age and gender requirements |

---

## Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "message": "Validation error",
  "errors": [{ "field": "email", "message": "Valid email is required" }]
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "message": "Authentication required"
}
```

### 403 Forbidden
```json
{
  "success": false,
  "message": "Insufficient permissions"
}
```

### 404 Not Found
```json
{
  "success": false,
  "message": "Resource not found"
}
```

### 409 Conflict
```json
{
  "success": false,
  "message": "Duplicate resource"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "message": "Internal server error"
}
```

---

## Rate Limiting

| Endpoint Type | Limit | Window |
|---------------|-------|--------|
| Authentication | 5 requests | 15 minutes |
| General API | 100 requests | 15 minutes |
| Training | 10 requests | 1 minute |
| Competition | 20 entries | 1 hour |

---

## Security Features

### Authentication & Authorization
- JWT access tokens (short-lived, 15 min)
- Refresh token rotation (7 days)
- Role-based access control (user, admin, moderator)
- Session management with secure tokens
- Account status validation (active/disabled)

### Input Protection
- Password hashing (bcrypt, 10+ rounds)
- Input validation (express-validator)
- SQL injection prevention (Prisma ORM)
- XSS prevention (escape output)
- Request sanitization

### Infrastructure Security
- Rate limiting per IP/user
- CORS configuration
- Helmet security headers
- HTTPS enforcement (production)
- Audit logging for security events

---

## Performance Headers

| Header | Purpose |
|--------|---------|
| X-Request-ID | Request tracing |
| Content-Type | application/json |
| Authorization | Bearer token |

---

## Cross-References

- **PRD-03 Gameplay Systems:** [PRD-03-Gameplay-Systems.md](./product/PRD-03-Gameplay-Systems.md)
- **PRD-04 Advanced Systems:** [PRD-04-Advanced-Systems.md](./product/PRD-04-Advanced-Systems.md)
- **Data Models:** [data-models.md](./data-models.md)
- **Architecture:** [architecture-backend.md](./architecture-backend.md)
- **Historical Source:** `docs/history/claude-api/`

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-12-01 | Initial generation from BMAD workflow |
| 2.0.0 | 2025-12-01 | Consolidated from historical docs (api_specs, routes-layer, controllers-layer, GROOM_API_TEST_PLAN) |
