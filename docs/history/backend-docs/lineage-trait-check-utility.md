# Lineage Trait Check Utility

## Overview

The Lineage Trait Check Utility provides functions to analyze horse lineages for discipline affinity patterns. It examines up to 3 generations of ancestors to determine if there's a strong genetic predisposition toward a specific discipline.

## Core Function

### `checkLineageForDisciplineAffinity(ancestors)`

**Purpose**: Takes in 3 generations of ancestors and returns the most common discipline. If 3 or more share the same discipline, returns `{ affinity: true, discipline: 'jumping' }`. Otherwise, returns `{ affinity: false }`.

**Parameters**:

- `ancestors` (Array): Array of ancestor objects with discipline information

**Returns**:

```javascript
{
  affinity: boolean,        // true if 3+ ancestors share same discipline
  discipline?: string       // the dominant discipline (only if affinity is true)
}
```

**Example Usage**:

```javascript
import { checkLineageForDisciplineAffinity } from '../utils/lineageTraitCheck.js';

const ancestors = [
  { id: 1, name: 'Horse1', discipline: 'Show Jumping' },
  { id: 2, name: 'Horse2', discipline: 'Show Jumping' },
  { id: 3, name: 'Horse3', discipline: 'Show Jumping' },
  { id: 4, name: 'Horse4', discipline: 'Dressage' },
  { id: 5, name: 'Horse5', discipline: 'Racing' },
];

const result = checkLineageForDisciplineAffinity(ancestors);
// Returns: { affinity: true, discipline: 'Show Jumping' }
```

## Data Source Priority

The utility analyzes ancestor discipline preferences using multiple data sources in priority order:

### 1. Direct Discipline Field (Highest Priority)

```javascript
{ id: 1, name: 'Horse1', discipline: 'Racing' }
```

### 2. Competition History Analysis

```javascript
{
  id: 1,
  name: 'Horse1',
  competitionHistory: [
    { discipline: 'Racing', placement: '1st' },
    { discipline: 'Racing', placement: '2nd' },
    { discipline: 'Dressage', placement: '3rd' }
  ]
}
// Determines 'Racing' as preferred discipline (most common)
```

### 3. Discipline Scores Analysis

```javascript
{
  id: 1,
  name: 'Horse1',
  disciplineScores: { 'Racing': 85, 'Dressage': 70, 'Show Jumping': 60 }
}
// Determines 'Racing' as preferred discipline (highest score)
```

### 4. Alternative Competition Field

```javascript
{
  id: 1,
  name: 'Horse1',
  competitions: [
    { discipline: 'Show Jumping', placement: '1st' }
  ]
}
```

### 5. Specialty Field (Fallback)

```javascript
{ id: 1, name: 'Horse1', specialty: 'Eventing' }
```

## Extended Functions

### `checkLineageForDisciplineAffinityDetailed(ancestors)`

Provides comprehensive analysis with additional metrics:

**Returns**:

```javascript
{
  affinity: boolean,
  discipline?: string,
  totalAnalyzed: number,           // Total ancestors examined
  totalWithDisciplines: number,    // Ancestors with discipline data
  disciplineBreakdown: object,     // Count per discipline
  affinityStrength: number,        // Percentage (0-100)
  dominantCount: number           // Count of dominant discipline
}
```

### `checkSpecificDisciplineAffinity(ancestors, targetDiscipline, minimumCount)`

Checks for affinity to a specific discipline:

**Parameters**:

- `ancestors` (Array): Ancestor objects
- `targetDiscipline` (string): Target discipline to check
- `minimumCount` (number): Minimum required count (default: 3)

**Returns**:

```javascript
{
  hasAffinity: boolean,
  count: number,
  required: number,
  discipline: string,
  matchingAncestors: Array,
  percentage: number
}
```

## Helper Functions

### `getAncestorPreferredDiscipline(ancestor)`

Determines an ancestor's preferred discipline from available data sources.

### `getMostCommonDisciplineFromHistory(competitionHistory)`

Analyzes competition history to find the most frequently competed discipline.

### `getHighestScoringDiscipline(disciplineScores)`

Finds the discipline with the highest score from discipline score data.

## Integration Examples

### Basic Affinity Check

```javascript
const ancestors = [
  { id: 1, discipline: 'Racing' },
  { id: 2, discipline: 'Racing' },
  { id: 3, discipline: 'Racing' },
];

const result = checkLineageForDisciplineAffinity(ancestors);
// Returns: { affinity: true, discipline: 'Racing' }
```

### Mixed Data Sources

```javascript
const ancestors = [
  { id: 1, discipline: 'Racing' },
  {
    id: 2,
    competitionHistory: [
      { discipline: 'Racing', placement: '1st' },
      { discipline: 'Racing', placement: '2nd' },
    ],
  },
  {
    id: 3,
    disciplineScores: { Racing: 90, Dressage: 70 },
  },
];

const result = checkLineageForDisciplineAffinity(ancestors);
// Returns: { affinity: true, discipline: 'Racing' }
```

### Breeding Analysis

```javascript
// Combine sire and dam lineages
const sireLineage = [
  /* sire ancestors */
];
const damLineage = [
  /* dam ancestors */
];
const combinedLineage = [...sireLineage, ...damLineage];

const analysis = checkLineageForDisciplineAffinityDetailed(combinedLineage);

if (analysis.affinity) {
  console.log(`Strong ${analysis.discipline} lineage detected!`);
  console.log(`Affinity strength: ${analysis.affinityStrength}%`);
} else {
  console.log('Diverse lineage - no single discipline dominance');
}
```

## Error Handling

The utility includes comprehensive error handling:

- **Graceful Degradation**: Returns safe defaults on errors
- **Input Validation**: Handles null, undefined, and empty inputs
- **Data Validation**: Manages missing or malformed discipline data
- **Logging**: Detailed logging for debugging and monitoring

## Edge Cases

### Empty or Null Inputs

```javascript
checkLineageForDisciplineAffinity([]); // { affinity: false }
checkLineageForDisciplineAffinity(null); // { affinity: false }
checkLineageForDisciplineAffinity(undefined); // { affinity: false }
```

### Insufficient Data

```javascript
const ancestors = [
  { id: 1, name: 'Horse1' }, // No discipline data
  { id: 2, name: 'Horse2' }, // No discipline data
];

const result = checkLineageForDisciplineAffinity(ancestors);
// Returns: { affinity: false }
```

### Exactly 3 Matches

```javascript
const ancestors = [
  { id: 1, discipline: 'Racing' },
  { id: 2, discipline: 'Racing' },
  { id: 3, discipline: 'Racing' },
];

const result = checkLineageForDisciplineAffinity(ancestors);
// Returns: { affinity: true, discipline: 'Racing' }
```

## Performance Considerations

- **Efficient Processing**: O(n) time complexity for ancestor analysis
- **Memory Efficient**: Minimal memory footprint
- **Lazy Evaluation**: Only processes necessary data sources
- **Caching Friendly**: Results can be cached for repeated queries

## Testing

Comprehensive test suite covers:

- Basic affinity detection (3+ ancestors)
- Multiple data source handling
- Edge cases and error conditions
- Performance scenarios
- Integration patterns

Run tests:

```bash
npm test -- tests/lineageTraitCheck.test.js
```

## Integration with At-Birth Traits

The utility integrates seamlessly with the at-birth traits system:

```javascript
import { checkLineageForDisciplineAffinity } from '../utils/lineageTraitCheck.js';
import { applyEpigeneticTraitsAtBirth } from '../utils/atBirthTraits.js';

// Use in breeding analysis
const ancestors = await getAncestors([sireId, damId], 3);
const affinityResult = checkLineageForDisciplineAffinity(ancestors);

if (affinityResult.affinity) {
  // Apply specialized lineage traits
  console.log(`Detected ${affinityResult.discipline} lineage affinity`);
}
```

## Future Enhancements

Planned improvements:

1. **Weighted Analysis**: Consider ancestor generation distance
2. **Performance Metrics**: Include competition success rates
3. **Bloodline Tracking**: Extended family analysis
4. **Genetic Markers**: Integration with genetic systems
5. **Machine Learning**: Predictive affinity modeling

## API Reference

### Main Functions

- `checkLineageForDisciplineAffinity(ancestors)` - Basic affinity check
- `checkLineageForDisciplineAffinityDetailed(ancestors)` - Detailed analysis
- `checkSpecificDisciplineAffinity(ancestors, discipline, minimum)` - Specific discipline check

### Helper Functions

- `getAncestorPreferredDiscipline(ancestor)` - Individual ancestor analysis
- `getMostCommonDisciplineFromHistory(history)` - Competition history analysis
- `getHighestScoringDiscipline(scores)` - Discipline score analysis

### Return Types

- Basic: `{ affinity: boolean, discipline?: string }`
- Detailed: `{ affinity, discipline, totalAnalyzed, totalWithDisciplines, disciplineBreakdown, affinityStrength, dominantCount }`
- Specific: `{ hasAffinity, count, required, discipline, matchingAncestors, percentage }`
