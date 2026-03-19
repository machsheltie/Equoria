# Equoria Data Models

**Generated:** 2026-03-19 (Full Rescan)
**ORM:** Prisma (prisma-client-js)
**Database:** PostgreSQL
**Total Models:** 43
**Total Enums:** 6
**Migrations:** 45

---

## Entity Relationship Overview

```
User 1──n Horse
User 1──n Groom
User 1──n Rider
User 1──n Trainer
User 1──n RefreshToken
User 1──n EmailVerificationToken
User 1──n XpEvent
User 1──n Facility
User 1──n Show (hostUser)
User 1──n Show (createdByUser)
User 1──n ShowEntry
User 1──n GroomAssignment
User 1──n GroomSalaryPayment
User 1──n GroomPerformanceRecord
User 1──n RiderAssignment
User 1──n TrainerAssignment
User 1──n ForumThread
User 1──n ForumPost
User 1──n DirectMessage (sent)
User 1──n DirectMessage (received)
User 1──n Club (leader)
User 1──n ClubMembership
User 1──n ClubCandidate
User 1──n ClubBallot
User 1──n HorseSale (seller)
User 1──n HorseSale (buyer)

Horse n──1 Breed
Horse n──1 Stable
Horse n──1 User (owner)
Horse n──1 Horse (sire — self-relation)
Horse n──1 Horse (dam — self-relation)
Horse 1──n CompetitionResult
Horse 1──n TrainingLog
Horse 1──1 FoalDevelopment
Horse 1──n FoalActivity
Horse 1──n FoalTrainingHistory
Horse 1──n HorseXpEvent
Horse 1──n GroomAssignment
Horse 1──n GroomInteraction
Horse 1──n GroomPerformanceRecord
Horse 1──n GroomHorseSynergy
Horse 1──n GroomAssignmentLog
Horse 1──n TraitHistoryLog
Horse 1──n MilestoneTraitLog
Horse 1──n UltraRareTraitEvent
Horse 1──n RiderAssignment
Horse 1──n TrainerAssignment
Horse 1──n HorseSale
Horse 1──n ShowEntry

Groom n──1 User
Groom 1──n GroomAssignment
Groom 1──n GroomInteraction
Groom 1──n GroomSalaryPayment
Groom 1──n GroomPerformanceRecord
Groom 1──1 GroomMetrics
Groom 1──1 GroomTalentSelections
Groom 1──n GroomHorseSynergy
Groom 1──n GroomAssignmentLog
Groom 1──n GroomLegacyLog (retiredGroom)
Groom 1──n GroomLegacyLog (legacyGroom)
Groom 1──n TraitHistoryLog
Groom 1──n MilestoneTraitLog
Groom 1──n UltraRareTraitEvent

Rider n──1 User
Rider 1──n RiderAssignment

Trainer n──1 User
Trainer 1──n TrainerAssignment

Show 1──n CompetitionResult
Show 1──n ShowEntry
Show n──1 User (hostUser)
Show n──1 User (createdByUser)

Club 1──n ClubMembership
Club 1──n ClubElection
Club n──1 User (leader)

ClubElection 1──n ClubCandidate
ClubCandidate 1──n ClubBallot

Facility 1──n FacilityUpgrade

GroomAssignment 1──n GroomInteraction
```

---

## Enums

### BoardSection

Forum thread categorization.
Values: `general`, `art`, `sales`, `services`, `venting`

### ClubType

Club categorization.
Values: `discipline`, `breed`

### ClubRole

Club membership role.
Values: `member`, `officer`, `president`

### ElectionStatus

Club election lifecycle.
Values: `upcoming`, `open`, `closed`

### ShowStatus

Show lifecycle status (BA-1).
Values: `open`, `closed`, `executing`, `completed`

### AgeStage

Foal development age stages (BB-1).
Values: `newborn` (0-4 weeks), `weanling` (4-26 weeks), `yearling` (26-52 weeks), `two_year_old` (52-104 weeks)

---

## Domain: Auth & Users

### User

Primary user account for the game.

| Field                  | Type             | Description                                                   |
| ---------------------- | ---------------- | ------------------------------------------------------------- |
| id                     | String (UUID)    | Primary key                                                   |
| username               | String           | Unique username                                               |
| email                  | String           | Unique email                                                  |
| password               | String           | Hashed password                                               |
| firstName              | String           | First name                                                    |
| lastName               | String           | Last name                                                     |
| money                  | Int              | In-game currency (default: 1000)                              |
| level                  | Int              | User level (default: 1)                                       |
| xp                     | Int              | Experience points (default: 0)                                |
| role                   | String           | Access control role (default: "user")                         |
| settings               | **Json (JSONB)** | User preferences, inventory, onboarding flags (default: "{}") |
| groomSalaryGracePeriod | DateTime?        | Grace period start for groom salary                           |
| emailVerified          | Boolean          | Email verification status (default: false)                    |
| emailVerifiedAt        | DateTime?        | When email was verified                                       |
| createdAt              | DateTime         | Created timestamp                                             |
| updatedAt              | DateTime         | Updated timestamp                                             |

**Indexes:** email, emailVerified
**Relations:** horses, grooms, riders, trainers, refreshTokens, emailVerificationTokens, xpEvents, facilities, shows (host + creator), showEntries, forumThreads, forumPosts, sentMessages, receivedMessages, clubsLed, clubMemberships, candidacies, ballots, horsesSold, horsesBought, groomAssignments, groomSalaryPayments, groomPerformanceRecords, riderAssignments, trainerAssignments

### RefreshToken

JWT refresh token storage for session management.

| Field          | Type      | Description                                 |
| -------------- | --------- | ------------------------------------------- |
| id             | Int       | Primary key                                 |
| token          | String    | Token value (unique)                        |
| userId         | String    | FK to User                                  |
| familyId       | String?   | Token family for rotation tracking          |
| expiresAt      | DateTime  | Expiration date                             |
| isActive       | Boolean   | Active status (default: true)               |
| isInvalidated  | Boolean   | Security invalidation flag (default: false) |
| lastActivityAt | DateTime? | Session timeout tracking (CWE-613)          |
| createdAt      | DateTime  | Created timestamp                           |
| updatedAt      | DateTime  | Updated timestamp                           |

**Indexes:** token, userId, expiresAt, lastActivityAt, familyId, [isActive + isInvalidated], [familyId + isActive + isInvalidated]
**Table:** refresh_tokens

### EmailVerificationToken

Email verification tokens with audit trail.

| Field     | Type      | Description                         |
| --------- | --------- | ----------------------------------- |
| id        | Int       | Primary key                         |
| token     | String    | 256-bit token (unique, VarChar(64)) |
| userId    | String    | FK to User                          |
| email     | String    | Email to verify (VarChar(255))      |
| expiresAt | DateTime  | 24-hour expiration                  |
| createdAt | DateTime  | Created timestamp                   |
| usedAt    | DateTime? | Verification timestamp              |
| ipAddress | String?   | Audit: IP address (VarChar(45))     |
| userAgent | String?   | Audit: User agent (Text)            |

**Indexes:** token, userId, expiresAt, email
**Table:** email_verification_tokens

### XpEvent

User XP gain events.

| Field     | Type     | Description         |
| --------- | -------- | ------------------- |
| id        | Int      | Primary key         |
| amount    | Int      | XP amount           |
| reason    | String   | Why XP was awarded  |
| userId    | String   | FK to User          |
| timestamp | DateTime | When XP was awarded |

**Indexes:** userId, timestamp, [userId + timestamp]
**Table:** xp_events

---

## Domain: Horses

### Horse

Central entity for horse management. Contains stats, genetics, breeding, care, and economy fields.

| Field       | Type            | Description                          |
| ----------- | --------------- | ------------------------------------ |
| id          | Int             | Primary key                          |
| name        | String          | Horse name                           |
| sex         | String          | stallion, mare, gelding, colt, filly |
| dateOfBirth | DateTime (Date) | Birth date                           |
| breedId     | Int?            | FK to Breed                          |
| stableId    | Int?            | FK to Stable                         |
| userId      | String?         | FK to User (owner)                   |

**Genetics & Appearance:**

| Field               | Type              | Description                                                                                        |
| ------------------- | ----------------- | -------------------------------------------------------------------------------------------------- |
| genotype            | **Json? (JSONB)** | Genetic data                                                                                       |
| phenotypicMarkings  | **Json? (JSONB)** | Physical markings                                                                                  |
| finalDisplayColor   | String?           | Display color                                                                                      |
| shade               | String?           | Color shade                                                                                        |
| imageUrl            | String?           | Image path (default: "/images/samplehorse.JPG")                                                    |
| trait               | String?           | Primary trait                                                                                      |
| temperament         | String?           | Temperament type                                                                                   |
| personality         | String?           | Personality type                                                                                   |
| epigeneticFlags     | String[]          | Epigenetic trait flags (default: [])                                                               |
| epigeneticModifiers | **Json? (JSONB)** | Epigenetic modifier data (default: {"hidden":[],"negative":[],"positive":[]})                      |
| ultraRareTraits     | **Json? (JSONB)** | Ultra-rare/exotic traits (default: {"ultraRare":[],"exotic":[]})                                   |
| conformationScores  | **Json? (JSONB)** | Body region scores 1-100 (default: head/neck/shoulders/back/legs/hooves/topline/hindquarters = 20) |

**Stats (0-100, all Int?, default: 0):**
precision, strength, speed, agility, endurance, intelligence, stamina, balance, coordination, boldness, flexibility, obedience, focus

**Breeding:**

| Field        | Type             | Description                                |
| ------------ | ---------------- | ------------------------------------------ |
| sireId       | Int?             | FK to Horse (sire — self-relation)         |
| damId        | Int?             | FK to Horse (dam — self-relation)          |
| studStatus   | String?          | Stud availability (default: "Not at Stud") |
| studFee      | Int?             | Stud fee (default: 0)                      |
| lastBredDate | DateTime? (Date) | Last breeding date                         |

**Financial:**

| Field         | Type     | Description                                  |
| ------------- | -------- | -------------------------------------------- |
| totalEarnings | Int?     | Career earnings (default: 0)                 |
| earnings      | Decimal? | Decimal earnings (Decimal(10,2), default: 0) |
| forSale       | Boolean? | For sale flag (default: false)               |
| salePrice     | Int?     | Sale price (default: 0)                      |

**Care & Condition:**

| Field                   | Type              | Description                            |
| ----------------------- | ----------------- | -------------------------------------- |
| healthStatus            | String?           | Health status (default: "Excellent")   |
| lastVettedDate          | DateTime? (Date)  | Last vet date                          |
| bondScore               | Int?              | Bond with groom (default: 0)           |
| stressLevel             | Int?              | Stress level (default: 0)              |
| daysGroomedInARow       | Int?              | Consecutive grooming days (default: 0) |
| burnoutStatus           | String?           | Burnout status (default: "none")       |
| taskLog                 | **Json? (JSONB)** | Foal task logging                      |
| consecutiveDaysFoalCare | Int?              | Foal care streak (default: 0)          |
| lastGroomed             | DateTime?         | Last grooming date                     |

**Game Mechanics:**

| Field               | Type              | Description                      |
| ------------------- | ----------------- | -------------------------------- |
| tack                | **Json? (JSONB)** | Equipped tack (default: "{}")    |
| age                 | Int?              | Computed age                     |
| trainingCooldown    | DateTime?         | Training cooldown expiry         |
| rider               | **Json? (JSONB)** | Assigned rider data              |
| disciplineScores    | **Json? (JSONB)** | Discipline score map             |
| horseXp             | Int?              | Horse XP (default: 0)            |
| availableStatPoints | Int?              | Unspent stat points (default: 0) |

**Farrier & Feed:**

| Field           | Type      | Description                          |
| --------------- | --------- | ------------------------------------ |
| lastFarrierDate | DateTime? | Last farrier visit                   |
| hoofCondition   | String?   | Hoof state (default: "good")         |
| lastShod        | DateTime? | Last shoeing date                    |
| currentFeed     | String?   | Current feed type (default: "basic") |
| lastFedDate     | DateTime? | Last feeding date                    |
| energyLevel     | Int?      | Energy level (default: 100)          |

**Indexes:** userId, breedId, stableId
**Table:** horses

### Breed

Horse breed reference data.

| Field       | Type    | Description       |
| ----------- | ------- | ----------------- |
| id          | Int     | Primary key       |
| name        | String  | Breed name        |
| description | String? | Breed description |

**Table:** breeds

### Stable

Horse housing locations.

| Field    | Type    | Description |
| -------- | ------- | ----------- |
| id       | Int     | Primary key |
| name     | String  | Stable name |
| location | String? | Location    |

**Table:** stables

### HorseXpEvent

Horse XP gain events.

| Field     | Type     | Description         |
| --------- | -------- | ------------------- |
| id        | Int      | Primary key         |
| amount    | Int      | XP amount           |
| reason    | String   | Why XP was awarded  |
| horseId   | Int      | FK to Horse         |
| timestamp | DateTime | When XP was awarded |

**Indexes:** horseId, timestamp, [horseId + timestamp]
**Table:** horse_xp_events

---

## Domain: Training

### TrainingLog

Records horse training sessions.

| Field      | Type     | Description         |
| ---------- | -------- | ------------------- |
| id         | Int      | Primary key         |
| discipline | String   | Training discipline |
| trainedAt  | DateTime | Training timestamp  |
| horseId    | Int      | FK to Horse         |

**Table:** training_logs

---

## Domain: Competition

### Show

Competition events with lifecycle management.

| Field           | Type       | Description                         |
| --------------- | ---------- | ----------------------------------- |
| id              | Int        | Primary key                         |
| name            | String     | Show name (unique)                  |
| discipline      | String     | Competition discipline              |
| levelMin        | Int        | Minimum level                       |
| levelMax        | Int        | Maximum level                       |
| entryFee        | Int        | Entry cost                          |
| prize           | Int        | Prize money                         |
| runDate         | DateTime   | Event date                          |
| hostUserId      | String?    | FK to User (host)                   |
| status          | ShowStatus | Lifecycle status (default: open)    |
| openDate        | DateTime?  | When entries opened (BA-1)          |
| closeDate       | DateTime?  | When entries close (BA-1)           |
| executedAt      | DateTime?  | When overnight execution ran (BA-1) |
| createdByUserId | String?    | FK to User (creator, BA-1)          |
| createdByClubId | Int?       | FK to Club (creator, BA-1)          |
| description     | String?    | Optional description (BA-2)         |
| maxEntries      | Int?       | Max entries allowed (BA-2)          |
| createdAt       | DateTime   | Created timestamp                   |
| updatedAt       | DateTime   | Updated timestamp                   |

**Indexes:** status, closeDate
**Table:** shows

### ShowEntry

Individual horse entries into a show (BA-3).

| Field     | Type     | Description                     |
| --------- | -------- | ------------------------------- |
| id        | Int      | Primary key                     |
| showId    | Int      | FK to Show                      |
| horseId   | Int      | FK to Horse                     |
| userId    | String   | FK to User                      |
| feePaid   | Int      | Entry fee snapshot (default: 0) |
| createdAt | DateTime | Created timestamp               |

**Unique:** [showId + horseId]
**Indexes:** showId, horseId, userId
**Table:** show_entries

### CompetitionResult

Records show performance and rewards.

| Field      | Type              | Description                          |
| ---------- | ----------------- | ------------------------------------ |
| id         | Int               | Primary key                          |
| horseId    | Int               | FK to Horse                          |
| showId     | Int               | FK to Show                           |
| score      | Decimal           | Performance score (Decimal(10,2))    |
| placement  | String?           | Ranking                              |
| discipline | String            | Competition discipline               |
| runDate    | DateTime          | Event date                           |
| showName   | String            | Show name snapshot                   |
| prizeWon   | Decimal?          | Winnings (Decimal(10,2), default: 0) |
| statGains  | **Json? (JSONB)** | Stats gained from competition        |
| createdAt  | DateTime          | Created timestamp                    |

**Table:** competition_results

---

## Domain: Breeding & Foal Development

### FoalDevelopment

Tracks young horse development progress. One-to-one with Horse.

| Field               | Type             | Description                                       |
| ------------------- | ---------------- | ------------------------------------------------- |
| id                  | Int              | Primary key                                       |
| foalId              | Int              | FK to Horse (unique — 1:1)                        |
| horseId             | Int?             | Legacy FK                                         |
| currentDay          | Int              | Development day (default: 0)                      |
| bondingLevel        | Int              | Bond 0-100 (default: 50)                          |
| bondScore           | Int              | Bond score (default: 0)                           |
| stressLevel         | Int              | Stress 0-100 (default: 20)                        |
| completedActivities | **Json (JSONB)** | Activity log (default: "{}")                      |
| ageStage            | AgeStage         | Age-based stage (default: newborn, BB-1)          |
| completedMilestones | **Json (JSONB)** | Milestone tracking (default: "{}", BB-3)          |
| isActive            | Boolean          | Whether foal window is open (default: true, BB-4) |
| lastInteractionAt   | DateTime?        | Last interaction for WYAG feed                    |
| createdAt           | DateTime         | Created timestamp                                 |
| updatedAt           | DateTime         | Updated timestamp                                 |

**Indexes:** isActive
**Table:** foal_development

### FoalActivity

Individual foal development activities.

| Field         | Type     | Description          |
| ------------- | -------- | -------------------- |
| id            | Int      | Primary key          |
| foalId        | Int      | FK to Horse          |
| day           | Int      | Activity day         |
| activityType  | String   | Activity type        |
| outcome       | String   | Result               |
| bondingChange | Int      | Bond delta           |
| stressChange  | Int      | Stress delta         |
| description   | String   | Activity description |
| createdAt     | DateTime | Created timestamp    |

**Table:** foal_activities

### FoalTrainingHistory

Foal training history with detailed tracking.

| Field        | Type          | Description               |
| ------------ | ------------- | ------------------------- |
| id           | String (UUID) | Primary key               |
| horseId      | Int           | FK to Horse               |
| day          | Int           | Training day              |
| activity     | String        | Activity name             |
| outcome      | String        | Result                    |
| bondChange   | Int           | Bond delta (default: 0)   |
| stressChange | Int           | Stress delta (default: 0) |
| timestamp    | DateTime      | Event timestamp           |
| createdAt    | DateTime      | Created timestamp         |
| updatedAt    | DateTime      | Updated timestamp         |

**Indexes:** horseId, day, timestamp, [horseId + day]
**Table:** foal_training_history

---

## Domain: Traits

### TraitHistoryLog

Records trait acquisition history for horses.

| Field          | Type     | Description                                       |
| -------------- | -------- | ------------------------------------------------- |
| id             | Int      | Primary key                                       |
| horseId        | Int      | FK to Horse                                       |
| traitName      | String   | Trait name                                        |
| sourceType     | String   | Origin (groom, milestone, environmental, genetic) |
| sourceId       | String?  | Specific source details                           |
| influenceScore | Int      | Influence points (default: 0)                     |
| isEpigenetic   | Boolean  | Epigenetic flag (default: false)                  |
| groomId        | Int?     | FK to Groom                                       |
| bondScore      | Int?     | Bond score at assignment                          |
| stressLevel    | Int?     | Stress at assignment                              |
| ageInDays      | Int      | Horse age at assignment                           |
| timestamp      | DateTime | Event timestamp                                   |
| createdAt      | DateTime | Created timestamp                                 |
| updatedAt      | DateTime | Updated timestamp                                 |

**Indexes:** horseId, [horseId + timestamp], traitName, sourceType, groomId, isEpigenetic
**Table:** trait_history_logs

### MilestoneTraitLog

Records milestone evaluations and trait assignments.

| Field                    | Type             | Description                                          |
| ------------------------ | ---------------- | ---------------------------------------------------- |
| id                       | Int              | Primary key                                          |
| horseId                  | Int              | FK to Horse                                          |
| milestoneType            | String           | Milestone category (imprinting, socialization, etc.) |
| score                    | Int              | Evaluation score                                     |
| finalTrait               | String?          | Assigned trait                                       |
| groomId                  | Int?             | FK to Groom                                          |
| bondScore                | Int?             | Bond average during window                           |
| taskDiversity            | Int              | Task variety score (default: 0)                      |
| taskConsistency          | Int              | Consistency score (default: 0)                       |
| careGapsPenalty          | Int              | Care gaps penalty (default: 0)                       |
| personalityMatchScore    | Int              | Groom compatibility -1 to 2 (default: 0)             |
| personalityEffectApplied | Boolean          | Whether compatibility applied (default: false)       |
| modifiersApplied         | **Json (JSONB)** | Modifiers applied (default: "{}")                    |
| reasoning                | String?          | Trait assignment reasoning                           |
| ageInDays                | Int              | Horse age at evaluation                              |
| timestamp                | DateTime         | Event timestamp                                      |
| createdAt                | DateTime         | Created timestamp                                    |
| updatedAt                | DateTime         | Updated timestamp                                    |

**Indexes:** horseId, [horseId + milestoneType], milestoneType, groomId, timestamp
**Table:** milestone_trait_logs

### UltraRareTraitEvent

Records ultra-rare and exotic trait acquisition attempts.

| Field             | Type              | Description                               |
| ----------------- | ----------------- | ----------------------------------------- |
| id                | Int               | Primary key                               |
| horseId           | Int               | FK to Horse                               |
| traitName         | String            | Trait name                                |
| traitTier         | String            | "ultra-rare" or "exotic"                  |
| eventType         | String            | triggered, unlocked, failed_trigger, etc. |
| baseChance        | Decimal?          | Base probability (Decimal(5,4))           |
| finalChance       | Decimal?          | Final probability (Decimal(5,4))          |
| groomId           | Int?              | FK to Groom                               |
| appliedPerks      | **Json? (JSONB)** | Groom perks applied (default: "[]")       |
| triggerConditions | **Json? (JSONB)** | Trigger conditions met (default: "{}")    |
| success           | Boolean           | Acquisition success (default: false)      |
| notes             | String?           | Additional context                        |
| timestamp         | DateTime          | Event timestamp                           |

**Indexes:** horseId, traitName, traitTier, eventType, groomId, timestamp, [horseId + traitName]
**Table:** ultra_rare_trait_events

---

## Domain: Grooms

### Groom

Hired stable hands that care for horses with trait influence capabilities.

| Field               | Type             | Description                                     |
| ------------------- | ---------------- | ----------------------------------------------- |
| id                  | Int              | Primary key                                     |
| name                | String           | Groom name                                      |
| speciality          | String           | Specialization area                             |
| experience          | Int              | XP points (default: 0)                          |
| level               | Int              | Level 1-10 (default: 1)                         |
| skillLevel          | String           | Skill tier (default: "novice")                  |
| personality         | String           | Personality type                                |
| groomPersonality    | String           | Epigenetic influence type (default: "balanced") |
| bonusTraitMap       | **Json (JSONB)** | Trait probability bonuses (default: "{}")       |
| rareTraitPerks      | **Json (JSONB)** | Ultra-rare trait perks (default: "{}")          |
| sessionRate         | Decimal          | Rate per session (Decimal(10,2), default: 15.0) |
| availability        | **Json (JSONB)** | Availability schedule (default: "{}")           |
| bio                 | String?          | Biography                                       |
| imageUrl            | String?          | Image URL                                       |
| isActive            | Boolean          | Active status (default: true)                   |
| hiredDate           | DateTime         | Hire date                                       |
| careerWeeks         | Int              | Weeks employed (default: 0)                     |
| retired             | Boolean          | Retirement status (default: false)              |
| retirementReason    | String?          | Retirement reason                               |
| retirementTimestamp | DateTime?        | When retired                                    |
| userId              | String?          | FK to User                                      |
| createdAt           | DateTime         | Created timestamp                               |
| updatedAt           | DateTime         | Updated timestamp                               |

**Indexes:** userId, level, experience, careerWeeks, retired, [retired + careerWeeks]
**Table:** grooms

### GroomAssignment

Links grooms to horses with bond tracking.

| Field     | Type      | Description                              |
| --------- | --------- | ---------------------------------------- |
| id        | Int       | Primary key                              |
| foalId    | Int       | FK to Horse                              |
| groomId   | Int       | FK to Groom                              |
| userId    | String?   | FK to User                               |
| startDate | DateTime  | Assignment start                         |
| endDate   | DateTime? | Assignment end                           |
| isActive  | Boolean   | Active status (default: true)            |
| isDefault | Boolean   | Default assignment flag (default: false) |
| priority  | Int       | Priority level 1-5 (default: 1)          |
| bondScore | Int       | Bond level 0-100 (default: 0)            |
| notes     | String?   | Assignment notes                         |
| createdAt | DateTime  | Created timestamp                        |
| updatedAt | DateTime  | Updated timestamp                        |

**Unique:** [foalId + groomId + isActive]
**Indexes:** foalId, groomId
**Table:** groom_assignments

### GroomInteraction

Records groom activities with horses.

| Field             | Type     | Description                            |
| ----------------- | -------- | -------------------------------------- |
| id                | Int      | Primary key                            |
| interactionType   | String   | Activity type                          |
| duration          | Int      | Duration in minutes                    |
| bondingChange     | Int      | Bond delta -10 to +10 (default: 0)     |
| stressChange      | Int      | Stress delta -10 to +10 (default: 0)   |
| quality           | String   | Interaction quality (default: "good")  |
| notes             | String?  | Notes                                  |
| cost              | Decimal  | Cost (Decimal(10,2), default: 0)       |
| taskType          | String?  | Task category for milestone evaluation |
| qualityScore      | Float?   | Score 0.0-1.0 (default: 0.75)          |
| milestoneWindowId | String?  | Milestone window grouping              |
| foalId            | Int      | FK to Horse                            |
| groomId           | Int      | FK to Groom                            |
| assignmentId      | Int?     | FK to GroomAssignment                  |
| timestamp         | DateTime | Event timestamp                        |
| createdAt         | DateTime | Created timestamp                      |

**Indexes:** foalId, groomId
**Table:** groom_interactions

### GroomSalaryPayment

Tracks groom salary payments.

| Field       | Type     | Description                                             |
| ----------- | -------- | ------------------------------------------------------- |
| id          | Int      | Primary key                                             |
| groomId     | Int      | FK to Groom                                             |
| userId      | String   | FK to User                                              |
| amount      | Int      | Payment amount                                          |
| paymentDate | DateTime | Payment date                                            |
| paymentType | String   | Payment category (default: "weekly_salary")             |
| status      | String   | paid, missed_insufficient_funds, etc. (default: "paid") |
| createdAt   | DateTime | Created timestamp                                       |
| updatedAt   | DateTime | Updated timestamp                                       |

**Indexes:** groomId, userId, paymentDate, [userId + paymentDate]
**Table:** groom_salary_payments

### GroomPerformanceRecord

Tracks groom performance across interactions.

| Field           | Type     | Description                      |
| --------------- | -------- | -------------------------------- |
| id              | Int      | Primary key                      |
| groomId         | Int      | FK to Groom                      |
| userId          | String   | FK to User                       |
| horseId         | Int?     | FK to Horse                      |
| interactionType | String   | Type of interaction              |
| bondGain        | Float    | Bond gain (default: 0)           |
| taskSuccess     | Boolean  | Task completed (default: true)   |
| wellbeingImpact | Float    | Impact -10 to +10 (default: 0)   |
| duration        | Int      | Duration in minutes (default: 0) |
| playerRating    | Int?     | 1-5 stars                        |
| recordedAt      | DateTime | When recorded                    |
| createdAt       | DateTime | Created timestamp                |
| updatedAt       | DateTime | Updated timestamp                |

**Indexes:** groomId, userId, recordedAt, [groomId + recordedAt]
**Table:** groom_performance_records

### GroomMetrics

Aggregated groom performance metrics. One-to-one with Groom.

| Field                | Type     | Description                            |
| -------------------- | -------- | -------------------------------------- |
| id                   | Int      | Primary key                            |
| groomId              | Int      | FK to Groom (unique — 1:1)             |
| totalInteractions    | Int      | Total interactions (default: 0)        |
| bondingEffectiveness | Int      | Bonding score 0-100 (default: 50)      |
| taskCompletion       | Int      | Completion rate 0-100 (default: 75)    |
| horseWellbeing       | Int      | Wellbeing impact 0-100 (default: 50)   |
| showPerformance      | Int      | Show score 0-100 (default: 50)         |
| consistency          | Int      | Consistency 0-100 (default: 50)        |
| playerSatisfaction   | Int      | Satisfaction 0-100 (default: 75)       |
| reputationScore      | Int      | Overall reputation 0-100 (default: 50) |
| lastUpdated          | DateTime | Last metrics update                    |
| createdAt            | DateTime | Created timestamp                      |
| updatedAt            | DateTime | Updated timestamp                      |

**Indexes:** reputationScore, groomId
**Table:** groom_metrics

### GroomHorseSynergy

Tracks groom-horse working relationship over time.

| Field            | Type     | Description                  |
| ---------------- | -------- | ---------------------------- |
| id               | Int      | Primary key                  |
| groomId          | Int      | FK to Groom                  |
| horseId          | Int      | FK to Horse                  |
| synergyScore     | Int      | Synergy 0+ (default: 0)      |
| sessionsTogether | Int      | Sessions worked (default: 0) |
| lastAssignedAt   | DateTime | Last assignment              |
| createdAt        | DateTime | Created timestamp            |
| updatedAt        | DateTime | Updated timestamp            |

**Unique:** [groomId + horseId]
**Indexes:** groomId, horseId, synergyScore
**Table:** groom_horse_synergies

### GroomAssignmentLog

Historical log of groom assignments with outcomes.

| Field               | Type      | Description                               |
| ------------------- | --------- | ----------------------------------------- |
| id                  | Int       | Primary key                               |
| groomId             | Int       | FK to Groom                               |
| horseId             | Int       | FK to Horse                               |
| assignedAt          | DateTime  | Assignment start                          |
| unassignedAt        | DateTime? | Assignment end                            |
| milestonesCompleted | Int       | Milestones during assignment (default: 0) |
| traitsShaped        | String[]  | Traits shaped (default: [])               |
| xpGained            | Int       | XP earned (default: 0)                    |
| createdAt           | DateTime  | Created timestamp                         |
| updatedAt           | DateTime  | Updated timestamp                         |

**Indexes:** groomId, horseId, assignedAt, [groomId + assignedAt]
**Table:** groom_assignment_logs

### GroomLegacyLog

Records mentorship between retired and new grooms.

| Field          | Type     | Description                |
| -------------- | -------- | -------------------------- |
| id             | Int      | Primary key                |
| retiredGroomId | Int      | FK to Groom (mentor)       |
| legacyGroomId  | Int      | FK to Groom (protege)      |
| inheritedPerk  | String   | Perk inherited             |
| mentorLevel    | Int      | Mentor level at retirement |
| createdAt      | DateTime | Created timestamp          |

**Indexes:** retiredGroomId, legacyGroomId
**Table:** groom_legacy_logs

### GroomTalentSelections

Groom talent tree selections. One-to-one with Groom.

| Field   | Type    | Description                |
| ------- | ------- | -------------------------- |
| id      | Int     | Primary key                |
| groomId | Int     | FK to Groom (unique — 1:1) |
| tier1   | String? | Tier 1 talent selection    |
| tier2   | String? | Tier 2 talent selection    |
| tier3   | String? | Tier 3 talent selection    |

**Indexes:** groomId
**Table:** groom_talent_selections

---

## Domain: Riders

### Rider

Hired riders for competition.

| Field       | Type     | Description                                |
| ----------- | -------- | ------------------------------------------ |
| id          | Int      | Primary key                                |
| firstName   | String   | First name                                 |
| lastName    | String   | Last name                                  |
| personality | String   | daring, methodical, intuitive, competitive |
| skillLevel  | String   | rookie, developing, experienced            |
| speciality  | String   | Preferred discipline                       |
| weeklyRate  | Int      | Weekly cost (default: 200)                 |
| experience  | Int      | Total XP (default: 0)                      |
| level       | Int      | Level 1-10 (default: 1)                    |
| careerWeeks | Int      | Weeks employed (default: 0)                |
| totalWins   | Int      | Competition wins (default: 0)              |
| prestige    | Int      | Prestige 0-100 (default: 0)                |
| retired     | Boolean  | Retirement status (default: false)         |
| bio         | String?  | Biography                                  |
| userId      | String?  | FK to User                                 |
| createdAt   | DateTime | Created timestamp                          |
| updatedAt   | DateTime | Updated timestamp                          |

**Indexes:** userId, level, retired
**Table:** riders

### RiderAssignment

Links riders to horses.

| Field     | Type     | Description                   |
| --------- | -------- | ----------------------------- |
| id        | Int      | Primary key                   |
| riderId   | Int      | FK to Rider                   |
| horseId   | Int      | FK to Horse                   |
| userId    | String?  | FK to User                    |
| isActive  | Boolean  | Active status (default: true) |
| notes     | String?  | Notes                         |
| startDate | DateTime | Assignment start              |
| createdAt | DateTime | Created timestamp             |
| updatedAt | DateTime | Updated timestamp             |

**Unique:** [riderId + horseId + isActive]
**Indexes:** riderId, horseId, userId
**Table:** rider_assignments

---

## Domain: Trainers

### Trainer

Hired trainers for horse development.

| Field       | Type     | Description                                           |
| ----------- | -------- | ----------------------------------------------------- |
| id          | Int      | Primary key                                           |
| firstName   | String   | First name                                            |
| lastName    | String   | Last name                                             |
| personality | String   | focused, encouraging, technical, competitive, patient |
| skillLevel  | String   | novice, developing, expert                            |
| speciality  | String   | Preferred discipline                                  |
| sessionRate | Int      | Session cost (default: 150)                           |
| experience  | Int      | Total XP (default: 0)                                 |
| level       | Int      | Level 1-10 (default: 1)                               |
| careerWeeks | Int      | Weeks employed (default: 0)                           |
| retired     | Boolean  | Retirement status (default: false)                    |
| bio         | String?  | Biography                                             |
| userId      | String?  | FK to User                                            |
| createdAt   | DateTime | Created timestamp                                     |
| updatedAt   | DateTime | Updated timestamp                                     |

**Indexes:** userId, level, retired
**Table:** trainers

### TrainerAssignment

Links trainers to horses.

| Field     | Type     | Description                   |
| --------- | -------- | ----------------------------- |
| id        | Int      | Primary key                   |
| trainerId | Int      | FK to Trainer                 |
| horseId   | Int      | FK to Horse                   |
| userId    | String?  | FK to User                    |
| isActive  | Boolean  | Active status (default: true) |
| notes     | String?  | Notes                         |
| startDate | DateTime | Assignment start              |
| createdAt | DateTime | Created timestamp             |
| updatedAt | DateTime | Updated timestamp             |

**Unique:** [trainerId + horseId + isActive]
**Indexes:** trainerId, horseId, userId
**Table:** trainer_assignments

---

## Domain: Community (Forums, Messages, Clubs)

### ForumThread

Forum discussion threads.

| Field          | Type         | Description                    |
| -------------- | ------------ | ------------------------------ |
| id             | Int          | Primary key                    |
| section        | BoardSection | Forum section (enum)           |
| title          | String       | Thread title                   |
| authorId       | String       | FK to User                     |
| tags           | String[]     | Thread tags                    |
| isPinned       | Boolean      | Pinned status (default: false) |
| viewCount      | Int          | View counter (default: 0)      |
| lastActivityAt | DateTime     | Last activity timestamp        |
| createdAt      | DateTime     | Created timestamp              |

### ForumPost

Individual posts within forum threads.

| Field     | Type     | Description                        |
| --------- | -------- | ---------------------------------- |
| id        | Int      | Primary key                        |
| threadId  | Int      | FK to ForumThread (cascade delete) |
| authorId  | String   | FK to User                         |
| content   | String   | Post content                       |
| createdAt | DateTime | Created timestamp                  |

### DirectMessage

Private messages between users.

| Field       | Type     | Description                   |
| ----------- | -------- | ----------------------------- |
| id          | Int      | Primary key                   |
| senderId    | String   | FK to User (SentMessages)     |
| recipientId | String   | FK to User (ReceivedMessages) |
| subject     | String   | Message subject               |
| content     | String   | Message body                  |
| tag         | String?  | Optional tag                  |
| isRead      | Boolean  | Read status (default: false)  |
| createdAt   | DateTime | Created timestamp             |

### Club

Player-organized clubs (discipline or breed based).

| Field       | Type     | Description                |
| ----------- | -------- | -------------------------- |
| id          | Int      | Primary key                |
| name        | String   | Club name (unique)         |
| type        | ClubType | discipline or breed (enum) |
| category    | String   | Specific category          |
| description | String   | Club description           |
| leaderId    | String   | FK to User (ClubsLed)      |
| createdAt   | DateTime | Created timestamp          |

### ClubMembership

Club member records with roles.

| Field    | Type     | Description                                  |
| -------- | -------- | -------------------------------------------- |
| id       | Int      | Primary key                                  |
| clubId   | Int      | FK to Club (cascade delete)                  |
| userId   | String   | FK to User                                   |
| role     | ClubRole | member, officer, president (default: member) |
| joinedAt | DateTime | Join date                                    |

**Unique:** [clubId + userId]

### ClubElection

Club governance elections.

| Field    | Type           | Description                                |
| -------- | -------------- | ------------------------------------------ |
| id       | Int            | Primary key                                |
| clubId   | Int            | FK to Club                                 |
| position | String         | Position being elected                     |
| status   | ElectionStatus | upcoming, open, closed (default: upcoming) |
| startsAt | DateTime       | Election start                             |
| endsAt   | DateTime       | Election end                               |

### ClubCandidate

Election candidates.

| Field      | Type   | Description        |
| ---------- | ------ | ------------------ |
| id         | Int    | Primary key        |
| electionId | Int    | FK to ClubElection |
| userId     | String | FK to User         |
| statement  | String | Campaign statement |

**Unique:** [electionId + userId]

### ClubBallot

Individual votes in club elections.

| Field       | Type     | Description                                |
| ----------- | -------- | ------------------------------------------ |
| id          | Int      | Primary key                                |
| candidateId | Int      | FK to ClubCandidate                        |
| voterId     | String   | FK to User                                 |
| electionId  | Int      | Election reference (for unique constraint) |
| createdAt   | DateTime | Vote timestamp                             |

**Unique:** [electionId + voterId]

---

## Domain: Marketplace

### HorseSale

Records completed horse sales between players.

| Field     | Type     | Description                   |
| --------- | -------- | ----------------------------- |
| id        | Int      | Primary key                   |
| horseId   | Int      | FK to Horse                   |
| sellerId  | String   | FK to User (HorseSalesSold)   |
| buyerId   | String   | FK to User (HorseSalesBought) |
| salePrice | Int      | Final sale price              |
| horseName | String   | Horse name snapshot at sale   |
| soldAt    | DateTime | Sale completion date          |

**Indexes:** sellerId, buyerId, soldAt
**Table:** horse_sales

---

## Domain: Services (Facilities)

### Facility

Player-owned facilities with upgrade system.

| Field           | Type             | Description                                             |
| --------------- | ---------------- | ------------------------------------------------------- |
| id              | Int              | Primary key                                             |
| userId          | String           | FK to User (cascade delete)                             |
| name            | String           | Facility name                                           |
| type            | String           | basic_stable, premium_facility, specialized_environment |
| level           | Int              | Upgrade level (default: 1)                              |
| upgrades        | **Json (JSONB)** | Upgrade levels map (default: "{}")                      |
| effectiveness   | Int              | Effectiveness percentage (default: 60)                  |
| maintenanceCost | Int              | Monthly cost (default: 100)                             |
| lastMaintenance | DateTime?        | Last maintenance date                                   |
| createdAt       | DateTime         | Created timestamp                                       |
| updatedAt       | DateTime         | Updated timestamp                                       |

**Table:** facilities

### FacilityUpgrade

Individual facility upgrade records.

| Field         | Type     | Description                         |
| ------------- | -------- | ----------------------------------- |
| id            | Int      | Primary key                         |
| facilityId    | Int      | FK to Facility (cascade delete)     |
| upgradeType   | String   | ventilation, heating, cooling, etc. |
| previousLevel | Int      | Level before upgrade                |
| newLevel      | Int      | Level after upgrade                 |
| cost          | Int      | Upgrade cost                        |
| effectiveness | Int      | Effectiveness rating                |
| purchaseDate  | DateTime | Purchase date                       |

**Table:** facility_upgrades

---

## JSONB Fields Summary

All fields stored as PostgreSQL JSONB for flexible schema-within-schema:

| Model               | Field               | Default                                     | Purpose                                  |
| ------------------- | ------------------- | ------------------------------------------- | ---------------------------------------- |
| User                | settings            | `{}`                                        | Preferences, inventory, onboarding flags |
| Horse               | genotype            | null                                        | Genetic allele data                      |
| Horse               | phenotypicMarkings  | null                                        | Physical marking descriptions            |
| Horse               | epigeneticModifiers | `{"hidden":[],"negative":[],"positive":[]}` | Epigenetic trait modifiers               |
| Horse               | ultraRareTraits     | `{"ultraRare":[],"exotic":[]}`              | Ultra-rare/exotic trait storage          |
| Horse               | conformationScores  | `{"head":20,"neck":20,...}`                 | Body region conformation 1-100           |
| Horse               | taskLog             | null                                        | Foal task logging                        |
| Horse               | tack                | `{}`                                        | Equipped saddle/bridle                   |
| Horse               | rider               | null                                        | Assigned rider data                      |
| Horse               | disciplineScores    | null                                        | Discipline score map                     |
| CompetitionResult   | statGains           | null                                        | Stats gained from competition            |
| FoalDevelopment     | completedActivities | `{}`                                        | Activity completion log                  |
| FoalDevelopment     | completedMilestones | `{}`                                        | Milestone completion tracking            |
| Groom               | bonusTraitMap       | `{}`                                        | Trait probability bonuses                |
| Groom               | rareTraitPerks      | `{}`                                        | Ultra-rare trait perk definitions        |
| Groom               | availability        | `{}`                                        | Availability schedule                    |
| MilestoneTraitLog   | modifiersApplied    | `{}`                                        | Modifiers during evaluation              |
| UltraRareTraitEvent | appliedPerks        | `[]`                                        | Applied groom perks                      |
| UltraRareTraitEvent | triggerConditions   | `{}`                                        | Trigger conditions met                   |
| Facility            | upgrades            | `{}`                                        | Upgrade level map                        |

---

## Model Count by Domain

| Domain              | Models                                                                                                                                                                           | Count  |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Auth & Users        | User, RefreshToken, EmailVerificationToken, XpEvent                                                                                                                              | 4      |
| Horses              | Horse, Breed, Stable, HorseXpEvent                                                                                                                                               | 4      |
| Training            | TrainingLog                                                                                                                                                                      | 1      |
| Competition         | Show, ShowEntry, CompetitionResult                                                                                                                                               | 3      |
| Breeding & Foal Dev | FoalDevelopment, FoalActivity, FoalTrainingHistory                                                                                                                               | 3      |
| Traits              | TraitHistoryLog, MilestoneTraitLog, UltraRareTraitEvent                                                                                                                          | 3      |
| Grooms              | Groom, GroomAssignment, GroomInteraction, GroomSalaryPayment, GroomPerformanceRecord, GroomMetrics, GroomHorseSynergy, GroomAssignmentLog, GroomLegacyLog, GroomTalentSelections | 10     |
| Riders              | Rider, RiderAssignment                                                                                                                                                           | 2      |
| Trainers            | Trainer, TrainerAssignment                                                                                                                                                       | 2      |
| Community           | ForumThread, ForumPost, DirectMessage, Club, ClubMembership, ClubElection, ClubCandidate, ClubBallot                                                                             | 8      |
| Marketplace         | HorseSale                                                                                                                                                                        | 1      |
| Services            | Facility, FacilityUpgrade                                                                                                                                                        | 2      |
| **Total**           |                                                                                                                                                                                  | **43** |
