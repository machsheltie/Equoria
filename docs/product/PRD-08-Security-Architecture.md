# PRD-08: Security Architecture

**Version:** 1.0.0
**Last Updated:** 2025-12-01
**Status:** Reference Documentation
**Source Integration:** Consolidated from docs/history/claude-rules/SECURITY.md

---

## Overview

This document outlines the comprehensive security architecture for Equoria, designed to prevent common exploits and vulnerabilities that have plagued horse simulation games. Security is implemented at every layer of the application.

---

## 1. Authentication & Authorization

### 1.1 JWT Token Security

| Feature | Implementation |
|---------|----------------|
| **Token Verification** | Cryptographic signature verification |
| **Token Fingerprinting** | Anti-tampering with user fingerprints |
| **Expiration Enforcement** | Multiple layers of expiration checking |
| **Token Types** | Access (15min) + Refresh (7 days) |

#### Token Configuration
```javascript
// Access Token (short-lived)
{
  expiresIn: '15m',
  algorithm: 'HS256'
}

// Refresh Token (longer-lived)
{
  expiresIn: '7d',
  algorithm: 'HS256',
  httpOnly: true,
  secure: true
}
```

### 1.2 Role-Based Access Control

| Role | Permissions |
|------|-------------|
| **User** | Own resources only |
| **Moderator** | User + flagged content review |
| **Admin** | Full system access |

#### Resource Ownership Validation
- Users can only access/modify their own resources
- Ownership verified at service layer
- Database queries scoped by user ID

### 1.3 Password Security

| Setting | Value | Purpose |
|---------|-------|---------|
| **Algorithm** | bcrypt | Adaptive hashing |
| **Salt Rounds** | 12 (production) | Brute-force resistance |
| **Min Length** | 8 characters | Basic security |
| **Complexity** | Required | Mixed characters |

---

## 2. Game Integrity Protection

### 2.1 Protected Fields

The following fields cannot be directly modified by API requests:

```javascript
const protectedStats = [
  'precision', 'strength', 'speed', 'agility', 'endurance',
  'intelligence', 'personality', 'total_earnings', 'level'
];

const protectedFields = [
  'id', 'createdAt', 'updatedAt', 'ownerId', 'userId'
];
```

### 2.2 Stat Manipulation Prevention

| Protection | Implementation |
|------------|----------------|
| **Range Validation** | All stats must be 0-100 |
| **Training Only** | Stats increase only through legitimate training |
| **Audit Logging** | All stat changes logged and monitored |
| **Server-Side Calculation** | No client-side stat computation |

### 2.3 Resource Duplication Prevention

```javascript
// Operation tracking prevents duplicates
{
  windowMs: 5000,        // 5 second window
  fingerprint: 'hash',   // Unique operation signature
  storage: 'memory'      // In-memory deduplication
}
```

### 2.4 Training System Security

| Check | Requirement |
|-------|-------------|
| **Ownership** | Only horse owners can train |
| **Age** | Minimum 3 years old |
| **Health** | Good or Excellent status |
| **Cooldown** | 7-day global cooldown |
| **Discipline** | Valid discipline only |

### 2.5 Breeding System Security

| Check | Requirement |
|-------|-------------|
| **Biological** | Proper sex (mare + stallion) |
| **Age** | 3-21 years for both |
| **Ownership** | Access control verified |
| **Cooldown** | 30 days (mare), 14 days (stallion) |
| **Health** | Not injured |
| **Self-Prevention** | Cannot breed with self |

### 2.6 Financial Transaction Security

| Protection | Implementation |
|------------|----------------|
| **Balance Check** | Real-time verification |
| **Transaction Limits** | Maximum amounts enforced |
| **Self-Transfer Block** | Cannot transfer to self |
| **Audit Logging** | All transactions logged |

---

## 3. Input Validation & Sanitization

### 3.1 Validation Schemas

#### Horse Data Validation
```javascript
const horseSchema = {
  name: { type: 'string', min: 1, max: 50 },
  age: { type: 'number', min: 0, max: 30 },
  sex: { type: 'enum', values: ['male', 'female'] },
  stats: { type: 'object', range: [0, 100] },
  breedId: { type: 'uuid' }
};
```

#### User Data Validation
```javascript
const userSchema = {
  username: { type: 'string', min: 3, max: 20, pattern: /^[a-zA-Z0-9_]+$/ },
  email: { type: 'email' },
  password: { type: 'string', min: 8 }
};
```

### 3.2 XSS Prevention

```javascript
// Input sanitization
function sanitize(input) {
  return input
    .replace(/[<>]/g, '')           // Remove HTML tags
    .replace(/javascript:/gi, '')    // Remove javascript: protocols
    .replace(/on\w+\s*=/gi, '')     // Remove event handlers
    .replace(/data:/gi, '');         // Remove data: protocols
}
```

### 3.3 SQL Injection Prevention

- **Prisma ORM:** All queries are parameterized
- **No Raw Queries:** Raw SQL disabled unless explicitly needed
- **Type Validation:** All parameters type-checked

---

## 4. Rate Limiting & Anti-Automation

### 4.1 Rate Limit Configuration

| Endpoint Type | Requests | Window | Action |
|---------------|----------|--------|--------|
| **Global** | 100 | 15 minutes | Block IP |
| **Authentication** | 5 | 15 minutes | Block IP |
| **Training** | 10 | 1 hour | Block user |
| **Breeding** | 5 | 1 hour | Block user |
| **Financial** | 20 | 15 minutes | Block user |

### 4.2 Suspicious Activity Detection

```javascript
// Patterns detected
const suspiciousPatterns = {
  excessiveFailures: 10,      // Failed requests threshold
  rapidFireRequests: 20,      // Requests in 30 seconds
  multipleIPs: 3,             // IPs per user session
  sensitiveOps: 15,           // Sensitive ops in 5 minutes
  errorThenSuccess: true      // Exploit attempt pattern
};
```

### 4.3 Anti-Automation Measures

- Request fingerprinting
- Behavioral analysis
- Timing pattern detection
- IP reputation checking

---

## 5. Audit Logging & Monitoring

### 5.1 Logged Operations

| Category | Events |
|----------|--------|
| **Authentication** | Login, logout, token refresh, failures |
| **High-Sensitivity** | Breeding, financial transactions, stat changes |
| **User Activity** | Resource creation, modification, deletion |
| **Security Events** | Rate limit violations, suspicious patterns |

### 5.2 Log Format

```javascript
{
  timestamp: 'ISO8601',
  userId: 'uuid',
  action: 'string',
  resource: 'string',
  resourceId: 'uuid',
  ip: 'string',
  userAgent: 'string',
  status: 'success|failure',
  details: 'object',
  sensitiveDataRedacted: true
}
```

### 5.3 Alert Thresholds

| Priority | Triggers |
|----------|----------|
| **High** | Multiple IP addresses, large transactions, stat manipulation attempts |
| **Medium** | Rate limit violations, excessive failures |
| **Low** | Invalid input attempts, 404 errors |

---

## 6. Data Integrity

### 6.1 Hash Verification

```javascript
// Data integrity verification
const dataHash = crypto.createHash('sha256')
  .update(JSON.stringify(data, Object.keys(data).sort()))
  .digest('hex');
```

### 6.2 Timestamp Validation

| Check | Implementation |
|-------|----------------|
| **Server Timestamps** | All operations use server time |
| **Clock Drift** | 5-minute tolerance |
| **Time Manipulation** | Detected and blocked |

---

## 7. Exploit Prevention Summary

### 7.1 Common Exploits Blocked

| Exploit Type | Prevention Method |
|--------------|-------------------|
| **Stat Hacking** | Protected fields, range validation, audit logging |
| **Money Duplication** | Balance verification, transaction limits, deduplication |
| **Resource Duplication** | Operation tracking, request fingerprinting |
| **Training Exploits** | Global cooldowns, ownership validation |
| **Breeding Exploits** | Biological validation, cooldown enforcement |
| **Time Manipulation** | Server timestamps, clock validation |
| **Account Sharing** | IP monitoring, session management |

### 7.2 Security Layers

```
Layer 1: Rate Limiting (IP-based)
         ↓
Layer 2: Authentication (JWT validation)
         ↓
Layer 3: Authorization (Role/ownership check)
         ↓
Layer 4: Input Validation (Schema validation)
         ↓
Layer 5: Business Logic (Game rule enforcement)
         ↓
Layer 6: Database (Prisma parameterized queries)
         ↓
Layer 7: Audit Logging (All operations logged)
```

---

## 8. Security Configuration

### 8.1 Environment Variables

```bash
# Required Security Settings
JWT_SECRET=your-secure-64-char-minimum-secret
JWT_REFRESH_SECRET=your-secure-refresh-secret
BCRYPT_ROUNDS=12
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
ALLOWED_ORIGINS=https://yourdomain.com
```

### 8.2 Production Security Checklist

- [ ] Change default JWT_SECRET (64+ characters)
- [ ] Change default JWT_REFRESH_SECRET
- [ ] Set BCRYPT_ROUNDS to 12+
- [ ] Configure proper CORS origins
- [ ] Enable HTTPS only
- [ ] Set up monitoring and alerting
- [ ] Configure database connection limits
- [ ] Enable audit logging
- [ ] Set up backup and recovery
- [ ] Implement WAF rules

---

## 9. Security Headers (Helmet)

```javascript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  hsts: { maxAge: 31536000, includeSubDomains: true },
}));
```

---

## 10. File Upload Security

| Check | Requirement |
|-------|-------------|
| **Size Limit** | 5MB maximum |
| **Allowed Types** | JPEG, PNG, GIF, WebP only |
| **Name Sanitization** | Remove path traversal |
| **Content Verification** | MIME type validation |
| **Storage** | Isolated from application |

---

## 11. Incident Response

### 11.1 Immediate Actions

1. **Identify** - Determine scope and impact
2. **Contain** - Prevent further damage
3. **Preserve** - Maintain audit logs
4. **Notify** - Internal and external communication
5. **Remediate** - Fix security gaps
6. **Monitor** - Enhanced monitoring

### 11.2 Contact Information

| Role | Contact |
|------|---------|
| **Security Team** | security@equoria.com |
| **Emergency** | On-call rotation |
| **Incident Reporting** | incidents@equoria.com |

---

## 12. Security Testing

### 12.1 Automated Testing

- Unit tests for all validation functions
- Integration tests for security middleware
- Penetration testing for common vulnerabilities
- Load testing for rate limiting effectiveness

### 12.2 Test Coverage Requirements

| Category | Minimum Coverage |
|----------|------------------|
| **Authentication** | 95% |
| **Authorization** | 95% |
| **Input Validation** | 90% |
| **Rate Limiting** | 85% |
| **Audit Logging** | 80% |

---

## Cross-References

- **Deployment Guide:** See [PRD-05-Deployment-Guide.md](./PRD-05-Deployment-Guide.md)
- **API Documentation:** See [api-contracts-backend.md](../api-contracts-backend.md)
- **Testing Strategy:** See [PRD-06-Testing-Strategy.md](./PRD-06-Testing-Strategy.md)
- **Historical Source:** `docs/history/claude-rules/SECURITY.md`

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-12-01 | Initial creation from SECURITY.md |
