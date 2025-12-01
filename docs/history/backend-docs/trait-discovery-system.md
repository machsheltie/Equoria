# Trait Discovery System

## Overview

The Trait Discovery System is a comprehensive feature that reveals hidden horse traits based on specific conditions such as bonding scores, stress levels, and enrichment activities. This system adds an engaging discovery element to horse management and creates meaningful progression through player interaction.

## Key Features

- **Condition-based Discovery**: Traits are revealed when specific conditions are met
- **Multiple Trigger Types**: Bonding, stress management, enrichment activities, and training
- **Real-time Updates**: Automatic discovery checks with optional real-time notifications
- **Comprehensive API**: Full REST API for trait management and discovery
- **Frontend Integration**: React hooks and components for seamless UI integration

## Discovery Conditions

### Bonding-Based Discoveries

| Condition        | Requirement                 | Priority  | Description                   |
| ---------------- | --------------------------- | --------- | ----------------------------- |
| `HIGH_BOND`      | Bond score ≥ 80             | High      | Strong bond formed with horse |
| `EXCELLENT_BOND` | Bond score ≥ 95             | Legendary | Exceptional bond achieved     |
| `MATURE_BOND`    | Age ≥ 2 AND Bond score ≥ 70 | Medium    | Mature relationship developed |

### Stress-Based Discoveries

| Condition        | Requirement       | Priority | Description               |
| ---------------- | ----------------- | -------- | ------------------------- |
| `LOW_STRESS`     | Stress level ≤ 20 | Medium   | Stress levels minimized   |
| `MINIMAL_STRESS` | Stress level ≤ 5  | High     | Perfect stress management |

### Combined Conditions

| Condition      | Requirement                           | Priority  | Description                      |
| -------------- | ------------------------------------- | --------- | -------------------------------- |
| `PERFECT_CARE` | Bond score ≥ 80 AND Stress level ≤ 20 | Legendary | Perfect care conditions achieved |

### Training-Based Discoveries

| Condition             | Requirement                         | Priority | Description                            |
| --------------------- | ----------------------------------- | -------- | -------------------------------------- |
| `CONSISTENT_TRAINING` | ≥5 training sessions in last 7 days | Medium   | Consistent training regimen maintained |

### Enrichment-Based Discoveries

| Discovery                       | Activities Required                | Min Count | Priority  | Description                               |
| ------------------------------- | ---------------------------------- | --------- | --------- | ----------------------------------------- |
| `SOCIALIZATION_COMPLETE`        | social_interaction, group_play     | 3         | Medium    | Socialization activities completed        |
| `MENTAL_STIMULATION_COMPLETE`   | puzzle_feeding, obstacle_course    | 2         | High      | Mental stimulation activities completed   |
| `PHYSICAL_DEVELOPMENT_COMPLETE` | free_exercise, controlled_movement | 4         | Medium    | Physical development activities completed |
| `ALL_ENRICHMENT_COMPLETE`       | All activity types                 | 6         | Legendary | All enrichment activities completed       |

## API Endpoints

### Core Discovery Endpoints

#### `POST /api/traits/discover/:horseId`

Trigger trait discovery for a specific horse.

**Parameters:**

- `horseId` (path): Horse ID (integer)

**Body:**

```json
{
  "checkEnrichment": true,
  "forceCheck": false
}
```

**Response:**

```json
{
  "success": true,
  "message": "Discovered 2 new traits!",
  "data": {
    "horseId": 123,
    "horseName": "Thunder",
    "revealed": [
      {
        "trait": "bold",
        "definition": {
          "type": "positive",
          "rarity": "common"
        },
        "discoveryReason": "Strong bond formed"
      }
    ],
    "conditions": [...],
    "updatedTraits": {...}
  }
}
```

#### `GET /api/traits/horse/:horseId`

Get all traits for a specific horse.

**Response:**

```json
{
  "success": true,
  "data": {
    "horseId": 123,
    "horseName": "Thunder",
    "bondScore": 85,
    "stressLevel": 15,
    "age": 2,
    "traits": {
      "positive": [...],
      "negative": [...],
      "hidden": [...]
    },
    "summary": {
      "totalTraits": 5,
      "visibleTraits": 3,
      "hiddenTraits": 2
    }
  }
}
```

#### `GET /api/traits/discovery-status/:horseId`

Get discovery status and conditions for a horse.

**Response:**

```json
{
  "success": true,
  "data": {
    "horseId": 123,
    "horseName": "Thunder",
    "currentStats": {
      "bondScore": 85,
      "stressLevel": 15,
      "age": 2
    },
    "traitCounts": {
      "visible": 3,
      "hidden": 2
    },
    "discoveryConditions": {
      "met": [...],
      "enrichment": [...],
      "total": 3
    },
    "canDiscover": true
  }
}
```

#### `POST /api/traits/batch-discover`

Trigger discovery for multiple horses (max 10).

**Body:**

```json
{
  "horseIds": [123, 456, 789],
  "checkEnrichment": true
}
```

#### `GET /api/traits/definitions`

Get all trait definitions with optional filtering.

**Query Parameters:**

- `type` (optional): Filter by type (`positive`, `negative`, `all`)

## Frontend Integration

### React Hook Usage

```jsx
import { useTraitDiscovery } from '../hooks/useTraitDiscovery';

function HorseProfile({ horseId }) {
  const { discoveryStatus, discoverTraits, isDiscovering, canDiscover, lastDiscovery } =
    useTraitDiscovery(horseId, {
      autoCheck: true,
      checkInterval: 30000,
      enableRealTime: true,
    });

  const handleDiscovery = async () => {
    const result = await discoverTraits({
      checkEnrichment: true,
      forceCheck: false,
    });

    if (result && result.revealed.length > 0) {
      // Show discovery notification
      setShowNotification(true);
    }
  };

  return (
    <div>
      {canDiscover && (
        <button onClick={handleDiscovery} disabled={isDiscovering}>
          {isDiscovering ? 'Discovering...' : 'Discover Traits'}
        </button>
      )}

      {lastDiscovery && (
        <TraitDiscoveryNotification
          discovery={lastDiscovery}
          visible={showNotification}
          onClose={() => setShowNotification(false)}
          horseName={horse.name}
        />
      )}
    </div>
  );
}
```

### Notification Component

```jsx
import TraitDiscoveryNotification from '../components/TraitDiscoveryNotification';

<TraitDiscoveryNotification
  discovery={discoveryResult}
  visible={showNotification}
  onClose={() => setShowNotification(false)}
  onViewDetails={discovery => showDetailsModal(discovery)}
  horseName='Thunder'
/>;
```

## Automatic Discovery

### Middleware Integration

The system includes automatic discovery middleware that triggers trait checks after relevant operations:

```javascript
// In foal routes - enrichment activities
router.post(
  '/:foalId/enrichment',
  [
    // validation...
  ],
  enrichmentDiscoveryMiddleware(),
  async (req, res) => {
    // enrichment logic...
  },
);

// In training routes - training completion
router.post(
  '/train',
  [
    // validation...
  ],
  trainingDiscoveryMiddleware(),
  async (req, res) => {
    // training logic...
  },
);
```

### Discovery Triggers

Automatic discovery is triggered after:

- Enrichment activity completion
- Training session completion
- Bond score changes
- Stress level changes
- Manual discovery requests

## Configuration

### Discovery Limits

- **Maximum revelations per check**: 3 traits
- **Minimum check interval**: 1-10 minutes (depending on trigger type)
- **Batch processing limit**: 10 horses maximum

### Priority System

Traits are revealed based on condition priority and trait rarity:

1. **Legendary conditions** → Legendary traits
2. **High priority conditions** → Rare/Legendary traits
3. **Medium priority conditions** → Common/Rare traits
4. **Low priority conditions** → Common traits

## Testing

### Unit Tests

- `backend/tests/traitDiscovery.test.js` - Core discovery logic
- Covers all discovery conditions and edge cases

### Integration Tests

- `backend/tests/integration/traitRoutes.test.js` - API endpoints
- Full end-to-end testing of all routes

### Test Coverage

- ✅ Discovery condition evaluation
- ✅ Trait revelation logic
- ✅ API endpoint validation
- ✅ Error handling
- ✅ Batch processing
- ✅ Database integration

## Performance Considerations

- **Caching**: Discovery checks are cached to prevent excessive database queries
- **Async Processing**: Discovery runs asynchronously to avoid blocking responses
- **Batch Limits**: Maximum 10 horses per batch request
- **Rate Limiting**: Built-in throttling for automatic discovery checks

## Future Enhancements

- **WebSocket Integration**: Real-time discovery notifications
- **Discovery Analytics**: Track discovery patterns and success rates
- **Custom Conditions**: User-defined discovery conditions
- **Achievement System**: Rewards for discovery milestones
- **Discovery History**: Detailed logs of all discoveries

## Troubleshooting

### Common Issues

1. **No traits discovered**: Check bond score and stress levels meet minimum requirements
2. **Discovery not triggering**: Verify middleware is properly attached to routes
3. **Database errors**: Ensure proper field names in Prisma queries
4. **Rate limiting**: Check discovery cache and timing intervals

### Debug Logging

Enable debug logging to trace discovery operations:

```javascript
// Set LOG_LEVEL=debug in environment
logger.debug('[traitDiscovery] Discovery check initiated for horse', horseId);
```
