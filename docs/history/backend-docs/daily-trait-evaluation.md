# Daily Trait Evaluation Cron Job System

## Overview

The Daily Trait Evaluation system is a scheduled job that runs at midnight UTC every day to evaluate foals aged 0-6 days for trait revelation based on their bonding and stress levels. This system implements the epigenetic trait mechanics that determine which traits become visible or hidden as foals develop.

## Architecture

### Core Components

1. **Trait Evaluation Engine** (`utils/traitEvaluation.js`)
2. **Cron Job Service** (`services/cronJobs.js`)
3. **Admin API** (`routes/adminRoutes.js`)
4. **Database Schema** (epigenetic_modifiers field)

### Database Integration

The system uses the `epigenetic_modifiers` JSONB field in the Horse table:

```json
{
  "positive": ["resilient", "calm"],
  "negative": ["nervous"],
  "hidden": ["intelligent", "legendary_bloodline"]
}
```

## Trait System

### Trait Categories

#### Positive Traits

- **resilient**: Faster stress recovery, improved training consistency
- **calm**: Reduced stress accumulation, improved focus
- **intelligent**: Accelerated learning, improved skill retention
- **bold**: Enhanced competition performance, better adaptability
- **athletic**: Improved physical stats, better movement quality
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
- **night_vision**: Enhanced night performance (rare)

### Revelation Conditions

Each trait has specific conditions that must be met for revelation:

```javascript
{
  minBondScore: 70,      // Minimum bonding score required
  maxStressLevel: 30,    // Maximum stress level allowed
  minAge: 2              // Minimum development day
}
```

### Trait Conflicts

The system prevents conflicting traits from coexisting:

- `calm` conflicts with `nervous`, `aggressive`
- `resilient` conflicts with `fragile`
- `bold` conflicts with `nervous`
- `intelligent` conflicts with `lazy`

## Cron Job Schedule

### Daily Execution

- **Schedule**: `0 0 * * *` (midnight UTC)
- **Target**: All foals aged 0-1 years
- **Process**: Evaluates each foal for trait revelation

### Execution Flow

1. **Query Foals**: Find all horses with age 0-1
2. **Filter Active**: Only process foals in development (day ≤ 6)
3. **Evaluate Traits**: Apply trait revelation logic
4. **Update Database**: Save new traits to epigenetic_modifiers
5. **Audit Logging**: Record all actions for monitoring

## API Endpoints

### Admin Management

#### Get Cron Job Status

```
GET /api/admin/cron/status
```

Response:

```json
{
  "success": true,
  "data": {
    "serviceRunning": true,
    "jobs": {
      "dailyTraitEvaluation": {
        "running": true,
        "scheduled": true
      }
    },
    "totalJobs": 1
  }
}
```

#### Start/Stop Cron Service

```
POST /api/admin/cron/start
POST /api/admin/cron/stop
```

#### Manual Trait Evaluation

```
POST /api/admin/traits/evaluate
```

Triggers immediate trait evaluation for all eligible foals.

#### Get Foals in Development

```
GET /api/admin/foals/development
```

Returns all foals currently in the development period with their current stats.

#### Get Trait Definitions

```
GET /api/admin/traits/definitions
```

Returns complete trait definitions with revelation conditions.

## Trait Revelation Logic

### Evaluation Process

1. **Age Check**: Trait must meet minimum age requirement
2. **Bonding Check**: Bond score must be within required range
3. **Stress Check**: Stress level must be within acceptable limits
4. **Probability Roll**: Random chance based on trait's base probability
5. **Conflict Check**: Ensure no conflicting traits exist
6. **Visibility Determination**: Decide if trait should be hidden

### Probability Modifiers

- **Bonding Score Effects**:

  - High bonding (80-100): +20% positive trait chance, -15% negative trait chance
  - Low bonding (0-20): -20% positive trait chance, +15% negative trait chance

- **Stress Level Effects**:
  - High stress (80-100): -15% positive trait chance, +20% negative trait chance
  - Low stress (0-20): +15% positive trait chance, -20% negative trait chance

### Visibility Rules

- **Legendary traits**: 90% chance to be hidden
- **Rare traits**: 70% chance to be hidden
- **Poor conditions**: 30% chance for any trait to be hidden
- **Good conditions**: 10% chance for traits to be hidden

## Monitoring and Auditing

### Audit Logging

All trait revelations are logged with:

- Timestamp
- Foal ID and name
- Development day
- Traits revealed (positive, negative, hidden)
- Total count

### Daily Summary

Each evaluation produces a summary log:

```json
{
  "type": "DAILY_TRAIT_EVALUATION_SUMMARY",
  "timestamp": "2025-05-25T00:00:00.000Z",
  "statistics": {
    "foalsProcessed": 15,
    "foalsUpdated": 8,
    "errors": 0,
    "duration": 1250
  }
}
```

### Error Handling

- **Database Errors**: Logged and continue processing other foals
- **Missing Data**: Graceful handling with default values
- **Validation Errors**: Detailed logging for debugging

## Configuration

### Environment Variables

The cron job service respects the following environment settings:

- `NODE_ENV=test`: Disables automatic cron job startup
- Timezone: UTC (hardcoded for consistency)

### Customization

Trait definitions can be modified in `utils/traitEvaluation.js`:

- Add new traits with revelation conditions
- Adjust probability values
- Modify conflict relationships

## Testing

### Unit Tests (`tests/traitEvaluation.test.js`)

- Trait revelation logic
- Condition validation
- Conflict resolution
- Error handling

### Integration Tests (`tests/cronJobsIntegration.test.js`)

- End-to-end cron job execution
- Database integration
- Admin API endpoints
- Error scenarios

## Performance Considerations

### Optimization Strategies

1. **Batch Processing**: Process all foals in single database query
2. **Efficient Updates**: Only update horses with new traits
3. **Error Isolation**: Continue processing if individual foals fail
4. **Logging Efficiency**: Structured logging for performance monitoring

### Scalability

- **Database Indexing**: Age and development day fields indexed
- **Memory Usage**: Minimal memory footprint with streaming processing
- **Execution Time**: Typical execution under 2 seconds for 100 foals

## Troubleshooting

### Common Issues

1. **No Traits Revealed**: Check bonding/stress levels meet conditions
2. **Duplicate Traits**: Verify conflict resolution logic
3. **Missing Foals**: Ensure age and development day criteria
4. **Cron Not Running**: Check service status via admin API

### Debug Commands

```bash
# Manual trait evaluation
curl -X POST http://localhost:3000/api/admin/traits/evaluate

# Check cron status
curl http://localhost:3000/api/admin/cron/status

# View foals in development
curl http://localhost:3000/api/admin/foals/development
```

### Log Analysis

Search application logs for:

- `[CronJobService.AUDIT]`: Trait revelation events
- `[CronJobService.evaluateDailyFoalTraits]`: Daily execution logs
- `[traitEvaluation]`: Detailed trait evaluation logic

## Future Enhancements

### Planned Features

1. **Trait Discovery Events**: Notify players when traits are revealed
2. **Breeding Integration**: Use revealed traits in breeding calculations
3. **Performance Analytics**: Track trait revelation statistics
4. **Custom Schedules**: Allow different evaluation frequencies

### Extension Points

- **New Trait Categories**: Environmental, seasonal, or breed-specific traits
- **Dynamic Conditions**: Weather or event-based revelation modifiers
- **User Influence**: Allow player actions to influence trait revelation
- **Trait Evolution**: Traits that change over time based on care quality

## Security Considerations

- **Admin Access**: Trait evaluation endpoints require admin privileges
- **Data Validation**: All inputs validated before database operations
- **Error Exposure**: Sensitive information not exposed in error messages
- **Audit Trail**: Complete logging for security monitoring

## Integration with Game Systems

### Foal Development

- Uses bond_score and stress_level from enrichment activities
- Respects development day progression (0-6)
- Integrates with foal training history

### Competition System

- Revealed traits affect competition performance
- Hidden traits provide discovery gameplay
- Trait conflicts prevent overpowered combinations

### Breeding System

- Traits influence offspring genetics
- Hidden traits add breeding strategy depth
- Rare traits increase breeding value
