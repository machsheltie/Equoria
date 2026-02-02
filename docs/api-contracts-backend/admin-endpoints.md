# Admin Endpoints

**Base Path:** `/api/admin` or `/api/v1/admin`

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/admin/users` | List all users | Admin |
| GET | `/admin/stats` | Get system stats | Admin |
| PUT | `/admin/users/:id/role` | Role assignment | Admin |
| GET | `/admin/horses/all` | Global horse overview | Admin |
| POST | `/admin/shows/create` | Show creation | Admin |
| GET | `/admin/stats/system` | System statistics | Admin |
| POST | `/admin/maintenance/backup` | Database backup | Admin |

---
