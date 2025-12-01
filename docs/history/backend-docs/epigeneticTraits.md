# Epigenetic Traits Calculation System

A sophisticated breeding system that determines offspring traits based on parent genetics and environmental factors during foal development.

## Overview

The epigenetic traits system simulates realistic inheritance patterns where offspring traits are influenced by:

- **Parent Genetics**: Traits from both dam and sire
- **Environmental Factors**: Bonding scores and stress levels during foal development
- **Random Variation**: Natural genetic variation and rare trait emergence
- **Trait Conflicts**: Automatic resolution of contradictory traits

## Core Function

### `calculateEpigeneticTraits(params)`

Calculates offspring traits based on breeding parameters.

#### Parameters

```javascript
{
  damTraits: string[],        // Dam's traits (required)
  sireTraits: string[],       // Sire's traits (required)
  damBondScore: number,       // Dam's bonding score 0-100 (required)
  damStressLevel: number,     // Dam's stress level 0-100 (required)
  seed?: number              // Optional seed for deterministic results
}
```

#### Returns

```javascript
{
  positive: string[],         // Visible positive traits
  negative: string[],         // Visible negative traits
  hidden: string[]           // Hidden traits (to be discovered later)
}
```

#### Example Usage

```javascript
import { calculateEpigeneticTraits } from '../utils/epigeneticTraits.js';

const breedingParams = {
  damTraits: ['resilient', 'intelligent'],
  sireTraits: ['bold', 'athletic'],
  damBondScore: 85,
  damStressLevel: 20,
};

const offspring = calculateEpigeneticTraits(breedingParams);
console.log(offspring);
// {
//   positive: ['resilient', 'bold'],
//   negative: [],
//   hidden: ['intelligent']
// }
```

## Trait System

### Trait Categories

#### Positive Traits

- **resilient**: Faster stress recovery, improved training consistency
- **bold**: Enhanced competition performance, better adaptability
- **intelligent**: Accelerated learning, improved skill retention
- **athletic**: Improved physical stats, better movement quality
- **calm**: Reduced stress accumulation, improved focus
- **trainability_boost**: Major training efficiency bonus (rare)

#### Negative Traits

- **nervous**: Increased stress sensitivity, requires gentle approach
- **stubborn**: Slower initial learning, increased training time
- **fragile**: Higher injury risk, requires careful management
- **aggressive**: Handling challenges, social difficulties
- **lazy**: Reduced training efficiency, requires motivation

#### Rare Traits

- **legendary_bloodline**: Exceptional heritage (legendary rarity)
- **weather_immunity**: Environmental resistance (rare)
- **fire_resistance**: Heat tolerance (rare)
- **water_phobia**: Water avoidance (rare negative)
- **night_vision**: Enhanced night performance (rare)

### Trait Properties

Each trait has:

- **Type**: positive, negative
- **Rarity**: common, rare, legendary
- **Conflicts**: List of incompatible traits

### Trait Conflicts

The system automatically resolves conflicting traits:

- `calm` conflicts with `nervous`, `aggressive`
- `resilient` conflicts with `fragile`
- `bold` conflicts with `nervous`
- `intelligent` conflicts with `lazy`
- `athletic` conflicts with `fragile`
- `trainability_boost` conflicts with `stubborn`

## Game Mechanics

### Inheritance Probability

Base inheritance probabilities by rarity:

- **Common traits**: 50% base chance
- **Rare traits**: 15% base chance
- **Legendary traits**: 5% base chance

### Environmental Modifiers

#### Bonding Score Effects (0-100)

- **High bonding (80-100)**:
  - +20% max increase to positive trait probability
  - -15% max decrease to negative trait probability
- **Low bonding (0-20)**:
  - -20% max decrease to positive trait probability
  - +15% max increase to negative trait probability

#### Stress Level Effects (0-100)

- **High stress (80-100)**:
  - -15% max decrease to positive trait probability
  - +20% max increase to negative trait probability
  - Additional negative trait generation (30% chance)
- **Low stress (0-20)**:
  - +15% max increase to positive trait probability
  - -20% max decrease to negative trait probability

### Environmental Trait Generation

The system can generate new traits based on conditions:

#### Positive Environmental Traits

- Generated when `(bondScore - stressLevel) > 20`
- 30% chance to generate: `resilient`, `calm`, or `intelligent`

#### Negative Environmental Traits

- Generated when `(bondScore - stressLevel) < -20`
- 60% chance to generate: `nervous`, `fragile`, or `lazy`

#### Rare Environmental Traits

- Base 3% chance, increased to 8% with excellent conditions
- Can generate: `weather_immunity`, `night_vision`, `legendary_bloodline`

### Trait Visibility

Traits are categorized as visible or hidden:

- **Rare traits**: 70% chance to be hidden
- **Legendary traits**: 90% chance to be hidden
- **Poor conditions**: 30% chance for any trait to be hidden
- **Visible traits**: Appear in positive/negative arrays
- **Hidden traits**: Appear in hidden array, discovered through gameplay

## Integration Guidelines

### Database Integration

Store calculated traits in horse records:

```javascript
// Example database update
const offspring = calculateEpigeneticTraits(breedingParams);

await prisma.horse.create({
  data: {
    name: foalName,
    age: 0,
    breedId: parentBreedId,
    epigeneticTraits: {
      positive: offspring.positive,
      negative: offspring.negative,
      hidden: offspring.hidden,
    },
  },
});
```

### Foal Development Integration

Use foal development system data for environmental factors:

```javascript
// Get foal development data
const foalDev = await getFoalDevelopment(foalId);

const breedingParams = {
  damTraits: dam.epigeneticTraits.positive.concat(dam.epigeneticTraits.negative),
  sireTraits: sire.epigeneticTraits.positive.concat(sire.epigeneticTraits.negative),
  damBondScore: foalDev.bondingLevel,
  damStressLevel: foalDev.stressLevel,
};

const offspring = calculateEpigeneticTraits(breedingParams);
```

### UI Integration

Display traits using the TraitDisplay component:

```jsx
<TraitDisplay
  traits={{
    positive: horse.epigeneticTraits.positive,
    negative: horse.epigeneticTraits.negative,
    hidden: horse.epigeneticTraits.hidden,
  }}
  horseName={horse.name}
  onTraitPress={(trait, info) => {
    // Handle trait selection
    showTraitDetails(trait, info);
  }}
/>
```

## Utility Functions

### `getTraitDefinition(trait)`

Returns trait definition including type, rarity, and conflicts.

```javascript
const def = getTraitDefinition('resilient');
// {
//   type: 'positive',
//   rarity: 'common',
//   conflicts: ['fragile']
// }
```

### `getTraitsByType(type)`

Returns all traits of specified type.

```javascript
const positiveTraits = getTraitsByType('positive');
// ['resilient', 'bold', 'intelligent', ...]
```

### `checkTraitConflict(trait1, trait2)`

Checks if two traits conflict.

```javascript
const conflicts = checkTraitConflict('calm', 'nervous');
// true
```

## Testing

### Unit Tests

Comprehensive test suite covers:

- Input validation
- Inheritance probability
- Environmental effects
- Trait conflicts
- Edge cases
- Deterministic behavior

### Test Examples

```javascript
// Test with seed for deterministic results
const result = calculateEpigeneticTraits({
  damTraits: ['resilient'],
  sireTraits: ['bold'],
  damBondScore: 80,
  damStressLevel: 20,
  seed: 12345,
});

// Test environmental effects
const highStressResult = calculateEpigeneticTraits({
  damTraits: ['resilient'],
  sireTraits: ['bold'],
  damBondScore: 20,
  damStressLevel: 90,
});
```

## Performance Considerations

- **Lightweight**: Function executes in <1ms for typical inputs
- **Memory Efficient**: No persistent state, pure function
- **Scalable**: Can handle hundreds of breeding calculations per second
- **Deterministic**: Optional seeding for testing and debugging

## Error Handling

The function validates all inputs and throws descriptive errors:

```javascript
try {
  const result = calculateEpigeneticTraits(params);
} catch (error) {
  console.error('Breeding calculation failed:', error.message);
  // Handle error appropriately
}
```

Common errors:

- `Missing required breeding parameters`
- `Parent traits must be arrays`
- `Bond scores and stress levels must be numbers`
- `Bond scores must be between 0-100, stress levels between 0-100`

## Game Balance

### Breeding Strategy Impact

Different strategies yield different outcomes:

- **High Bond Strategy**: Focus on maximizing dam bonding

  - Pros: More positive traits, fewer negative traits
  - Cons: Stress levels may still cause issues

- **Low Stress Strategy**: Minimize environmental stress

  - Pros: Better trait expression, fewer hidden traits
  - Cons: May miss bonding benefits

- **Balanced Strategy**: Optimize both factors
  - Pros: Consistent results, good trait variety
  - Cons: May not maximize any single outcome

### Rare Trait Breeding

Breeding for rare traits requires:

- Excellent environmental conditions (high bond, low stress)
- Multiple attempts due to low probability
- Strategic parent selection with existing rare traits
- Patience as rare traits are often hidden initially

## Future Enhancements

Potential system expansions:

- **Seasonal Effects**: Environmental factors based on breeding season
- **Bloodline Tracking**: Multi-generational trait inheritance
- **Mutation System**: Spontaneous new trait generation
- **Trait Evolution**: Traits that change over time
- **Environmental Adaptation**: Traits influenced by stable location

## Conclusion

The epigenetic traits system provides a sophisticated, realistic breeding mechanic that:

- Rewards careful foal development
- Creates meaningful breeding decisions
- Generates trait variety and rarity
- Integrates seamlessly with existing game systems
- Provides engaging long-term progression

Users must balance environmental factors during foal development to maximize positive trait inheritance while minimizing negative traits, creating a deep and rewarding breeding experience.
