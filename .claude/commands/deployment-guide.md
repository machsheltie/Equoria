# Deployment Guide

**Skill:** `/deployment-guide`
**Purpose:** Load production deployment procedures and configuration

---

## When to Use This Skill

Invoke this skill when:

- Preparing for production deployment
- Configuring hosting environment
- Setting up CI/CD pipelines
- Troubleshooting deployment issues
- Scaling infrastructure

---

## Quick Deployment Checklist

### Environment Setup

- [ ] Production database configured (PostgreSQL 14+)
- [ ] Environment variables set (.env)
- [ ] JWT secrets changed from defaults
- [ ] CORS origins configured
- [ ] HTTPS enabled

### Database Setup

```bash
cd packages/database
npx prisma migrate deploy
npx prisma generate
```

### Server Deployment

```bash
cd backend
npm install --production
npm start
```

### Security Checklist

- [ ] Change JWT_SECRET and SESSION_SECRET
- [ ] Set BCRYPT_ROUNDS to 12+
- [ ] Configure rate limiting
- [ ] Enable audit logging
- [ ] Set up monitoring (Sentry, CloudWatch)

---

**Load full deployment docs:**

```bash
cat .claude/docs/planning/DEPLOYMENT.md
```
