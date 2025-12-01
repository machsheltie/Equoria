# At-Birth Traits System

## Overview

The At-Birth Traits System automatically applies epigenetic traits to newborn horses (age 0) during creation based on breeding conditions, lineage analysis, and environmental factors. This system enhances the breeding mechanics by making mare care, feed quality, and genetic diversity directly impact offspring traits.

## Architecture

### Core Components

1. **At-Birth Trait Engine** (`utils/atBirthTraits.js`)
2. **Horse Model Integration** (`models/horseModel.js`)
3. **Lineage Analysis** (ancestry tracking and discipline specialization)
4. **Inbreeding Detection** (3-generation genetic analysis)
5. **Feed Quality Assessment** (mare care evaluation)

### Database Integration

The system integrates with the existing `epigenetic_modifiers` JSONB field in the Horse table:

```sql
epigenetic_modifiers Json? @default("{\"positive\": [], \"negative\": [], \"hidden\": []}")
```

## Trait Categories

### Positive Traits

#### Hardy

- **Description**: Strong constitution from excellent mare care
- **Conditions**: Mare stress ≤ 20, Feed quality ≥ 80
- **Probability**: 25%
- **Effects**: Improved health and resilience

#### Well Bred

- **Description**: Benefits from careful breeding selection
- **Conditions**: Mare stress ≤ 30, Feed quality ≥ 70, No inbreeding
- **Probability**: 20%
- **Effects**: Balanced genetic advantages

#### Specialized Lineage

- **Description**: Genetic advantage in family discipline specialty
- **Conditions**: Discipline specialization detected, Mare stress ≤ 40
- **Probability**: 30%
- **Effects**: Bonus in specialized discipline

#### Premium Care

- **Description**: Exceptional prenatal care benefits
- **Conditions**: Mare stress ≤ 10, Feed quality ≥ 90
- **Probability**: 15%
- **Effects**: Superior development potential

### Negative Traits

#### Weak Constitution

- **Description**: Poor health from inadequate mare care
- **Conditions**: Mare stress ≥ 70, Feed quality ≤ 40
- **Probability**: 35%
- **Effects**: Reduced health and performance

#### Inbred

- **Description**: Genetic complications from close breeding
- **Conditions**: Inbreeding detected within 3 generations
- **Probability**: 60%
- **Effects**: Various genetic penalties

#### Stressed Lineage

- **Description**: Inherited stress sensitivity
- **Conditions**: Mare stress ≥ 60
- **Probability**: 25%
- **Effects**: Higher stress susceptibility

#### Poor Nutrition

- **Description**: Developmental issues from inadequate feeding
- **Conditions**: Feed quality ≤ 30
- **Probability**: 40%
- **Effects**: Reduced growth potential

## System Features

### Lineage Analysis

The system analyzes up to 3 generations of ancestors to detect:

- **Discipline Specialization**: When >60% of ancestor competitions are in one discipline
- **Competition History**: Total competitions and win rates
- **Genetic Diversity**: Ancestor variety and breeding patterns

```javascript
const lineageAnalysis = await analyzeLineage(sireId, damId);
// Returns: { disciplineSpecialization, specializedDiscipline, specializationStrength }
```

### Inbreeding Detection

Automatically detects common ancestors within 3 generations:

- **Common Ancestor Identification**: Finds shared lineage
- **Inbreeding Coefficient**: Calculates genetic similarity
- **Breeding Recommendations**: Warns of genetic risks

```javascript
const inbreedingAnalysis = await detectInbreeding(sireId, damId);
// Returns: { inbreedingDetected, commonAncestors, inbreedingCoefficient }
```

### Feed Quality Assessment

Evaluates mare care quality based on:

- **Health Status**: Mare's current health condition
- **Earnings History**: Proxy for care investment
- **Care Quality**: Simulated feeding system integration

```javascript
const feedQuality = await assessFeedQuality(mareId);
// Returns: 0-100 quality score
```

## Integration with Horse Creation

### Automatic Application

The system automatically applies traits when creating horses with:

- Age = 0 (newborn)
- Both sire_id and dam_id present

```javascript
const horseData = {
  name: 'Foal Name',
  age: 0,
  breedId: 1,
  sire_id: 10,
  dam_id: 20,
  mareStress: 25, // Optional override
  feedQuality: 75, // Optional override
};

const horse = await createHorse(horseData);
// Automatically applies at-birth traits
```

### Manual Application

For custom breeding scenarios:

```javascript
const breedingData = {
  sireId: 10,
  damId: 20,
  mareStress: 15,
  feedQuality: 85,
};

const result = await applyEpigeneticTraitsAtBirth(breedingData);
// Returns: { traits, breedingAnalysis }
```

## Trait Visibility

### Immediate Visibility

- Most positive traits are visible at birth
- Negative traits appear as warnings
- Some traits may be hidden initially

### Hidden Traits

- 30% chance to hide traits when >2 total traits
- Hidden traits can be revealed through foal development
- Maintains mystery and discovery elements

## Error Handling

### Graceful Degradation

- Continues horse creation even if trait application fails
- Logs errors for debugging
- Provides default empty traits on failure

### Validation

- Requires both sire and dam IDs
- Validates mare existence
- Handles missing data gracefully

## Testing

### Unit Tests

- Trait condition evaluation
- Lineage analysis logic
- Inbreeding detection
- Feed quality assessment

### Integration Tests

- Horse creation with traits
- Database interactions
- Error scenarios
- Edge cases

### Test Coverage

```bash
npm test -- tests/atBirthTraits.test.js
npm test -- tests/horseModelAtBirth.test.js
```

## Performance Considerations

### Database Queries

- Optimized ancestor retrieval
- Efficient competition history lookup
- Minimal database calls

### Caching Opportunities

- Lineage analysis results
- Feed quality assessments
- Trait definitions

## Future Enhancements

### Planned Features

1. **Advanced Feed System Integration**
2. **Seasonal Breeding Effects**
3. **Bloodline Tracking**
4. **Genetic Marker System**
5. **Breeding Recommendations**

### Configuration Options

- Trait probability adjustments
- Condition threshold tuning
- Custom trait definitions
- Breeding season effects

## API Endpoints

### Admin Routes

```javascript
// Get trait definitions
GET / api / admin / traits / definitions;

// Manual trait application
POST / api / admin / traits / apply - at - birth;
```

### Breeding Routes

```javascript
// Analyze breeding compatibility
POST /api/breeding/analyze
{
  "sireId": 10,
  "damId": 20
}
```

## Monitoring and Logging

### Key Metrics

- Trait application rates
- Inbreeding detection frequency
- Feed quality distributions
- Lineage specialization patterns

### Log Events

- Trait applications
- Breeding analysis results
- Error conditions
- Performance metrics

## Best Practices

### Breeding Strategy

1. Monitor mare stress levels
2. Invest in quality feed
3. Avoid close inbreeding
4. Consider lineage specialization
5. Track trait inheritance patterns

### Development Guidelines

1. Test trait conditions thoroughly
2. Handle edge cases gracefully
3. Log important events
4. Maintain performance
5. Document trait effects

## Troubleshooting

### Common Issues

1. **No traits applied**: Check age = 0 and parent IDs
2. **Unexpected traits**: Verify breeding conditions
3. **Performance issues**: Review database queries
4. **Missing lineage**: Check ancestor data completeness

### Debug Commands

```bash
# Test trait application
node examples/atBirthTraitsExample.js

# Run specific tests
npm test -- tests/atBirthTraits.test.js

# Check database connections
npm run test:database
```
