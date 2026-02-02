# PRD-04: Advanced Systems - Epigenetics & Traits

**Version:** 1.0.0
**Last Updated:** 2025-12-01
**Status:** Backend ✅ Complete | Frontend ❌ Pending
**Source Integration:** Consolidated from docs/history/claude-systems/

---

## Overview

This document covers the advanced trait and genetics systems that provide strategic depth to Equoria. These systems create meaningful long-term consequences for player decisions in foal care, groom selection, and breeding programs.

---

## 1. Epigenetic Trait System

**Status:** ✅ Advanced Implementation Complete
**Source:** `docs/history/claude-systems/epigenetictraits.md`, `epigenetictraitflagsystem.md`

### 1.1 Core Concept

Epigenetic traits reflect developmental influences that shape a horse's behavior, performance, and adaptability. These traits are **not static** - they emerge based on:
- Foalhood experiences
- Early training patterns
- Bonding quality
- Environmental exposure
- Groom personality influence

### 1.2 Trait Categories

**Behavioral Epigenetic Traits:**
| Trait | Type | Description |
|-------|------|-------------|
| secretive | Epigenetic | Slower to bond; stats harder to detect |
| explorative | Epigenetic | Highly curious; trail event bonuses |
| desensitized | Epigenetic | Lower fear response to stimuli |
| peopleOriented | Epigenetic | Bonds quickly; faster XP gain |
| routineDependent | Epigenetic | Best under consistent care |
| stressProne | Epigenetic | Vulnerable to unpredictable conditions |
| confident | Epigenetic | Bonus XP during training |
| resilient | Epigenetic | Faster recovery from stress |
| showCalm | Epigenetic | Stands well for judging |
| crowdReady | Epigenetic | Comfortable in busy environments |

**Conditional/Temporary Traits:**
| Trait | Type | Description |
|-------|------|-------------|
| injuryProne | Epigenetic/Temp | Increased injury risk; may fade |
| burnoutImmune | Dynamic | Prevents burnout; earned through care |
| presentationBoosted | Temporary | Cosmetic bonus from grooming |
| epigeneticEdge | Hidden | Bonus from ideal foalhood conditions |

### 1.3 Development Windows

Traits develop during **early life (0-3 years)** based on care patterns:

| Age Range | Influences | Potential Traits |
|-----------|------------|------------------|
| 0-1 year | Socialization, desensitization, foal handling | peopleOriented, desensitized, secretive |
| 1-2 years | Routine care, curiosity, play | explorative, routineDependent, stressProne |
| 2-3 years | Structured training, bonding, event exposure | confident, resilient, crowdReady, showCalm |

### 1.4 Trait Stacking Rules

- **Maximum 3 visible epigenetic traits** per horse
- **1 hidden trait slot** (epigeneticEdge)
- Temporary traits overlay but don't count toward limit
- Dynamic traits (burnoutImmune) exist outside the stack

### 1.5 Conflict Resolution

Certain traits cannot co-exist:

| Trait A | Conflicts With | Resolution |
|---------|----------------|------------|
| routineDependent | explorative | Temperament check determines winner |
| secretive | peopleOriented | Must pick one during bonding phase |
| stressProne | resilient | Dominant influence during foalhood wins |
| burnoutImmune | injuryProne | Training care determines override |

### 1.6 Hidden Trait: epigeneticEdge

Unlocked when **all ideal conditions** met during early life:
- Optimal nutrition
- Consistent bonding
- Minimal stress
- Appropriate training

**Benefits:**
- Subtle scoring bonuses
- Enhanced stat growth
- Increased genetic legacy value
- Only revealed through special evaluations

---

## 2. Epigenetic Flag System

**Status:** ✅ Complete (9 flags implemented)
**Source:** `docs/history/claude-systems/epigenetictraitflagsystem.md`

### 2.1 Flag Categories

**Confidence Flags:**
| Flag | Effect | Trigger |
|------|--------|---------|
| BRAVE | Competition bonus, stress resistance | Energetic groom + challenges overcome |
| FEARFUL | Stress penalty, competition anxiety | Missed socialization, trauma |
| CONFIDENT | Training XP bonus | Patient groom + milestone success |
| INSECURE | Bond difficulty | Inconsistent care |

**Social Flags:**
| Flag | Effect | Trigger |
|------|--------|---------|
| AFFECTIONATE | Bond speed bonus | Gentle groom + consistent touch |
| ANTISOCIAL | Handler penalty | Isolation, negative interactions |
| SOCIAL | Group training bonus | Socialization success |

**Resilience Flags:**
| Flag | Effect | Trigger |
|------|--------|---------|
| RESILIENT | Stress recovery +25% | Patient groom + stress survived |
| SENSITIVE | Stress vulnerability | Neglect, harsh treatment |

### 2.2 Flag Assignment Engine

Flags are evaluated weekly based on:
- Care pattern analysis (30-day window)
- Groom personality effects
- Milestone outcomes
- Stress/recovery events

**Age Restriction:** Only applies to horses under 3 years old

### 2.3 API Endpoints

```
POST /api/flags/evaluate           - Evaluate flags for horse
GET  /api/horses/:id/flags         - Get horse flags
GET  /api/flags/definitions        - Get flag definitions
GET  /api/epigenetic-traits/definitions
POST /api/epigenetic-traits/evaluate-milestone/:horseId
POST /api/epigenetic-traits/log-trait
GET  /api/epigenetic-traits/history/:horseId
GET  /api/epigenetic-traits/summary/:horseId
GET  /api/epigenetic-traits/breeding-insights/:horseId
```

---

## 3. Ultra-Rare Trait System

**Status:** ✅ 100% Backend Complete (14/14 tests passing)
**Source:** `docs/history/claude-systems/ultrarareexotictraits.md`

### 3.1 Overview

Ultra-rare and exotic traits are prestige traits requiring specific hidden conditions. They provide both mechanical impact and narrative flair, creating long-term goals and breeding legacy value.

### 3.2 Trait Tiers

| Tier | Base Chance | Description |
|------|-------------|-------------|
| Ultra-Rare | <3% | Probability-based, can be nudged by groom perks |
| Exotic | Conditional | Multi-factor unlock (lineage + flags + care) |

### 3.3 Ultra-Rare Traits (5 Total)

| Trait | Trigger Conditions | Mechanical Perks | Groom Synergy |
|-------|-------------------|------------------|---------------|
| **Phoenix-Born** | 3+ stress events + 2 recoveries | +30% stress decay; 3-day burnout recovery | Mindful Handler, Guardian Instinct |
| **Iron-Willed** | No skipped milestones + no negative traits by age 3 | Cannot be burned out; +5 stamina | Methodical, Detail-Oriented |
| **Empathic Mirror** | Same groom birth-3yrs; high bond entire time | Adopts companion mood; +5% team events | Soft-Hearted, Affectionate |
| **Born Leader** | Top bond + Steady temperament; always top 3 conformation | +2 discipline to nearby horses | Confident Leader |
| **Stormtouched** | Reactive temperament + missed care week + novelty event | +10% stat growth; 2x stress gain | Novelty Trainer, Reserved |

### 3.4 Exotic Traits (5 Total)

| Trait | Unlock Condition | Mechanical Perks | Groom Trigger |
|-------|-----------------|------------------|---------------|
| **Shadow-Follower** | 2+ missed socialization + late bond (after age 2) | +10 bond first handler; -20% others | Guardian Instinct |
| **Ghostwalker** | Bond <30 throughout youth + resilient flag | Immune to stress; max bond 60; no reassignment | Reserved, Iron-Willed |
| **Soulbonded** | Same groom all 4 milestones + >90 bond each | +10% show with same handler | Bondsmith |
| **Fey-Kissed** | Both parents have ultra-rare trait + perfect foal care | All-stat bonus; visual aura effect | Any groom with 3 rare perks |
| **Dreamtwin** | Twin birth + raised together + same groom + matching flags | Sibling effect: mirrored changes; weaker if separated | Playful, Soft-Spoken |

### 3.5 Groom Perk Influence

**Rare Trait Booster Mechanic:**
- +25% bonus if base chance exists
- +15% bonus if multiple conditions met
- Perk revealed after 2 successful trait triggers

### 3.6 UI Suggestions (Frontend)

- Gold border for ultra-rare traits
- Purple border for exotic traits
- "Lore" tab on horse profile
- Discovery notifications with flair

### 3.7 API Endpoints

```
GET  /api/ultra-rare-traits/definitions
GET  /api/ultra-rare-traits/:horseId
POST /api/ultra-rare-traits/evaluate/:horseId
GET  /api/ultra-rare-traits/events/:horseId
POST /api/ultra-rare-traits/check-conditions/:horseId
GET  /api/ultra-rare-traits/groom-perks/:groomId
```

---

## 4. Trait Discovery System

**Status:** ✅ Advanced Implementation
**Source:** `docs/history/claude-systems/trait-discovery-system.md`

### 4.1 Discovery Mechanics

Traits can be:
- **Unlocked automatically** when conditions met
- **Hidden at first** and revealed through bonding/evaluation
- **Earned dynamically** as horse performs/matures

### 4.2 Revelation Methods

| Method | Traits Revealed |
|--------|-----------------|
| Bonding Milestones | Social traits |
| Training Sessions | Performance traits |
| Competition Placement | Temperament traits |
| Veterinary Evaluation | Hidden traits |
| Lineage Analysis | epigeneticEdge |

### 4.3 API Endpoints

```
POST /api/traits/discover/:horseId    - Trigger discovery
GET  /api/traits/horse/:horseId       - Get horse traits
GET  /api/traits/definitions          - Get trait definitions
GET  /api/traits/discovery-status/:id - Get discovery status
POST /api/traits/batch-discover       - Batch discovery
GET  /api/traits/competition-impact/:id
GET  /api/traits/competition-comparison/:id
```

---

## 5. Competition Trait Impact

**Status:** ✅ Implemented

### 5.1 Trait Effects by Discipline

Each discipline has specific trait bonuses/penalties:

**Example - Dressage:**
| Trait | Effect |
|-------|--------|
| confident | +10% score |
| stressProne | -15% score |
| showCalm | +5% score |
| resilient | +5% score |

### 5.2 Analysis Endpoints

```
GET /api/traits/competition-impact/:horseId
GET /api/traits/competition-effects
GET /api/traits/competition-comparison/:horseId
```

---

## 6. Trait History & Breeding Insights

**Status:** ✅ Complete

### 6.1 Trait History Logging

Every trait assignment logged with:
- Source (groom, milestone, competition)
- Influence score
- Horse age at assignment
- Epigenetic flag status

### 6.2 Breeding Insights

Analysis for breeding decisions:
- Trait inheritance probability
- Epigenetic flag compatibility
- Ultra-rare trait potential

### 6.3 API Endpoints

```
GET /api/epigenetic-traits/history/:horseId
GET /api/epigenetic-traits/summary/:horseId
GET /api/epigenetic-traits/breeding-insights/:horseId
```

---

## 7. Enhanced Milestone Evaluation

**Status:** ✅ Complete

### 7.1 Milestone Types (5)

| Milestone | Age Window | Focus |
|-----------|------------|-------|
| Imprinting | Day 1 | First bond formation |
| Socialization | Week 1-4 | Social development |
| Curiosity & Play | Week 1-4 | Exploration tendencies |
| Trust & Handling | Week 1-4 | Handler relationships |
| Confidence vs Reactivity | Week 1-4 | Temperament setting |

### 7.2 Scoring Components

**Groom Care Integration:**
- Bond consistency tracking
- Task diversity scoring
- 30-day care pattern analysis

**Score Modifiers:**
- Bond level: -2 to +2
- Task consistency: 0 to +3
- Care gaps: Penalty applied

**Trait Confirmation Logic:**
- Score ≥3: Confirms positive trait
- Score ≤-3: Confirms negative trait
- Otherwise: Randomized

### 7.3 API Endpoints

```
POST /api/traits/evaluate-milestone
GET  /api/traits/milestone-status/:horseId
GET  /api/traits/milestone-definitions
```

---

## Cross-References

- **Previous:** [PRD-03-Gameplay-Systems.md](./PRD-03-Gameplay-Systems.md)
- **Next:** [PRD-05-Technical-Reference.md](./PRD-05-Technical-Reference.md) (if created)
- **Historical Source:** `docs/history/claude-systems/`

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-12-01 | Initial creation from historical docs consolidation |
