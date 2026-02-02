# Competition Endpoints

**Base Path:** `/api/competition` or `/api/v1/competition`

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/competitions` | List competitions | Yes |
| GET | `/competitions/:id` | Get competition details | Yes |
| POST | `/competitions/:id/enter` | Enter horse in competition | Yes |
| GET | `/competitions/:id/results` | Get competition results | Yes |
| POST | `/competition/enter-show` | Enter horses in competition | Yes |
| GET | `/competition/show/:showId/results` | Get show results | Yes |
| GET | `/competition/horse/:horseId/results` | Get horse competition history | Yes |
| GET | `/competition/shows/available` | Available competitions listing | Yes |

### Enter Show Request
```json
{
  "showId": 1,
  "horseIds": [1, 2, 3]
}
```

### Competition Eligibility
- Age 3-20 years
- Level restrictions per show
- No duplicate entries
- Health status must be healthy

---
