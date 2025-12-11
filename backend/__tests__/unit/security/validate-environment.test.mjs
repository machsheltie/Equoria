import { describe, it, expect, vi, beforeEach, afterEach } from '@jest/globals';
import { validateEnvironment } from '../../utils/validateEnvironment.mjs';

const originalEnv = { ...process.env };
const logs = [];

vi.mock('../../utils/logger.mjs', () => ({
  default: {
    warn: (...args) => logs.push(['warn', ...args]),
    error: (...args) => logs.push(['error', ...args]),
    info: (...args) => logs.push(['info', ...args]),
  },
}));

describe('validateEnvironment', () => {
  beforeEach(() => {
    logs.length = 0;
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('throws when required envs are missing or invalid', () => {
    delete process.env.DATABASE_URL;
    delete process.env.JWT_SECRET;
    process.env.NODE_ENV = 'invalid';
    process.env.PORT = 'abc';

    expect(() => validateEnvironment()).toThrow(/Missing required environment variable/);
  });

  it('warns about weak JWT secrets and HTTP origins in production', () => {
    process.env.DATABASE_URL = 'postgresql://user:password@localhost/db';
    process.env.JWT_SECRET = 'your-super-secret';
    process.env.NODE_ENV = 'production';
    process.env.PORT = '80';
    process.env.ALLOWED_ORIGINS = 'http://example.com';

    expect(() => validateEnvironment()).toThrow(/JWT_SECRET appears to be a placeholder value/);
    const warnMessages = logs.filter(l => l[0] === 'warn').map(l => l.slice(1).join(' ')).join(' ');
    expect(warnMessages).toMatch(/ALLOWED_ORIGINS contains HTTP URLs/);
    expect(warnMessages).toMatch(/PORT is set to 80/);
  });

  it('passes for valid configuration', () => {
    process.env.DATABASE_URL = 'postgresql://user:StrongP@ss@localhost:5432/dbname';
    process.env.JWT_SECRET = 'StrongSecretWithNumbers1234567890ABCDE';
    process.env.NODE_ENV = 'test';
    process.env.PORT = '3000';

    expect(() => validateEnvironment()).not.toThrow();
  });
});
