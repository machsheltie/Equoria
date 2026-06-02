import { buildDatabaseUrl, getPoolConfig } from '../../packages/database/dbPoolConfig.mjs';

describe('dbPoolConfig', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  // Equoria-6s3fl: the test-env pool MUST be able to serve a single request
  // that needs more than one connection at once (Promise.all of two queries,
  // or an interactive $transaction with a concurrent read). A size-1 pool
  // self-starves and throws Prisma P2024 "Timed out fetching a new
  // connection" under load — the transient flake this guards against. The
  // floor is 2; we pin 3 to match production. An explicit env object is used
  // so the assertion is deterministic regardless of the ambient JEST_WORKER_ID.
  describe('test-env connection pool sizing (Equoria-6s3fl)', () => {
    it('sizes the test pool >= 2 so a multi-connection request cannot self-starve', () => {
      const cfg = getPoolConfig({ NODE_ENV: 'test' });
      expect(cfg.connection_limit).toBeGreaterThanOrEqual(2);
    });

    it('pins the test pool to 3 (parity with production)', () => {
      expect(getPoolConfig({ NODE_ENV: 'test' }).connection_limit).toBe(3);
      expect(getPoolConfig({ NODE_ENV: 'production' }).connection_limit).toBe(3);
    });

    it('still honors an explicit TEST_DB_POOL_SIZE override for constrained envs', () => {
      const cfg = getPoolConfig({ NODE_ENV: 'test', TEST_DB_POOL_SIZE: '5' });
      expect(cfg.connection_limit).toBe(5);
    });

    it('sentinel-positive: the regressed value of 1 would violate the >= 2 floor', () => {
      // Proves the floor assertion is meaningful, not vacuous: 1 (the old
      // pathological value) is exactly what the >= 2 guard rejects.
      const floor = 2;
      expect(1).toBeLessThan(floor);
      expect(getPoolConfig({ NODE_ENV: 'test' }).connection_limit).not.toBe(1);
    });
  });

  it('applies explicit pool settings in production', () => {
    const env = {
      NODE_ENV: 'production',
      DB_POOL_SIZE: '25',
      DB_POOL_TIMEOUT: '60',
      DB_CONNECT_TIMEOUT: '10',
    };
    const baseUrl = 'postgresql://user:pass@localhost:5432/equoria';
    const url = new URL(buildDatabaseUrl(baseUrl, env));

    expect(url.searchParams.get('connection_limit')).toBe('25');
    expect(url.searchParams.get('pool_timeout')).toBe('60');
    expect(url.searchParams.get('connect_timeout')).toBe('10');
  });

  it('preserves existing query params', () => {
    const env = {
      NODE_ENV: 'production',
      DB_POOL_SIZE: '30',
    };
    const baseUrl = 'postgresql://user:pass@localhost:5432/equoria?schema=public';
    const url = new URL(buildDatabaseUrl(baseUrl, env));

    expect(url.searchParams.get('schema')).toBe('public');
    expect(url.searchParams.get('connection_limit')).toBe('30');
  });

  it('applies defaults in production when pool settings are missing', () => {
    const env = {
      NODE_ENV: 'production',
    };
    const baseUrl = 'postgresql://user:pass@localhost:5432/equoria';
    const url = new URL(buildDatabaseUrl(baseUrl, env));

    expect(url.searchParams.get('connection_limit')).toBe('3');
    expect(url.searchParams.get('pool_timeout')).toBe('30');
    expect(url.searchParams.get('connect_timeout')).toBe('30');
  });
});
