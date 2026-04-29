import { describe, it, expect, jest, beforeAll, beforeEach, afterEach } from '@jest/globals';

const originalEnv = { ...process.env };
const logs = [];
let exitSpy;
let validateEnvironment;

// ESM mocking pattern: jest.unstable_mockModule must run BEFORE the dynamic
// import of the SUT. With "type":"module" in package.json and transform:{}
// in jest config, mock paths are resolved relative to __tests__/setup.mjs
// (the setupFilesAfterEnv file) rather than this test file's directory.
// Hence the mock path uses ../utils/... (relative to __tests__/) not the
// ../../../utils/... that would be relative to this file's deeper location.
// The dynamic import below uses the test-file-relative path, which DOES
// resolve normally. 21R-SEC-3-A.
jest.unstable_mockModule('../utils/logger.mjs', () => ({
  default: {
    warn: (...args) => logs.push(['warn', ...args]),
    error: (...args) => logs.push(['error', ...args]),
    info: (...args) => logs.push(['info', ...args]),
  },
}));

beforeAll(async () => {
  ({ validateEnvironment } = await import('../../../utils/validateEnvironment.mjs'));
});

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
