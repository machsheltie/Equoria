# 5. Deployment Strategies

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
