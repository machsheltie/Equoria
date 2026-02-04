# Models Layer - Data Access Layer

## Overview

The models layer provides a comprehensive data access abstraction for the Equoria project. All database operations are centralized through model functions that provide validation, error handling, and consistent interfaces.

## Model Files

### 1. `horseModel.js` - Horse Data Management

**Core Functions:**
- `createHorse(horseData)` - Creates new horse with breed relationships
- `getHorseById(id)` - Retrieves horse with full relations
- `updateDisciplineScore(horseId, discipline, pointsToAdd)` - Updates training scores
- `incrementDisciplineScore(horseId, discipline)` - Adds +5 to discipline (training)
- `getDisciplineScores(horseId)` - Retrieves current training progress

**Key Features:**
- **Breed relationship handling** with multiple input formats
- **JSONB discipline scores** for flexible training data
- **Comprehensive validation** for all required fields
- **Full relation loading** (breed, owner, stable, user)
- **Error handling** with descriptive messages

**Test Coverage:** 32 tests covering CRUD operations, validation, and edge cases

### 2. `userModel.js` - User Account Management

**Core Functions:**
- `createUser(userData)` - Creates new user accounts
- `getUserById(id)` - Retrieves user by UUID
- `getUserByEmail(email)` - Email-based user lookup
- `getUserWithHorses(id)` - User with horse collection
- `updateUser(id, updateData)` - User progression updates
- `deleteUser(id)` - Account deletion

**Key Features:**
- **UUID primary keys** for security and scalability
- **Email validation** with uniqueness constraints
- **Business rule validation** (money >= 0, level >= 1, xp >= 0)
- **JSON settings field** for flexible configuration
- **Horse relationship loading** with breed and stable data

**Test Coverage:** 27 tests covering all CRUD operations and validation scenarios

### 3. `foalModel.js` - Breeding and Foal Management

**Core Functions:**
- `createFoal(foalData)` - Creates new foal from breeding
- `getFoalById(foalId)` - Retrieves foal with parents and traits
- `updateFoalTraits(foalId, newTraits)` - Updates discovered traits
- `deleteFoal(foalId)` - Removes foal (age-out or other reasons)

**Key Features:**
- **Parent relationship tracking** for lineage
- **Complex genetics handling** with JSONB storage
- **Trait discovery integration** for gameplay progression
- **Breeding validation** ensuring proper parentage
- **Comprehensive error handling** for breeding failures

**Test Coverage:** Extensive tests covering breeding mechanics and trait management

### 4. `trainingModel.js` - Training System Support

**Core Functions:**
- `logTrainingSession({ horseId, discipline })` - Records training events
- `getLastTrainingDate(horseId, discipline)` - Discipline-specific history
- `getAnyRecentTraining(horseId)` - Global cooldown checking
- `getHorseAge(horseId)` - Age validation for training eligibility

**Key Features:**
- **Training history logging** for cooldown enforcement
- **Global cooldown system** (one discipline per week)
- **Age-based restrictions** (3+ years for training)
- **Discipline-specific tracking** for UI and analytics
- **Performance optimization** for frequent queries

**Test Coverage:** Comprehensive tests covering training workflows and cooldown logic

### 5. `resultModel.js` - Competition Results

**Core Functions:**
- `saveResult(resultData)` - Records competition outcomes
- `getResultsByHorse(horseId)` - Horse performance history
- `getResultsByShow(showId)` - Show leaderboards
- `getResultById(resultId)` - Individual result details

**Key Features:**
- **Competition result tracking** with scores and placements
- **Leaderboard generation** for show results
- **Performance history** for horse profiles
- **Relationship loading** with horse and show data
- **Placement logic** for podium positions (1st, 2nd, 3rd)

**Test Coverage:** 23 tests covering result recording and retrieval scenarios

### 6. `userModel.js` - Legacy User System

**Purpose:** Maintains backward compatibility with existing user system while transitioning to user-based architecture.

**Status:** Being phased out in favor of `userModel.js`

## Common Patterns

### 1. Input Validation
All model functions include comprehensive input validation:
```javascript
// Example pattern used across all models
if (!requiredField) {
  throw new Error('Descriptive error message with field name');
}
```

### 2. Error Handling
Consistent error handling with descriptive messages:
```javascript
try {
  // Database operation
} catch (error) {
  throw new Error(`Operation failed: ${error.message}`);
}
```

### 3. Relationship Loading
Strategic use of Prisma's `include` for efficient data loading:
```javascript
include: {
  breed: true,
  owner: true,
  stable: true,
  user: true
}
```

### 4. JSONB Field Management
Specialized handling for flexible JSON data:
```javascript
// Discipline scores, genetics, traits stored as JSONB
disciplineScores: updatedScores || {}
```

## Database Schema Integration

The models layer abstracts the following database tables:
- **horses** - Core horse data with relationships
- **users** - User accounts and progression
- **foals** - Breeding outcomes and genetics
- **training_logs** - Training history and cooldowns
- **competition_results** - Competition outcomes and rankings
- **users** - Legacy user system (being phased out)

## Performance Considerations

### 1. Query Optimization
- **Selective relationship loading** based on use case
- **Indexed fields** for frequent queries (IDs, emails, names)
- **Efficient JSONB queries** for complex data

### 2. Connection Management
- **Prisma connection pooling** for optimal performance
- **Transaction support** for complex operations
- **Proper connection cleanup** in all functions

### 3. Caching Strategy
- **Model-level caching** for frequently accessed data
- **Invalidation patterns** for data consistency
- **Memory-efficient queries** for large datasets

## Testing Strategy

### 1. Test Organization
Each model has comprehensive test coverage:
- **Unit tests** for individual functions
- **Integration tests** for complex workflows
- **Validation tests** for input checking
- **Error handling tests** for failure scenarios

### 2. Test Database
- **Separate test environment** (`.env.test`)
- **Isolated test data** preventing interference
- **Cleanup procedures** for test independence
- **Mock data generators** for consistent testing

### 3. Coverage Metrics
- **100% function coverage** across all models
- **Edge case testing** for boundary conditions
- **Error path validation** for robustness
- **Performance testing** for critical operations

## Future Enhancements

### 1. Planned Improvements
- **Caching layer** for frequently accessed data
- **Audit logging** for all data changes
- **Soft delete patterns** for data preservation
- **Version control** for critical game data

### 2. Scalability Considerations
- **Read replica support** for query distribution
- **Sharding strategies** for large datasets
- **Connection pool optimization** for high load
- **Query performance monitoring**

The models layer provides a robust, well-tested foundation for all data operations in the Equoria game, with excellent maintainability and performance characteristics. 