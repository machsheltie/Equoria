# Foal Enrichment Activity API

## Overview

The Foal Enrichment Activity API provides a RESTful endpoint for completing enrichment activities with foals during their critical development period (days 0-6). This API manages foal bonding and stress levels while recording all activities in the training history.

## Endpoint

```
POST /api/foals/{foalId}/enrichment
```

## Request Format

### URL Parameters

- `foalId` (integer, required): The ID of the foal (must be age 0 or 1)

### Request Body

```json
{
  "day": 3,
  "activity": "Trailer Exposure"
}
```

#### Fields

- `day` (integer, required): Development day (0-6)
- `activity` (string, required): Activity name (1-100 characters)

## Response Format

### Success Response (200 OK)

```json
{
  "success": true,
  "message": "Enrichment activity \"Trailer Exposure\" completed successfully",
  "data": {
    "foal": {
      "id": 1,
      "name": "Young Star"
    },
    "activity": {
      "name": "Trailer Exposure",
      "day": 3,
      "outcome": "success",
      "description": "Introduce the foal to a horse trailer completed successfully."
    },
    "updated_levels": {
      "bond_score": 54,
      "stress_level": 25
    },
    "changes": {
      "bond_change": 4,
      "stress_change": 5
    },
    "training_record_id": "uuid-string"
  }
}
```

### Error Responses

#### 400 Bad Request - Validation Error

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "msg": "Day must be an integer between 0 and 6",
      "param": "day",
      "location": "body"
    }
  ]
}
```

#### 400 Bad Request - Activity Not Appropriate

```json
{
  "success": false,
  "message": "Activity \"Trailer Exposure\" is not appropriate for day 0. Available activities: Gentle Touch, Quiet Presence, Soft Voice"
}
```

#### 404 Not Found - Foal Not Found

```json
{
  "success": false,
  "message": "Foal not found"
}
```

#### 404 Not Found - Not a Foal

```json
{
  "success": false,
  "message": "Horse is not a foal (must be 1 year old or younger)"
}
```

#### 500 Internal Server Error

```json
{
  "success": false,
  "message": "Internal server error"
}
```

## Available Activities by Day

### Day 0 - Birth and Initial Bonding

- **Gentle Touch**: Softly touch and stroke the foal
- **Quiet Presence**: Sit quietly near the foal
- **Soft Voice**: Speak gently to the foal

### Day 1 - Basic Interaction

- **Feeding Assistance**: Help with feeding routine
- **Grooming Introduction**: Introduce basic grooming
- **Play Interaction**: Gentle play and interaction

### Day 2 - Movement and Exploration

- **Walking Practice**: Encourage walking and movement
- **Environment Exploration**: Explore the stable area
- **Social Introduction**: Meet other horses safely

### Day 3 - Learning and Training Basics

- **Halter Introduction**: Introduce wearing a halter
- **Leading Practice**: Practice being led
- **Handling Exercises**: Practice being handled
- **Trailer Exposure**: Introduce the foal to a horse trailer

### Day 4 - Advanced Interaction

- **Obstacle Introduction**: Navigate simple obstacles
- **Advanced Grooming**: More thorough grooming session
- **Training Games**: Fun learning activities

### Day 5 - Confidence Building

- **Confidence Building**: Activities to build confidence
- **New Experiences**: Introduce new sights and sounds
- **Independence Practice**: Practice being independent

### Day 6 - Final Preparation

- **Final Assessment**: Evaluate development progress
- **Graduation Ceremony**: Celebrate completion
- **Future Planning**: Plan next steps

## Activity Name Formats

The API accepts activities in multiple formats:

1. **Exact Name**: `"Trailer Exposure"`
2. **Type Format**: `"trailer_exposure"`
3. **Case Insensitive**: `"TRAILER EXPOSURE"`, `"trailer exposure"`

## Bonding and Stress Mechanics

### Bonding Score (0-100)

- Starts at 50 (default)
- Increased by positive interactions
- Higher bonding improves future training success
- Capped at 100 maximum

### Stress Level (0-100)

- Starts at 0 (default)
- Increased by challenging activities
- Decreased by calming activities
- Affects foal's responsiveness to training
- Capped at 100 maximum

### Activity Outcomes

- **Excellent**: High bonding gain, low stress increase
- **Success**: Moderate bonding gain, moderate stress change
- **Challenging**: Lower bonding gain, higher stress increase

## Database Integration

### Horse Table Updates

The API updates the following fields in the `Horse` table:

- `bond_score`: Updated with activity bonding changes
- `stress_level`: Updated with activity stress changes

### Training History Records

Each activity creates a record in the `foal_training_history` table:

```sql
CREATE TABLE foal_training_history (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  horse_id     INTEGER REFERENCES Horse(id) ON DELETE CASCADE,
  day          INTEGER NOT NULL,
  activity     TEXT NOT NULL,
  outcome      TEXT NOT NULL,
  bond_change  INTEGER DEFAULT 0,
  stress_change INTEGER DEFAULT 0,
  timestamp    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Usage Examples

### JavaScript/Node.js

```javascript
const response = await fetch('/api/foals/1/enrichment', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    day: 3,
    activity: 'Trailer Exposure',
  }),
});

const data = await response.json();
if (data.success) {
  console.log(`Bond Score: ${data.data.updated_levels.bond_score}`);
  console.log(`Stress Level: ${data.data.updated_levels.stress_level}`);
}
```

### cURL

```bash
curl -X POST http://localhost:3000/api/foals/1/enrichment \
  -H "Content-Type: application/json" \
  -d '{
    "day": 3,
    "activity": "Trailer Exposure"
  }'
```

### Browser JavaScript

```javascript
const completeActivity = async (foalId, day, activity) => {
  try {
    const response = await fetch(`/api/foals/${foalId}/enrichment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ day, activity }),
    });

    const data = await response.json();

    if (data.success) {
      // Update UI with new bonding and stress levels
      updateFoalStats(data.data.updated_levels);
    } else {
      // Handle error
      showError(data.message);
    }
  } catch (error) {
    console.error('Failed to complete activity:', error);
  }
};
```

## Validation Rules

### Request Validation

- `foalId`: Must be a positive integer
- `day`: Must be an integer between 0 and 6 (inclusive)
- `activity`: Must be a non-empty string, 1-100 characters

### Business Logic Validation

- Horse must exist in database
- Horse must be age 0 or 1 (foal age range)
- Activity must be appropriate for the specified day
- Activity name must match available activities (case-insensitive)

## Error Handling

The API provides comprehensive error handling with specific error messages:

1. **Validation Errors**: Detailed field-level validation messages
2. **Business Logic Errors**: Clear explanations of why an activity cannot be completed
3. **Database Errors**: Graceful handling of database connection issues
4. **Not Found Errors**: Specific messages for missing foals or inappropriate activities

## Performance Considerations

- Database queries are optimized with proper indexing
- Activity validation uses in-memory lookups
- Bonding/stress calculations are performed in-application
- Single database transaction per activity completion

## Security Considerations

- Input validation prevents SQL injection
- Parameter sanitization prevents XSS attacks
- Error messages don't expose sensitive database information
- Activity validation prevents unauthorized data manipulation

## Testing

The API includes comprehensive test coverage:

### Unit Tests (`foalEnrichment.test.js`)

- Function-level testing with mocked dependencies
- Validation testing for all input parameters
- Error handling verification
- Business logic testing

### Integration Tests (`foalEnrichmentIntegration.test.js`)

- End-to-end API testing
- Database integration verification
- Real HTTP request/response testing
- Data persistence validation

### Demo Script (`examples/foalEnrichmentDemo.js`)

- Interactive demonstration of API functionality
- Example usage patterns
- Error scenario testing

## Related Endpoints

- `GET /api/foals/:foalId/development` - Get foal development status
- `POST /api/foals/:foalId/activity` - Complete legacy foal activity
- `POST /api/foals/:foalId/advance-day` - Advance foal to next day

## Migration Notes

This API uses the new `foal_training_history` table introduced in migration `20250525184836_add_horse_bonding_and_foal_training_history`. Ensure the migration has been applied before using this endpoint.

## Support

For issues or questions about the Foal Enrichment API:

1. Check the test files for usage examples
2. Run the demo script for interactive testing
3. Review the validation rules for proper request formatting
4. Check server logs for detailed error information
