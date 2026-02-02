# Scaling Configuration (Cluster + DB Pool)

## Purpose
Provide safe baseline values for horizontal scaling and database pooling without over-allocating connections.

## Environment Variables
- `CLUSTER_ENABLED`: Enables Node.js clustering when `true`.
- `WEB_CONCURRENCY`: Worker count when clustering is enabled.
- `DB_POOL_SIZE`: Prisma connection limit (`connection_limit`).
- `DB_POOL_TIMEOUT`: Prisma pool wait time in seconds (`pool_timeout`).
- `DB_CONNECT_TIMEOUT`: Prisma connect timeout in seconds (`connect_timeout`).

## Recommended Defaults (Starting Point)
These values are conservative and should work on a single Postgres instance with default `max_connections`.

```
CLUSTER_ENABLED=false
WEB_CONCURRENCY=4
DB_POOL_SIZE=20
DB_POOL_TIMEOUT=30
DB_CONNECT_TIMEOUT=30
```

## How to Size in Production
Use the database max connections as the hard cap. Postgres default is often 100.

Heuristic:

```
DB_POOL_SIZE = floor((DB_MAX_CONNECTIONS - RESERVED) / WEB_CONCURRENCY)
RESERVED = 10 (migrations, admin, monitoring)
```

Example with DB max connections 100 and 4 workers:

```
DB_POOL_SIZE = floor((100 - 10) / 4) = 22
```

If you run multiple app instances, divide by total workers across all instances.

## When to Change
- Increase `WEB_CONCURRENCY` only if CPU is underutilized and DB is not saturated.
- Increase `DB_POOL_SIZE` only after checking `pg_stat_activity` and max connections.
- Increase `DB_POOL_TIMEOUT` if you see pool timeouts under load.

## Notes
- `CLUSTER_ENABLED` is ignored in `NODE_ENV=test`.
- Production defaults are applied if pool env vars are missing.
