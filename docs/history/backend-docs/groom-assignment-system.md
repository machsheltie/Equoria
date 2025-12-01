# Groom Assignment System

## Overview

The Groom Assignment System is a comprehensive feature that allows players to assign dedicated caretakers to their foals for daily care. The system automatically increases bonding scores based on groom interactions and provides full UI management for assignments.

## Key Features

- **Automatic Groom Assignment**: Default grooms are automatically assigned to foals when none exist
- **Skill-Based Bonding**: Groom interactions increase bonding based on speciality, skill level, and personality
- **Daily Care Automation**: Automated daily care routines with configurable schedules
- **Cost Management**: Hourly rates and interaction costs based on groom skill levels
- **Comprehensive UI**: Web-based browser interface for managing assignments

## Database Schema

### Groom Model

```sql
model Groom {
  id          Int      @id @default(autoincrement())
  name        String
  speciality  String   // "foal_care", "general", "training", "medical"
  experience  Int      @default(1) // Years of experience (1-20)
  skill_level String   @default("novice") // "novice", "intermediate", "expert", "master"
  personality String   // "gentle", "energetic", "patient", "strict"
  hourly_rate Float    @default(15.0) // Cost per hour
  availability Json    @default("{}") // Available days/hours
  bio         String?  // Optional biography
  image_url   String?  // Optional profile image
  is_active   Boolean  @default(true)
  hired_date  DateTime @default(now())
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  // Relations
  assignments   GroomAssignment[]
  interactions  GroomInteraction[]
  player        User? @relation(fields: [playerId], references: [id])
  playerId      String?

  @@map("grooms")
}
```

### GroomAssignment Model

```sql
model GroomAssignment {
  id          Int      @id @default(autoincrement())
  startDate   DateTime @default(now())
  endDate     DateTime?
  isActive    Boolean  @default(true)
  isDefault   Boolean  @default(false) // System-assigned default groom
  priority    Int      @default(1) // 1 = primary, 2 = backup, etc.
  notes       String?  // Assignment notes
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  // Relations
  foal        Horse @relation(fields: [foalId], references: [id], onDelete: Cascade)
  foalId      Int
  groom       Groom @relation(fields: [groomId], references: [id], onDelete: Cascade)
  groomId     Int
  player      User? @relation(fields: [playerId], references: [id])
  playerId    String?
  interactions GroomInteraction[]

  @@unique([foalId, groomId, isActive])
  @@map("groom_assignments")
}
```

### GroomInteraction Model

```sql
model GroomInteraction {
  id              Int      @id @default(autoincrement())
  interactionType String   // "daily_care", "feeding", "grooming", "exercise", "medical_check"
  duration        Int      // Duration in minutes
  bondingChange   Int      @default(0) // Change in bonding score (-10 to +10)
  stressChange    Int      @default(0) // Change in stress level (-10 to +10)
  quality         String   @default("good") // "poor", "fair", "good", "excellent"
  notes           String?  // Optional interaction notes
  cost            Float    @default(0.0) // Cost of this interaction
  timestamp       DateTime @default(now())
  createdAt       DateTime @default(now())

  // Relations
  foal            Horse @relation(fields: [foalId], references: [id], onDelete: Cascade)
  foalId          Int
  groom           Groom @relation(fields: [groomId], references: [id], onDelete: Cascade)
  groomId         Int
  assignment      GroomAssignment? @relation(fields: [assignmentId], references: [id])
  assignmentId    Int?

  @@map("groom_interactions")
}
```

## API Endpoints

### Core Assignment Endpoints

#### `POST /api/grooms/assign`

Assign a groom to a foal.

**Request Body:**

```json
{
  "foalId": 123,
  "groomId": 456,
  "priority": 1,
  "notes": "Primary caretaker"
}
```

#### `POST /api/grooms/ensure-default/:foalId`

Ensure a foal has a default groom assignment.

#### `GET /api/grooms/assignments/:foalId`

Get all assignments for a specific foal.

#### `POST /api/grooms/interact`

Record a groom interaction with a foal.

**Request Body:**

```json
{
  "foalId": 123,
  "groomId": 456,
  "interactionType": "daily_care",
  "duration": 60,
  "notes": "Morning care routine"
}
```

#### `GET /api/grooms/player/:playerId`

Get all grooms for a player.

#### `POST /api/grooms/hire`

Hire a new groom for a player.

#### `GET /api/grooms/definitions`

Get groom system definitions (specialties, skill levels, personalities).

## Groom System Mechanics

### Specialties and Modifiers

| Specialty     | Bonding Modifier | Stress Reduction | Preferred Activities               |
| ------------- | ---------------- | ---------------- | ---------------------------------- |
| **Foal Care** | 1.5x             | 1.3x             | daily_care, feeding, grooming      |
| **General**   | 1.0x             | 1.0x             | daily_care, grooming, exercise     |
| **Training**  | 1.2x             | 0.8x             | exercise, training, daily_care     |
| **Medical**   | 0.9x             | 1.5x             | medical_check, daily_care, feeding |

### Skill Levels and Effects

| Skill Level      | Bonding Modifier | Cost Modifier | Error Chance | Description                 |
| ---------------- | ---------------- | ------------- | ------------ | --------------------------- |
| **Novice**       | 0.8x             | 0.7x          | 15%          | New to horse care           |
| **Intermediate** | 1.0x             | 1.0x          | 8%           | Experienced caretaker       |
| **Expert**       | 1.3x             | 1.5x          | 3%           | Highly skilled professional |
| **Master**       | 1.6x             | 2.0x          | 1%           | Elite horse care specialist |

### Personality Traits

| Personality   | Bonding Modifier | Stress Reduction | Description                |
| ------------- | ---------------- | ---------------- | -------------------------- |
| **Gentle**    | 1.2x             | 1.4x             | Calm and patient approach  |
| **Energetic** | 1.1x             | 0.9x             | Active and enthusiastic    |
| **Patient**   | 1.3x             | 1.2x             | Takes time with each horse |
| **Strict**    | 0.9x             | 0.8x             | Disciplined and structured |

## Daily Care Automation

### Routine Types

| Routine          | Duration | Time of Day | Priority | Description                     |
| ---------------- | -------- | ----------- | -------- | ------------------------------- |
| **Morning Care** | 45 min   | Morning     | 1        | Feeding, grooming, health check |
| **Feeding**      | 20 min   | Multiple    | 2        | Regular feeding routine         |
| **Grooming**     | 30 min   | Afternoon   | 3        | Brushing and basic grooming     |
| **Exercise**     | 60 min   | Afternoon   | 4        | Light exercise and movement     |
| **Evening Care** | 30 min   | Evening     | 5        | Evening check-up and settling   |

### Automation Features

- **Scheduled Execution**: Runs at 8 AM, 2 PM, and 8 PM daily
- **Smart Caching**: Prevents excessive database queries
- **Availability Checking**: Respects groom availability schedules
- **Cost Calculation**: Automatic cost tracking for all interactions
- **Bonding Updates**: Real-time bonding score and stress level updates

## Frontend Integration

### React Hook Usage

```jsx
import { useGroomManagement } from '../hooks/useGroomManagement';

function FoalCareScreen({ foalId, playerId }) {
  const {
    grooms,
    assignments,
    assignGroom,
    ensureDefaultAssignment,
    recordInteraction,
    getActiveAssignment,
  } = useGroomManagement(playerId);

  const activeAssignment = getActiveAssignment(foalId);

  // Component logic...
}
```

### Component Usage

```jsx
import GroomAssignmentManager from '../components/GroomAssignmentManager';

<GroomAssignmentManager
  foalId={foal.id}
  foalName={foal.name}
  playerId={player.id}
  onAssignmentChange={() => refreshFoalData()}
/>;
```

## Default Groom Profiles

The system includes three default groom profiles that are automatically created for players:

1. **Sarah Johnson** - Foal Care Specialist

   - Speciality: foal_care
   - Skill Level: intermediate
   - Personality: gentle
   - Rate: $18/hour

2. **Mike Rodriguez** - General Caretaker

   - Speciality: general
   - Skill Level: expert
   - Personality: patient
   - Rate: $25/hour

3. **Emma Thompson** - Training Assistant
   - Speciality: training
   - Skill Level: intermediate
   - Personality: energetic
   - Rate: $20/hour

## Integration Points

### Automatic Assignment

- **Foal Development Route**: Automatically ensures default groom assignment when foal development is accessed
- **Enrichment Activities**: Triggers trait discovery after groom interactions
- **Daily Care**: Automated daily routines maintain foal bonding and reduce stress

### Real-time Updates

- **WebSocket Support**: Ready for real-time notifications of groom interactions
- **State Management**: React hooks provide real-time state updates
- **Cost Tracking**: Automatic cost calculation and player balance updates

## Performance Considerations

- **Caching**: Discovery checks are cached to prevent excessive database queries
- **Batch Processing**: Support for batch operations on multiple foals
- **Rate Limiting**: Built-in throttling for automatic discovery checks
- **Optimized Queries**: Efficient database queries with proper indexing

## Testing Coverage

- **Unit Tests**: Core groom system logic and calculations
- **Integration Tests**: API endpoints and database operations
- **UI Tests**: React components and user interactions
- **Automation Tests**: Daily care automation and scheduling

## Future Enhancements

- **Advanced Scheduling**: Custom care schedules per foal
- **Groom Training**: Skill development system for grooms
- **Performance Analytics**: Detailed groom performance tracking
- **Seasonal Events**: Special care routines for events
- **Mobile Notifications**: Push notifications for care reminders

## Troubleshooting

### Common Issues

1. **No grooms available**: System automatically creates default grooms
2. **Assignment conflicts**: Priority system resolves conflicts automatically
3. **Cost management**: Hourly rates are clearly displayed and calculated
4. **Availability issues**: Groom availability is checked before assignments

### Debug Logging

Enable debug logging to trace groom operations:

```javascript
// Set LOG_LEVEL=debug in environment
logger.debug('[groomSystem] Assignment created for foal', foalId);
```

This comprehensive groom assignment system provides players with meaningful foal care management while automating the complex bonding calculations and daily care routines.
