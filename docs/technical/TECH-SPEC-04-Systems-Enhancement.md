# TECH-SPEC-04: Shows & Breeding Systems Enhancement

**Status:** Draft
**Version:** 1.0.0
**Created:** 2025-12-02
**Source:** systems_status_overview.md, GAME_FEATURES.md, data-models.md

---

## Overview

Enhance the Shows System (currently "BASIC") and Breeding System (currently "FUNCTIONAL") to production-ready status. These are the two systems identified as "Needs Integration Work" in the systems status overview.

---

## Part A: Shows System Enhancement

### Current State: BASIC

**What Exists:**
- Basic show model with scheduling, entry fees, prizes
- Show creation and management infrastructure
- Integration with competition execution system
- Level requirements (min/max) for entry eligibility
- Competition results tracking

**What's Missing:**
- Comprehensive show management interface
- Show series and championship systems
- Advanced entry management (waitlists, qualifications)
- Judge assignment and scoring systems
- Show categories and class divisions
- Prize distribution and sponsorship systems

---

### Phase A1: Show Management API

**Priority:** P1 - High
**Estimated Hours:** 10-12

#### A1.1 New Endpoints

**Show CRUD:**
```
POST   /api/shows                 - Create show
GET    /api/shows                 - List shows with filters
GET    /api/shows/:id             - Get show details
PUT    /api/shows/:id             - Update show
DELETE /api/shows/:id             - Cancel show
```

**Show Entry Management:**
```
POST   /api/shows/:id/entries           - Enter horse
DELETE /api/shows/:id/entries/:entryId  - Withdraw entry
GET    /api/shows/:id/entries           - List entries
GET    /api/shows/:id/waitlist          - Get waitlist
POST   /api/shows/:id/entries/promote   - Promote from waitlist
```

**Show Execution:**
```
POST   /api/shows/:id/start       - Start show execution
POST   /api/shows/:id/complete    - Complete show, distribute prizes
GET    /api/shows/:id/results     - Get detailed results
```

#### A1.2 Controller Implementation

**File:** `backend/controllers/showController.mjs`

```javascript
// Key methods:
// - createShow(req, res) - Validate and create show
// - listShows(req, res) - Filter by status, discipline, date range
// - getShowDetails(req, res) - Include entries, classes, judges
// - enterShow(req, res) - Validate eligibility, manage capacity
// - withdrawEntry(req, res) - Handle refunds, waitlist promotion
// - executeShow(req, res) - Run competition, calculate scores
// - completeShow(req, res) - Distribute prizes, update stats
```

#### A1.3 Service Layer

**File:** `backend/services/showManagementService.mjs`

```javascript
// Show lifecycle management:
// - validateShowCreation(showData, hostUser)
// - calculateEntryFee(show, horse, user)
// - checkEntryEligibility(horse, show)
// - processWaitlist(show)
// - distributeShowPrizes(show, results)
```

---

### Phase A2: Show Series & Championships

**Priority:** P2 - Medium
**Estimated Hours:** 8-10

#### A2.1 Schema Changes

```prisma
model ShowSeries {
  id            Int       @id @default(autoincrement())
  name          String    @unique
  description   String?
  discipline    String
  startDate     DateTime
  endDate       DateTime
  shows         Show[]
  championshipPoints Json  // Point system configuration
  prizes        Json      // Series prize structure
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}

model SeriesStanding {
  id            Int       @id @default(autoincrement())
  seriesId      Int
  horseId       Int
  userId        String
  totalPoints   Int       @default(0)
  showsEntered  Int       @default(0)
  bestPlacement String?
  updatedAt     DateTime  @updatedAt

  series        ShowSeries @relation(fields: [seriesId], references: [id])
  horse         Horse      @relation(fields: [horseId], references: [id])
  user          User       @relation(fields: [userId], references: [id])

  @@unique([seriesId, horseId])
}
```

#### A2.2 New Endpoints

```
POST   /api/series                     - Create series
GET    /api/series                     - List series
GET    /api/series/:id                 - Get series details
GET    /api/series/:id/standings       - Get leaderboard
GET    /api/series/:id/shows           - Get shows in series
POST   /api/series/:id/calculate       - Recalculate standings
```

#### A2.3 Point System

```javascript
const defaultPointSystem = {
  1: 100,  // 1st place
  2: 80,   // 2nd place
  3: 65,   // 3rd place
  4: 55,   // 4th place
  5: 50,   // 5th place
  6: 45,   // 6th place
  7: 40,
  8: 35,
  9: 30,
  10: 25,
  participation: 10  // Just for entering
};
```

---

### Phase A3: Show Classes & Divisions

**Priority:** P2 - Medium
**Estimated Hours:** 6-8

#### A3.1 Schema Changes

```prisma
model ShowClass {
  id            Int       @id @default(autoincrement())
  showId        Int
  name          String
  discipline    String
  levelMin      Int
  levelMax      Int
  ageMin        Int?
  ageMax        Int?
  maxEntries    Int       @default(20)
  entryFee      Int
  prizes        Json      // Per-class prize structure
  runOrder      Int       @default(0)

  show          Show      @relation(fields: [showId], references: [id])
  entries       ClassEntry[]
  results       ClassResult[]
}
```

#### A3.2 Division Examples

```javascript
const standardDivisions = {
  open: { levelMin: 0, levelMax: 1000, ageMin: 3 },
  novice: { levelMin: 0, levelMax: 200, ageMin: 3 },
  intermediate: { levelMin: 201, levelMax: 500, ageMin: 4 },
  advanced: { levelMin: 501, levelMax: 1000, ageMin: 5 },
  youth: { levelMin: 0, levelMax: 300, ageMin: 3, ageMax: 5 },
  senior: { levelMin: 0, levelMax: 1000, ageMin: 15 }
};
```

---

## Part B: Breeding System Enhancement

### Current State: FUNCTIONAL

**What Exists:**
- Basic breeding mechanics with sire/dam relationships
- Foal creation with inherited traits and genetics
- Breeding prediction service
- Epigenetic trait inheritance
- Foal development tracking

**What's Missing:**
- Comprehensive breeding management interface
- Advanced genetics system with Mendelian inheritance
- Breeding contracts and stud fee management
- Genetic diversity tracking and inbreeding prevention
- Breeding marketplace and stud advertising

---

### Phase B1: Advanced Genetics System

**Priority:** P1 - High
**Estimated Hours:** 12-15

#### B1.1 Schema Enhancements

```prisma
model GeneticProfile {
  id              Int       @id @default(autoincrement())
  horseId         Int       @unique
  genotype        Json      // Full genetic data
  alleles         Json      // Dominant/recessive pairs
  coatGenes       Json      // Color genetics
  healthGenes     Json      // Health predispositions
  performanceGenes Json     // Athletic genes
  rareGenes       Json      // Ultra-rare trait genetics
  inbreedingCoeff Float     @default(0)
  geneticDiversity Float    @default(1.0)

  horse           Horse     @relation(fields: [horseId], references: [id])
}

model BreedingRecord {
  id              Int       @id @default(autoincrement())
  mareId          Int
  stallionId      Int
  breedingDate    DateTime
  expectedDueDate DateTime?
  actualFoalId    Int?      @unique
  status          String    @default("pending") // pending, confirmed, foaled, failed
  fee             Int
  contractTerms   Json?

  mare            Horse     @relation("MareBreedings", fields: [mareId], references: [id])
  stallion        Horse     @relation("StallionBreedings", fields: [stallionId], references: [id])
  foal            Horse?    @relation("BreedingResult", fields: [actualFoalId], references: [id])
}
```

#### B1.2 Mendelian Inheritance Service

**File:** `backend/services/mendelianInheritanceService.mjs`

```javascript
// Key methods:
// - calculateOffspringGenotype(sireGenotype, damGenotype)
// - predictTraitProbabilities(sire, dam)
// - determineCoatColor(sireCoatGenes, damCoatGenes)
// - assessHealthRisks(sire, dam)
// - calculateInbreedingCoefficient(foal, ancestors)
```

#### B1.3 New Endpoints

```
GET    /api/breeding/genetics/:horseId      - Get genetic profile
POST   /api/breeding/predict                - Predict breeding outcome
GET    /api/breeding/compatibility/:id1/:id2 - Check pair compatibility
GET    /api/breeding/inbreeding/:id1/:id2   - Check inbreeding risk
```

---

### Phase B2: Breeding Contracts & Marketplace

**Priority:** P2 - Medium
**Estimated Hours:** 10-12

#### B2.1 Schema Additions

```prisma
model StudListing {
  id              Int       @id @default(autoincrement())
  stallionId      Int
  ownerId         String
  fee             Int
  liveCover       Boolean   @default(true)
  limitPerSeason  Int?
  seasonStart     DateTime?
  seasonEnd       DateTime?
  description     String?
  requirements    Json?     // Mare requirements
  isActive        Boolean   @default(true)

  stallion        Horse     @relation(fields: [stallionId], references: [id])
  owner           User      @relation(fields: [ownerId], references: [id])
  contracts       BreedingContract[]
}

model BreedingContract {
  id              Int       @id @default(autoincrement())
  studListingId   Int
  mareOwnerId     String
  mareId          Int
  status          String    @default("pending") // pending, accepted, rejected, completed
  agreedFee       Int
  terms           Json
  contractDate    DateTime  @default(now())
  expiresAt       DateTime

  studListing     StudListing @relation(fields: [studListingId], references: [id])
  mareOwner       User        @relation(fields: [mareOwnerId], references: [id])
  mare            Horse       @relation(fields: [mareId], references: [id])
}
```

#### B2.2 New Endpoints

**Stud Marketplace:**
```
POST   /api/stud/listings              - Create stud listing
GET    /api/stud/listings              - Browse available studs
GET    /api/stud/listings/:id          - Get listing details
PUT    /api/stud/listings/:id          - Update listing
DELETE /api/stud/listings/:id          - Remove listing
```

**Breeding Contracts:**
```
POST   /api/breeding/contracts         - Request breeding
GET    /api/breeding/contracts         - List user's contracts
PUT    /api/breeding/contracts/:id     - Accept/reject contract
POST   /api/breeding/contracts/:id/complete - Complete breeding
```

---

### Phase B3: Inbreeding Prevention System

**Priority:** P1 - High
**Estimated Hours:** 6-8

#### B3.1 Inbreeding Coefficient Calculation

```javascript
// Wright's coefficient of inbreeding calculation
function calculateInbreedingCoefficient(sireId, damId, generations = 5) {
  // Find common ancestors within N generations
  // Calculate path coefficients
  // Sum contributions from all common ancestors
  // Return coefficient (0 = no inbreeding, 0.25 = first cousins, etc.)
}
```

#### B3.2 Warning Thresholds

```javascript
const inbreedingThresholds = {
  safe: 0.0625,      // < 6.25% - Green light
  caution: 0.125,    // 6.25-12.5% - Yellow warning
  high: 0.25,        // 12.5-25% - Orange warning, health risks
  critical: 0.25     // > 25% - Red warning, breeding blocked
};
```

#### B3.3 UI Warnings

```
┌─────────────────────────────────────────────────────────────┐
│  ⚠️ INBREEDING WARNING                                       │
│                                                             │
│  These horses share the common ancestor "Champion Thunder"  │
│  3 generations back on both sides.                          │
│                                                             │
│  Inbreeding Coefficient: 12.5%                             │
│  Risk Level: CAUTION                                        │
│                                                             │
│  Potential Issues:                                          │
│  - Reduced genetic diversity                                │
│  - Higher chance of recessive health conditions             │
│  - May impact foal performance stats                        │
│                                                             │
│  [ Cancel ]              [ Proceed Anyway ]                │
└─────────────────────────────────────────────────────────────┘
```

---

## Integration Points

### Show-Breeding Integration

- Championship horses get breeding bonuses
- Series winners listed as "Proven Performers" in marketplace
- Show performance affects stud fee recommendations

### Cross-System Dependencies

| System | Shows Integration | Breeding Integration |
|--------|-------------------|----------------------|
| Grooms | Handler bonuses for shows | Foal care bonuses |
| Training | Eligibility for classes | Stat inheritance |
| Traits | Trait bonuses in scoring | Trait inheritance |
| XP | XP from placements | XP from successful breeding |

---

## Testing Requirements

### Shows System Tests
- Show creation and validation
- Entry management and waitlists
- Series point calculations
- Prize distribution
- Class division eligibility

### Breeding System Tests
- Genetic inheritance calculations
- Inbreeding coefficient accuracy
- Breeding contract lifecycle
- Stud marketplace operations
- Foal stat inheritance

---

## Estimated Timeline

| Phase | Duration | Priority | Dependencies |
|-------|----------|----------|--------------|
| A1: Show Management API | 10-12 hours | P1 | None |
| A2: Series & Championships | 8-10 hours | P2 | Phase A1 |
| A3: Classes & Divisions | 6-8 hours | P2 | Phase A1 |
| B1: Advanced Genetics | 12-15 hours | P1 | None |
| B2: Breeding Marketplace | 10-12 hours | P2 | Phase B1 |
| B3: Inbreeding Prevention | 6-8 hours | P1 | Phase B1 |
| **Total** | **52-65 hours** | | |

---

## Acceptance Criteria

### Shows System
1. Full CRUD operations for shows
2. Series with automatic point tracking
3. Multiple classes per show
4. Waitlist management
5. 90%+ test coverage

### Breeding System
1. Mendelian trait inheritance working
2. Inbreeding coefficient calculated and displayed
3. Stud marketplace functional
4. Breeding contracts with escrow
5. 90%+ test coverage
