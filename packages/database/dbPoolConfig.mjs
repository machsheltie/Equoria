const parseNumber = (value) => {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

export const getPoolConfig = (env = process.env) => {
  const isTestEnv = env.NODE_ENV === 'test' || env.JEST_WORKER_ID !== undefined;

  const defaults = {
    connection_limit: 20,
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

  return url.toString();
};

export default {
  getPoolConfig,
  buildDatabaseUrl,
};
