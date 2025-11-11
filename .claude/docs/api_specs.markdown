# API Specifications - Equoria Game Backend

## Base URL
- **Development:** `http://localhost:3000/api/`
- **Production:** `https://api.equoria.com/api/`

## Authentication
- **Type:** JWT Bearer Token
- **Header:** `Authorization: Bearer <token>`
- **Refresh:** Automatic token refresh on 401 responses

## Response Format
All API responses follow a consistent format:
```json
{
  "success": true|false,
  "message": "Descriptive message",
  "data": { ... } | null,
  "error": null | "Error description"
}
```

## Core Endpoints

### Horse Management
- **GET /api/horses/:id**: Retrieve horse by ID with relationships
  - Response: Horse object with breed, owner, stable, user relations
  - Status: 200 (success), 404 (not found), 500 (server error)

- **POST /api/horses**: Create new horse
  - Body: `{ name, age, breedId, ownerId, stableId, userId? }`
  - Response: Created horse with full relations
  - Status: 201 (created), 400 (validation error), 500 (server error)

### User Management
- **GET /api/users/:id**: Retrieve user by UUID
  - Response: User object with basic information
  - Status: 200 (success), 404 (not found), 500 (server error)

- **GET /api/users/:id/horses**: Get user with all horses
  - Response: User object with horses array including relations
  - Status: 200 (success), 404 (not found), 500 (server error)

- **POST /api/users**: Create new user
  - Body: `{ name, email, money, level, xp, settings }`
  - Response: Created user object with UUID
  - Status: 201 (created), 400 (validation error), 500 (server error)

- **PUT /api/users/:id**: Update user information
  - Body: Partial user object with fields to update
  - Response: Updated user object
  - Status: 200 (success), 400 (validation error), 404 (not found)

### Training System
- **POST /api/training/check-eligibility**: Check training eligibility
  - Body: `{ horseId, discipline }`
  - Response: `{ eligible: boolean, reason?: string }`
  - Status: 200 (success), 400 (validation error)

- **POST /api/training/train**: Execute training session
  - Body: `{ horseId, discipline }`
  - Response: `{ success: true, message: "...", updatedScore: number, nextEligibleDate: string }`
  - Status: 200 (success), 400 (training not allowed), 500 (server error)

- **GET /api/training/status/:horseId/:discipline**: Get training status
  - Response: Detailed training status with cooldown information
  - Status: 200 (success), 404 (horse not found)

- **GET /api/training/horse/:horseId/all-status**: Get multi-discipline status
  - Response: Training status for all disciplines
  - Status: 200 (success), 404 (horse not found)

- **GET /api/training/trainable-horses/:userId**: Get trainable horses
  - Response: Array of horses eligible for training
  - Status: 200 (success), 404 (user not found)

### Competition System
- **POST /api/competition/enter-show**: Enter horses in competition
  - Body: `{ showId, horseIds: [number] }`
  - Response: Competition results with placements and scores
  - Status: 200 (success), 400 (validation error), 500 (server error)

- **GET /api/competition/show/:showId/results**: Get show results
  - Response: Array of results with horse and show details
  - Status: 200 (success), 404 (show not found)

- **GET /api/competition/horse/:horseId/results**: Get horse competition history
  - Response: Array of results with show details
  - Status: 200 (success), 404 (horse not found)

### Authentication
- **POST /api/auth/register**: Register new user
  - Body: `{ email, password, name }`
  - Response: User object with JWT token
  - Status: 201 (created), 400 (validation error), 409 (user exists)

- **POST /api/auth/login**: User login
  - Body: `{ email, password }`
  - Response: User object with JWT token
  - Status: 200 (success), 401 (invalid credentials), 400 (validation error)

- **POST /api/auth/refresh**: Refresh JWT token
  - Body: `{ refreshToken }`
  - Response: New access token
  - Status: 200 (success), 401 (invalid token)

- **POST /api/auth/logout**: User logout
  - Body: `{ refreshToken }`
  - Response: Success confirmation
  - Status: 200 (success)

### Breeding System
- **POST /api/breeding/breed**: Create foal from breeding pair
  - Body: `{ sireId, damId, userId }`
  - Response: Created foal with genetics and traits
  - Status: 201 (created), 400 (validation error), 500 (server error)

- **GET /api/foals/:id/development**: Get foal development status
  - Response: Development progress with bonding and stress metrics
  - Status: 200 (success), 404 (foal not found)

- **POST /api/foals/:id/activity**: Perform enrichment activity
  - Body: `{ activity, duration? }`
  - Response: Updated foal status with trait discoveries
  - Status: 200 (success), 400 (validation error), 404 (foal not found)

## Validation Rules

### Input Validation
- **Horse Age:** Must be positive integer
- **User Email:** Valid email format, unique constraint
- **Horse Names:** 2-50 characters, alphanumeric with spaces
- **Discipline:** Must be valid discipline from statMap
- **Money/Scores:** Non-negative integers

### Business Rules
- **Training Age Limit:** Horses must be 3+ years old
- **Training Cooldown:** 7-day global cooldown per horse
- **Competition Eligibility:** Age 3-20, level restrictions, no duplicates
- **Breeding Restrictions:** Age and gender requirements

## Error Handling

### HTTP Status Codes
- **200:** Success
- **201:** Created
- **400:** Bad Request (validation error)
- **401:** Unauthorized (authentication required)
- **403:** Forbidden (insufficient permissions)
- **404:** Not Found
- **409:** Conflict (duplicate resource)
- **500:** Internal Server Error

### Error Response Format
```json
{
  "success": false,
  "message": "Validation failed",
  "error": "Specific error description",
  "details": {
    "field": "validation_error_message"
  }
}
```

## Security Headers
- **helmet:** Security headers middleware
- **cors:** Cross-origin resource sharing
- **rate-limiting:** Request throttling
- **X-Request-ID:** Request tracing header

## Rate Limiting
- **General API:** 100 requests per 15 minutes
- **Authentication:** 5 login attempts per 15 minutes
- **Training:** 10 requests per minute per user
- **Competition:** 20 entries per hour per user

## Conventions
- Use JSON for all request/response bodies
- Include `Content-Type: application/json` header
- Validate all inputs with express-validator
- Use camelCase for JSON property names
- Include X-Request-ID header for request tracing
- Follow RESTful resource naming conventions

## References
- Database Schema: `@docs/database-infrastructure.md`
- Authentication: `@docs/backend-overview.md`
- Testing: `@docs/testing-architecture.md`
- Routes Implementation: `@docs/routes-layer.md`