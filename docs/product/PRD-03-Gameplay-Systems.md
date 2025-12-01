# PRD-03: Gameplay Systems

**Version:** 2.0.0
**Last Updated:** 2025-12-01
**Status:** Backend ✅ Complete | Frontend ❌ Pending
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

| Parameter | Value | Description |
|-----------|-------|-------------|
| Minimum Age | 3 years | Horses must mature before training |
| Maximum Age | 20 years | Training restricted for elderly horses |
| Global Cooldown | 7 days | One training session per week (any discipline) |
| Base Score Gain | +5 points | Discipline score increase per session |
| Base XP Award | +5 XP | User XP per training session |
| Stat Gain Chance | 15% | Random stat increase probability |

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
| Rodeo | Strength, Agility, Endurance | Multiple rodeo events |

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

| Attribute | Options | Description |
|-----------|---------|-------------|
| Specialty | foal_care, general, training, medical | Area of expertise |
| Skill Level | novice, intermediate, expert, master | Experience tier |
| Personality | gentle, energetic, patient, strict | Affects care outcomes |
| Level | 1-10 | Career progression |
| Career Weeks | 0-104 | Time employed (max 2 years) |

### 3.2 Personality Effects on Epigenetic Traits

| Personality | Primary Bonus | Trait Influence |
|-------------|---------------|-----------------|
| GENTLE | +20% AFFECTIONATE | Enhances affectionate, confident |
| ENERGETIC | +20% BRAVE | Boosts brave, social traits |
| PATIENT | +20% RESILIENT | Develops resilient, confident |
| FIRM | +20% CONFIDENT | Strengthens brave, confident |
| BALANCED | +10% all | Moderate all positive traits |

### 3.3 Age-Based Task System

| Age Range | Task Category | Activities |
|-----------|---------------|------------|
| 0-2 years | Enrichment | Trust building, desensitization, showground exposure |
| 1-3 years | Foal Grooming | Early touch, hoof handling, tying practice |
| 3+ years | General Grooming | Brushing, hand-walking, stall care, bathing |

**Daily Limits:** One interaction per horse per day (prevents stacking)

### 3.4 Career Lifecycle

**Retirement System:**
- Mandatory retirement: 104 weeks (2 years)
- Early retirement: Level 10+ or 12+ assignments
- Approaching retirement alerts

**Legacy System:**
- Eligibility: Retired level 7+ grooms
- Protégé generation: Inherit perks and bonuses
- Perk inheritance: Personality-based selection

### 3.5 Talent Tree (3 Tiers)

| Tier | Level Req | Description |
|------|-----------|-------------|
| Tier 1 | Level 3+ | Basic talents |
| Tier 2 | Level 5+ | Advanced talents |
| Tier 3 | Level 8+ | Master talents |

- 24 unique talents across personalities
- One talent per tier (permanent choice)
- Passive bonuses to interactions

### 3.6 Conformation Show Handling

**Score Breakdown:**
| Component | Weight | Source |
|-----------|--------|--------|
| Horse Conformation | 65% | 8 body region scores |
| Handler Skill | 20% | Groom show_handling_skill |
| Bond Score | 8% | Horse-groom relationship |
| Temperament Synergy | 7% | Personality match |

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

| Source | Amount | Sink | Cost |
|--------|--------|------|------|
| Starting Money | $1,000 | Training | Variable |
| Competition 1st | 50% prize | Groom Salary | Weekly |
| Competition 2nd | 30% prize | Breeding Fee | Per breeding |
| Competition 3rd | 20% prize | Entry Fees | Per competition |

### 5.2 User Progression

**XP System:**
```
Level 1: 0-199 XP
Level 2+: 100 XP per level

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

## Cross-References

- **Previous:** [PRD-02-Core-Features.md](./PRD-02-Core-Features.md)
- **Next:** [PRD-04-Advanced-Systems.md](./PRD-04-Advanced-Systems.md)
- **Historical Source:** `docs/history/claude-systems/`

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-11-07 | Initial sparse version |
| 2.0.0 | 2025-12-01 | Major expansion from historical docs consolidation |
