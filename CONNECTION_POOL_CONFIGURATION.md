# Connection Pool Configuration Reference

## Quick Lookup

### Current Configuration

**File:** `packages/database/prismaClient.mjs`

**Test Environment Settings (Defaults):**
```javascript
CONNECTION_LIMIT: 20   // connections allowed simultaneously
POOL_TIMEOUT: 30       // seconds to wait for available connection
CONNECT_TIMEOUT: 30    // seconds to establish new connection
```

**Production Environment:**
- Uses `DATABASE_URL` with optional pool settings
- Defaults apply if `DB_POOL_*` vars are omitted

---

## Configuration Comparison

| Parameter | OLD (Broken) | NEW (Fixed) | Reason |
|-----------|--------------|------------|--------|
| connection_limit | 1 | 20 | Support Jest parallel test workers |
| pool_timeout | 5s | 30s | Sufficient time for test setup/teardown |
| connect_timeout | 5s | 30s | Accommodates test database startup |

---

## How the Configuration Works

### For Tests (`NODE_ENV=test`)

1. Jest starts multiple worker processes (default: 50% of CPU cores)
2. Each worker creates a Prisma Client instance
3. Each client tries to connect to database
4. Connection requests are queued (max 10 connections)
5. Requests wait up to 20 seconds for available connection
6. If connection not available within 20s, worker times out
7. After test completes, connection is released back to pool

### For Production

- Uses raw `DATABASE_URL` value
- Connection pooling handled by:
  - Heroku Postgres pooling
  - Railway connection pooling
  - Or external pooler (pgBouncer, etc.)
- No modifications by Prisma Client

---

## Constants Definition

**Location:** `packages/database/prismaClient.mjs` (lines 29-39)

```javascript
const CONNECTION_POOL_CONFIG = {
  TEST: {
    CONNECTION_LIMIT: 20,    // Max concurrent connections
    POOL_TIMEOUT: 30,        // Max wait time (seconds)
    CONNECT_TIMEOUT: 30,     // Connection establishment time (seconds)
  },
  PRODUCTION: {
    // Production uses DATABASE_URL with optional DB_POOL_* overrides
  },
};
```

---

## Implementation Location

**File:** `packages/database/prismaClient.mjs`

**Lines 23-54:** Connection pool configuration
**Lines 41-54:** Configuration usage in connectionConfig

```javascript
const connectionConfig = {
  datasources: {
    db: {
      url: buildDatabaseUrl(process.env.DATABASE_URL, process.env),
    },
  },
  // ... rest of configuration
};
```

---

## When to Adjust

### Increase connection_limit if:
- Tests timeout with: "Timed out fetching a new connection from the connection pool"
- You have many Jest workers running
- Database easily handles more connections

**Action:**
```javascript
CONNECTION_LIMIT: 15,  // or 20, depending on your needs
```

### Decrease connection_limit if:
- Error: "too many connections from client"
- Database is near max_connections limit
- Shared database with other services

**Action:**
```javascript
CONNECTION_LIMIT: 5,  // More conservative limit
```

### Increase pool_timeout if:
- Slow CI/CD systems timeout
- Database operations take longer than expected

**Action:**
```javascript
POOL_TIMEOUT: 30,  // Wait longer for connections
```

### Decrease connect_timeout if:
- Very low latency network
- Want to fail faster on connection issues

**Action:**
```javascript
CONNECT_TIMEOUT: 5,  // Fail faster
```

---

## Validation Checklist

After applying configuration:

- [ ] Jest cache cleared: `npx jest --clearCache`
- [ ] Configuration shows in console: `[PrismaClient] Jest cleanup registered`
- [ ] No "connection pool timeout" errors
- [ ] No "too many connections" errors
- [ ] Tests complete without hanging
- [ ] All test suites pass

---

## Diagnostic Commands

```bash
# Check current configuration
grep -n "CONNECTION_LIMIT\|POOL_TIMEOUT\|CONNECT_TIMEOUT" packages/database/prismaClient.mjs

# Clear Jest cache before running tests
npx jest --clearCache

# Run tests with timeout details
npm test -- --testTimeout=30000 --verbose

# Check for connection pool errors
npm test 2>&1 | grep -i "connection\|pool\|timeout"

# Monitor database connections during tests
psql -d equoria_test -c "SELECT count(*) FROM pg_stat_activity;"

# Detect open handles (resource leaks)
npm test -- --detectOpenHandles
```

---

## Related Files

- **Main Configuration:** `packages/database/prismaClient.mjs`
- **Pool Helpers:** `packages/database/dbPoolConfig.mjs`
- **Test Environment:** `backend/.env.test`
- **Production Environment:** `.env` (not in repo)
- **Jest Configuration:** `jest.config.mjs` or `jest.config.js`
- **Full Documentation:** `DATABASE_CONNECTION_POOL_FIX.md`

---

## Support

### Questions?
See `DATABASE_CONNECTION_POOL_FIX.md` for comprehensive documentation.

### Issues?
1. Check diagnostic output: `npm test -- --verbose 2>&1 | grep -i "connection"`
2. Verify configuration: `cat packages/database/prismaClient.mjs | grep -A 15 "CONNECTION_POOL_CONFIG"`
3. Clear cache: `npx jest --clearCache`
4. Run again: `npm test`

---

**Last Updated:** 2025-11-20
**Status:** Active Configuration
**Environment:** Test (10), Production (from DATABASE_URL)
