# Trait Modifiers Documentation

## Overview

Complete documentation of all trait definitions with type, rarity, category, conflicts, and gameplay effects for the Equoria horse simulation game.

## Positive Traits

### Common Positive Traits

#### resilient

- **Type**: positive
- **Rarity**: common
- **Category**: epigenetic
- **Conflicts**: fragile, easilyOverwhelmed
- **Description**: Less likely to be affected by stress
- **Gameplay Effects**:
  - Training stress reduction: 15%
  - Competition stress resistance: 15%
  - Stress recovery rate: +25%
  - Injury recovery bonus: +20%
  - Discipline bonuses: Cross Country (+5%), Endurance (+6%), Racing (+4%)

#### bold

- **Type**: positive
- **Rarity**: common
- **Category**: epigenetic
- **Conflicts**: nervous, fearful
- **Description**: Shows courage in challenging situations
- **Gameplay Effects**:
  - Training confidence bonus: +15%
  - Competition score modifier: +3.5%
  - Competition nerve bonus: +20%
  - Discipline bonuses: Show Jumping (+6%), Cross Country (+5%), Racing (+4%)

#### intelligent

- **Type**: positive
- **Rarity**: common
- **Category**: epigenetic
- **Conflicts**: lazy
- **Description**: Learns faster and retains training better
- **Gameplay Effects**:
  - Training XP modifier: +25%
  - Stat gain chance modifier: +15%
  - Training time reduction: 10%
  - Competition score modifier: +3%
  - Discipline bonuses: Dressage (+6%), Reining (+5%), Eventing (+4%)

#### athletic

- **Type**: positive
- **Rarity**: common
- **Category**: epigenetic
- **Conflicts**: fragile, lazy
- **Description**: Enhanced physical performance and stamina
- **Gameplay Effects**:
  - Physical training bonus: +20%
  - Stamina training bonus: +25%
  - Competition score modifier: +5%
  - Base stat boosts: stamina (+2), agility (+2), balance (+1)
  - Discipline bonuses: Racing (+7%), Show Jumping (+6%), Cross Country (+6%)

#### calm

- **Type**: positive
- **Rarity**: common
- **Category**: epigenetic
- **Conflicts**: nervous, aggressive, easilyOverwhelmed
- **Description**: Maintains composure in stressful situations
- **Gameplay Effects**:
  - Bonding bonus: +15%
  - Training stress reduction: 20%
  - Competition stress resistance: 25%
  - Base stress reduction: -5
  - Discipline bonuses: Dressage (+5%), Driving (+4%), Trail (+3%)

#### confident

- **Type**: positive
- **Rarity**: common
- **Category**: epigenetic
- **Conflicts**: nervous, fearful
- **Description**: This horse is brave in new situations
- **Gameplay Effects**:
  - Enhanced adaptation to new experiences
  - Reduced anxiety in unfamiliar environments
  - Improved performance under pressure

#### social

- **Type**: positive
- **Rarity**: common
- **Category**: epigenetic
- **Conflicts**: antisocial, aggressive
- **Description**: Enjoys interaction with other horses and humans
- **Gameplay Effects**:
  - Bonding bonus: +25%
  - Grooming bonding bonus: +30%
  - Training bonding bonus: +20%
  - Group training bonus: +15%
  - Stress reduction: -5

#### eagerLearner

- **Type**: positive
- **Rarity**: common
- **Category**: epigenetic
- **Conflicts**: lazy, stubborn
- **Description**: Shows enthusiasm for learning new skills and training
- **Gameplay Effects**:
  - Training XP modifier: +25%
  - Stat gain chance modifier: +10%
  - Base stat boost: +1
  - Motivation bonus: +20%
  - Competition score modifier: +2%

### Situational Positive Traits

#### presentationBoosted

- **Type**: positive
- **Rarity**: common
- **Category**: situational
- **Conflicts**: none
- **Description**: Scores higher in appearance-based events
- **Gameplay Effects**:
  - Enhanced performance in presentation competitions
  - Improved grooming effectiveness
  - Better show ring presence

#### showCalm

- **Type**: positive
- **Rarity**: common
- **Category**: situational
- **Conflicts**: nervous
- **Description**: Remains composed during competitions and shows
- **Gameplay Effects**:
  - Reduced competition stress
  - Improved performance consistency in shows
  - Better crowd tolerance

#### crowdReady

- **Type**: positive
- **Rarity**: common
- **Category**: situational
- **Conflicts**: nervous
- **Description**: Comfortable performing in front of large audiences
- **Gameplay Effects**:
  - Reduced crowd-related stress
  - Enhanced performance in public events
  - Improved show ring confidence

### Rare Positive Traits

#### trainabilityBoost

- **Type**: positive
- **Rarity**: rare
- **Category**: epigenetic
- **Conflicts**: stubborn
- **Description**: Exceptional learning ability and training response
- **Gameplay Effects**:
  - Training XP modifier: +30%
  - Stat gain chance modifier: +20%
  - Training success rate: +25%
  - Competition score modifier: +4%
  - Discipline bonuses: Dressage (+7%), Reining (+6%), Driving (+5%)

#### legendaryBloodline

- **Type**: positive
- **Rarity**: legendary
- **Category**: epigenetic
- **Conflicts**: none
- **Description**: Exceptional heritage with legendary performance potential
- **Gameplay Effects**:
  - Significant performance bonuses across all disciplines
  - Enhanced breeding value
  - Increased prestige and recognition

### Bond Traits

#### bonded

- **Type**: positive
- **Rarity**: common
- **Category**: bond
- **Conflicts**: aggressive, antisocial
- **Description**: Forms deeper trust with specific handlers
- **Gameplay Effects**:
  - Enhanced handler compatibility
  - Improved training cooperation
  - Stronger emotional connection with caretakers

## Negative Traits

### Common Negative Traits

#### nervous

- **Type**: negative
- **Rarity**: common
- **Category**: epigenetic
- **Conflicts**: bold, calm, confident, showCalm, crowdReady
- **Description**: Easily startled and stressed by new situations
- **Gameplay Effects**:
  - Bonding penalty: 20%
  - Training stress increase: +25%
  - Competition stress risk: +10
  - Competition score modifier: -4%
  - Discipline penalties: Racing (-6%), Show Jumping (-5%), Eventing (-4%)

#### stubborn

- **Type**: negative
- **Rarity**: common
- **Category**: epigenetic
- **Conflicts**: trainabilityBoost, eagerLearner
- **Description**: Resistant to training and new commands
- **Gameplay Effects**:
  - Training XP modifier: -15%
  - Training resistance: +30%
  - New skill penalty: 25%
  - Competition score modifier: -3%
  - Discipline penalties: Dressage (-6%), Reining (-5%), Eventing (-4%)

#### fragile

- **Type**: negative
- **Rarity**: common
- **Category**: epigenetic
- **Conflicts**: resilient, athletic
- **Description**: More susceptible to injury and stress
- **Gameplay Effects**:
  - Training injury risk: +30%
  - Training intensity limit: -20%
  - Injury recovery penalty: 30%
  - Competition score modifier: -3.5%
  - Discipline penalties: Cross Country (-8%), Show Jumping (-6%), Racing (-5%)

#### aggressive

- **Type**: negative
- **Rarity**: common
- **Category**: epigenetic
- **Conflicts**: calm, bonded, social
- **Description**: Difficult to handle and may show hostility
- **Gameplay Effects**:
  - Training difficulty increase: +25%
  - Trainer safety risk
  - Competition score modifier: -4.5%
  - Disqualification risk: 15%
  - Discipline penalties: Dressage (-8%), Driving (-7%), Trail (-6%)

#### lazy

- **Type**: negative
- **Rarity**: common
- **Category**: epigenetic
- **Conflicts**: intelligent, athletic, eagerLearner
- **Description**: Low motivation and energy for training
- **Gameplay Effects**:
  - Training XP modifier: -20%
  - Training motivation penalty: 25%
  - Training time increase: +15%
  - Competition score modifier: -3.5%
  - Discipline penalties: Endurance (-8%), Cross Country (-6%), Racing (-5%)

#### antisocial

- **Type**: negative
- **Rarity**: common
- **Category**: epigenetic
- **Conflicts**: social, bonded
- **Description**: Prefers isolation and avoids interaction with others
- **Gameplay Effects**:
  - Bonding penalty: 30%
  - Grooming bonding penalty: 25%
  - Group training penalty: 20%
  - Crowd stress: +15%
  - Stress increase: +10

#### fearful

- **Type**: negative
- **Rarity**: common
- **Category**: epigenetic
- **Conflicts**: confident, bold
- **Description**: Hesitation or spook-prone behavior under stress
- **Gameplay Effects**:
  - Increased stress responses
  - Reduced performance in challenging situations
  - Enhanced startle reactions

#### easilyOverwhelmed

- **Type**: negative
- **Rarity**: common
- **Category**: epigenetic
- **Conflicts**: resilient, calm
- **Description**: Slower recovery from mistakes or chaotic settings
- **Gameplay Effects**:
  - Reduced performance consistency
  - Increased stress accumulation
  - Slower adaptation to new environments

## Trait Conflict System

### Bidirectional Conflicts

- **confident** ↔ **fearful**, **nervous**
- **bold** ↔ **fearful**, **nervous**
- **calm** ↔ **nervous**, **aggressive**, **easilyOverwhelmed**
- **resilient** ↔ **fragile**, **easilyOverwhelmed**
- **intelligent** ↔ **lazy**
- **athletic** ↔ **fragile**, **lazy**
- **social** ↔ **antisocial**, **aggressive**
- **trainabilityBoost** ↔ **stubborn**
- **eagerLearner** ↔ **lazy**, **stubborn**

### Conflict Resolution Rules

1. Existing traits take precedence over new trait assignments
2. Higher rarity traits may override lower rarity conflicts in special circumstances
3. Environmental factors influence conflict resolution probability
4. Breeding conditions can affect which conflicting traits emerge

## Implementation Notes

### Database Storage

- Traits stored in `horse.epigenetic_modifiers` JSON field
- Categories: positive, negative, hidden
- Conformation scores stored separately in `conformationScores` JSON field

### Naming Convention

- All trait names use camelCase (e.g., 'eagerLearner', 'showCalm')
- No snake_case allowed in trait references
- Consistent naming across all API endpoints and database fields

### Integration Points

- **Training System**: XP modifiers, stress effects, stat gain bonuses
- **Competition System**: Score modifiers, discipline bonuses, stress resistance
- **Bonding System**: Relationship effects, grooming bonuses, handler compatibility
- **Breeding System**: Trait inheritance, environmental trait generation
