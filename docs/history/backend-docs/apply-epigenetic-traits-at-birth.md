# Apply Epigenetic Traits at Birth

## Overview

The `applyEpigeneticTraitsAtBirth()` function assigns epigenetic traits to foals at birth based on mare conditions, lineage analysis, and breeding circumstances. This function implements the trait assignment system requested in TASK 2.

## Function Signature

```javascript
applyEpigeneticTraitsAtBirth({ mare, lineage, feedQuality, stressLevel });
```

### Parameters

- **mare** (Object, required): Mare object containing stress_level and other properties
- **lineage** (Array, optional): Array of ancestor objects with discipline information
- **feedQuality** (number, optional): Feed quality score (0-100)
- **stressLevel** (number, optional): Mare's stress level override (0-100)

### Returns

```javascript
{
  positive: string[],  // Array of positive trait names
  negative: string[]   // Array of negative trait names
}
```

## Trait Assignment Logic

### 1. Low Stress + Premium Feed Conditions

**Conditions**: Mare stress ≤ 20 AND feed quality ≥ 80

**Traits Assigned**:

- `resilient` (75% chance) - Stress resistance and recovery bonuses
- `people_trusting` (60% chance) - Enhanced bonding and handler cooperation

### 2. Inbreeding Detection

**Detection**: Common ancestors appearing multiple times in lineage

**Severity Levels**:

- **High**: 4+ occurrences of same ancestor
- **Moderate**: 3 occurrences of same ancestor
- **Low**: 2 occurrences of same ancestor

**Traits Assigned**:

- `fragile` - Higher injury risk, slower recovery
  - High inbreeding: 80% chance
  - Moderate inbreeding: 50% chance
  - Low inbreeding: 25% chance
- `reactive` - Increased stress sensitivity and unpredictability
  - High inbreeding: 70% chance
  - Moderate inbreeding: 40% chance
  - Low inbreeding: 20% chance
- `low_immunity` - Weakened immune system and health issues
  - High inbreeding: 60% chance
  - Moderate inbreeding: 35% chance
  - Low inbreeding: 15% chance

### 3. Discipline Specialization

**Conditions**: 3+ ancestors share the same discipline

**Detection Methods**:

1. Direct `discipline` field on ancestor objects
2. Highest scoring discipline from `disciplineScores` object
3. Most common discipline from competition history

**Traits Assigned**:

- `discipline_affinity_*` (70% chance) - Specialized bonuses for inherited discipline
  - Available disciplines: racing, jumping, dressage, etc.
- `legacy_talent` (40% chance) - Enhanced talent inheritance (requires 4+ ancestors)

### 4. Additional Stress Effects

**High Stress** (≥ 80): 40% chance for `nervous` trait
**Poor Nutrition** (≤ 30): 30% chance for `low_immunity` trait

## Usage Examples

### Basic Usage

```javascript
import { applyEpigeneticTraitsAtBirth } from '../utils/applyEpigeneticTraitsAtBirth.js';

const mare = {
  id: 1,
  stress_level: 15,
  health_status: 'Excellent',
};

const result = applyEpigeneticTraitsAtBirth({
  mare,
  feedQuality: 85,
  stressLevel: 15,
});

console.log(result);
// { positive: ['resilient', 'people_trusting'], negative: [] }
```

### With Lineage Specialization

```javascript
const lineage = [
  { id: 1, discipline: 'Racing' },
  { id: 2, discipline: 'Racing' },
  { id: 3, discipline: 'Racing' },
  { id: 4, discipline: 'Dressage' },
];

const result = applyEpigeneticTraitsAtBirth({
  mare,
  lineage,
  feedQuality: 60,
  stressLevel: 30,
});

// Possible result: { positive: ['discipline_affinity_racing'], negative: [] }
```

### With Inbreeding

```javascript
const inbredLineage = [
  { id: 100, name: 'Common Ancestor' },
  { id: 100, name: 'Common Ancestor' },
  { id: 100, name: 'Common Ancestor' },
  { id: 100, name: 'Common Ancestor' }, // High inbreeding
  { id: 101, name: 'Other Horse' },
];

const result = applyEpigeneticTraitsAtBirth({
  mare,
  lineage: inbredLineage,
  feedQuality: 50,
  stressLevel: 50,
});

// Possible result: { positive: [], negative: ['fragile', 'reactive', 'low_immunity'] }
```

## Available Traits

### Positive Traits

- **resilient**: Stress resistance, faster recovery, competition bonuses
- **people_trusting**: Enhanced bonding, handler cooperation, crowd comfort
- **legacy_talent**: Exceptional inherited talent, prestige bonuses
- **discipline_affinity_racing**: Racing specialization bonuses
- **discipline_affinity_jumping**: Show jumping specialization bonuses
- **discipline_affinity_dressage**: Dressage specialization bonuses

### Negative Traits

- **fragile**: Higher injury risk, performance inconsistency
- **reactive**: Stress sensitivity, unpredictable behavior
- **low_immunity**: Health vulnerabilities, slower recovery
- **nervous**: Stress accumulation, performance penalties

## Integration with Existing Systems

### Trait Effects

All assigned traits integrate with the existing `traitEffects.js` system:

```javascript
import { getCombinedTraitEffects } from '../utils/traitEffects.js';

const traits = ['resilient', 'people_trusting'];
const effects = getCombinedTraitEffects(traits);
// Returns combined bonuses for training, competition, bonding, etc.
```

### Database Storage

Traits should be stored in the horse's `epigenetic_modifiers` JSONB field:

```javascript
const { positive, negative } = applyEpigeneticTraitsAtBirth(params);

await prisma.horse.update({
  where: { id: foalId },
  data: {
    epigenetic_modifiers: {
      positive,
      negative,
      hidden: [], // Some traits may be hidden initially
    },
  },
});
```

## Testing

Comprehensive tests are available in `tests/applyEpigeneticTraitsAtBirth.test.js`:

```bash
npm test -- tests/applyEpigeneticTraitsAtBirth.test.js
```

Test coverage includes:

- Input validation
- Optimal breeding conditions
- Inbreeding detection and severity
- Discipline specialization
- Edge cases and error handling

## Key Features

1. **Probabilistic Assignment**: Traits are assigned based on probability, not guaranteed
2. **Duplicate Prevention**: Automatically removes duplicate traits
3. **Flexible Input**: Handles missing lineage, discipline data gracefully
4. **Multiple Detection Methods**: Uses discipline field, scores, or competition history
5. **Severity-Based Effects**: Inbreeding severity affects trait assignment probability
6. **Comprehensive Logging**: Detailed logging for debugging and monitoring

## Performance Considerations

- Function is synchronous and fast (no database calls)
- Lineage analysis is O(n) where n is number of ancestors
- Suitable for real-time foal creation workflows
- Memory efficient with minimal object creation
