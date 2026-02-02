# User Endpoints

**Base Path:** `/api/users` or `/api/v1/users`

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/users` | List users | Yes |
| GET | `/users/:id` | Get user by ID | Yes |
| PUT | `/users/:id` | Update user | Yes |
| DELETE | `/users/:id` | Delete user | Yes |
| GET | `/users/:id/horses` | Get user with all horses | Yes |
| GET | `/users/:id/progress` | Get user level/XP progress | Yes |
| GET | `/users/dashboard` | Comprehensive user dashboard | Yes |
| POST | `/users/:id/award-xp` | Award XP for activities | Yes |
| GET | `/users/:id/xp-history` | Get XP history log | Yes |

### User Progression
```javascript
// Level Formula
Current Level = Math.floor(totalXP / 100) + 1
XP for Next Level = (currentLevel * 100)
Progress % = ((totalXP % 100) / 100) * 100
```

---
