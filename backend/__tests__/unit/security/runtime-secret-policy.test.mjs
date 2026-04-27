import { describe, it, expect, jest, afterEach } from '@jest/globals';
import { validateJwtSecrets } from '../../../scripts/validate-environment.mjs';

const originalEnv = { ...process.env };
const importFresh = path =>
  import(`${path}?cacheBust=${Date.now()}-${Math.random().toString(16).slice(2)}`);

describe('deployable runtime secret policy', () => {
  afterEach(() => {
    process.env = { ...originalEnv };
    jest.resetModules();
  });

  it('config bootstrap rejects committed test-only JWT secrets in beta', async () => {
    process.env.NODE_ENV = 'beta';
    process.env.DATABASE_URL = 'postgresql://user:StrongPass123!@localhost:5432/equoria';
    process.env.PORT = '3001';
    process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only-32chars';
    process.env.JWT_REFRESH_SECRET = 'StrongRefreshSecret1234567890ABCD';

    await expect(importFresh('../../../config/config.mjs')).rejects.toThrow(
      /committed test-only secret/,
    );
  });

  it('config bootstrap allows test secrets in NODE_ENV=test', async () => {
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = 'postgresql://user:StrongPass123!@localhost:5432/equoria_test';
    process.env.PORT = '3001';
    process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only-32chars';
    process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-for-testing-only-32chars';

    const { default: config } = await importFresh('../../../config/config.mjs');

    expect(config.env).toBe('test');
    expect(config.jwtSecret).toBe('test-jwt-secret-key-for-testing-only-32chars');
  });

  it('script-level validation fails deployable modes that use committed test-only refresh secrets', () => {
    process.env.NODE_ENV = 'beta-readiness';
    process.env.JWT_SECRET = 'StrongSecret1234567890ABCDEFGHIJK';
    process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-for-testing-only-32chars';

    const results = validateJwtSecrets();

    expect(results.valid).toBe(false);
    expect(results.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('JWT_REFRESH_SECRET uses a committed test-only secret'),
      ]),
    );
  });
});
