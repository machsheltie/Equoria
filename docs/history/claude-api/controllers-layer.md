# Controllers Layer - Business Logic Layer

## Overview

The controllers layer implements the core business logic for the Equoria game. Controllers handle API requests, orchestrate interactions between models and services, and ensure proper validation and error handling.

## Controller Files

### 1. `trainingController.js` - Training System Logic

**Core Functions:**
- `canTrain(horseId, discipline)` - Eligibility validation with age and cooldown checks
- `trainHorse(horseId, discipline)` - Complete training workflow execution
- `getTrainingStatus(horseId, discipline)` - Detailed status reporting
- `getTrainableHorses(userId)` - Filtered horse list for UI
- `trainRouteHandler(req, res)` - REST API endpoint handler

**Business Rules:**
- **Age Requirement:** Horses must be 3+ years old
- **Global Cooldown:** One discipline per week limit (7 days)
- **Score Progression:** +5 points per training session
- **Validation:** Comprehensive input validation and error handling

**Key Features:**
- **Global cooldown system** prevents discipline hopping
- **Comprehensive logging** for debugging and monitoring
- **Detailed error messages** for UI feedback
- **Performance optimization** for frequent queries

**Test Coverage:** 38 tests covering all training workflows and edge cases

### 2. `authController.js` - Authentication & Authorization

**Core Functions:**
- `register(req, res)` - New user account creation
- `login(req, res)` - User authentication with JWT
- `refreshToken(req, res)` - Token refresh mechanism
- `logout(req, res)` - Session termination
- `getProfile(req, res)` - User profile retrieval

**Security Features:**
- **bcrypt password hashing** with configurable salt rounds
- **JWT token generation** with role-based claims
- **Account status validation** (active/disabled users)
- **Refresh token system** for extended sessions
- **Rate limiting protection** against brute force attacks

**Key Features:**
- **Role-based access control** (user, admin, moderator)
- **Token fingerprinting** for additional security
- **Comprehensive audit logging** for security events
- **Input validation** with express-validator
- **Standardized API responses** using ApiResponse utility

**Test Coverage:** Multiple test suites covering authentication flows

### 3. `competitionController.js` - Competition Management

**Core Functions:**
- `enterAndRunShow(horseIds, show)` - Complete competition workflow
- `simulateCompetition(horses, show)` - Competition scoring logic
- `calculateResults(horses, scores)` - Result ranking and placement

**Business Logic:**
- **Eligibility validation** using `isHorseEligibleForShow()`
- **Duplicate prevention** checking existing results
- **Automatic placement** assignment (1st, 2nd, 3rd)
- **Performance scoring** based on stats and randomization

**Key Features:**
- **Multi-horse entry** with batch processing
- **Graceful error handling** continues with valid entries
- **Result persistence** in competition_results table
- **Summary statistics** for entry success/failure rates
- **Integration** with horse, show, and result models

**Test Coverage:** 10 comprehensive tests covering competition workflows

### 4. `horseController.js` - Horse Management

**Core Functions:**
- Basic CRUD operations for horse entities
- Horse profile retrieval with relationships
- Horse status and statistics queries

**Features:**
- **Relationship loading** (breed, owner, stable, user)
- **Validation** for horse data integrity
- **Error handling** for missing or invalid horses

### 5. `breedController.js` - Breed Management

**Core Functions:**
- Breed listing and filtering
- Breed statistics and characteristics
- Breed validation for horse creation

**Features:**
- **Comprehensive breed data** with genetics information
- **Search and filtering** capabilities
- **Validation** for breeding operations

### 6. `pingController.js` - Health Check

**Purpose:** Simple health check endpoint for monitoring and testing

**Function:**
- `handlePing(req, res)` - Basic connectivity test with optional name parameter

## Common Patterns

### 1. Input Validation
All controllers use express-validator for comprehensive input validation:
```javascript
// Standard validation pattern
const errors = validationResult(req);
if (!errors.isEmpty()) {
  return res.status(400).json(ApiResponse.badRequest('Validation failed', {
    errors: errors.array()
  }));
}
```

### 2. Error Handling
Consistent error handling with proper logging:
```javascript
try {
  // Business logic
} catch (error) {
  logger.error('[controller] Operation failed:', error);
  return res.status(500).json(ApiResponse.serverError('Operation failed'));
}
```

### 3. Response Standardization
Uniform API responses using ApiResponse utility:
```javascript
// Success response
return res.status(200).json(ApiResponse.success('Operation successful', data));

// Error response
return res.status(400).json(ApiResponse.badRequest('Invalid input', errors));
```

### 4. Logging
Comprehensive logging for debugging and monitoring:
```javascript
logger.info(`[controller] Starting operation for user ${userId}`);
logger.warn(`[controller] Validation failed: ${error.message}`);
logger.error(`[controller] Critical error: ${error.message}`);
```

## Business Logic Patterns

### 1. Multi-Step Workflows
Complex operations broken into clear steps:
```javascript
// Example: Training workflow
// 1. Validate eligibility
// 2. Log training session
// 3. Update discipline scores
// 4. Calculate next eligible date
// 5. Return comprehensive result
```

### 2. Eligibility Checking
Consistent eligibility validation across systems:
- Age requirements
- Cooldown periods
- Status validation
- Resource availability

### 3. Data Orchestration
Controllers coordinate between multiple models:
- Fetch related data
- Validate relationships
- Perform calculations
- Update multiple entities
- Maintain data consistency

### 4. Result Aggregation
Complex data assembly for UI consumption:
- Join related entities
- Calculate derived values
- Format for presentation
- Include metadata

## Security Considerations

### 1. Authentication
- **JWT-based authentication** with secure token generation
- **Role-based authorization** for different user types
- **Session management** with refresh token support
- **Account status validation** preventing disabled user access

### 2. Input Validation
- **Comprehensive validation** on all inputs
- **Type checking** and format validation
- **Business rule validation** for game logic
- **SQL injection prevention** via Prisma ORM

### 3. Error Handling
- **Secure error messages** avoiding information disclosure
- **Proper HTTP status codes** for different scenarios
- **Audit logging** for security-relevant events
- **Rate limiting** protection against abuse

### 4. Data Protection
- **Password hashing** with bcrypt and salt
- **Sensitive data filtering** in responses
- **Access control** based on ownership and roles
- **Input sanitization** for XSS prevention

## Performance Optimization

### 1. Database Queries
- **Efficient relationship loading** with Prisma include
- **Selective field retrieval** to minimize data transfer
- **Query optimization** for frequently accessed data
- **Connection pooling** for optimal performance

### 2. Caching Strategy
- **Model-level caching** for static data
- **Result caching** for expensive operations
- **Session caching** for user data
- **Invalidation patterns** for data consistency

### 3. Async Operations
- **Promise-based operations** for non-blocking I/O
- **Parallel processing** where possible
- **Error handling** for async operations
- **Timeout management** for long-running operations

## Testing Strategy

### 1. Unit Testing
- **Individual function testing** with mocked dependencies
- **Business logic validation** with various scenarios
- **Error handling testing** for failure conditions
- **Edge case coverage** for boundary conditions

### 2. Integration Testing
- **End-to-end workflow testing** with real database
- **API endpoint testing** with supertest
- **Multi-system interaction testing**
- **Performance testing** for critical operations

### 3. Security Testing
- **Authentication flow testing**
- **Authorization validation testing**
- **Input validation testing**
- **Error handling security testing**

## Future Enhancements

### 1. Planned Features
- **Caching middleware** for performance improvement
- **Rate limiting** per user and endpoint
- **Audit logging** for all data changes
- **Webhook support** for external integrations

### 2. Scalability Improvements
- **Horizontal scaling** patterns
- **Load balancing** considerations
- **Database optimization** for high load
- **Microservice architecture** preparation

The controllers layer provides robust, secure, and well-tested business logic that forms the backbone of the Equoria game's functionality, with excellent maintainability and extensibility characteristics. 