import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { validateEnvironment } from '../../../utils/validateEnvironment.mjs';

const originalEnv = { ...process.env };
const logs = [];
let exitSpy;

jest.mock('../../../utils/logger.mjs', () => ({
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
    exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    exitSpy.mockRestore();
  });

  it('throws when required envs are missing or invalid', () => {
    delete process.env.DATABASE_URL;
    delete process.env.JWT_SECRET;
    process.env.NODE_ENV = 'invalid';
    process.env.PORT = 'abc';

    validateEnvironment();
    expect(exitSpy).toHaveBeenCalled();
  });

  it('warns about weak JWT secrets and HTTP origins in production', () => {
    process.env.DATABASE_URL = 'postgresql://user:password@localhost/db';
    process.env.JWT_SECRET = 'your-super-secret';
    process.env.NODE_ENV = 'production';
    process.env.PORT = '80';
    process.env.ALLOWED_ORIGINS = 'http://example.com';

    validateEnvironment();
    expect(exitSpy).toHaveBeenCalled();
  });

  it('passes for valid configuration', () => {
    process.env.DATABASE_URL = 'postgresql://user:StrongP@ss@localhost:5432/dbname';
    process.env.JWT_SECRET = 'StrongSecretWithNumbers1234567890ABCDE';
    process.env.NODE_ENV = 'test';
    process.env.PORT = '3000';

    expect(() => validateEnvironment()).not.toThrow();
  });
});
