# Equoria Horse Training System Documentation

## Overview
The Equoria training system implements a comprehensive horse training model with age restrictions, cooldown periods, trait integration, and progressive skill development. The system enforces realistic training limitations while providing meaningful progression for both horses and players.

## Core Training Mechanics

### Age Restrictions
- **Minimum Training Age**: 3 years old
- **Maximum Training Age**: 20 years old
- **Validation**: Enforced at API level and business logic layer
- **Rationale**: Young horses need physical and mental development before intensive training

### Training Cooldown System
- **Global Cooldown**: 7 days between ANY training sessions per horse
- **Scope**: Applies across all disciplines (not per-discipline)
- **Implementation**: Tracked via `trainingCooldown` field in horse model
- **Business Logic**: Prevents overtraining and maintains realistic training schedules

### Discipline System
The Equoria training system supports all 23 major equestrian disciplines, each with specific stat focus areas for realistic horse development:

**Western Disciplines:**
- **Western Pleasure**: Obedience, focus, precision development
- **Reining**: Precision, agility, focus refinement
- **Cutting**: Agility, strength, intelligence training
- **Barrel Racing**: Speed, agility, stamina enhancement
- **Roping**: Strength, precision, focus development
- **Team Penning**: Intelligence, agility, obedience coordination
- **Rodeo**: Strength, agility, endurance conditioning

**English Disciplines:**
- **Hunter**: Precision, endurance, agility training
- **Saddleseat**: Flexibility, obedience, precision development
- **Dressage**: Precision, obedience, focus refinement
- **Show Jumping**: Agility, precision, intelligence enhancement
- **Eventing**: Endurance, precision, agility combination
- **Cross Country**: Endurance, intelligence, agility building

**Specialized Disciplines:**
- **Endurance**: Endurance, stamina, speed conditioning
- **Vaulting**: Strength, flexibility, endurance training
- **Polo**: Speed, agility, intelligence development
- **Combined Driving**: Obedience, strength, focus coordination
- **Fine Harness**: Precision, flexibility, obedience refinement
- **Gaited**: Flexibility, obedience, focus enhancement
- **Gymkhana**: Speed, flexibility, stamina training

**Racing Disciplines:**
- **Racing**: Speed, stamina, intelligence development
- **Steeplechase**: Speed, endurance, stamina conditioning
- **Harness Racing**: Speed, precision, stamina training

## Training Progression System

### Discipline Score Advancement
- **Base Increase**: +5 points per training session
- **Trait Modifiers**: Applied based on horse's epigenetic traits
- **Calculation**: `finalIncrease = baseIncrease + traitEffects.scoreModifier`
- **Storage**: Updated in horse's `disciplineScores` JSON field

### Stat Gain Mechanics
- **Base Chance**: 15% probability per training session
- **Stat Selection**: Based on discipline-specific stat mapping
- **Gain Amount**: 1-3 points randomly determined
- **Trait Effects**: Chance and amount modified by horse traits
- **Target Stats**: Discipline-relevant stats (e.g., Racing focuses on speed, stamina, focus)

### Experience Point (XP) Rewards
- **Base XP**: 5 XP awarded to horse owner per training session
- **Trait Modifiers**: XP amount affected by traits like `intelligent` (+25%) or `lazy` (-20%)
- **Level Progression**: XP contributes to user level advancement
- **Logging**: All XP awards logged for progression tracking

## Trait Integration

### Positive Trait Effects
- **intelligent**: +25% training XP, +15% stat gain chance, +10% training time reduction
- **athletic**: +20% physical training bonus, +25% stamina training bonus
- **eagerLearner**: +25% training XP, +10% stat gain chance, +20% motivation bonus
- **resilient**: 15% training stress reduction, +25% stress recovery rate
- **trainabilityBoost**: +30% training XP, +20% stat gain chance, +25% training success rate

### Negative Trait Effects
- **lazy**: -20% training XP, 25% motivation penalty, +15% training time increase
- **stubborn**: -15% training XP, +30% training resistance, 25% new skill penalty
- **fragile**: +30% training injury risk, -20% training intensity limit
- **nervous**: +25% training stress increase, -20% bonding penalty
- **aggressive**: +25% training difficulty increase, trainer safety risk

### Trait-Based Training Modifications
- **Score Modifiers**: Traits directly affect discipline score gains
- **Cooldown Adjustments**: Some traits may reduce training cooldown periods
- **Stat Gain Bonuses**: Traits can boost both chance and amount of stat gains
- **Burnout Protection**: Trait effects can block training when horse experiences burnout

## API Endpoints

### Training Execution
- **POST /api/training/train**
  - Body: `{ horseId: number, discipline: string }`
  - Response: Training results with score updates and trait effects
  - Validation: Horse ID, discipline name, age eligibility, cooldown status

### Training Status
- **GET /api/training/status/:horseId/:discipline**
  - Returns: Eligibility status, cooldown information, next available date
  - Use Case: Frontend training availability checks
- **GET /api/training/status/:horseId**
  - Returns: Training status across all 23 disciplines dynamically
  - Use Case: Complete training overview for a horse

### Trainable Horses
- **GET /api/horses/trainable/:userId**
  - Returns: All horses owned by user eligible for training
  - Filters: Age requirements, cooldown status, health status

## Database Schema Integration

### Horse Model Fields
- **disciplineScores**: JSON field storing score per discipline
- **trainingCooldown**: DateTime field for next eligible training date
- **epigenetic_modifiers**: JSON field containing trait arrays affecting training
- **stats**: Individual stat fields (speed, stamina, agility, etc.)

### Training Log Model
- **horseId**: Foreign key to horse being trained
- **discipline**: String identifying training discipline
- **trainedAt**: Timestamp of training session
- **scoreIncrease**: Points gained in the session
- **traitEffects**: JSON field storing applied trait modifications

## Business Rules Enforcement

### Age Validation
```javascript
// Minimum age check
if (horseAge < TRAINING_LIMITS.MIN_AGE) {
  return { eligible: false, reason: 'Horse too young for training' };
}

// Maximum age check  
if (horseAge > TRAINING_LIMITS.MAX_AGE) {
  return { eligible: false, reason: 'Horse too old for training' };
}
```

### Cooldown Enforcement
```javascript
// Check 7-day global cooldown
const lastTraining = await getAnyRecentTraining(horseId);
if (lastTraining && (now - lastTraining) < sevenDays) {
  return { eligible: false, reason: 'Training cooldown active' };
}
```

### Trait Effect Application
```javascript
// Apply trait effects to training outcomes
const traitEffects = getCombinedTraitEffects(horse.traits);
const modifiedXP = baseXP * (1 + traitEffects.trainingXpModifier);
const modifiedScore = baseScore + traitEffects.scoreModifier;
```

## Error Handling

### Validation Errors
- **Invalid Horse ID**: Non-existent or invalid horse identifier
- **Invalid Discipline**: Unrecognized discipline name
- **Age Restrictions**: Horse too young or too old for training
- **Cooldown Active**: Training attempted before cooldown expiration

### Database Errors
- **Connection Failures**: Database connectivity issues
- **Transaction Failures**: Rollback on partial update failures
- **Constraint Violations**: Foreign key or data type violations

### Business Logic Errors
- **Burnout Status**: Training blocked due to horse burnout
- **Health Restrictions**: Training blocked due to poor horse health
- **Ownership Validation**: User doesn't own the specified horse

## Testing Coverage

### Unit Tests
- **Training Controller**: Business logic validation (age, cooldown, trait effects)
- **Training Model**: Database operations and data validation
- **Training Cooldown**: Cooldown calculation and enforcement
- **Trait Effects**: Training modifier calculations

### Integration Tests
- **Training Progression**: Complete training workflow with database
- **Trait Integration**: Training with various trait combinations
- **XP System**: Training XP awards and user progression
- **API Endpoints**: Full request/response cycle testing

## Performance Considerations

### Database Optimization
- **Indexed Fields**: trainingCooldown, horseId, discipline for fast queries
- **JSON Field Queries**: Efficient trait and score lookups
- **Connection Pooling**: Managed database connections for concurrent training

### Caching Strategy
- **Horse Data**: Cache frequently accessed horse information
- **Trait Effects**: Cache calculated trait effect combinations
- **Cooldown Status**: Cache training eligibility status

## Security Implementation

### Input Validation
- **Parameter Sanitization**: All inputs validated and sanitized
- **SQL Injection Prevention**: Parameterized queries via Prisma ORM
- **Authorization Checks**: User ownership validation before training

### Rate Limiting
- **API Rate Limits**: Prevent training spam attempts
- **Cooldown Enforcement**: Server-side cooldown validation
- **Session Management**: Secure user session handling

## Future Enhancements

### Planned Features
- **Training Specialization**: Advanced discipline-specific training paths
- **Group Training**: Multi-horse training sessions with bonuses
- **Trainer NPCs**: Professional trainers with unique bonuses
- **Training Facilities**: Stable upgrades affecting training effectiveness

### Scalability Considerations
- **Microservice Architecture**: Separate training service for high load
- **Event-Driven Updates**: Asynchronous training result processing
- **Horizontal Scaling**: Database sharding for large horse populations
