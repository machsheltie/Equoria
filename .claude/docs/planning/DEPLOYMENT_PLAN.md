# 🚀 Deployment Plan: API Route Naming Consistency Fixes

## **Overview**

This document outlines the deployment strategy for the critical API route naming consistency fixes that resolve route conflicts and standardize endpoint naming.

## **🎯 Deployment Strategy**

### **Phase 1: Staging Deployment**

1. **Pre-deployment Verification**

   ```bash
   # Run verification scripts
   node verify-naming-fixes.mjs
   node test-server-startup.mjs

   # Run full test suite
   npm run test-backend

   # Lint check
   npm run lint-backend
   ```

2. **Docker Build & Deploy**

   ```bash
   # Build Docker image
   docker build -t equoria-backend:naming-fixes .

   # Run container for staging
   docker run -d \
     --name equoria-staging \
     -p 3001:3000 \
     -e NODE_ENV=staging \
     -e DATABASE_URL=$STAGING_DATABASE_URL \
     -e JWT_SECRET=$STAGING_JWT_SECRET \
     -e JWT_REFRESH_SECRET=$STAGING_JWT_REFRESH_SECRET \
     equoria-backend:naming-fixes
   ```

3. **Staging Verification**

   ```bash
   # Test new endpoints
   curl http://localhost:3001/api/users
   curl http://localhost:3001/api/leaderboards
   curl http://localhost:3001/api/milestones/milestone-definitions

   # Verify old endpoints return 404
   curl http://localhost:3001/api/user
   curl http://localhost:3001/api/leaderboard
   ```

### **Phase 2: Production Deployment**

1. **Blue-Green Deployment Strategy**

   - Deploy to green environment
   - Run health checks and API tests
   - Switch traffic from blue to green
   - Keep blue as rollback option

2. **Production Commands**

   ```bash
   # Build production image
   docker build -t equoria-backend:v1.1.0 .

   # Deploy to production
   docker run -d \
     --name equoria-prod-green \
     -p 3000:3000 \
     -e NODE_ENV=production \
     -e DATABASE_URL=$PROD_DATABASE_URL \
     -e JWT_SECRET=$PROD_JWT_SECRET \
     -e JWT_REFRESH_SECRET=$PROD_JWT_REFRESH_SECRET \
     equoria-backend:v1.1.0
   ```

## **🔍 Rollback Plan**

### **Immediate Rollback (if needed)**

```bash
# Stop new deployment
docker stop equoria-prod-green

# Start previous version
docker start equoria-prod-blue

# Update load balancer to point to blue
```

### **Database Rollback**

- No database changes were made, so no schema rollback needed
- Only code-level changes that don't affect data

## **📊 Health Checks**

### **Automated Health Checks**

```bash
#!/bin/bash
# health-check.sh

echo "🏥 Running Health Checks..."

# Basic server health
curl -f http://localhost:3000/health || exit 1

# API endpoint verification
curl -f http://localhost:3000/api || exit 1

# New endpoints working
curl -f http://localhost:3000/api/users || exit 1
curl -f http://localhost:3000/api/leaderboards || exit 1
curl -f http://localhost:3000/api/milestones/milestone-definitions || exit 1

echo "✅ All health checks passed!"
```

### **Performance Monitoring**

- Monitor response times for new endpoints
- Check error rates and 404s
- Monitor database connection pool usage

## **🚨 Monitoring & Alerting**

### **Key Metrics to Monitor**

1. **API Response Times**

   - `/api/users/*` endpoints
   - `/api/leaderboards/*` endpoints
   - `/api/milestones/*` endpoints

2. **Error Rates**

   - 404 errors on old endpoints (expected)
   - 500 errors on new endpoints (investigate)
   - Authentication failures

3. **Database Performance**
   - Query execution times
   - Connection pool utilization
   - Lock contention

### **Alert Thresholds**

- Response time > 2 seconds
- Error rate > 5%
- Database connection failures
- Memory usage > 80%

## **📋 Deployment Checklist**

### **Pre-Deployment**

- [ ] PR approved and merged
- [ ] All tests passing
- [ ] Verification scripts pass
- [ ] Staging environment tested
- [ ] Rollback plan confirmed
- [ ] Monitoring alerts configured

### **During Deployment**

- [ ] Blue-green deployment executed
- [ ] Health checks pass
- [ ] New endpoints responding
- [ ] Old endpoints properly deprecated
- [ ] Performance metrics normal

### **Post-Deployment**

- [ ] Monitor for 24 hours
- [ ] Check error logs
- [ ] Verify frontend integration
- [ ] Update external documentation
- [ ] Notify stakeholders

## **🔧 Environment Configuration**

### **Required Environment Variables**

```bash
# Core Configuration
NODE_ENV=production
PORT=3000

# Database
DATABASE_URL=postgresql://user:pass@host:port/db

# Authentication
JWT_SECRET=your-jwt-secret
JWT_REFRESH_SECRET=your-refresh-secret

# Monitoring (optional)
MONITORING_ENABLED=true
LOG_LEVEL=info
```

### **Docker Compose (Alternative)**

```yaml
version: '3.8'
services:
  equoria-backend:
    build: .
    ports:
      - '3000:3000'
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - JWT_SECRET=${JWT_SECRET}
      - JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:3000/health']
      interval: 30s
      timeout: 10s
      retries: 3
    restart: unless-stopped
```

## **📞 Emergency Contacts**

### **Deployment Team**

- **Primary**: Development Team Lead
- **Secondary**: DevOps Engineer
- **Escalation**: Technical Director

### **Communication Channels**

- **Slack**: #equoria-deployments
- **Email**: dev-team@equoria.com
- **Emergency**: On-call rotation

## **📈 Success Criteria**

### **Deployment Success**

- [ ] All new endpoints responding correctly
- [ ] No increase in error rates
- [ ] Response times within acceptable limits
- [ ] Frontend integration working
- [ ] No critical bugs reported

### **Business Impact**

- [ ] Milestone functionality restored
- [ ] API consistency improved
- [ ] Developer experience enhanced
- [ ] Technical debt reduced

---

**Next Steps**: Execute Phase 1 (Staging) deployment and proceed to Phase 2 (Production) upon successful verification.
