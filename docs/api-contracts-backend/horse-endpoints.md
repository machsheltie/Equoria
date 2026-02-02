# Horse Endpoints

**Base Path:** `/api/horses` or `/api/v1/horses`

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/horses` | List user's horses | Yes |
| GET | `/horses/:id` | Get horse details | Yes |
| POST | `/horses` | Create horse | Yes |
| PUT | `/horses/:id` | Update horse | Yes |
| DELETE | `/horses/:id` | Delete horse | Yes |
| GET | `/horses/:id/training-history` | Training log retrieval | Yes |
| GET | `/horses/:id/competition-history` | Competition results | Yes |
| GET | `/horses/:id/xp` | Get horse XP status | Yes |
| POST | `/horses/:id/allocate-stat` | Allocate stat points | Yes |
| GET | `/horses/:id/xp-history` | Paginated horse XP history | Yes |
| GET | `/horses/:id/conformation` | Get conformation breakdown | Yes |

### Create Horse Request
```json
{
  "name": "Thunderbolt",
  "age": 3,
  "breedId": 1,
  "ownerId": "uuid",
  "stableId": 1
}
```

### Horse XP System
```javascript
// XP to Stat Conversion: 100 Horse XP = 1 allocable stat point
baseXP = 20
placementBonus = placement === 1 ? 10 : placement === 2 ? 7 : placement === 3 ? 5 : 0
totalHorseXP = baseXP + placementBonus
availableStatPoints = Math.floor(horse.totalXP / 100)
```

---
