# Horse API Contracts

**Version:** 1.0.0
**Last Updated:** 2025-12-05
**Base URL:** `/api/v1/horses`
**Authentication:** Required for POST/PUT/DELETE operations

---

## Overview

The Horse API provides comprehensive CRUD operations and advanced features for managing horses in the Equoria game. This includes basic horse management, XP progression, trait analysis, breeding predictions, and groom compatibility.

**Total Endpoints:** 19
**Categories:**
- Basic CRUD (5 endpoints)
- XP System (4 endpoints)
- Advanced Features (10 endpoints)

---

## Authentication

Most endpoints require JWT authentication via the `Authorization` header:

```
Authorization: Bearer <jwt_token>
```

**Public Endpoints:** GET /horses, GET /horses/:id
**Protected Endpoints:** All POST/PUT/DELETE operations

---

## Data Models

### Horse Model (Core Fields)

```typescript
interface Horse {
  // Identity
  id: number;
  name: string;
  sex: 'stallion' | 'mare' | 'gelding';
  dateOfBirth: Date;
  age?: number;

  // Foreign Keys
  breedId: number;
  ownerId?: string;
  userId?: string;
  stableId?: number;

  // Genetics & Appearance
  genotype?: object;
  phenotypicMarkings?: object;
  finalDisplayColor?: string;
  shade?: string;
  imageUrl: string; // Default: "/images/samplehorse.JPG"

  // Traits & Characteristics
  trait?: string;
  temperament?: string;
  personality?: string;
  epigeneticFlags: string[]; // For horses under 3 years old

  // Base Stats (0-100)
  precision: number;
  strength: number;
  speed: number;
  agility: number;
  endurance: number;
  intelligence: number;

  // Competition Stats (0-100)
  stamina: number;
  balance: number;
  coordination: number;
  boldness: number;
  flexibility: number;
  obedience: number;
  focus: number;

  // Financial & Breeding
  totalEarnings: number;
  sireId?: number;
  damId?: number;
  studStatus: string; // Default: "Not at Stud"
  studFee: number;
  lastBredDate?: Date;
  forSale: boolean;
  salePrice: number;

  // Health & Care
  healthStatus: string; // Default: "Excellent"
  lastVettedDate: Date;
  bondScore: number;
  stressLevel: number;

  // Groom System
  daysGroomedInARow: number;
  burnoutStatus: string; // Default: "none"

  // XP System
  horseXp: number;
  availableStatPoints: number;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;

  // Relations (when included)
  breed?: Breed;
  user?: User;
  stable?: Stable;
  sire?: Horse;
  dam?: Horse;
  competitionResults?: CompetitionResult[];
  trainingLogs?: TrainingLog[];
  horseXpEvents?: HorseXpEvent[];
  // ... and 15+ more relations
}
```

### Standard Response Format

All endpoints follow this response structure:

```typescript
interface SuccessResponse<T> {
  success: true;
  message: string;
  data: T;
}

interface ErrorResponse {
  success: false;
  message: string;
  error?: string; // Only in development mode
}
```

---

## CRUD Endpoints

### 1. List All Horses

**Endpoint:** `GET /horses`
**Authentication:** Not required
**Description:** Retrieve a paginated list of horses with optional filtering.

#### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| userId | string | No | - | Filter by owner user ID |
| breedId | number | No | - | Filter by breed ID |
| limit | number | No | 50 | Maximum horses to return (pagination) |
| offset | number | No | 0 | Number of horses to skip (pagination) |

#### Request Example

```http
GET /horses?userId=user123&breedId=5&limit=20&offset=0
```

#### Response (200 OK)

```json
{
  "success": true,
  "message": "Found 15 horses",
  "data": [
    {
      "id": 1,
      "name": "Thunder",
      "sex": "stallion",
      "dateOfBirth": "2020-03-15T00:00:00.000Z",
      "breedId": 5,
      "userId": "user123",
      "breed": {
        "id": 5,
        "name": "Arabian"
      },
      "user": {
        "id": "user123",
        "username": "JohnDoe"
      },
      "imageUrl": "/images/samplehorse.JPG",
      "horseXp": 1500,
      "totalEarnings": 5000,
      "createdAt": "2023-01-15T10:30:00.000Z"
    }
    // ... more horses
  ]
}
```

#### Error Responses

**500 Internal Server Error**
```json
{
  "success": false,
  "message": "Internal server error",
  "error": "Database connection failed" // Development only
}
```

---

### 2. Get Horse by ID

**Endpoint:** `GET /horses/:id`
**Authentication:** Not required
**Description:** Retrieve detailed information about a specific horse.

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | number | Yes | Horse ID (must be positive integer) |

#### Request Example

```http
GET /horses/1
```

#### Response (200 OK)

```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Thunder",
    "sex": "stallion",
    "dateOfBirth": "2020-03-15T00:00:00.000Z",
    "age": 5,
    "breedId": 5,
    "userId": "user123",
    "stableId": 2,
    "genotype": {
      "color": "bay",
      "pattern": "solid"
    },
    "phenotypicMarkings": {
      "face": "blaze",
      "legs": ["sock_lf"]
    },
    "finalDisplayColor": "Bay",
    "trait": "Speed Demon",
    "temperament": "Spirited",
    "personality": "Bold",
    "epigeneticFlags": [],
    "precision": 75,
    "strength": 80,
    "speed": 95,
    "agility": 85,
    "endurance": 70,
    "intelligence": 78,
    "stamina": 88,
    "balance": 82,
    "coordination": 86,
    "boldness": 90,
    "flexibility": 75,
    "obedience": 72,
    "focus": 80,
    "totalEarnings": 5000,
    "studStatus": "At Stud",
    "studFee": 1000,
    "forSale": false,
    "healthStatus": "Excellent",
    "bondScore": 85,
    "stressLevel": 15,
    "horseXp": 1500,
    "availableStatPoints": 3,
    "breed": {
      "id": 5,
      "name": "Arabian",
      "description": "Desert-bred endurance horses"
    },
    "user": {
      "id": "user123",
      "username": "JohnDoe"
    },
    "createdAt": "2023-01-15T10:30:00.000Z",
    "updatedAt": "2023-12-01T15:45:00.000Z"
  }
}
```

#### Error Responses

**404 Not Found**
```json
{
  "success": false,
  "message": "Horse not found"
}
```

**400 Bad Request** (Invalid ID format)
```json
{
  "success": false,
  "message": "Horse ID must be a positive integer"
}
```

---

### 3. Create New Horse

**Endpoint:** `POST /horses`
**Authentication:** Required (JWT token)
**Description:** Create a new horse owned by the authenticated user.

#### Request Headers

```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

#### Request Body

```typescript
interface CreateHorseRequest {
  name: string; // Required, 1-100 characters
  breedId: number; // Required, positive integer
  age?: number; // Optional, 0-50
  sex?: 'stallion' | 'mare' | 'gelding'; // Optional
  // Additional optional fields...
  healthStatus?: string;
  trait?: string;
  temperament?: string;
  personality?: string;
}
```

#### Request Example

```json
{
  "name": "Storm Chaser",
  "breedId": 5,
  "age": 3,
  "sex": "mare",
  "trait": "Endurance Master",
  "temperament": "Calm",
  "personality": "Friendly"
}
```

#### Response (201 Created)

```json
{
  "success": true,
  "message": "Horse created successfully",
  "data": {
    "id": 42,
    "name": "Storm Chaser",
    "sex": "mare",
    "dateOfBirth": "2025-12-05T00:00:00.000Z",
    "breedId": 5,
    "userId": "user123",
    "age": 3,
    "trait": "Endurance Master",
    "temperament": "Calm",
    "personality": "Friendly",
    "healthStatus": "Good",
    "horseXp": 0,
    "availableStatPoints": 0,
    "totalEarnings": 0,
    "precision": 0,
    "strength": 0,
    "speed": 0,
    "agility": 0,
    "endurance": 0,
    "intelligence": 0,
    "createdAt": "2025-12-05T12:00:00.000Z",
    "updatedAt": "2025-12-05T12:00:00.000Z"
  }
}
```

#### Error Responses

**400 Bad Request** (Validation errors)
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "field": "name",
      "message": "Name must be between 1 and 100 characters"
    },
    {
      "field": "breedId",
      "message": "Breed ID must be a positive integer"
    }
  ]
}
```

**401 Unauthorized** (Missing or invalid token)
```json
{
  "success": false,
  "message": "Authentication required"
}
```

---

### 4. Update Horse

**Endpoint:** `PUT /horses/:id`
**Authentication:** Not required (but should be for production)
**Description:** Update an existing horse's information.

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | number | Yes | Horse ID to update |

#### Request Body

Any valid Horse model fields can be updated:

```json
{
  "name": "Thunder Strike",
  "healthStatus": "Good",
  "studStatus": "At Stud",
  "studFee": 1500,
  "forSale": true,
  "salePrice": 10000
}
```

#### Response (200 OK)

```json
{
  "success": true,
  "message": "Horse updated successfully",
  "data": {
    "id": 1,
    "name": "Thunder Strike",
    "healthStatus": "Good",
    "studStatus": "At Stud",
    "studFee": 1500,
    "forSale": true,
    "salePrice": 10000,
    "breed": {
      "id": 5,
      "name": "Arabian"
    },
    "user": {
      "id": "user123",
      "username": "JohnDoe"
    },
    "updatedAt": "2025-12-05T12:30:00.000Z"
  }
}
```

#### Error Responses

**404 Not Found**
```json
{
  "success": false,
  "message": "Horse not found"
}
```

---

### 5. Delete Horse

**Endpoint:** `DELETE /horses/:id`
**Authentication:** Not required (but should be for production)
**Description:** Permanently delete a horse from the system.

⚠️ **Warning:** This operation is irreversible and will cascade delete related records.

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | number | Yes | Horse ID to delete |

#### Request Example

```http
DELETE /horses/42
```

#### Response (200 OK)

```json
{
  "success": true,
  "message": "Horse deleted successfully"
}
```

#### Error Responses

**404 Not Found**
```json
{
  "success": false,
  "message": "Horse not found"
}
```

---

## XP System Endpoints

### 6. Get Horse XP Status

**Endpoint:** `GET /horses/:id/xp`
**Authentication:** Not required
**Description:** Retrieve the horse's current XP, level, and available stat points.

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | number | Yes | Horse ID |

#### Response (200 OK)

```json
{
  "success": true,
  "data": {
    "horseId": 1,
    "horseName": "Thunder",
    "currentXp": 1500,
    "level": 8,
    "xpToNextLevel": 500,
    "availableStatPoints": 3,
    "totalXpEarned": 1500
  }
}
```

---

### 7. Allocate Stat Point

**Endpoint:** `POST /horses/:id/allocate-stat`
**Authentication:** Required
**Description:** Spend an available stat point to increase a specific stat.

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | number | Yes | Horse ID |

#### Request Body

```typescript
interface AllocateStatRequest {
  stat: 'precision' | 'strength' | 'speed' | 'agility' | 'endurance' | 'intelligence';
}
```

#### Request Example

```json
{
  "stat": "speed"
}
```

#### Response (200 OK)

```json
{
  "success": true,
  "message": "Stat point allocated successfully",
  "data": {
    "horseId": 1,
    "horseName": "Thunder",
    "stat": "speed",
    "newValue": 96,
    "availableStatPoints": 2
  }
}
```

#### Error Responses

**400 Bad Request** (No points available)
```json
{
  "success": false,
  "message": "No available stat points"
}
```

**400 Bad Request** (Stat at max)
```json
{
  "success": false,
  "message": "Stat is already at maximum value (100)"
}
```

---

### 8. Get XP History

**Endpoint:** `GET /horses/:id/xp-history`
**Authentication:** Not required
**Description:** Retrieve the history of XP events for a horse.

#### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| limit | number | No | 50 | Maximum events to return |
| offset | number | No | 0 | Number of events to skip |

#### Response (200 OK)

```json
{
  "success": true,
  "data": {
    "horseId": 1,
    "horseName": "Thunder",
    "events": [
      {
        "id": 101,
        "horseId": 1,
        "eventType": "competition_win",
        "xpEarned": 100,
        "description": "Won Spring Derby",
        "timestamp": "2025-12-01T10:00:00.000Z"
      },
      {
        "id": 102,
        "horseId": 1,
        "eventType": "training_session",
        "xpEarned": 50,
        "description": "Completed speed training",
        "timestamp": "2025-12-02T14:30:00.000Z"
      }
    ],
    "total": 15
  }
}
```

---

### 9. Award XP (Admin)

**Endpoint:** `POST /horses/:id/award-xp`
**Authentication:** Required (Admin only)
**Description:** Manually award XP to a horse.

#### Request Body

```typescript
interface AwardXpRequest {
  amount: number; // Positive integer
  eventType: string; // e.g., "manual_award", "bonus"
  description?: string;
}
```

#### Request Example

```json
{
  "amount": 200,
  "eventType": "bonus",
  "description": "Monthly activity bonus"
}
```

#### Response (200 OK)

```json
{
  "success": true,
  "message": "XP awarded successfully",
  "data": {
    "horseId": 1,
    "horseName": "Thunder",
    "xpAwarded": 200,
    "newTotalXp": 1700,
    "newLevel": 9,
    "leveledUp": true,
    "statPointsEarned": 1
  }
}
```

---

## Advanced Feature Endpoints

### 10. Get Trainable Horses

**Endpoint:** `GET /horses/trainable/:userId`
**Authentication:** Not required
**Description:** Get all horses eligible for training for a specific user.

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| userId | string | Yes | User ID (1-50 characters) |

#### Response (200 OK)

```json
{
  "success": true,
  "data": {
    "userId": "user123",
    "trainableHorses": [
      {
        "id": 1,
        "name": "Thunder",
        "canTrain": true,
        "cooldownEndsAt": null,
        "energyLevel": 100
      },
      {
        "id": 2,
        "name": "Storm",
        "canTrain": false,
        "cooldownEndsAt": "2025-12-06T10:00:00.000Z",
        "energyLevel": 45
      }
    ],
    "total": 2
  }
}
```

---

### 11. Get Competition History

**Endpoint:** `GET /horses/:id/history`
**Authentication:** Not required
**Description:** Retrieve a horse's complete competition history.

#### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| limit | number | No | 50 | Maximum results to return |
| offset | number | No | 0 | Number of results to skip |

#### Response (200 OK)

```json
{
  "success": true,
  "data": {
    "horseId": 1,
    "horseName": "Thunder",
    "history": [
      {
        "id": 201,
        "competitionId": 50,
        "competitionName": "Spring Derby",
        "placement": 1,
        "totalParticipants": 12,
        "prizeMoney": 5000,
        "xpEarned": 100,
        "date": "2025-12-01T10:00:00.000Z"
      }
    ],
    "totalCompetitions": 15,
    "totalWins": 8,
    "winRate": 53.3,
    "totalEarnings": 45000
  }
}
```

---

### 12. Create Foal with Epigenetics

**Endpoint:** `POST /horses/foals`
**Authentication:** Required
**Description:** Create a new foal with genetic inheritance from sire and dam, including epigenetic traits.

#### Request Body

```typescript
interface CreateFoalRequest {
  name: string;
  sireId: number;
  damId: number;
  userId: string;
  // Optionally override genetic calculations
  trait?: string;
  temperament?: string;
  personality?: string;
}
```

#### Request Example

```json
{
  "name": "Lightning Bolt",
  "sireId": 1,
  "damId": 2,
  "userId": "user123"
}
```

#### Response (201 Created)

```json
{
  "success": true,
  "message": "Foal created successfully",
  "data": {
    "id": 43,
    "name": "Lightning Bolt",
    "sex": "stallion",
    "dateOfBirth": "2025-12-05T00:00:00.000Z",
    "age": 0,
    "sireId": 1,
    "damId": 2,
    "userId": "user123",
    "genotype": {
      "inherited": "calculated_genetics"
    },
    "epigeneticFlags": [
      "early_speed_boost",
      "stable_temperament"
    ],
    "trait": "Speed Prodigy",
    "temperament": "Balanced",
    "personality": "Curious",
    "horseXp": 0,
    "createdAt": "2025-12-05T12:00:00.000Z"
  }
}
```

---

### 13. Get Horse Overview

**Endpoint:** `GET /horses/:id/overview`
**Authentication:** Not required
**Description:** Get a comprehensive overview of a horse including stats, history, and relationships.

#### Response (200 OK)

```json
{
  "success": true,
  "data": {
    "horse": {
      "id": 1,
      "name": "Thunder",
      "age": 5,
      "breed": "Arabian",
      "owner": "JohnDoe"
    },
    "stats": {
      "base": {
        "precision": 75,
        "strength": 80,
        "speed": 95
      },
      "competition": {
        "stamina": 88,
        "balance": 82
      }
    },
    "performance": {
      "totalCompetitions": 15,
      "wins": 8,
      "winRate": 53.3,
      "totalEarnings": 45000
    },
    "progression": {
      "currentXp": 1500,
      "level": 8,
      "availableStatPoints": 3
    },
    "health": {
      "status": "Excellent",
      "bondScore": 85,
      "stressLevel": 15
    },
    "lineage": {
      "sire": {
        "id": 10,
        "name": "Desert Wind"
      },
      "dam": {
        "id": 15,
        "name": "Morning Star"
      }
    }
  }
}
```

---

### 14. Get Trait Trends

**Endpoint:** `GET /horses/trait-trends`
**Authentication:** Not required
**Description:** Analyze trait development trends across all horses.

#### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| breedId | number | No | - | Filter by specific breed |
| minAge | number | No | 0 | Minimum horse age |
| maxAge | number | No | 50 | Maximum horse age |

#### Response (200 OK)

```json
{
  "success": true,
  "data": {
    "traitDistribution": {
      "Speed Demon": 15,
      "Endurance Master": 12,
      "Precision Expert": 8
    },
    "averageStatsByTrait": {
      "Speed Demon": {
        "speed": 92,
        "agility": 85,
        "endurance": 70
      },
      "Endurance Master": {
        "endurance": 95,
        "stamina": 92,
        "intelligence": 75
      }
    },
    "trends": {
      "mostCommon": "Speed Demon",
      "rarest": "Ultra Rare Trait X",
      "emergingTrait": "Balance Virtuoso"
    }
  }
}
```

---

### 15. Get Personality Impact

**Endpoint:** `GET /horses/:id/personality-impact`
**Authentication:** Not required
**Description:** Determine which grooms are compatible with a horse based on personality.

#### Response (200 OK)

```json
{
  "success": true,
  "data": {
    "horseId": 1,
    "horseName": "Thunder",
    "personality": "Bold",
    "compatibleGrooms": [
      {
        "groomId": 5,
        "groomName": "Sarah",
        "compatibilityScore": 95,
        "reason": "Excellent match for bold personalities"
      },
      {
        "groomId": 8,
        "groomName": "Mike",
        "compatibilityScore": 80,
        "reason": "Good experience with spirited horses"
      }
    ],
    "incompatibleGrooms": [
      {
        "groomId": 3,
        "groomName": "Tom",
        "compatibilityScore": 30,
        "reason": "Prefers calm, gentle horses"
      }
    ]
  }
}
```

---

### 16. Get Legacy Score

**Endpoint:** `GET /horses/:id/legacy-score`
**Authentication:** Not required
**Description:** Calculate a horse's legacy score based on competitions, offspring, and achievements.

#### Response (200 OK)

```json
{
  "success": true,
  "data": {
    "horseId": 1,
    "horseName": "Thunder",
    "legacyScore": 8750,
    "breakdown": {
      "competitionSuccess": 5000,
      "offspring": 2000,
      "rareTrait": 1000,
      "longevity": 500,
      "bondScore": 250
    },
    "rank": 42,
    "percentile": 95.5,
    "achievements": [
      "Grand Champion",
      "Legendary Sire",
      "Speed Record Holder"
    ]
  }
}
```

---

### 17. Get Trait Timeline Card

**Endpoint:** `GET /horses/:id/trait-card`
**Authentication:** Not required
**Description:** Get a visual timeline of trait development and milestones.

#### Response (200 OK)

```json
{
  "success": true,
  "data": {
    "horseId": 1,
    "horseName": "Thunder",
    "timeline": [
      {
        "age": 0,
        "event": "Born with Speed Demon trait",
        "date": "2020-03-15T00:00:00.000Z"
      },
      {
        "age": 1,
        "event": "Epigenetic trait 'Early Acceleration' developed",
        "date": "2021-03-15T00:00:00.000Z"
      },
      {
        "age": 2,
        "event": "First competition - showed natural speed",
        "date": "2022-03-15T00:00:00.000Z"
      },
      {
        "age": 3,
        "event": "Trait fully matured",
        "date": "2023-03-15T00:00:00.000Z"
      }
    ],
    "currentTraits": [
      "Speed Demon",
      "Early Acceleration",
      "Competitive Spirit"
    ]
  }
}
```

---

### 18. Get Breeding Data

**Endpoint:** `GET /horses/:id/breeding-data`
**Authentication:** Not required
**Description:** Get breeding predictions and genetic information for potential offspring.

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| mateId | number | No | ID of potential mate to predict offspring |

#### Response (200 OK)

```json
{
  "success": true,
  "data": {
    "horseId": 1,
    "horseName": "Thunder",
    "sex": "stallion",
    "studStatus": "At Stud",
    "studFee": 1000,
    "geneticProfile": {
      "dominantTraits": ["Speed", "Agility"],
      "recessiveTraits": ["Endurance"],
      "colorGenetics": "Ee/Aa"
    },
    "offspringCount": 12,
    "successfulOffspring": 9,
    "predictions": {
      "withMateId": 2,
      "mateName": "Storm",
      "predictedTraits": [
        {
          "trait": "Speed Demon",
          "probability": 75
        },
        {
          "trait": "Endurance Master",
          "probability": 25
        }
      ],
      "predictedStats": {
        "speed": {
          "min": 85,
          "max": 98,
          "expected": 92
        },
        "endurance": {
          "min": 70,
          "max": 90,
          "expected": 80
        }
      },
      "colorPredictions": [
        {
          "color": "Bay",
          "probability": 50
        },
        {
          "color": "Chestnut",
          "probability": 25
        },
        {
          "color": "Black",
          "probability": 25
        }
      ]
    }
  }
}
```

---

## Error Handling

### Standard Error Codes

| Status Code | Description | Common Causes |
|-------------|-------------|---------------|
| 400 | Bad Request | Invalid input, validation failure |
| 401 | Unauthorized | Missing or invalid JWT token |
| 404 | Not Found | Horse ID doesn't exist |
| 500 | Internal Server Error | Database error, server crash |

### Error Response Format

All errors follow this structure:

```typescript
interface ErrorResponse {
  success: false;
  message: string;
  error?: string; // Only included in development mode
  errors?: ValidationError[]; // For validation failures
}

interface ValidationError {
  field: string;
  message: string;
}
```

### Example Error Responses

**Validation Error (400)**
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "field": "name",
      "message": "Name must be between 1 and 100 characters"
    },
    {
      "field": "age",
      "message": "Age must be between 0 and 50"
    }
  ]
}
```

**Authentication Error (401)**
```json
{
  "success": false,
  "message": "Authentication required"
}
```

**Not Found (404)**
```json
{
  "success": false,
  "message": "Horse not found"
}
```

**Server Error (500)**
```json
{
  "success": false,
  "message": "Internal server error",
  "error": "Database connection timeout" // Development only
}
```

---

## Rate Limiting

**Not currently implemented**, but recommended for production:

- 100 requests per minute per user
- 1000 requests per hour per user
- 429 status code when exceeded

---

## Pagination

List endpoints support pagination via query parameters:

- `limit`: Maximum items per page (default: 50, max: 100)
- `offset`: Number of items to skip (default: 0)

Example:
```
GET /horses?limit=20&offset=40
```

This returns items 41-60.

---

## Filtering

The `GET /horses` endpoint supports filtering by:

- `userId`: Filter by owner
- `breedId`: Filter by breed
- Additional filters can be added as needed

---

## Includes/Relations

Many endpoints support `include` query parameter to load related data:

```
GET /horses/1?include=breed,user,sire,dam
```

This reduces the need for multiple API calls.

---

## Versioning

**Current Version:** v1
**Base Path:** `/api/v1/horses`

Future versions will use:
- `/api/v2/horses`
- etc.

---

## Security Considerations

### Authentication
- JWT tokens expire after 24 hours
- Refresh tokens should be used for extended sessions
- Tokens should be stored securely (httpOnly cookies recommended)

### Authorization
- Users can only create/update/delete their own horses
- Admin endpoints require special permissions
- CORS should be configured for production

### Input Validation
- All inputs are validated using express-validator
- SQL injection protection via Prisma ORM
- XSS protection via input sanitization

---

## Testing

### Test Coverage
- Unit tests for all endpoints
- Integration tests for complex flows
- E2E tests for critical user journeys

### Test Data
Mock horse data is available for testing:

```json
{
  "id": 999,
  "name": "Test Horse",
  "sex": "stallion",
  "breedId": 1,
  "userId": "test_user",
  "horseXp": 0
}
```

---

## Changelog

### Version 1.0.0 (2025-12-05)
- Initial API documentation
- 19 endpoints documented
- Request/response formats defined
- Error handling standardized

---

## Support

For issues or questions:
- Check the Prisma schema: `packages/database/prisma/schema.prisma`
- Review route definitions: `backend/routes/horseRoutes.mjs`
- Contact backend team for API changes
