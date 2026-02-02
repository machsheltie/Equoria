# Equoria Data Models

**Generated:** 2025-12-01
**Last Updated:** 2025-12-01 (Full Rescan)
**ORM:** Prisma 6.8.2
**Database:** PostgreSQL
**Total Models:** 29

## Entity Relationship Overview

```
User 1──n Horse
User 1──n Groom
User 1──n RefreshToken
User 1──n EmailVerificationToken
User 1──n XpEvent
User 1──n Facility

Horse n──1 Breed
Horse n──1 Stable
Horse n──1 Horse (sire)
Horse n──1 Horse (dam)
Horse 1──n GroomAssignment
Horse 1──1 FoalDevelopment
Horse 1──n FoalActivity
Horse 1──n TraitHistoryLog
Horse 1──n CompetitionResult
Horse 1──n TrainingLog

Groom 1──n GroomAssignment
Groom 1──n GroomInteraction
Groom 1──n GroomSalaryPayment
Groom 1──1 GroomMetrics
Groom 1──1 GroomTalentSelections

Show 1──n CompetitionResult
```

## Core Models

### User
Primary user account for the game.

| Field | Type | Description |
|-------|------|-------------|
| id | String (UUID) | Primary key |
| username | String | Unique username |
| email | String | Unique email |
| password | String | Hashed password |
| firstName | String | First name |
| lastName | String | Last name |
| money | Int | In-game currency (default: 1000) |
| level | Int | User level (default: 1) |
| xp | Int | Experience points |
| role | String | Access control (user, admin) - default: user |
| settings | Json | User preferences |
| emailVerified | Boolean | Email verification status |

### Horse
Central entity for horse management.

| Field | Type | Description |
|-------|------|-------------|
| id | Int | Primary key |
| name | String | Horse name |
| sex | String | Normalized lowercase: stallion, mare, gelding, colt, filly |
| dateOfBirth | DateTime | Birth date |
| breedId | Int? | FK to Breed |
| userId | String? | Current owner FK to User (Primary) |
| ownerId | String? | Legacy FK to User (Deprecated - mirrored) |
| stableId | Int? | FK to Stable |

**Genetics:**
| Field | Type | Description |
|-------|------|-------------|
| genotype | Json? | Genetic data |
| phenotypicMarkings | Json? | Physical markings |
| finalDisplayColor | String? | Display color |
| shade | String? | Color shade |
| epigeneticFlags | String[] | Epigenetic trait flags |
| epigeneticModifiers | Json? | Modifier data |
| ultraRareTraits | Json? | Ultra-rare/exotic traits |

**Stats (0-100):**
| Field | Type | Description |
|-------|------|-------------|
| precision | Int | Precision stat |
| strength | Int | Strength stat |
| speed | Int | Speed stat |
| agility | Int | Agility stat |
| endurance | Int | Endurance stat |
| intelligence | Int | Intelligence stat |
| stamina | Int | Stamina stat |
| balance | Int | Balance stat |
| coordination | Int | Coordination stat |
| boldness | Int | Boldness stat |
| flexibility | Int | Flexibility stat |
| obedience | Int | Obedience stat |
| focus | Int | Focus stat |

**Conformation (1-100 per region):**
| Field | Type | Description |
|-------|------|-------------|
| conformationScores | Json | head, neck, shoulders, back, legs, hooves, topline, hindquarters |

**Breeding:**
| Field | Type | Description |
|-------|------|-------------|
| sireId | Int? | FK to parent (sire) |
| damId | Int? | FK to parent (dam) |
| studStatus | String? | Stud availability |
| studFee | Int? | Stud fee |
| lastBredDate | DateTime? | Last breeding date |

**Care:**
| Field | Type | Description |
|-------|------|-------------|
| healthStatus | String? | Health status |
| bondScore | Int? | Bond with groom |
| stressLevel | Int? | Stress level |
| burnoutStatus | String? | Burnout status |

### Groom
Hired stable hands that care for horses.

| Field | Type | Description |
|-------|------|-------------|
| id | Int | Primary key |
| name | String | Groom name |
| speciality | String | Specialization |
| experience | Int | XP points |
| level | Int | Level (1-10) |
| skillLevel | String | Skill tier (novice, etc.) |
| personality | String | Personality type |
| groomPersonality | String | Epigenetic influence type |
| bonusTraitMap | Json | Trait probability bonuses |
| rareTraitPerks | Json | Ultra-rare trait perks |
| sessionRate | Decimal | Rate per session |
| careerWeeks | Int | Weeks employed |
| retired | Boolean | Retirement status |

### Show
Competition events.

| Field | Type | Description |
|-------|------|-------------|
| id | Int | Primary key |
| name | String | Show name (unique) |
| discipline | String | Competition type |
| levelMin | Int | Minimum level |
| levelMax | Int | Maximum level |
| entryFee | Int | Entry cost |
| prize | Int | Prize money |
| runDate | DateTime | Event date |

### Breed
Horse breeds reference.

| Field | Type | Description |
|-------|------|-------------|
| id | Int | Primary key |
| name | String | Breed name |
| description | String? | Breed description |

### Stable
Horse housing locations.

| Field | Type | Description |
|-------|------|-------------|
| id | Int | Primary key |
| name | String | Stable name |
| location | String? | Location |

## Relationship Models

### GroomAssignment
Links grooms to horses.

| Field | Type | Description |
|-------|------|-------------|
| id | Int | Primary key |
| foalId | Int | FK to Horse |
| groomId | Int | FK to Groom |
| startDate | DateTime | Assignment start |
| endDate | DateTime? | Assignment end |
| isActive | Boolean | Active status |
| bondScore | Int | Bond level (0-100) |

### GroomInteraction
Records groom activities with horses.

| Field | Type | Description |
|-------|------|-------------|
| id | Int | Primary key |
| interactionType | String | Activity type |
| duration | Int | Minutes |
| bondingChange | Int | Bond delta (-10 to +10) |
| stressChange | Int | Stress delta |
| quality | String | Interaction quality |
| taskType | String? | Task category |
| qualityScore | Float? | Score (0.0-1.0) |

### CompetitionResult
Records show performance.

| Field | Type | Description |
|-------|------|-------------|
| id | Int | Primary key |
| horseId | Int | FK to Horse |
| showId | Int | FK to Show |
| score | Decimal | Performance score |
| placement | String? | Ranking |
| discipline | String | Competition type |
| prizeWon | Decimal? | Winnings |
| statGains | Json? | Stats gained |

## Development Models

### FoalDevelopment
Tracks young horse development.

| Field | Type | Description |
|-------|------|-------------|
| id | Int | Primary key |
| foalId | Int | FK to Horse (unique) |
| currentDay | Int | Development day |
| bondingLevel | Int | Bond (0-100) |
| stressLevel | Int | Stress (0-100) |
| completedActivities | Json | Activity log |

### FoalActivity
Individual development activities.

| Field | Type | Description |
|-------|------|-------------|
| id | Int | Primary key |
| foalId | Int | FK to Horse |
| day | Int | Activity day |
| activityType | String | Activity type |
| outcome | String | Result |
| bondingChange | Int | Bond delta |
| stressChange | Int | Stress delta |

## Trait Models

### TraitHistoryLog
Records trait acquisition history.

| Field | Type | Description |
|-------|------|-------------|
| id | Int | Primary key |
| horseId | Int | FK to Horse |
| traitName | String | Trait name |
| sourceType | String | Origin (groom, milestone, etc.) |
| influenceScore | Int | Influence points |
| isEpigenetic | Boolean | Epigenetic flag |
| ageInDays | Int | Horse age at assignment |

### MilestoneTraitLog
Records milestone evaluations.

| Field | Type | Description |
|-------|------|-------------|
| id | Int | Primary key |
| horseId | Int | FK to Horse |
| milestoneType | String | Milestone category |
| score | Int | Evaluation score |
| finalTrait | String? | Assigned trait |
| taskDiversity | Int | Task variety score |
| taskConsistency | Int | Consistency score |
| personalityMatchScore | Int | Groom compatibility |

### UltraRareTraitEvent
Records ultra-rare trait attempts.

| Field | Type | Description |
|-------|------|-------------|
| id | Int | Primary key |
| horseId | Int | FK to Horse |
| traitName | String | Trait name |
| traitTier | String | ultra-rare or exotic |
| eventType | String | triggered, unlocked, failed |
| baseChance | Decimal? | Base probability |
| finalChance | Decimal? | Final probability |
| success | Boolean | Acquisition success |

## Economy Models

### GroomSalaryPayment
Tracks groom payments.

| Field | Type | Description |
|-------|------|-------------|
| id | Int | Primary key |
| groomId | Int | FK to Groom |
| userId | String | FK to User |
| amount | Int | Payment amount |
| paymentType | String | Payment category |
| status | String | paid, missed, etc. |

### Facility
Player-owned facilities.

| Field | Type | Description |
|-------|------|-------------|
| id | Int | Primary key |
| userId | String | FK to User |
| name | String | Facility name |
| type | String | Facility category |
| level | Int | Upgrade level |
| effectiveness | Int | Effectiveness % |
| maintenanceCost | Int | Monthly cost |

## Authentication Models

### RefreshToken
JWT refresh token storage.

| Field | Type | Description |
|-------|------|-------------|
| id | Int | Primary key |
| token | String | Token value (unique) |
| userId | String | FK to User |
| familyId | String? | Token family for rotation |
| expiresAt | DateTime | Expiration |
| isActive | Boolean | Active status |
| isInvalidated | Boolean | Security invalidation |
| lastActivityAt | DateTime? | Session timeout tracking |

### EmailVerificationToken
Email verification tokens.

| Field | Type | Description |
|-------|------|-------------|
| id | Int | Primary key |
| token | String | 256-bit token (unique) |
| userId | String | FK to User |
| email | String | Email to verify |
| expiresAt | DateTime | 24-hour expiration |
| usedAt | DateTime? | Verification timestamp |
| ipAddress | String? | Audit: IP |
| userAgent | String? | Audit: User agent |

## Indexes

Key performance indexes:
- `User`: email, emailVerified
- `Horse`: userId, breedId, stableId
- `Groom`: userId, level, experience, retired
- `RefreshToken`: token, userId, familyId, expiresAt
- `TraitHistoryLog`: horseId, traitName, sourceType
- `MilestoneTraitLog`: horseId, milestoneType
