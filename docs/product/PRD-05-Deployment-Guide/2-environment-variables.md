# 2. Environment Variables

### 2.1 Required Variables

```bash
# Server Configuration
NODE_ENV=production
PORT=3000

# Database Configuration
DATABASE_URL="postgresql://username:password@host:port/database"

# JWT Authentication
JWT_SECRET="your-cryptographically-secure-secret-64-chars-minimum"
JWT_REFRESH_SECRET="your-cryptographically-secure-refresh-secret"

# CORS Configuration
ALLOWED_ORIGINS="https://yourdomain.com,https://www.yourdomain.com"
```

### 2.2 Optional Variables

```bash
# Logging
LOG_LEVEL=info

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Security
BCRYPT_SALT_ROUNDS=12

# Monitoring
MONITORING_ENABLED=true
```

### 2.3 Development vs Production

| Variable | Development | Production |
|----------|-------------|------------|
| NODE_ENV | development | production |
| LOG_LEVEL | debug | info |
| BCRYPT_SALT_ROUNDS | 10 | 12 |
| Rate Limits | Relaxed | Strict |

---
