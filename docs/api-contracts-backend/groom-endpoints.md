# Groom Endpoints

**Base Path:** `/api/grooms` or `/api/v1/grooms`

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/grooms` | List grooms | Yes |
| GET | `/grooms/:id` | Get groom details | Yes |
| POST | `/grooms` | Hire groom | Yes |
| PUT | `/grooms/:id` | Update groom | Yes |
| DELETE | `/grooms/:id` | Remove groom | Yes |
| GET | `/grooms/definitions` | System definitions | Yes |
| GET | `/grooms/user/:userId` | Get user's grooms | Yes |

### Groom Assignment
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/groom-assignments` | Assign groom to horse | Yes |
| GET | `/groom-assignments/:foalId` | Get assignments for horse | Yes |
| DELETE | `/groom-assignments/:id` | Remove assignment | Yes |
| POST | `/grooms/assign` | Assign groom to foal | Yes |
| GET | `/grooms/foal/:id` | Get foal's groom assignments | Yes |

### Groom Interaction
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/grooms/interact` | Record groom interaction | Yes |

### Hire Groom Request
```json
{
  "name": "Sarah Johnson",
  "speciality": "foal_care",
  "skill_level": "expert",
  "personality": "gentle",
  "experience": 8,
  "session_rate": 25.0,
  "bio": "Experienced foal care specialist"
}
```

### Groom Interaction Request
```json
{
  "foalId": 1,
  "groomId": 1,
  "taskType": "trust_building",
  "duration": 30,
  "notes": "Foal responded well to gentle handling"
}
```

### Age Gating Rules
| Age Range | Allowed Tasks |
|-----------|---------------|
| 0-2 years | Enrichment only (trust_building, desensitization) |
| 1-3 years | Foal grooming + enrichment |
| 3+ years | All tasks (general grooming, hand-walking, etc.) |

### Groom Career Management
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/grooms/:id/retirement/eligibility` | Check retirement eligibility | Yes |
| POST | `/grooms/:id/retirement/process` | Process retirement | Yes |
| GET | `/grooms/retirement/approaching` | Get approaching retirements | Yes |
| GET | `/grooms/retirement/statistics` | Get retirement statistics | Yes |

### Groom Legacy System
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/grooms/:id/legacy/eligibility` | Check legacy eligibility | Yes |
| POST | `/grooms/:id/legacy/create` | Create protégé | Yes |
| GET | `/grooms/legacy/history` | Get legacy history | Yes |

### Groom Talent Tree
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/grooms/talents/definitions` | Get talent definitions | Yes |
| GET | `/grooms/:id/talents` | Get groom talents | Yes |
| POST | `/grooms/:id/talents/select` | Select talent | Yes |

---
