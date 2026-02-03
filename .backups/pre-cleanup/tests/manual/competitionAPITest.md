# Competition API Endpoints Manual Test Guide

## 🚀 **COMPETITION API ENDPOINTS TESTING**

This guide provides manual testing steps for the newly implemented competition API endpoints.

### **Prerequisites**

1. Backend server running (`npm run dev`)
2. Database seeded with test data
3. Valid authentication token
4. Test horse and show data

### **API Endpoints to Test**

#### **1. GET /api/competition/disciplines**

**Purpose:** Get all available competition disciplines

```bash
curl -X GET http://localhost:3000/api/competition/disciplines
```

**Expected Response:**

```json
{
  "success": true,
  "data": {
    "disciplines": ["Racing", "Dressage", "Show Jumping", "Gaited", ...],
    "disciplineDetails": [...],
    "total": 24
  }
}
```

#### **2. GET /api/competition/eligibility/:horseId/:discipline**

**Purpose:** Check horse eligibility for a specific discipline

```bash
curl -X GET http://localhost:3000/api/competition/eligibility/1/Racing \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected Response:**

```json
{
  "success": true,
  "data": {
    "horseId": 1,
    "horseName": "Test Horse",
    "discipline": "Racing",
    "eligibility": {
      "horseLevel": 3,
      "ageEligible": true,
      "traitEligible": true,
      "disciplineStats": ["speed", "stamina", "focus"],
      "currentAge": 5,
      "healthStatus": "Good",
      "disciplineScore": 100
    }
  }
}
```

#### **3. POST /api/competition/enter**

**Purpose:** Enter a horse in a competition

```bash
curl -X POST http://localhost:3000/api/competition/enter \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "horseId": 1,
    "showId": 1
  }'
```

**Expected Response:**

```json
{
  "success": true,
  "message": "Horse successfully entered in competition",
  "data": {
    "entryId": 123,
    "horseId": 1,
    "showId": 1,
    "entryFee": 100,
    "eligibilityDetails": {
      "horseLevel": 3,
      "disciplineScore": 100
    }
  }
}
```

#### **4. POST /api/competition/execute**

**Purpose:** Execute a competition (host only)

```bash
curl -X POST http://localhost:3000/api/competition/execute \
  -H "Authorization: Bearer HOST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "showId": 1
  }'
```

**Expected Response:**

```json
{
  "success": true,
  "message": "Competition executed successfully",
  "data": {
    "showId": 1,
    "showName": "Test Racing Show",
    "discipline": "Racing",
    "totalEntries": 5,
    "results": [
      {
        "horseId": 1,
        "horseName": "Test Horse",
        "userId": "user123",
        "userName": "testuser",
        "placement": 1,
        "prizeWon": 500,
        "xpGained": 20,
        "statGain": {
          "stat": "speed",
          "amount": 1
        }
      }
    ],
    "statGains": [...],
    "totalPrizeDistributed": 1000,
    "totalXPAwarded": 50
  }
}
```

#### **5. GET /api/leaderboard/competition**

**Purpose:** Get competition leaderboards with filtering

```bash
# Get wins leaderboard
curl -X GET "http://localhost:3000/api/leaderboard/competition?metric=wins&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get earnings leaderboard for Racing
curl -X GET "http://localhost:3000/api/leaderboard/competition?metric=earnings&discipline=Racing" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get placements leaderboard for last month
curl -X GET "http://localhost:3000/api/leaderboard/competition?metric=placements&period=month" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected Response:**

```json
{
  "success": true,
  "data": {
    "leaderboard": [
      {
        "rank": 1,
        "horseId": 1,
        "horseName": "Champion Horse",
        "userId": "user123",
        "userName": "champion_user",
        "wins": 5,
        "metric": "wins",
        "value": 5
      }
    ],
    "filters": {
      "discipline": null,
      "period": "all",
      "metric": "wins"
    },
    "pagination": {
      "total": 25,
      "limit": 10,
      "offset": 0,
      "hasMore": true
    }
  }
}
```

### **Error Cases to Test**

#### **1. Invalid Authentication**

```bash
curl -X GET http://localhost:3000/api/competition/eligibility/1/Racing
# Expected: 401 Unauthorized
```

#### **2. Invalid Horse Ownership**

```bash
curl -X GET http://localhost:3000/api/competition/eligibility/999/Racing \
  -H "Authorization: Bearer YOUR_TOKEN"
# Expected: 403 Forbidden or 404 Not Found
```

#### **3. Invalid Discipline**

```bash
curl -X GET http://localhost:3000/api/competition/eligibility/1/InvalidDiscipline \
  -H "Authorization: Bearer YOUR_TOKEN"
# Expected: 400 Bad Request with available disciplines
```

#### **4. Duplicate Entry**

```bash
# Enter horse twice in same show
curl -X POST http://localhost:3000/api/competition/enter \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"horseId": 1, "showId": 1}'
# Expected: 400 Bad Request - "Horse is already entered in this competition"
```

#### **5. Non-host Execution**

```bash
curl -X POST http://localhost:3000/api/competition/execute \
  -H "Authorization: Bearer NON_HOST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"showId": 1}'
# Expected: 403 Forbidden - "Only the show host can execute this competition"
```

### **Validation Tests**

#### **1. Invalid Input Validation**

```bash
curl -X POST http://localhost:3000/api/competition/enter \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"horseId": "invalid", "showId": 1}'
# Expected: 400 Bad Request with validation errors
```

#### **2. Missing Required Fields**

```bash
curl -X POST http://localhost:3000/api/competition/enter \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"horseId": 1}'
# Expected: 400 Bad Request - missing showId
```

### **Success Criteria**

✅ All endpoints return proper HTTP status codes
✅ Authentication and authorization work correctly
✅ Validation errors are properly handled and returned
✅ Competition business logic is properly integrated
✅ Hidden scoring is implemented (no raw scores in responses)
✅ Leaderboard filtering works correctly
✅ Error messages are clear and helpful
✅ All endpoints are properly documented with Swagger

### **Notes**

- Replace `YOUR_TOKEN` with actual JWT token from authentication
- Replace `HOST_TOKEN` with token from show host user
- Replace horse/show IDs with actual database IDs
- Ensure test data exists before running tests
- Check database state after operations to verify data persistence

## 🎯 **TESTING COMPLETE**

If all tests pass, the Competition API endpoints are ready for production use!
