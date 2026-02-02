# Authentication Endpoints

**Base Path:** `/api/auth` or `/api/v1/auth`

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/auth/register` | Register new user | No |
| POST | `/auth/login` | Login user | No |
| POST | `/auth/refresh` | Refresh access token | No |
| POST | `/auth/logout` | Logout user | Yes |
| GET | `/auth/profile` | Get user profile | Yes |
| PUT | `/auth/profile` | Update user profile | Yes |
| GET | `/auth/verify-email` | Verify email address | No |
| POST | `/auth/resend-verification` | Resend verification email | Yes |
| GET | `/auth/verification-status` | Get verification status | Yes |

### Register Request
```json
{
  "email": "user@example.com",
  "username": "johndoe",
  "password": "securePassword123",
  "firstName": "John",
  "lastName": "Doe"
}
```

### Login Response
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": { "id": "uuid", "email": "...", "username": "..." },
    "accessToken": "eyJ...",
    "refreshToken": "eyJ..."
  }
}
```

### Security Features
- **bcrypt password hashing** with 10+ salt rounds
- **JWT access tokens** (15-minute expiry)
- **Refresh tokens** (7-day expiry with rotation)
- **Rate limiting:** 5 attempts per 15 minutes
- **Role-based claims** (user, admin, moderator)

---
