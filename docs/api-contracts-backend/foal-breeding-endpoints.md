# Foal & Breeding Endpoints

**Base Path:** `/api/foals` or `/api/v1/foals`

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/breeding/breed` | Create foal from breeding pair | Yes |
| GET | `/foals/:id` | Foal details with genetics | Yes |
| GET | `/foals/:id/development` | Get foal development status | Yes |
| POST | `/foals/:id/activity` | Log foal activity | Yes |
| GET | `/foals/:id/activities` | Get foal activities | Yes |
| POST | `/foals/:id/enrich` | Foal enrichment activities | Yes |
| GET | `/foals/:id/traits` | Trait discovery status | Yes |
| POST | `/foals/:id/reveal-traits` | Manual trait revelation | Yes |
| PUT | `/foals/:id/develop` | Foal development progression | Yes |

### Breeding Request
```json
{
  "sireId": 1,
  "damId": 2,
  "userId": "uuid"
}
```

### Foal Activity Request
```json
{
  "activity": "trust_building",
  "duration": 30
}
```

---
