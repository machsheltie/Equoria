# Equoria Gradual Rollout Strategy

**Version:** 1.0.0
**Last Updated:** 2025-12-03
**Status:** Active

---

## Executive Summary

This document outlines Equoria's strategy for gradual feature rollout, ensuring safe deployments with rollback capabilities, backward compatibility, and controlled feature exposure through feature flags.

---

## Table of Contents

1. [Current State Analysis](#current-state-analysis)
2. [Feature Flags System](#feature-flags-system)
3. [Rollback Strategies](#rollback-strategies)
4. [Backward Compatibility](#backward-compatibility)
5. [Migration Scripts](#migration-scripts)
6. [Implementation Checklist](#implementation-checklist)

---

## Current State Analysis

### Existing Patterns (As of 2025-12-03)

| Pattern | Status | Location |
|---------|--------|----------|
| API Versioning | ✅ Active | `/api/v1/*` + legacy `/api/*` |
| Labs Namespace | ✅ Active | `/api/v1/labs/*` for experiments |
| Feature Toggles | ⚠️ Defined but unused | `ENABLE_*` env vars |
| DB Migrations | ✅ Active | 36 Prisma migrations |
| Rollback Scripts | ✅ Partial | 1 manual rollback script |
| CI/CD Pipeline | ✅ Active | 9-job GitHub Actions |

### Gaps Identified

1. **No Feature Flag Library** - Environment variables exist but aren't consumed
2. **No Centralized Flag Management** - No UI for non-dev flag control
3. **Limited Rollback Automation** - Manual SQL scripts only
4. **No Gradual Percentage Rollout** - All-or-nothing deployments

---

## Feature Flags System

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Feature Flag Service                      │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ Environment │  │   Runtime   │  │  Database-backed    │ │
│  │   Flags     │  │   Flags     │  │  Flags (Optional)   │ │
│  │ (.env)      │  │ (memory)    │  │  (Prisma/Redis)     │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Flag Evaluation                           │
├─────────────────────────────────────────────────────────────┤
│  • User-based targeting (userId, email domain)              │
│  • Percentage rollout (0-100%)                              │
│  • Environment-based (dev, staging, prod)                   │
│  • Time-based activation (scheduled features)               │
└─────────────────────────────────────────────────────────────┘
```

### Flag Naming Convention

```
FF_<SCOPE>_<FEATURE_NAME>

Examples:
FF_AUTH_PASSWORDLESS_LOGIN      # Authentication feature
FF_BREEDING_EPIGENETICS         # Breeding system feature
FF_COMPETITION_TEAM_EVENTS      # Competition feature
FF_UI_DARK_MODE                 # Frontend UI feature
```

### Flag Types

| Type | Use Case | Example |
|------|----------|---------|
| `BOOLEAN` | Simple on/off | `FF_AUTH_MFA_ENABLED` |
| `PERCENTAGE` | Gradual rollout | `FF_BREEDING_NEW_UI: 25` (25% of users) |
| `STRING` | A/B variants | `FF_LANDING_PAGE: "variant_b"` |
| `USER_LIST` | Beta testers | `FF_BETA_USERS: "user1,user2"` |

### Implementation Files

```
backend/
├── services/
│   └── featureFlagService.mjs    # Core feature flag logic
├── middleware/
│   └── featureFlagMiddleware.mjs # Request-level flag evaluation
└── utils/
    └── featureFlags.mjs          # Flag definitions and defaults

frontend/
├── lib/
│   └── featureFlags.ts           # Frontend flag hooks
└── contexts/
    └── FeatureFlagContext.tsx    # React context for flags
```

---

## Rollback Strategies

### Tier 1: Feature Flag Rollback (Instant)

**Time to Rollback:** < 1 minute
**Risk Level:** Low

```javascript
// Instant disable via environment variable
FF_NEW_FEATURE_ENABLED=false

// Or via API endpoint (if database-backed)
PUT /api/internal/feature-flags/FF_NEW_FEATURE
{ "enabled": false }
```

### Tier 2: Code Rollback (5-15 minutes)

**Time to Rollback:** 5-15 minutes
**Risk Level:** Medium

```bash
# Revert to previous commit
git revert HEAD
git push origin main

# CI/CD automatically deploys
```

### Tier 3: Database Rollback (15-60 minutes)

**Time to Rollback:** 15-60 minutes
**Risk Level:** High

```sql
-- Use idempotent rollback scripts
-- Example: packages/database/migrations/rollback_*.sql

-- Always include verification
SELECT COUNT(*) FROM affected_table WHERE condition;
```

### Rollback Decision Matrix

| Scenario | Strategy | Owner |
|----------|----------|-------|
| UI bug, no data impact | Tier 1 (Flag) | Any dev |
| API bug, no data impact | Tier 2 (Code) | On-call |
| Data corruption risk | Tier 3 (DB) | DB Admin + Lead |
| Security vulnerability | Tier 2 + Tier 1 | Security team |

---

## Backward Compatibility

### API Compatibility Rules

1. **Never Remove Fields** - Deprecate instead
2. **Never Change Field Types** - Add new field if needed
3. **Always Support Old Endpoints** - Minimum 6-month deprecation
4. **Version Breaking Changes** - `/api/v2/*` for incompatible changes

### Current Dual-Mount Pattern

```javascript
// backend/app.mjs - Active pattern
app.use('/api/v1', apiV1Router);      // Current version
app.use('/api', apiV1Router);          // Legacy support

app.use('/api/v1/labs', labsRouter);  // Experimental
app.use('/api/labs', labsRouter);      // Legacy experimental
```

### Deprecation Process

```javascript
// 1. Mark endpoint as deprecated in code
/** @deprecated Use /api/v1/horses instead. Removal: 2025-06-01 */
app.get('/api/horse/:id', deprecatedHorseHandler);

// 2. Add deprecation header in response
res.set('Deprecation', 'true');
res.set('Sunset', 'Sat, 01 Jun 2025 00:00:00 GMT');

// 3. Log usage for tracking
logger.warn('[DEPRECATED] /api/horse/:id accessed', { userId });

// 4. Remove after sunset date
```

### Database Schema Compatibility

```prisma
// Adding fields - Always nullable or with defaults
model Horse {
  // Existing fields unchanged
  name String

  // New field with default (backward compatible)
  displayName String @default("")

  // New optional field (backward compatible)
  nickname String?
}
```

---

## Migration Scripts

### Prisma Migration Workflow

```bash
# Development
npx prisma migrate dev --name add_feature_flags_table

# Production (safe deployment)
npx prisma migrate deploy
```

### Custom Migration Scripts

Location: `packages/database/migrations/`

```sql
-- Template: YYYYMMDD_description.sql
-- Example: 20251203_add_feature_flag_overrides.sql

-- Up migration
BEGIN;

CREATE TABLE IF NOT EXISTS feature_flag_overrides (
    id SERIAL PRIMARY KEY,
    flag_name VARCHAR(100) NOT NULL UNIQUE,
    enabled BOOLEAN NOT NULL DEFAULT false,
    percentage INTEGER DEFAULT 100,
    user_whitelist TEXT[],
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feature_flag_name
ON feature_flag_overrides(flag_name);

COMMIT;

-- Down migration (in separate file or section)
-- DROP TABLE IF EXISTS feature_flag_overrides;
```

### Migration Verification Script

```javascript
// packages/database/verify_migration.js
async function verifyMigration(migrationName) {
  const checks = {
    'add_feature_flags_table': async () => {
      const result = await prisma.$queryRaw`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_name = 'feature_flag_overrides'
        )
      `;
      return result[0].exists;
    }
  };

  return checks[migrationName]?.() ?? false;
}
```

---

## Implementation Checklist

### Phase 1: Foundation (Week 1)

- [ ] Create `featureFlagService.mjs` with core logic
- [ ] Implement environment variable flag loading
- [ ] Add flag evaluation middleware
- [ ] Create frontend `useFeatureFlag` hook
- [ ] Document initial flags in `.env.example`

### Phase 2: Integration (Week 2)

- [ ] Wrap new features with flag checks
- [ ] Add flag status to API health endpoint
- [ ] Create admin endpoint for flag override (internal)
- [ ] Add flag status logging for debugging

### Phase 3: Advanced Features (Week 3-4)

- [ ] Implement percentage-based rollout
- [ ] Add user-targeting capability
- [ ] Create database-backed flag storage (optional)
- [ ] Build simple admin UI for flag management

### Phase 4: Monitoring (Ongoing)

- [ ] Track flag evaluation counts
- [ ] Alert on flag state changes
- [ ] Document flag lifecycle (creation to removal)
- [ ] Regular flag cleanup reviews

---

## Flag Lifecycle

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ PROPOSED │───▶│  ACTIVE  │───▶│ RAMPING  │───▶│  STABLE  │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
                                                     │
                                                     ▼
                                              ┌──────────┐
                                              │ CLEANUP  │
                                              │ (remove) │
                                              └──────────┘

States:
- PROPOSED: Flag defined, not yet in code
- ACTIVE: In code, default OFF
- RAMPING: Gradually increasing percentage
- STABLE: 100% rolled out, ready for cleanup
- CLEANUP: Flag code being removed
```

---

## Quick Reference

### Check if feature is enabled (Backend)

```javascript
import { isFeatureEnabled } from '../services/featureFlagService.mjs';

if (await isFeatureEnabled('FF_NEW_BREEDING_UI', { userId })) {
  // New feature code
} else {
  // Existing code
}
```

### Check if feature is enabled (Frontend)

```typescript
import { useFeatureFlag } from '@/lib/featureFlags';

function Component() {
  const newUIEnabled = useFeatureFlag('FF_NEW_BREEDING_UI');

  return newUIEnabled ? <NewUI /> : <LegacyUI />;
}
```

### Emergency Flag Disable

```bash
# Via environment (requires restart)
echo "FF_PROBLEMATIC_FEATURE=false" >> .env
pm2 restart equoria-backend

# Via API (if database-backed, instant)
curl -X PUT http://localhost:3000/api/internal/flags/FF_PROBLEMATIC_FEATURE \
  -H "X-Internal-Key: $INTERNAL_API_KEY" \
  -d '{"enabled": false}'
```

---

## Related Documents

- [API Documentation](./api/API-01-Overview.md)
- [CI/CD Pipeline](./.github/workflows/ci-cd.yml)
- [Database Migrations](./packages/database/prisma/migrations/)
- [Backend Architecture](./docs/technical/TECH-01-Backend-Stack.md)

---

**Maintained by:** Engineering Team
**Review Cycle:** Quarterly
**Next Review:** 2026-03-01
