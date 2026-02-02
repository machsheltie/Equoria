# PRD-05: Deployment & Operations Guide

**Version:** 1.0.0
**Last Updated:** 2025-12-01
**Status:** Reference Documentation
**Source Integration:** Consolidated from docs/history/claude-planning/DEPLOYMENT*.md

---

## Overview

This document provides comprehensive deployment and operations guidance for the Equoria platform. It covers environment configuration, deployment strategies, monitoring, security hardening, and troubleshooting procedures.

---

## 1. Pre-Deployment Checklist

### 1.1 Environment Configuration

- [ ] Set `NODE_ENV=production`
- [ ] Generate secure `JWT_SECRET` (64+ characters)
- [ ] Generate secure `JWT_REFRESH_SECRET` (64+ characters)
- [ ] Configure production database URL
- [ ] Set up CORS allowed origins
- [ ] Configure logging level
- [ ] Set up SSL certificates

### 1.2 Security Checklist

- [ ] JWT secrets are cryptographically secure
- [ ] Database credentials are secure
- [ ] CORS origins are properly configured
- [ ] Rate limiting is enabled
- [ ] Security headers are configured (Helmet)
- [ ] Input validation is in place
- [ ] No sensitive data in logs

### 1.3 Database Setup

- [ ] Production database is created
- [ ] Database migrations are applied
- [ ] Database user has minimal required permissions
- [ ] Database backups are configured
- [ ] Connection pooling is configured
- [ ] Indexes are optimized

---

## 2. Environment Variables

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

## 3. Docker Deployment

### 3.1 Dockerfile

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy application code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Change ownership
RUN chown -R nodejs:nodejs /app
USER nodejs

EXPOSE 3000

CMD ["npm", "start"]
```

### 3.2 Docker Compose

```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgres://user:pass@db:5432/equoria
      - JWT_SECRET=${JWT_SECRET}
      - JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
    depends_on:
      - db
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    restart: unless-stopped

  db:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=equoria
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

volumes:
  postgres_data:
```

---

## 4. Cloud Deployment Options

### 4.1 Heroku

```bash
# Install Heroku CLI
npm install -g heroku

# Login and create app
heroku login
heroku create your-app-name

# Set environment variables
heroku config:set NODE_ENV=production
heroku config:set JWT_SECRET="your-secret"
heroku config:set JWT_REFRESH_SECRET="your-refresh-secret"
heroku config:set DATABASE_URL="your-db-url"

# Deploy
git push heroku main

# Run migrations
heroku run npx prisma migrate deploy
```

### 4.2 Railway

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway init
railway up

# Set environment variables via Railway dashboard
```

### 4.3 DigitalOcean App Platform

```yaml
name: equoria-api
services:
- name: api
  source_dir: /backend
  github:
    repo: your-username/equoria
    branch: main
  run_command: npm start
  environment_slug: node-js
  instance_count: 1
  instance_size_slug: basic-xxs
  envs:
  - key: NODE_ENV
    value: production
  - key: JWT_SECRET
    value: your-secret
    type: SECRET
  - key: DATABASE_URL
    value: your-db-url
    type: SECRET
```

### 4.4 AWS Elastic Beanstalk

```yaml
# .elasticbeanstalk/config.yml
branch-defaults:
  main:
    environment: equoria-production

deploy:
  artifact: deploy.zip

environment-defaults:
  equoria-production:
    branch: null
    repository: null

global:
  application_name: equoria
  default_ec2_keyname: your-key
  default_platform: Node.js 18
  default_region: us-east-1
```

---

## 5. Deployment Strategies

### 5.1 Blue-Green Deployment

**Recommended for production releases**

```bash
# Phase 1: Deploy to green environment
docker build -t equoria-backend:v1.1.0 .
docker run -d \
  --name equoria-prod-green \
  -p 3001:3000 \
  -e NODE_ENV=production \
  equoria-backend:v1.1.0

# Phase 2: Run health checks
curl -f http://localhost:3001/health

# Phase 3: Switch traffic from blue to green
# (Update load balancer configuration)

# Phase 4: Keep blue as rollback option
docker stop equoria-prod-blue
```

### 5.2 Rolling Deployment

**For non-breaking changes**

```bash
# Scale up new version
kubectl set image deployment/equoria api=equoria:v1.1.0

# Monitor rollout
kubectl rollout status deployment/equoria

# Rollback if needed
kubectl rollout undo deployment/equoria
```

### 5.3 Staging Verification

```bash
# Pre-deployment verification
node verify-naming-fixes.mjs
node test-server-startup.mjs

# Run full test suite
npm run test-backend

# Lint check
npm run lint-backend

# Docker build and test
docker build -t equoria-backend:staging .
docker run -d \
  --name equoria-staging \
  -p 3001:3000 \
  -e NODE_ENV=staging \
  equoria-backend:staging

# Test endpoints
curl http://localhost:3001/api/users
curl http://localhost:3001/api/leaderboards
curl http://localhost:3001/health
```

---

## 6. Process Management

### 6.1 PM2 Configuration

```bash
# Install PM2
npm install -g pm2

# Create ecosystem file
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'equoria-api',
    script: 'server.mjs',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'development'
    },
    env_production: {
      NODE_ENV: 'production'
    },
    max_memory_restart: '1G',
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
}
EOF

# Start application
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
```

### 6.2 Nginx Reverse Proxy

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 90;
    }
}
```

---

## 7. Health Monitoring

### 7.1 Health Check Endpoints

| Endpoint | Purpose | Expected Response |
|----------|---------|-------------------|
| `GET /ping` | Basic ping/pong | 200 OK |
| `GET /health` | Comprehensive health check | 200 with status JSON |

### 7.2 Health Check Script

```bash
#!/bin/bash
# health-check.sh

echo "Running Health Checks..."

# Basic server health
response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health)
if [ $response != "200" ]; then
  echo "Health check failed with status: $response"
  exit 1
fi

# API endpoint verification
curl -f http://localhost:3000/api || exit 1

# Database connectivity (via health endpoint)
health_data=$(curl -s http://localhost:3000/health)
db_status=$(echo $health_data | jq -r '.database')
if [ "$db_status" != "connected" ]; then
  echo "Database health check failed"
  exit 1
fi

echo "All health checks passed!"
```

### 7.3 Key Metrics to Monitor

**API Performance:**
- Response times (p50, p95, p99)
- Request throughput
- Error rates (4xx, 5xx)
- Active connections

**Database Performance:**
- Query execution times
- Connection pool utilization
- Lock contention
- Disk usage

**System Resources:**
- CPU utilization
- Memory usage
- Disk I/O
- Network bandwidth

### 7.4 Alert Thresholds

| Metric | Warning | Critical |
|--------|---------|----------|
| Response time | >1 second | >2 seconds |
| Error rate | >2% | >5% |
| CPU usage | >70% | >90% |
| Memory usage | >70% | >85% |
| Disk usage | >70% | >85% |
| DB connections | >70% pool | >90% pool |

---

## 8. CI/CD Pipeline

### 8.1 GitHub Actions Workflow

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15-alpine
        env:
          POSTGRES_DB: equoria_test
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
        ports:
          - 5432:5432
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm test
      - run: npm run lint

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to production
        run: |
          # Your deployment script here
        env:
          DEPLOY_KEY: ${{ secrets.DEPLOY_KEY }}
```

### 8.2 Quality Gates

**Pre-Deployment:**
- [ ] PR approved and merged
- [ ] All tests passing (468+ tests)
- [ ] Lint checks passing
- [ ] Staging environment tested
- [ ] Rollback plan confirmed
- [ ] Monitoring alerts configured

**During Deployment:**
- [ ] Blue-green deployment executed
- [ ] Health checks pass
- [ ] New endpoints responding
- [ ] Performance metrics normal

**Post-Deployment:**
- [ ] Monitor for 24 hours
- [ ] Check error logs
- [ ] Verify frontend integration
- [ ] Update external documentation

---

## 9. Rollback Procedures

### 9.1 Immediate Rollback

```bash
# Stop new deployment
docker stop equoria-prod-green

# Start previous version
docker start equoria-prod-blue

# Update load balancer to point to blue

# Verify rollback
curl -f http://localhost:3000/health
```

### 9.2 Database Rollback

```bash
# Check migration status
npx prisma migrate status

# Rollback to specific migration
npx prisma migrate resolve --rolled-back "migration_name"

# Reset to last known good state (DANGER: Data loss)
# Only use in emergency with backups
npx prisma migrate reset
```

### 9.3 Emergency Contacts

| Role | Contact Method |
|------|----------------|
| Development Team Lead | Primary on-call |
| DevOps Engineer | Secondary on-call |
| Technical Director | Escalation |
| Slack Channel | #equoria-deployments |

---

## 10. Performance Optimization

### 10.1 Database Optimization

```sql
-- Add indexes for common queries
CREATE INDEX idx_horses_owner ON horses(owner_id);
CREATE INDEX idx_horses_breed ON horses(breed_id);
CREATE INDEX idx_horses_training ON horses(training_cooldown_end);
CREATE INDEX idx_results_horse ON competition_results(horse_id);
CREATE INDEX idx_results_show ON competition_results(show_id);
```

### 10.2 Application Optimization

- Enable gzip compression
- Set up CDN for static assets
- Configure caching headers
- Use connection pooling
- Optimize database queries

### 10.3 Connection Pool Configuration

```javascript
// Prisma connection pool
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  connectionLimit = 10
  poolTimeout = 20
}
```

---

## 11. Security Hardening

### 11.1 SSL/TLS Configuration

- TLS 1.2+ required
- Strong cipher suites only
- HSTS headers enabled
- Certificate auto-renewal

### 11.2 Security Headers (Helmet)

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

### 11.3 Rate Limiting

```javascript
const rateLimit = require('express-rate-limit');

// General API limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: 'Too many requests, please try again later'
});

// Auth limiter
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many login attempts'
});

app.use('/api/', apiLimiter);
app.use('/api/auth/', authLimiter);
```

---

## 12. Troubleshooting

### 12.1 Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Database connection errors | Invalid DATABASE_URL | Check URL format and network |
| JWT errors | Missing/invalid secret | Verify JWT_SECRET is set |
| CORS errors | Origin not whitelisted | Check ALLOWED_ORIGINS |
| Memory issues | Memory leaks | Monitor heap, scale horizontally |
| Slow responses | Query optimization needed | Add indexes, optimize queries |

### 12.2 Debugging Commands

```bash
# View application logs
pm2 logs equoria-api

# Monitor performance
pm2 monit

# Check health status
curl http://localhost:3000/health

# Database connection test
npx prisma db execute --stdin < test-query.sql

# Check process status
pm2 status
```

### 12.3 Log Analysis

```bash
# View error logs
tail -f ./logs/err.log

# Search for specific errors
grep -i "error" ./logs/combined.log | tail -100

# Count error types
grep -i "error" ./logs/combined.log | sort | uniq -c | sort -rn
```

---

## Cross-References

- **Previous:** [PRD-04-Advanced-Systems.md](./PRD-04-Advanced-Systems.md)
- **API Contracts:** [api-contracts-backend.md](../api-contracts-backend.md)
- **Development Guide:** [development-guide.md](../development-guide.md)
- **Architecture:** [architecture-backend.md](../architecture-backend.md)
- **Historical Source:** `docs/history/claude-planning/DEPLOYMENT*.md`

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-12-01 | Initial creation from historical docs consolidation |
