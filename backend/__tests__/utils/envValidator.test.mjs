import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { validateRequiredEnvVars, validateTestEnvironment, getEnvironmentSummary } from '../../utils/envValidator.mjs';

const REQUIRED = ['NODE_ENV', 'DATABASE_URL', 'JWT_SECRET', 'JWT_REFRESH_SECRET', 'PORT'];

let originalEnv;

beforeEach(() => {
  originalEnv = { ...process.env };
});

afterEach(() => {
  // Restore original env
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) {
      delete process.env[key];
    }
  }
  Object.assign(process.env, originalEnv);
});

function setRequiredVars() {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = 'postgresql://user:pass@localhost/equoria_test';
  process.env.JWT_SECRET = 'a'.repeat(32);
  process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);
  process.env.PORT = '3000';
}

describe('validateRequiredEnvVars', () => {
  it('returns success:true when all required vars are present', () => {
    setRequiredVars();
    const result = validateRequiredEnvVars(false);
    expect(result.success).toBe(true);
    expect(result.missing).toHaveLength(0);
    expect(result.present).toEqual(expect.arrayContaining(REQUIRED));
  });

  it('returns success:false and lists missing when vars are absent', () => {
    setRequiredVars();
    delete process.env.JWT_SECRET;
    const result = validateRequiredEnvVars(false);
    expect(result.success).toBe(false);
    expect(result.missing).toContain('JWT_SECRET');
  });

  it('throws when throwOnMissing=true and a var is missing', () => {
    setRequiredVars();
    delete process.env.PORT;
    expect(() => validateRequiredEnvVars(true)).toThrow('Missing required environment variables');
  });

  it('does not throw when throwOnMissing=false even with missing vars', () => {
    setRequiredVars();
    delete process.env.PORT;
    expect(() => validateRequiredEnvVars(false)).not.toThrow();
  });

  it('adds warning when NODE_ENV is not "test"', () => {
    setRequiredVars();
    process.env.NODE_ENV = 'development';
    const result = validateRequiredEnvVars(false);
    expect(result.warnings.some(w => w.includes("NODE_ENV is 'development'"))).toBe(true);
  });

  it('adds warning when DATABASE_URL does not contain equoria_test', () => {
    setRequiredVars();
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost/equoria';
    const result = validateRequiredEnvVars(false);
    expect(result.warnings.some(w => w.includes('equoria_test'))).toBe(true);
  });

  it('adds warning when JWT_SECRET is shorter than 32 chars', () => {
    setRequiredVars();
    process.env.JWT_SECRET = 'short';
    const result = validateRequiredEnvVars(false);
    expect(result.warnings.some(w => w.includes('JWT_SECRET'))).toBe(true);
  });

  it('includes missingOptional list in result', () => {
    setRequiredVars();
    delete process.env.LOG_LEVEL;
    const result = validateRequiredEnvVars(false);
    expect(Array.isArray(result.missingOptional)).toBe(true);
  });
});

describe('validateTestEnvironment', () => {
  it('returns result with testWarnings array', () => {
    setRequiredVars();
    const result = validateTestEnvironment();
    expect(result).toHaveProperty('testWarnings');
    expect(Array.isArray(result.testWarnings)).toBe(true);
  });

  it('adds testWarning when NODE_ENV is not test', () => {
    setRequiredVars();
    process.env.NODE_ENV = 'development';
    const result = validateTestEnvironment();
    expect(result.testWarnings.some(w => w.includes('NODE_ENV'))).toBe(true);
  });

  it('returns success:true when all required vars are set', () => {
    setRequiredVars();
    const result = validateTestEnvironment();
    expect(result.success).toBe(true);
  });
});

describe('getEnvironmentSummary', () => {
  it('returns expected shape', () => {
    setRequiredVars();
    const summary = getEnvironmentSummary();
    expect(summary).toHaveProperty('nodeEnv');
    expect(summary).toHaveProperty('port');
    expect(summary).toHaveProperty('databaseConfigured');
    expect(summary).toHaveProperty('jwtConfigured');
    expect(summary).toHaveProperty('requiredVarsCount');
    expect(summary).toHaveProperty('optionalVarsCount');
    expect(summary).toHaveProperty('presentRequiredVars');
    expect(summary).toHaveProperty('presentOptionalVars');
  });

  it('databaseConfigured is true when DATABASE_URL is set', () => {
    setRequiredVars();
    expect(getEnvironmentSummary().databaseConfigured).toBe(true);
  });

  it('databaseConfigured is false when DATABASE_URL is unset', () => {
    setRequiredVars();
    delete process.env.DATABASE_URL;
    expect(getEnvironmentSummary().databaseConfigured).toBe(false);
  });

  it('presentRequiredVars count matches present vars', () => {
    setRequiredVars();
    const summary = getEnvironmentSummary();
    expect(summary.presentRequiredVars).toBe(REQUIRED.length);
  });
});
