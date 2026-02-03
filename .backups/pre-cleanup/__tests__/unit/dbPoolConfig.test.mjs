import { buildDatabaseUrl } from '../../../packages/database/dbPoolConfig.mjs';

describe('dbPoolConfig', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
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

    expect(url.searchParams.get('connection_limit')).toBe('20');
    expect(url.searchParams.get('pool_timeout')).toBe('30');
    expect(url.searchParams.get('connect_timeout')).toBe('30');
  });
});
