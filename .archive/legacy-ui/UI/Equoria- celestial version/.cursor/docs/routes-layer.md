# Routes Layer - API Endpoints & Route Management

## Overview

The routes layer defines all REST API endpoints for the Equoria application. Each route file handles a specific domain of functionality with comprehensive validation, error handling, and standardized response formats.

## Route Files Structure

### 1. `trainingRoutes.js` - Training System Endpoints

**Base Path:** `/api/training`

**Endpoints:**
- `POST /check-eligibility` - Validates horse training eligibility
- `POST /train` - Executes training session with validation
- `GET /status/:horseId/:discipline` - Individual discipline status
- `GET /horse/:horseId/all-status` - Multi-discipline status overview

**Validation Features:**
- **Horse ID validation:** Positive integer checks
- **Discipline validation:** String length and content validation
- **Comprehensive error handling** with environment-specific messages
- **Standardized response format** for all endpoints

**Business Integration:**
- Uses `trainingController` for business logic
- Implements global cooldown enforcement
- Provides detailed status information for UI

### 2. `authRoutes.js` - Authentication & Authorization

**Base Path:** `/api/auth`

**Endpoints:**
- `POST /register` - New user account creation
- `POST /login` - User authentication with JWT
- `POST /refresh` - Token refresh mechanism
- `POST /logout` - Session termination
- `GET /profile` - User profile retrieval

**Security Features:**
- **bcrypt password hashing** with configurable salt rounds
- **JWT token generation** with role-based claims
- **Input validation** with express-validator
- **Rate limiting** protection against brute force
- **Comprehensive audit logging** for security events

**Validation Patterns:**
- **Email validation:** Format and uniqueness checks
- **Password validation:** Strength requirements
- **Token validation:** JWT integrity and expiration
- **Role-based access** control implementation

### 3. `competitionRoutes.js` - Competition Management

**Base Path:** `/api/competition`

**Endpoints:**
- `POST /enter-show` - Horse entry and competition execution
- `GET /show/:showId/results` - Show leaderboards and results
- `GET /horse/:horseId/results` - Horse competition history
- `GET /shows/available` - Available competitions listing

**Business Logic:**
- **Eligibility validation** before entry
- **Batch processing** for multiple horse entries
- **Result persistence** with automatic placement
- **Comprehensive error handling** for failed entries

**Integration Features:**
- Uses `competitionController` for orchestration
- Integrates with `isHorseEligible` utility
- Leverages `simulateCompetition` logic
- Connects to `resultModel` for persistence

### 4. `horseRoutes.js` - Horse Management

**Base Path:** `/api/horses`

**Endpoints:**
- `GET /` - Horse listing with filters
- `GET /:id` - Individual horse details
- `POST /` - Create new horse
- `PUT /:id` - Update horse information
- `DELETE /:id` - Remove horse (soft delete)
- `GET /:id/training-history` - Training log retrieval
- `GET /:id/competition-history` - Competition results

**Features:**
- **Comprehensive CRUD** operations
- **Relationship loading** (breed, owner, stable, user)
- **Search and filtering** capabilities
- **History tracking** for training and competitions
- **Validation** for horse data integrity

### 5. `foalRoutes.js` - Breeding & Foal Management

**Base Path:** `/api/foals`

**Endpoints:**
- `POST /breed` - Initiate breeding between horses
- `GET /:id` - Foal details with genetics
- `POST /:id/enrich` - Foal enrichment activities
- `GET /:id/traits` - Trait discovery status
- `POST /:id/reveal-traits` - Manual trait revelation
- `PUT /:id/develop` - Foal development progression

**Breeding Features:**
- **Genetic inheritance** calculation
- **Trait discovery** mechanics
- **Development tracking** with enrichment
- **Epigenetic modifications** based on care

**Validation:**
- **Parent validation** for breeding eligibility
- **Age restrictions** for breeding participation
- **Activity validation** for enrichment
- **Development tracking** for progression

### 6. `adminRoutes.js` - Administrative Functions

**Base Path:** `/api/admin`

**Endpoints:**
- `GET /users` - User management listing
- `PUT /users/:id/role` - Role assignment
- `GET /horses/all` - Global horse overview
- `POST /shows/create` - Show creation
- `GET /stats/system` - System statistics
- `POST /maintenance/backup` - Database backup

**Security Features:**
- **Role-based access control** (admin/moderator only)
- **Comprehensive audit logging** for admin actions
- **Input validation** for sensitive operations
- **Rate limiting** for admin endpoints

### 7. `traitDiscoveryRoutes.js` - Trait System

**Base Path:** `/api/traits`

**Endpoints:**
- `POST /discover/:foalId` - Trigger trait discovery
- `GET /progress/:foalId` - Discovery progress tracking
- `POST /batch-discover` - Batch trait discovery
- `GET /definitions` - Trait definition reference

**Discovery Mechanics:**
- **Condition checking** for trait revelation
- **Progress tracking** toward discovery goals
- **Batch processing** for multiple foals
- **Comprehensive logging** of discovery events

### 8. `breedRoutes.js` - Breed Information

**Base Path:** `/api/breeds`

**Endpoints:**
- `GET /` - Breed listing with characteristics
- `GET /:id` - Individual breed details
- `GET /:id/horses` - Horses of specific breed

**Features:**
- **Breed characteristics** and genetics
- **Statistical information** for breeding decisions
- **Horse listings** by breed

### 9. `ping.js` - Health Check

**Base Path:** `/ping`

**Purpose:** Simple connectivity and health checking

**Function:**
- Basic server responsiveness test
- Optional name parameter for testing
- Minimal overhead for monitoring

## Common Route Patterns

### 1. Validation Middleware

Standard validation pattern used across all routes:
```javascript
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};
```

### 2. Error Handling

Consistent error handling with environment-aware responses:
```javascript
catch (error) {
  logger.error(`[route] Error: ${error.message}`);
  res.status(500).json({
    success: false,
    message: 'Operation failed',
    error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
  });
}
```

### 3. Response Standardization

Uniform response format across all endpoints:
```javascript
// Success response
res.json({
  success: true,
  data: result,
  message: 'Operation successful'
});

// Error response
res.status(400).json({
  success: false,
  message: 'Operation failed',
  errors: validationErrors
});
```

### 4. Logging

Comprehensive logging for debugging and monitoring:
```javascript
logger.info(`[route] Starting operation with params: ${JSON.stringify(params)}`);
logger.warn(`[route] Validation warning: ${warning}`);
logger.error(`[route] Operation failed: ${error.message}`);
```

## Security & Validation

### 1. Input Validation

**Express-validator integration:**
- Type checking (integer, string, email, etc.)
- Length restrictions and format validation
- Custom validation rules for business logic
- Sanitization for XSS prevention

**Common validation patterns:**
```javascript
// ID validation
param('id').isInt({ min: 1 }).withMessage('ID must be positive integer')

// Email validation
body('email').isEmail().normalizeEmail().withMessage('Valid email required')

// String validation
body('name').isLength({ min: 1, max: 50 }).withMessage('Name must be 1-50 characters')
```

### 2. Authentication Middleware

**JWT-based authentication:**
- Token validation on protected routes
- Role-based access control
- Session management with refresh tokens
- Comprehensive audit logging

### 3. Rate Limiting

**Protection against abuse:**
- Request rate limiting per IP/user
- Endpoint-specific limits
- Escalating penalties for violations
- Monitoring and alerting

### 4. CORS Configuration

**Cross-origin request handling:**
- Configured allowed origins
- Proper header management
- Preflight request handling
- Security header implementation

## Performance Optimization

### 1. Route Organization

**Efficient routing:**
- Modular route files by domain
- Middleware reuse across routes
- Optimized route matching
- Minimal overhead per request

### 2. Validation Efficiency

**Optimized validation:**
- Early validation failure detection
- Cached validation rules
- Minimal validation overhead
- Efficient error aggregation

### 3. Response Compression

**Data transfer optimization:**
- JSON response compression
- Efficient serialization
- Minimal response payloads
- Proper HTTP caching headers

## Testing Integration

### 1. Route Testing

**Comprehensive endpoint testing:**
- Supertest integration for API testing
- Mock middleware for unit testing
- Integration tests with real database
- Performance testing for critical routes

### 2. Validation Testing

**Input validation verification:**
- Valid input acceptance testing
- Invalid input rejection testing
- Edge case boundary testing
- Security vulnerability testing

### 3. Error Handling Testing

**Error scenario coverage:**
- Database connection failures
- Validation error responses
- Authentication failures
- Authorization denials

## Documentation & Maintenance

### 1. API Documentation

**Comprehensive endpoint documentation:**
- Request/response schemas
- Example payloads and responses
- Error code explanations
- Authentication requirements

### 2. Version Management

**API versioning strategy:**
- Backward compatibility maintenance
- Deprecation notices for old endpoints
- Migration guides for version changes
- Version-specific route handling

### 3. Monitoring & Analytics

**Route performance tracking:**
- Response time monitoring
- Error rate tracking
- Usage analytics by endpoint
- Performance bottleneck identification

The routes layer provides a robust, secure, and well-documented API that serves as the primary interface for all client interactions with the Equoria game backend, with excellent maintainability and scalability characteristics. 