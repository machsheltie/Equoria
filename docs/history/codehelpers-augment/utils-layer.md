# Utils Layer - Utility Functions & Game Mechanics

## Overview

The utils layer contains specialized utility functions that implement core game mechanics, data processing, and common functionality used throughout the Equoria application.

## Core Game Mechanics

### 1. `statMap.js` - Discipline Statistics System

**Purpose:** Defines the relationship between horse statistics and competition disciplines

**Core Data Structure:**
```javascript
const statMap = {
  "Racing": ["speed", "stamina", "focus"],           // Primary, Secondary, Tertiary
  "Show Jumping": ["balance", "agility", "boldness"],
  "Dressage": ["precision", "focus", "obedience"],
  // ... 23 total disciplines
};
```

**Key Functions:**
- `getStatsForDiscipline(discipline)` - Returns [primary, secondary, tertiary] stats
- `getAllDisciplines()` - Lists all available competition disciplines
- `getAllStatCategories()` - Returns unique stat categories (10 total stats)
- `isDisciplineValid(discipline)` - Validates discipline names

**Stat Categories:** speed, stamina, agility, balance, precision, intelligence, boldness, flexibility, obedience, focus

**Weighting System:**
- Primary stat: 50% importance
- Secondary stat: 30% importance  
- Tertiary stat: 20% importance

### 2. `traitDiscovery.js` - Trait Revelation System

**Purpose:** Implements progressive trait discovery mechanics for foal development

**Discovery Conditions:**
- **High Bonding** (bonding score ≥ 80): Reveals intelligence and calm traits
- **Low Stress** (stress ≤ 20): Reveals resilience and athletic traits
- **Social Activities** (3+ activities): Reveals calm and trainability traits
- **Physical Activities** (3+ activities): Reveals athletic and bold traits
- **Mental Activities** (3+ activities): Reveals intelligence and special traits
- **Perfect Care** (bonding ≥ 90 + stress ≤ 15): Reveals legendary traits
- **Development Complete** (day 6): Reveals all remaining hidden traits

**Core Functions:**
- `revealTraits(foalId)` - Checks conditions and reveals appropriate traits
- `batchRevealTraits(foalIds)` - Processes multiple foals efficiently
- `getDiscoveryProgress(foalId)` - Returns progress toward revelation conditions

**Trait Categories:**
- **Positive Traits:** Athletic, intelligent, calm, resilient, bold
- **Negative Traits:** Timid, aggressive, sickly, stubborn
- **Hidden Traits:** Start hidden and are revealed through gameplay

### 3. `traitEvaluation.js` - Trait Impact System

**Purpose:** Calculates the statistical impact of traits on horse performance

**Trait Definitions:**
- **Statistical Modifiers:** Direct stat bonuses/penalties
- **Special Abilities:** Unique effects like weather immunity
- **Performance Multipliers:** Scaling factors for competitions
- **Breeding Benefits:** Enhanced genetics for offspring

**Core Functions:**
- `evaluateTraits(traitArray)` - Calculates cumulative trait effects
- `getTraitModifiers(traits)` - Returns stat modification values
- `calculateTraitScore(traits)` - Quantifies overall trait value

### 4. `epigeneticTraits.js` - Advanced Genetics System

**Purpose:** Implements complex trait inheritance and environmental influences

**Key Features:**
- **Environmental Modifiers:** Trait expression based on conditions
- **Inheritance Patterns:** Complex genetic trait passing
- **Mutation System:** Random trait variations
- **Expression Levels:** Variable trait strength

**Core Functions:**
- `calculateEpigeneticEffects(genetics, environment)` - Environmental trait modification
- `inheritTraits(parent1, parent2)` - Genetic trait inheritance logic
- `applyMutations(traits)` - Random genetic variations

## Competition & Scoring

### 5. `simulateCompetition.js` - Competition Engine

**Purpose:** Realistic competition simulation with stat-based scoring

**Scoring Algorithm:**
1. **Base Performance:** Calculated from discipline-relevant stats
2. **Trait Modifiers:** Applied from horse's trait profile
3. **Randomization:** ±15% variance for realism
4. **Final Score:** Normalized to 0-100 range

**Key Features:**
- **Multi-horse competitions** with realistic ranking
- **Discipline-specific scoring** using statMap weights
- **Trait integration** for enhanced realism
- **Performance variance** preventing predictable outcomes

### 6. `competitionRewards.js` - Prize Distribution

**Purpose:** Manages competition prizes and user rewards

**Reward Types:**
- **Money Prizes:** Based on placement and show tier
- **Experience Points:** For horse and user progression
- **Reputation:** Long-term user standing
- **Special Items:** Rare rewards for exceptional performance

### 7. `isHorseEligible.js` - Competition Eligibility

**Purpose:** Validates horse eligibility for competition entry

**Eligibility Checks:**
- **Age Requirements:** 3-20 years for competition
- **Level Requirements:** Must meet show's min/max level
- **Discipline Restrictions:** Some shows limit disciplines
- **Previous Entries:** Prevents duplicate show participation

**Core Functions:**
- `isHorseEligibleForShow(horse, show, previousEntries)` - Boolean eligibility
- `getEligibilityDetails(horse, show, previousEntries)` - Detailed reason reporting

## Training System Utilities

### 8. `trainingCooldown.js` - Training Restriction System

**Purpose:** Manages training cooldowns and eligibility

**Cooldown Logic:**
- **Global Cooldown:** 7 days between any training sessions
- **Age Restrictions:** Minimum 3 years for training
- **Time Calculations:** Precise millisecond-based cooldown tracking

**Core Functions:**
- `canTrain(horse)` - Boolean training eligibility
- `getCooldownTimeRemaining(horse)` - Milliseconds until eligible
- `setCooldown(horseId)` - Sets 7-day cooldown after training
- `formatCooldown(milliseconds)` - Human-readable time formatting

### 9. `getStatScore.js` - Performance Calculation

**Purpose:** Calculates performance scores for horses in specific disciplines

**Calculation Method:**
- Retrieves discipline stat weights from statMap
- Applies weighted average of horse's relevant stats
- Includes trait modifiers and bonuses
- Returns normalized performance score

## Data Generation & Testing

### 10. `generateMockShows.js` - Test Data Generation

**Purpose:** Creates realistic test shows for development and testing

**Show Generation Features:**
- **Realistic Names:** "{Season} {Adjective} - {Discipline}" format
- **Level Constraints:** Proper min/max level relationships
- **Financial Balance:** Entry fees 100-500, prizes 500-2000
- **Date Scheduling:** ±30 days from current date
- **Discipline Integration:** Uses getAllDisciplines() for consistency

**Core Functions:**
- `generateMockShows(count)` - Creates array of realistic shows
- `generateSingleMockShow(overrides)` - Single show with custom properties

## System Utilities

### 11. `apiResponse.js` - Standardized API Responses

**Purpose:** Consistent API response formatting across all endpoints

**Response Types:**
- **Success Responses:** Uniform success format with data
- **Error Responses:** Standardized error structure
- **Validation Errors:** Detailed validation failure information
- **HTTP Status Codes:** Proper status code management

**Core Functions:**
- `ApiResponse.success(message, data)` - Success response wrapper
- `ApiResponse.error(message, errors)` - Error response wrapper
- `ApiResponse.badRequest(message, errors)` - 400 error responses
- `ApiResponse.unauthorized(message)` - 401 authentication errors
- `ApiResponse.serverError(message)` - 500 internal errors

### 12. `logger.js` - Logging System

**Purpose:** Centralized logging for debugging and monitoring

**Log Levels:**
- **Info:** General operational information
- **Warn:** Warning conditions that need attention
- **Error:** Error conditions that require investigation
- **Debug:** Detailed debugging information

### 13. `healthCheck.js` - System Monitoring

**Purpose:** Comprehensive system health monitoring

**Health Checks:**
- **Database Connectivity:** PostgreSQL connection status
- **Memory Usage:** Application memory consumption
- **API Response Times:** Endpoint performance monitoring
- **Error Rates:** System stability indicators

### 14. `securityValidation.js` - Security Utilities

**Purpose:** Input validation and security enforcement

**Security Features:**
- **Input Sanitization:** XSS prevention and data cleaning
- **Validation Rules:** Comprehensive input validation
- **Rate Limiting:** API abuse prevention
- **Authentication Helpers:** JWT and session validation

## User & Game Management

### 15. `userUpdates.js` - User Progession

**Purpose:** Manages user advancement and rewards

**Update Types:**
- **Experience Points:** Training and competition XP
- **Level Progression:** Automatic level-up calculations
- **Money Management:** Prize distribution and spending
- **Achievement Tracking:** Progress toward milestones

### 16. `horseUpdates.js` - Horse Development

**Purpose:** Manages horse stat progression and development

**Update Categories:**
- **Stat Improvements:** Training-based stat increases
- **Age Progression:** Automatic aging and maturation
- **Health Management:** Injury and recovery systems
- **Breeding Readiness:** Maturity and eligibility tracking

## Performance & Optimization

### 17. Common Optimization Patterns

**Caching Strategies:**
- **Static Data Caching:** Stat maps and trait definitions
- **Query Optimization:** Efficient database access patterns
- **Memory Management:** Optimized data structures

**Error Handling:**
- **Graceful Degradation:** System continues despite individual failures
- **Comprehensive Logging:** Detailed error tracking and reporting
- **Input Validation:** Prevents invalid data from causing issues

**Testing Support:**
- **Mock Data Generation:** Realistic test data creation
- **Test Utilities:** Helper functions for testing scenarios
- **Validation Helpers:** Input verification and error checking

## Integration Patterns

### 18. Cross-System Integration

**Model Integration:** Utils seamlessly integrate with models layer for data access

**Controller Support:** Business logic controllers rely heavily on util functions

**API Consistency:** Standardized responses and validation across all endpoints

**Game Balance:** Statistical calculations ensure fair and engaging gameplay

The utils layer provides the essential building blocks that enable all game mechanics to function cohesively, with excellent performance, reliability, and maintainability characteristics that support the complex simulation requirements of Equoria. 