const parseNumber = (value) => {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

export const getPoolConfig = (env = process.env) => {
  const isTestEnv = env.NODE_ENV === 'test' || env.JEST_WORKER_ID !== undefined;

  const defaults = {
    // Railway PgBouncer Session mode has a limited pool_size (typically ≤10 on Hobby tier).
    // Keep production connections small; override with DB_POOL_SIZE env var if needed.
    //
    // Test mode (Equoria-6s3fl): 3 per worker — the SAME size as production.
    // The previous value of 1 was chosen to keep chained/overlapping Jest runs
    // under a believed "~25 max_connections" ceiling. That ceiling was a stale
    // Railway-era assumption that does NOT hold: the canonical test DB is local
    // (postgresql://…@localhost:5432/equoria, max_connections=100), and CI runs
    // each shard against its OWN isolated postgres:15 service (also
    // max_connections=100, never shared across shards). Worst realistic load —
    // 6 workers (50% of 12 cores) × 3 overlapping runs × 1 conn = 18 — was
    // already an order of magnitude under 100, so 1-per-worker bought no
    // headroom; it only STARVED the pool. A connection_limit of 1 cannot serve
    // a single request that needs two connections at once (e.g.
    // Promise.all([findUnique, findUnique]) or an interactive $transaction with
    // a concurrent read): the second acquire waits out pool_timeout (30 s) and
    // throws Prisma P2024 "Timed out fetching a new connection" — the transient
    // flake class tracked in Equoria-6s3fl (clubController.transferLeadership et
    // al). Matching production's 3 removes that self-contention while staying
    // far under the real 100 ceiling (6 workers × 3 = 18; even 3 overlapping
    // runs = 54). Override with TEST_DB_POOL_SIZE for a capacity-constrained
    // environment.
    connection_limit: 3,
    pool_timeout: 30,
    connect_timeout: 30,
  };

  if (isTestEnv) {
    return {
      connection_limit: parseNumber(env.TEST_DB_POOL_SIZE) || defaults.connection_limit,
      pool_timeout: parseNumber(env.TEST_DB_POOL_TIMEOUT) || defaults.pool_timeout,
      connect_timeout: parseNumber(env.TEST_DB_CONNECT_TIMEOUT) || defaults.connect_timeout,
    };
  }

  const poolSize = parseNumber(env.DB_POOL_SIZE);
  const poolTimeout = parseNumber(env.DB_POOL_TIMEOUT);
  const connectTimeout = parseNumber(env.DB_CONNECT_TIMEOUT);

  const hasOverrides = poolSize || poolTimeout || connectTimeout;

  if (env.NODE_ENV === 'production') {
    return {
      connection_limit: poolSize || defaults.connection_limit,
      pool_timeout: poolTimeout || defaults.pool_timeout,
      connect_timeout: connectTimeout || defaults.connect_timeout,
    };
  }

  if (!hasOverrides) {
    return null;
  }

  return {
    connection_limit: poolSize,
    pool_timeout: poolTimeout,
    connect_timeout: connectTimeout,
  };
};

export const buildDatabaseUrl = (baseUrl, env = process.env) => {
  if (!baseUrl) {
    return baseUrl;
  }

  const poolConfig = getPoolConfig(env);
  if (!poolConfig) {
    return baseUrl;
  }

  const url = new URL(baseUrl);
  Object.entries(poolConfig).forEach(([key, value]) => {
    if (!value) return;
    if (!url.searchParams.has(key)) {
      url.searchParams.set(key, String(value));
    }
  });

  // Supabase Transaction mode pooler uses port 6543.
  // Prisma requires pgbouncer=true in Transaction mode to disable prepared statements.
  const isSupabaseTransactionMode =
    url.hostname.includes('pooler.supabase.com') && url.port === '6543';
  if (isSupabaseTransactionMode && !url.searchParams.has('pgbouncer')) {
    url.searchParams.set('pgbouncer', 'true');
  }

  return url.toString();
};

export default {
  getPoolConfig,
  buildDatabaseUrl,
};
