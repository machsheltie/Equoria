# 🧬 Epigenetic Flag System - Complete Implementation

## 🎯 Overview

The Epigenetic Flag System is a comprehensive behavioral trait system that evaluates foal care patterns during the critical 0-3 year development window and assigns permanent behavioral flags that influence horse performance throughout their lifetime.

## 📋 Implementation Summary

### ✅ COMPLETED COMPONENTS

#### 1. **Flag Definitions System** (`config/epigeneticFlagDefinitions.mjs`)

- **9 Starter Flags**: 4 positive, 5 negative behavioral flags
- **Complete Configuration**: Name, display name, description, type, source category
- **Trait Weight Modifiers**: Influence on trait generation probabilities
- **Behavior Modifiers**: Competition, training, bonding, and stress modifiers
- **Trigger Conditions**: Complex pattern matching for flag assignment

#### 2. **Care Pattern Analysis** (`utils/carePatternAnalysis.mjs`)

- **Comprehensive Analysis**: Evaluates 7 days of groom interaction history
- **Pattern Detection**: Consistent care, novelty exposure, stress management, bonding, neglect
- **Environmental Factors**: Startle events, routine interactions, environmental changes
- **Age Eligibility**: 0-3 years evaluation window with precise age calculations
- **Integration**: Works with existing GroomInteraction system

#### 3. **Flag Evaluation Engine** (`utils/flagEvaluationEngine.mjs`)

- **Weekly Evaluation**: Automated flag assignment based on care patterns
- **Trigger Matching**: Complex condition evaluation against care history
- **Business Rules**: 5 flag limit, no overwrites, age restrictions
- **Batch Processing**: Admin tools for bulk evaluation
- **Performance Optimized**: Efficient database queries with JavaScript filtering

#### 4. **API Endpoints** (`routes/epigeneticFlagRoutes.mjs`)

- **POST /api/flags/evaluate**: Individual horse flag evaluation
- **GET /api/flags/horses/:id/flags**: Retrieve horse flags with details
- **GET /api/flags/definitions**: Flag definition reference
- **POST /api/flags/batch-evaluate**: Admin bulk evaluation
- **GET /api/flags/horses/:id/care-patterns**: Care pattern analysis
- **GET /api/flags/health**: System health check

#### 5. **Controller Logic** (`controllers/epigeneticFlagController.mjs`)

- **Complete Business Logic**: Validation, authorization, error handling
- **Authentication Integration**: User ownership validation and admin controls
- **Comprehensive Responses**: Detailed flag information and evaluation results
- **Error Management**: Professional error handling with logging

#### 6. **Flag Influence System** (`utils/epigeneticFlagInfluence.mjs`)

- **Trait Weight Modification**: Applies flag influences to trait generation
- **Competition Performance**: Modifies competition scores based on flags
- **Training Efficiency**: Affects training effectiveness and bonding
- **Behavior Aggregation**: Stacks multiple flag influences
- **Summary Generation**: Complete flag influence reporting

#### 7. **Comprehensive Testing** (78 passing tests)

- **Unit Tests**: 4 test suites with balanced mocking approach
- **Business Logic Validation**: Real functionality testing over artificial mocks
- **Edge Case Coverage**: Error handling, validation, and boundary conditions
- **Integration Ready**: Tests validate real system interactions

## 🎮 Game Mechanics

### Flag Types and Effects

#### **Positive Flags** (4 flags)

1. **Brave**: +Bold, +Confident, -Spooky, stress resistance, stat recovery bonus
2. **Confident**: +Bold, -Timid, competition bonus, training efficiency
3. **Affectionate**: +Bonding rate, +Groom effectiveness, social bonding
4. **Resilient**: +Hardy, -Fragile, +Steady, stress recovery, health bonus

#### **Negative Flags** (5 flags)

1. **Fearful**: +Spooky, +Timid, -Bold, stress vulnerability, competition penalty
2. **Aloof**: -Bonding rate, social resistance, independence
3. **Fragile**: +Fragile, -Hardy, stress vulnerability, health penalty
4. **Skittish**: +Spooky, -Steady, startle sensitivity, environmental reactivity
5. **Insecure**: +Timid, -Confident, bonding resistance, stress vulnerability

### Evaluation Process

1. **Age Window**: Flags evaluated weekly from birth to 3 years
2. **Care History**: Analyzes last 7 days of groom interactions
3. **Pattern Matching**: Complex trigger conditions based on care quality and consistency
4. **Flag Assignment**: Permanent flags assigned when conditions are met
5. **Influence Application**: Flags modify trait weights and behavior throughout horse's life

### Business Rules

- **Maximum 5 flags per horse** to maintain gameplay clarity
- **No flag overwrites** - once assigned, flags are permanent
- **Age restrictions** - evaluation only during 0-3 year window
- **Owner permissions** - only horse owners can trigger evaluations
- **Admin controls** - batch evaluation and system management tools

## 🔧 Technical Implementation

### Database Integration

- **Existing Schema**: Uses existing `epigenetic_flags` field in horses table
- **No Schema Changes**: Leverages current GroomInteraction system
- **Optimized Queries**: Efficient database operations with proper indexing

### API Security

- **JWT Authentication**: Full authentication and authorization
- **Ownership Validation**: Users can only evaluate their own horses
- **Admin Controls**: Special permissions for batch operations
- **Input Validation**: Comprehensive request validation with express-validator

### Performance Features

- **Efficient Queries**: Optimized database operations
- **JavaScript Filtering**: Complex array operations for flag limits
- **Caching Ready**: Flag definitions cached for performance
- **Batch Operations**: Admin tools for bulk processing

### Error Handling

- **Comprehensive Logging**: Winston logger integration throughout
- **Professional Responses**: Standardized error messages and status codes
- **Graceful Degradation**: System continues operating on partial failures
- **Audit Trail**: Complete logging of all flag evaluation activities

## 📊 Testing Results

### Test Coverage: 78 Tests Passing (100% Success Rate)

- **Flag Definitions**: 26 tests - Configuration validation and flag properties
- **Care Pattern Analysis**: 12 tests - Pattern detection and age eligibility
- **Flag Evaluation Engine**: 14 tests - Trigger matching and business logic
- **Flag Influence System**: 26 tests - Trait modification and behavior effects

### Testing Philosophy: Balanced Mocking

- **Strategic Mocking**: Only mock external dependencies (database, logger)
- **Real Logic Testing**: Test actual business logic and calculations
- **Integration Validation**: Verify real system interactions
- **Edge Case Coverage**: Comprehensive error and boundary testing

## 🚀 Integration Points

### Existing Systems

- **GroomInteraction System**: Primary data source for care patterns
- **Trait Discovery**: Flag influences applied to trait generation
- **Competition System**: Flag modifiers affect performance scores
- **Training System**: Flag influences training efficiency and bonding
- **User Authentication**: Full integration with existing auth system
- **Parent → Foal Flag Inheritance (Predisposition)** — see below.

### Parent → Foal Flag Inheritance — PREDISPOSITION model (Equoria-yzqhj.4)

Foals are **NOT** born with inherited epigenetic flags. Behavioral flags still
come ONLY from the 0-3yr care evaluation (`evaluateHorseFlags`). What a parent
passes down is a _predisposition_: a flag present in **either** parent (the
**union** of sire + dam `epigeneticFlags`) biases the foal's care-evaluation so
that the **same** care pattern is slightly more likely to trigger that one flag.
Predisposition never auto-grants a flag — care must still drive it; the
predisposition only nudges a borderline pattern over the line.

- **Single inheritance path / no schema change.** No `Horse` column and no
  birth-time snapshot are added. The predisposition is derived **live** at
  flag-evaluation time by loading the foal's sire + dam (`Horse.sireId` /
  `damId`) and reading their `epigeneticFlags`. A parentless foal (or one whose
  parents have no flags) yields an empty predisposition set and behaves exactly
  as before (regression-safe). This is intentionally distinct from the at-birth
  genetic _trait_ inheritance (Equoria-9o3n7) — that writes traits at birth;
  this biases the behavioral _flag_ array at the 0-3yr evaluation. They do not
  share a code path.
- **Bias mechanism + magnitude.** A single named constant,
  `FLAG_PREDISPOSITION_BIAS = 0.85` (in
  `backend/utils/flagEvaluationEngine.mjs`), relaxes the **numeric** care
  thresholds for a predisposed flag by 15%: `>=` minimums are multiplied by 0.85
  (`relaxMin`) and `<=`/`<` ceilings are widened by `/ 0.85` (`relaxMax`). The
  magnitude is deliberately conservative — enough to tip a just-below-threshold
  care pattern, not enough to manufacture a flag from inadequate care.
- **Scope.** Only the predisposed flag's thresholds are relaxed; all other
  flags are evaluated with unchanged thresholds for the same foal.
- **Tests (real DB, no mocks):**
  `backend/modules/traits/__tests__/flagPredispositionInheritance.integration.test.mjs`
  — a predisposed foal and a control foal receive an identical borderline 6-day
  `affectionate` care pattern; the predisposed foal develops the flag, the
  control does not, and a parentless foal is proven unaffected.

### Temporary / Environment-Triggered Flags (Equoria-yzqhj.5 — IMPLEMENTED)

Permanent epigenetic flags (`Horse.epigeneticFlags`, a `String[]`) are assigned
once and never expire. Temporary flags are a SEPARATE, expiring layer for
short-lived behavioral states caused by discrete environmental events.

- **Storage (additive — never the permanent String[]):** a new JSONB column
  `Horse.temporaryEpigeneticFlags` (migration
  `20260527120000_add_temporary_epigenetic_flags`, default `[]`). Each entry is
  `{ flag: string, expiresAt: ISO-string, source: string }`. The permanent
  `epigeneticFlags` column is untouched; a temporary flag never duplicates a
  permanent flag's semantics — temporary flags live ONLY in the new column.
- **Initial catalog (minimal, extensible — `backend/services/temporaryFlagSystem.mjs`,
  `TEMPORARY_FLAG_DURATION_DAYS`):**
  - `startled` — triggered by a startle environmental event; expires after **3 days**.
  - `unsettled` — triggered by a routine-change / care-gap event; expires after **5 days**.
    Adding a new temporary flag is a one-line addition to that constant.
- **Trigger:** `applyTemporaryFlag(horseId, flag, { source })` stamps
  `expiresAt = now + DURATION_DAYS[flag]` and pushes the entry (dedup: re-applying
  an active flag REFRESHES `expiresAt` instead of duplicating). A real
  environmental event calls it via
  `environmentalTriggerSystem.applyEnvironmentalEventFlag(horseId, eventType)`
  (`startle` → `startled`, `routine_change` → `unsettled`).
- **Daily expiry sweep:** the `temporaryFlagExpiry` cron job
  (`backend/services/cronJobs.mjs`, **00:20 UTC daily**) calls
  `sweepExpiredTemporaryFlags()`, which does a SCOPED read of only horses with a
  non-empty temp array and removes entries whose `expiresAt < now` (still-future
  entries are retained). Surfaced by `/api/admin/cron/health`.
- **Tests (real DB, no mocks):**
  `backend/modules/traits/__tests__/temporaryFlagSystem.integration.test.mjs` —
  set (env event → future-dated flag), dedup (refresh not duplicate), and a
  sentinel sweep (only expired flags removed; future flags on the same and
  another horse retained).

### Future Extensions

- **Competition Integration**: Enhanced AI rider compatibility
- **Advanced Analytics**: Detailed flag influence reporting and statistics

## 📈 Business Value

### Gameplay Enhancement

- **Deeper Strategy**: Long-term consequences for foal care decisions
- **Meaningful Choices**: Care quality directly impacts horse development
- **Progression Depth**: Multiple layers of horse development and optimization
- **Replayability**: Different care strategies lead to different outcomes

### Technical Excellence

- **Production Ready**: Professional code quality with comprehensive testing
- **Scalable Architecture**: Designed for growth and feature expansion
- **Maintainable Code**: Clean, documented, and well-structured implementation
- **Performance Optimized**: Efficient operations suitable for production use

## 🎉 Implementation Status: COMPLETE

The Epigenetic Flag System is fully implemented, tested, and ready for production deployment. All core features are functional, thoroughly tested, and integrated with existing game systems.

**Next Steps**: Frontend integration and additional game features can be built on this solid foundation.
