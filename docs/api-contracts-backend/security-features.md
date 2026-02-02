# Security Features

### Authentication & Authorization
- JWT access tokens (short-lived, 15 min)
- Refresh token rotation (7 days)
- Role-based access control (user, admin, moderator)
- Session management with secure tokens
- Account status validation (active/disabled)

### Input Protection
- Password hashing (bcrypt, 10+ rounds)
- Input validation (express-validator)
- SQL injection prevention (Prisma ORM)
- XSS prevention (escape output)
- Request sanitization

### Infrastructure Security
- Rate limiting per IP/user
- CORS configuration
- Helmet security headers
- HTTPS enforcement (production)
- Audit logging for security events

---
