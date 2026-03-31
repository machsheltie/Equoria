# PRD-03: Gameplay Systems

**Version:** 2.2.0
**Last Updated:** 2026-03-25
**Status:** Backend ✅ Complete | Frontend ✅ Complete
**Source Integration:** Consolidated from docs/history/claude-systems/

---

## Overview

This document specifies the core gameplay loops and systems that drive Equoria. All systems are implemented in the backend with comprehensive API coverage.

### Core Game Loop

```
1. User Registration → Create account, start with $1,000
2. Horse Acquisition → Purchase or breed horses
3. Foal Development → Raise foals with enrichment activities (epigenetic traits)
4. Groom Assignment → Hire grooms for care and bonding
5. Training → Develop horse skills in 23 disciplines
6. Competition → Enter shows to earn prizes, XP, and prestige
7. Breeding → Create next generation with improved genetics
8. Progression → Advance user level and expand operations
```

---

## 1. Training System

**Status:** ✅ Production Ready (100% Backend Complete)
**Source:** `docs/history/claude-systems/training-system.md`

### 1.1 Core Mechanics

| Parameter        | Value     | Description                                    |
| ---------------- | --------- | ---------------------------------------------- |
| Minimum Age      | 3 years   | Horses must mature before training             |
| Maximum Age      | 20 years  | Training restricted for elderly horses         |
| Global Cooldown  | 7 days    | One training session per week (any discipline) |
| Base Score Gain  | +5 points | Discipline score increase per session          |
| Base XP Award    | +5 XP     | User XP per training session                   |
| Stat Gain Chance | 15%       | Random stat increase probability               |

### 1.2 Disciplines (23 Total)

**Western Disciplines:**
| Discipline | Primary Stats | Description |
|------------|---------------|-------------|
| Western Pleasure | Obedience, Focus, Precision | Smooth gaits, calm demeanor |
| Reining | Precision, Agility, Focus | Spins, slides, stops |
| Cutting | Agility, Strength, Intelligence | Cattle work |
| Barrel Racing | Speed, Agility, Stamina | Timed pattern racing |
| Roping | Strength, Precision, Focus | Cattle roping |
| Team Penning | Intelligence, Agility, Obedience | Team cattle sorting |
| Rodeo | Strength, Agility, Endurance | 5 events: bull riding, bronc riding, steer wrestling, team roping, tie-down roping |

**English Disciplines:**
| Discipline | Primary Stats | Description |
|------------|---------------|-------------|
| Hunter | Precision, Endurance, Agility | Jump courses for style |
| Saddleseat | Flexibility, Obedience, Precision | High-stepping breeds |
| Dressage | Precision, Obedience, Focus | Classical movements |
| Show Jumping | Agility, Precision, Intelligence | Jump courses for speed |
| Eventing | Endurance, Precision, Agility | Three-phase competition |
| Cross Country | Endurance, Intelligence, Agility | Natural obstacles |

**Specialized Disciplines:**
| Discipline | Primary Stats | Requirements |
|------------|---------------|--------------|
| Endurance | Endurance, Stamina, Speed | Long-distance racing |
| Vaulting | Strength, Flexibility, Endurance | Gymnastics on horseback |
| Polo | Speed, Agility, Intelligence | Team ball sport |
| Combined Driving | Obedience, Strength, Focus | Carriage driving |
| Fine Harness | Precision, Flexibility, Obedience | Show driving |
| Gaited | Flexibility, Obedience, Focus | **Requires Gaited trait** |
| Gymkhana | Speed, Flexibility, Stamina | Timed games |

**Racing Disciplines:**
| Discipline | Primary Stats | Description |
|------------|---------------|-------------|
| Racing | Speed, Stamina, Intelligence | Flat track racing |
| Steeplechase | Speed, Endurance, Stamina | Jump racing |
| Harness Racing | Speed, Precision, Stamina | Sulky racing |

### 1.3 Trait Integration

**Positive Training Effects:**
| Trait | XP Bonus | Stat Chance | Other |
|-------|----------|-------------|-------|
| intelligent | +25% | +15% | -10% training time |
| athletic | +20% physical | - | +25% stamina bonus |
| eagerLearner | +25% | +10% | +20% motivation |
| resilient | - | - | -15% training stress |
| trainabilityBoost | +30% | +20% | +25% success rate |

**Negative Training Effects:**
| Trait | XP Penalty | Other Effects |
|-------|------------|---------------|
| lazy | -20% | +15% training time |
| stubborn | -15% | +30% resistance |
| fragile | - | +30% injury risk |
| nervous | - | +25% stress increase |

### 1.4 API Endpoints

```
POST /api/training/train              - Execute training session
GET  /api/training/status/:horseId    - Get training status (all disciplines)
GET  /api/training/eligibility/:id/:d - Check discipline eligibility
GET  /api/horses/trainable/:userId    - Get user's trainable horses
```

---

## 2. Competition System

**Status:** ✅ Complete (100% Backend)
**Source:** `docs/history/claude-systems/GAME_FEATURES.md`

### 2.1 Competition Mechanics

**Entry Requirements:**

- Minimum age: 3 years
- Maximum age: 21 years (retirement)
- Health status: Must be healthy
- Trait requirements: Discipline-specific (e.g., Gaited requires Gaited trait)
- Level requirements: Shows have min/max level restrictions

**Scoring Algorithm:**

```
Base Score = weighted_average(discipline_stats) × trait_modifiers
Age Factor = peak_at_6-8_years_curve
Random Factor = ±5% variance
Final Score = Base Score × Age Factor × Random Factor
```

**Prize Distribution:**
| Placement | Prize Share | Horse XP | User XP | Stat Gain Chance |
|-----------|-------------|----------|---------|------------------|
| 1st | 50% | 30 XP | 20 XP | 10% |
| 2nd | 30% | 27 XP | 15 XP | 5% |
| 3rd | 20% | 25 XP | 10 XP | 3% |
| 4th+ | 0% | 20 XP | 0 XP | 0% |

### 2.2 Horse Level Calculation

```
Horse Level = baseStats + legacyTraits + disciplineAffinity + trainingScore

Level Thresholds:
- Levels 1-10: Every 50 points (0-500)
- Levels 11-15: Every 100 points (500-1000)
```

### 2.3 API Endpoints

```
POST /api/competition/enter                    - Enter horse in competition
POST /api/competition/execute                  - Execute competition
GET  /api/competition/eligibility/:id/:disc    - Check eligibility
GET  /api/competition/disciplines              - Get all disciplines
GET  /api/competition/show/:id/results         - Get show results
GET  /api/competition/horse/:id/results        - Get horse history
GET  /api/leaderboard/competition              - Leaderboards
```

---

## 3. Groom Management System

**Status:** ✅ Comprehensive (77 tests, 100% passing)
**Source:** `docs/history/claude-systems/groomsystem.md`, `groompersonalitytraitbonus.md`

### 3.1 Groom Attributes

| Attribute    | Options                               | Description                 |
| ------------ | ------------------------------------- | --------------------------- |
| Specialty    | foal_care, general, training, medical | Area of expertise           |
| Skill Level  | novice, intermediate, expert, master  | Experience tier             |
| Personality  | gentle, energetic, patient, strict    | Affects care outcomes       |
| Level        | 1-10                                  | Career progression          |
| Career Weeks | 0-104                                 | Time employed (max 2 years) |

### 3.2 Personality Effects on Epigenetic Traits

| Personality | Primary Bonus     | Trait Influence                  |
| ----------- | ----------------- | -------------------------------- |
| GENTLE      | +20% AFFECTIONATE | Enhances affectionate, confident |
| ENERGETIC   | +20% BRAVE        | Boosts brave, social traits      |
| PATIENT     | +20% RESILIENT    | Develops resilient, confident    |
| FIRM        | +20% CONFIDENT    | Strengthens brave, confident     |
| BALANCED    | +10% all          | Moderate all positive traits     |

### 3.3 Age-Based Task System

| Age Range | Task Category    | Activities                                           |
| --------- | ---------------- | ---------------------------------------------------- |
| 0-2 years | Enrichment       | Trust building, desensitization, showground exposure |
| 1-3 years | Foal Grooming    | Early touch, hoof handling, tying practice           |
| 3+ years  | General Grooming | Brushing, hand-walking, stall care, bathing          |

**Daily Limits:** One interaction per horse per day (prevents stacking)

### 3.4 Career Lifecycle

**Retirement System:**

- Mandatory retirement: 104 weeks (2 years)
- Early retirement: Level 10+ or 12+ assignments
- Approaching retirement alerts

**Legacy System:**

- Eligibility: Retired level 7+ grooms with ≥50 XP
- Protégé generation cost: 2,000 currency per protégé
- Protégé starting level: parent groom level minus 6 (minimum level 1)
- Perk inheritance: Up to 2 perks transfer, selected by personality match (groom personality determines which perk category transfers)
- Stat bonus: +10% of parent groom's primary skill transferred to protégé
- Limits: 1 protégé per retired groom, maximum 3 active legacy grooms per player

### 3.5 Talent Tree (3 Tiers)

| Tier   | Level Req | Description      |
| ------ | --------- | ---------------- |
| Tier 1 | Level 3+  | Basic talents    |
| Tier 2 | Level 5+  | Advanced talents |
| Tier 3 | Level 8+  | Master talents   |

- 24 unique talents across personalities
- One talent per tier (permanent choice)
- Passive bonuses to interactions

### 3.6 Conformation Show Handling

**Status:** ❌ Not Implemented — Full Specification Ready
**Dependencies:** PRD-02 §3.1 (Conformation Scoring), §7 below (Breed Temperament System)

Conformation shows evaluate horses on physical appearance and presentation quality — not ridden performance. The groom acts as the handler, presenting the horse to judges.

**Score Formula:**

```
conformationScore = average(horse.conformationScores[all 8 regions])  // 0-100
handlerScore = groom.showHandlingSkill                                // 0-100
bondScore = groomHorseBond.level                                      // 0-100
temperamentSynergy = calculateSynergy(horse.temperament, groom.personality) // 0-100

finalScore = (conformationScore * 0.65)
           + (handlerScore * 0.20)
           + (bondScore * 0.08)
           + (temperamentSynergy * 0.07)
```

**Score Breakdown:**

| Component           | Weight | Source                                        | Description                         |
| ------------------- | ------ | --------------------------------------------- | ----------------------------------- |
| Horse Conformation  | 65%    | Average of 8 body region scores (PRD-02 §3.1) | Physical structure quality          |
| Handler Skill       | 20%    | Groom's `show_handling_skill` attribute       | Presentation technique              |
| Bond Score          | 8%     | Horse-groom bond level                        | Trust and cooperation               |
| Temperament Synergy | 7%     | Horse temperament × groom personality match   | Calmness and responsiveness in ring |

**Temperament Synergy Calculation:**

| Horse Temperament     | Best Groom Personality | Synergy Score           |
| --------------------- | ---------------------- | ----------------------- |
| Calm, Steady          | Any                    | 80-100 (easy to handle) |
| Spirited, Bold        | Energetic, Firm        | 70-90                   |
| Nervous, Reactive     | Patient, Gentle        | 60-85                   |
| Stubborn, Independent | Firm, Patient          | 50-75                   |
| Playful               | Energetic, Balanced    | 65-85                   |
| Lazy                  | Energetic, Firm        | 55-75                   |
| Aggressive            | Firm, Patient          | 40-65                   |

Poor matches (e.g., Nervous horse + Energetic groom) produce synergy scores of 20-40.

**Entry Requirements:**

- **Minimum age:** 1 year (youngstock classes available — lower than ridden competition minimum of 3)
- **No maximum age** — conformation shows are not physically demanding
- **Groom required:** A groom must be explicitly assigned as show handler before entry
- **Health:** Horse must be in healthy status
- **No training prerequisite** — conformation is innate, not trained

**Age Classes:**

| Class      | Age Range | Description                                |
| ---------- | --------- | ------------------------------------------ |
| Weanling   | 0-1 years | Youngest class, basic structure evaluation |
| Yearling   | 1-2 years | Growth and development assessment          |
| Youngstock | 2-3 years | Pre-training physical evaluation           |
| Junior     | 3-5 years | Maturing conformation                      |
| Senior     | 6+ years  | Full maturity evaluation                   |

**Rewards (Not Prize Money):**

Conformation shows award prestige, not currency. This differentiates them from ridden competitions.

| Placement | Ribbon | Title Points | Breeding Value Boost               |
| --------- | ------ | ------------ | ---------------------------------- |
| 1st       | Blue   | +10          | +5% to offspring conformation mean |
| 2nd       | Red    | +7           | +3% to offspring conformation mean |
| 3rd       | Yellow | +5           | +1% to offspring conformation mean |
| 4th+      | White  | +2           | None                               |

**Title Progression:** Accumulated title points unlock permanent prefixes:

- 25 points: "Noteworthy"
- 50 points: "Distinguished"
- 100 points: "Champion"
- 200 points: "Grand Champion"

**Breeding Value Boost:** Winners pass a small conformation bonus to offspring, stacking with normal breeding inheritance. Capped at +15% total accumulated boost.

**API Endpoints:**

```
POST /api/v1/competition/conformation/enter           - Enter conformation show
POST /api/v1/competition/conformation/execute          - Run the show (score + rank)
GET  /api/v1/competition/conformation/eligibility/:id  - Check horse eligibility
GET  /api/v1/competition/conformation/titles/:horseId  - Get title points and current title
```

**Acceptance Criteria:**

- Scoring formula produces final score from 4 components with documented weights (65/20/8/7)
- Horses as young as 1 year can enter (age class assigned automatically)
- Entry rejected if no groom assigned as handler
- No prize money awarded — only ribbons, title points, and breeding value boost
- Breeding value boost capped at +15% and correctly applied to offspring conformation generation
- Title progression thresholds trigger at correct point totals
- Conformation show results stored in competition history alongside ridden competition results

### 3.7 API Endpoints

```
POST /api/grooms/hire              - Hire new groom
POST /api/grooms/assign            - Assign to horse
POST /api/grooms/interact          - Record interaction
GET  /api/grooms/user/:userId      - Get user's grooms
GET  /api/grooms/definitions       - System definitions

# Career Management
GET  /api/grooms/:id/retirement/eligibility
POST /api/grooms/:id/retirement/process
GET  /api/grooms/retirement/approaching
GET  /api/grooms/retirement/statistics

# Legacy System
GET  /api/grooms/:id/legacy/eligibility
POST /api/grooms/:id/legacy/create
GET  /api/grooms/legacy/history

# Talent Tree
GET  /api/grooms/talents/definitions
GET  /api/grooms/:id/talents
POST /api/grooms/:id/talents/select
```

---

## 4. Breeding & Foal Development

**Status:** ⚠️ Functional (Backend Complete, Advanced Features Planned)

### 4.1 Breeding Mechanics

- Parent tracking (sire/dam relationships)
- Epigenetic trait inheritance
- Temperament compatibility analysis
- Breeding cooldowns
- Stud fee management

### 4.2 Foal Development (Days 0-6)

**Critical Development Period:**
| Day | Milestone | Epigenetic Impact |
|-----|-----------|-------------------|
| Day 1 | Imprinting | First bond formation |
| Week 1 | Socialization | Social trait development |
| Week 2 | Curiosity & Play | Explorative traits |
| Week 3 | Trust & Handling | Handler bonds |
| Week 4 | Confidence vs Reactivity | Temperament settling |

**Enrichment Activities:**

- Trust building exercises
- Desensitization training
- Showground exposure
- Early touch habituation

### 4.3 Milestone Evaluation

**Scoring Formula:**

```
Milestone Score = Bond Modifier + Task Consistency + Care Quality
- Bond Modifier: -2 to +2 based on bond level
- Task Consistency: 0 to +3 based on care patterns
- Care Quality: Groom personality bonuses

Trait Confirmation:
- Score ≥ 3: Confirms positive trait
- Score ≤ -3: Confirms negative trait
- Otherwise: Randomized outcome
```

### 4.4 API Endpoints

```
POST /api/horses/foals              - Create new foal
POST /api/foals/:id/enrichment      - Foal enrichment activity
GET  /api/foals/:id/development     - Get development status
POST /api/traits/evaluate-milestone - Evaluate milestone
GET  /api/traits/milestone-status/:id
```

---

## 5. Economy & Progression

### 5.1 Currency System

| Source          | Amount    | Sink         | Cost            |
| --------------- | --------- | ------------ | --------------- |
| Starting Money  | $1,000    | Training     | Variable        |
| Competition 1st | 50% prize | Groom Salary | Weekly          |
| Competition 2nd | 30% prize | Breeding Fee | Per breeding    |
| Competition 3rd | 20% prize | Entry Fees   | Per competition |

### 5.2 User Progression

**XP System:**

```
Level 1: 0-99 XP
Level 2+: 100 XP per level (Level 2 = 100-199 XP, Level 3 = 200-299 XP, etc.)

XP Sources:
- Training: +5 XP per session
- Competition 1st: +20 XP
- Competition 2nd: +15 XP
- Competition 3rd: +10 XP
- Breeding: +15 XP
```

### 5.3 Horse XP System (Independent)

```
100 Horse XP = 1 allocable stat point

Competition XP:
- 1st Place: 30 XP (20 base + 10 bonus)
- 2nd Place: 27 XP (20 base + 7 bonus)
- 3rd Place: 25 XP (20 base + 5 bonus)
- 4th+: 20 XP (base only)
```

---

## 6. Leaderboard System

**Status:** ✅ Implemented

### 6.1 Leaderboard Categories

- Overall competition rankings
- Discipline-specific rankings
- Earnings leaderboards
- User level rankings

### 6.2 API Endpoints

```
GET /api/leaderboard                      - Global leaderboard
GET /api/leaderboard/discipline/:disc     - Discipline leaderboard
```

---

## 7. Breed Temperament System

**Status:** ❌ Not Implemented — Full Specification Ready (New System)
**Dependencies:** Prisma migration (new `temperament` field on Horse model)

Each horse receives one temperament at birth, selected via weighted random probability from the breed's `temperament_weights` profile. Temperament is a cross-cutting attribute that modifies training, competition, groom interactions, and bonding speed.

### 7.1 Temperament Types (11 Total)

| Temperament | Description                                           | Prevalence                      |
| ----------- | ----------------------------------------------------- | ------------------------------- |
| Spirited    | High energy, forward-moving, enthusiastic             | Common in hot-blooded breeds    |
| Nervous     | Easily startled, anxious, flight-prone                | Common in Thoroughbreds         |
| Calm        | Relaxed, unfazed, steady under pressure               | Common in stock breeds          |
| Bold        | Confident, fearless, willing to try new things        | Common in Arabians, Andalusians |
| Steady      | Reliable, predictable, consistent performer           | Common in working breeds        |
| Independent | Self-directed, not herd-bound, can be aloof           | Moderate across breeds          |
| Reactive    | Quick responses, hyperaware, easily triggered         | Common in hot-blooded breeds    |
| Stubborn    | Resistant to direction, tests boundaries              | Low-moderate across breeds      |
| Playful     | Curious, energetic, mischievous                       | Moderate in young-type breeds   |
| Lazy        | Low motivation, needs encouragement, conserves energy | Low-moderate in draft-type      |
| Aggressive  | Dominant, pushy, requires experienced handling        | Rare across all breeds          |

### 7.2 Assignment at Birth

```
temperament = weightedRandomSelect(breed.temperament_weights)

// Example: Thoroughbred weights (sum to 100):
// Spirited: 30, Nervous: 15, Calm: 3, Bold: 15, Steady: 5,
// Independent: 5, Reactive: 15, Stubborn: 3, Playful: 5, Lazy: 3, Aggressive: 1
```

Temperament is permanent once assigned. No gameplay mechanic changes it.

### 7.3 Breed Temperament Weight Data (12 Breeds)

| Breed                   | Spirited | Nervous | Calm | Bold | Steady | Indep. | Reactive | Stubborn | Playful | Lazy | Aggr. |
| ----------------------- | -------- | ------- | ---- | ---- | ------ | ------ | -------- | -------- | ------- | ---- | ----- |
| Thoroughbred            | 30       | 15      | 3    | 15   | 5      | 5      | 15       | 3        | 5       | 3    | 1     |
| Arabian                 | 20       | 10      | 5    | 25   | 5      | 10     | 5        | 10       | 8       | 1    | 1     |
| American Saddlebred     | 30       | 2       | 10   | 20   | 10     | 5      | 3        | 3        | 15      | 1    | 1     |
| National Show Horse     | 25       | 5       | 8    | 20   | 8      | 5      | 5        | 5        | 12      | 1    | 1     |
| Pony of the Americas    | 5        | 2       | 30   | 10   | 25     | 5      | 2        | 5        | 10      | 5    | 1     |
| Appaloosa               | 10       | 2       | 25   | 15   | 25     | 5      | 2        | 5        | 5       | 5    | 1     |
| Tennessee Walking Horse | 5        | 1       | 40   | 5    | 30     | 3      | 1        | 3        | 5       | 5    | 1     |
| Pura Raza Espanola      | 20       | 5       | 10   | 25   | 10     | 5      | 5        | 5        | 8       | 1    | 1     |
| American Quarter Horse  | 10       | 2       | 30   | 10   | 25     | 5      | 2        | 5        | 5       | 5    | 1     |
| Walkaloosa              | 5        | 1       | 35   | 10   | 30     | 3      | 1        | 3        | 5       | 5    | 1     |
| Lusitano                | 20       | 5       | 20   | 25   | 15     | 5      | 3        | 3        | 10      | 2    | 2     |
| Paint Horse             | 15       | 2       | 25   | 20   | 20     | 5      | 1        | 1        | 10      | 1    | 0     |

### 7.4 Training Modifiers

Temperament affects training session outcomes (XP gain and discipline score gain):

| Temperament | XP Modifier | Score Modifier | Notes                          |
| ----------- | ----------- | -------------- | ------------------------------ |
| Spirited    | +10%        | +5%            | High energy aids learning      |
| Nervous     | -10%        | -5%            | Anxiety impairs focus          |
| Calm        | +5%         | +10%           | Steady focus, consistent gains |
| Bold        | +5%         | +5%            | Willing to try new things      |
| Steady      | +5%         | +10%           | Reliable improvement           |
| Independent | -5%         | 0%             | Resists directed training      |
| Reactive    | 0%          | -5%            | Easily distracted              |
| Stubborn    | -15%        | -10%           | Actively resists instruction   |
| Playful     | +5%         | -5%            | Engaged but unfocused          |
| Lazy        | -20%        | -15%           | Low effort output              |
| Aggressive  | -10%        | -5%            | Requires careful handling      |

### 7.5 Competition Modifiers

Temperament affects competition performance (applied as percentage modifier to final score):

| Temperament | Ridden Competition | Conformation Show | Notes                                   |
| ----------- | ------------------ | ----------------- | --------------------------------------- |
| Spirited    | +3%                | -2%               | Great under saddle, restless in hand    |
| Nervous     | -5%                | -5%               | Crowds and pressure reduce performance  |
| Calm        | +2%                | +5%               | Consistent performer, excellent in ring |
| Bold        | +5%                | +2%               | Thrives under pressure                  |
| Steady      | +3%                | +3%               | Reliable in all settings                |
| Independent | -2%                | -3%               | May ignore handler cues                 |
| Reactive    | -3%                | -4%               | Environmental triggers hurt performance |
| Stubborn    | -4%                | -3%               | May refuse at critical moments          |
| Playful     | +1%                | -1%               | Entertaining but unpredictable          |
| Lazy        | -5%                | 0%                | Lacks competitive drive under saddle    |
| Aggressive  | -3%                | -5%               | Judges penalize difficult behavior      |

### 7.6 Groom Synergy

Temperament interacts with groom personality to modify bonding speed and interaction quality:

| Horse Temperament | Best Groom Match | Synergy Effect                        |
| ----------------- | ---------------- | ------------------------------------- |
| Spirited          | Energetic        | +20% bonding speed                    |
| Nervous           | Patient, Gentle  | +25% bonding speed, -stress           |
| Calm              | Any              | +10% bonding speed (universally easy) |
| Bold              | Energetic, Firm  | +15% bonding speed                    |
| Steady            | Balanced         | +10% bonding speed                    |
| Independent       | Patient          | +15% bonding speed                    |
| Reactive          | Patient, Gentle  | +20% bonding speed, -stress           |
| Stubborn          | Firm             | +15% bonding speed                    |
| Playful           | Energetic        | +15% bonding speed                    |
| Lazy              | Energetic, Firm  | +10% bonding speed                    |
| Aggressive        | Firm, Patient    | +10% bonding speed (hard to bond)     |

Poor groom matches (e.g., Nervous horse + Firm groom) reduce bonding speed by 10-20%.

### 7.7 Breeding Inheritance

Foal temperament is NOT directly inherited from parents. It is always selected from the foal's breed `temperament_weights`.

Future enhancement (optional): epigenetic flags from enrichment activities during foal development could nudge probabilities by ±5% for specific temperaments, but the base distribution always comes from the breed.

### 7.8 Technical Specifications

- `Horse.temperament` — New String field on Horse model (nullable for existing horses)
- Prisma migration: `ALTER TABLE horses ADD COLUMN temperament VARCHAR(20)`
- Assigned at horse creation and foal birth
- Temperament is permanent — no mutation endpoints
- `Breed.breedGeneticProfile.temperament_weights` provides probability distribution
- Temperament included in existing `GET /api/v1/horses/:id` response (no separate endpoint needed)

**API Endpoints:**

```
GET /api/v1/horses/temperament-definitions  - List all 11 types with descriptions and game effects
```

**Acceptance Criteria:**

- Every new horse and foal receives exactly one temperament
- Temperament distribution across 1000+ horses of the same breed matches `temperament_weights` within statistical tolerance (chi-squared test, p > 0.05)
- Training modifiers correctly applied (verifiable: Stubborn horse gains less XP than Calm horse in same session)
- Competition modifiers correctly applied to final score
- Groom synergy bonding speed correctly adjusted per temperament-personality pairing
- Existing horses without temperament return `null` (backward compatible)
- Temperament definitions endpoint returns all 11 types with training/competition/groom effect descriptions

---

## Cross-References

- **Previous:** [PRD-02-Core-Features.md](./PRD-02-Core-Features.md)
- **Next:** [PRD-04-Advanced-Systems.md](./PRD-04-Advanced-Systems.md)
- **Historical Source:** `docs/history/claude-systems/`

---

## Document History

| Version | Date       | Changes                                                               |
| ------- | ---------- | --------------------------------------------------------------------- |
| 1.0.0   | 2025-11-07 | Initial sparse version                                                |
| 2.0.0   | 2025-12-01 | Major expansion from historical docs consolidation                    |
| 2.2.0   | 2026-03-25 | Full Conformation Show spec (§3.6), new Breed Temperament System (§7) |
| 2.1.0   | 2026-03-18 | Frontend marked complete (Epics 1-21 done)                            |
