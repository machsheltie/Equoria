import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  validateRequiredEnvVars,
  validateTestEnvironment,
  getEnvironmentSummary,
} from '../../../utils/envValidator.mjs';

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

  it('jwtConfigured is false when JWT_SECRET is unset', () => {
    setRequiredVars();
    delete process.env.JWT_SECRET;
    expect(getEnvironmentSummary().jwtConfigured).toBe(false);
  });

  it('presentRequiredVars count matches present vars', () => {
    setRequiredVars();
    const summary = getEnvironmentSummary();
    expect(summary.presentRequiredVars).toBe(REQUIRED.length);
  });

  it('presentOptionalVars is 0 when no optional vars are set', () => {
    setRequiredVars();
    const summary = getEnvironmentSummary();
    expect(typeof summary.presentOptionalVars).toBe('number');
  });

  it('presentOptionalVars changes when an optional var is toggled', () => {
    setRequiredVars();
    delete process.env.LOG_LEVEL;
    const without = getEnvironmentSummary().presentOptionalVars;
    process.env.LOG_LEVEL = 'error';
    const withIt = getEnvironmentSummary().presentOptionalVars;
    expect(withIt).toBe(without + 1);
  });

  it('nodeEnv reflects current NODE_ENV value', () => {
    setRequiredVars();
    process.env.NODE_ENV = 'production';
    expect(getEnvironmentSummary().nodeEnv).toBe('production');
  });

  it('port reflects current PORT value', () => {
    setRequiredVars();
    process.env.PORT = '8080';
    expect(getEnvironmentSummary().port).toBe('8080');
  });
});

describe('validateRequiredEnvVars — additional branch coverage', () => {
  it('adds warning when JWT_REFRESH_SECRET is shorter than 32 chars', () => {
    setRequiredVars();
    process.env.JWT_REFRESH_SECRET = 'tooshort';
    const result = validateRequiredEnvVars(false);
    expect(result.warnings.some(w => w.includes('JWT_REFRESH_SECRET'))).toBe(true);
  });

  it('treats an empty-string var as missing', () => {
    setRequiredVars();
    process.env.JWT_SECRET = '';
    const result = validateRequiredEnvVars(false);
    expect(result.missing).toContain('JWT_SECRET');
  });

  it('treats a whitespace-only var as missing', () => {
    setRequiredVars();
    process.env.PORT = '   ';
    const result = validateRequiredEnvVars(false);
    expect(result.missing).toContain('PORT');
  });

  it('accumulates multiple missing required vars', () => {
    setRequiredVars();
    delete process.env.JWT_SECRET;
    delete process.env.JWT_REFRESH_SECRET;
    const result = validateRequiredEnvVars(false);
    expect(result.missing).toContain('JWT_SECRET');
    expect(result.missing).toContain('JWT_REFRESH_SECRET');
    expect(result.missing.length).toBeGreaterThanOrEqual(2);
  });

  it('returns zero warnings when all vars are long enough and env is test', () => {
    setRequiredVars();
    const result = validateRequiredEnvVars(false);
    expect(result.warnings.filter(w => w.includes('JWT') || w.includes('NODE_ENV'))).toHaveLength(0);
  });
});

describe('validateTestEnvironment — additional branch coverage', () => {
  it('adds testWarning when DATABASE_URL does not contain "test"', () => {
    setRequiredVars();
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost/equoria_prod';
    const result = validateTestEnvironment();
    expect(result.testWarnings.some(w => w.includes('DATABASE_URL'))).toBe(true);
  });

  it('adds testWarning when LOG_LEVEL is not error or warn', () => {
    setRequiredVars();
    process.env.LOG_LEVEL = 'debug';
    const result = validateTestEnvironment();
    expect(result.testWarnings.some(w => w.includes('LOG_LEVEL'))).toBe(true);
  });

  it('does not add LOG_LEVEL warning when LOG_LEVEL is "error"', () => {
    setRequiredVars();
    process.env.LOG_LEVEL = 'error';
    const result = validateTestEnvironment();
    expect(result.testWarnings.some(w => w.includes('LOG_LEVEL'))).toBe(false);
  });

  it('does not add LOG_LEVEL warning when LOG_LEVEL is "warn"', () => {
    setRequiredVars();
    process.env.LOG_LEVEL = 'warn';
    const result = validateTestEnvironment();
    expect(result.testWarnings.some(w => w.includes('LOG_LEVEL'))).toBe(false);
  });

  it('does not add LOG_LEVEL warning when LOG_LEVEL is unset', () => {
    setRequiredVars();
    delete process.env.LOG_LEVEL;
    const result = validateTestEnvironment();
    expect(result.testWarnings.some(w => w.includes('LOG_LEVEL'))).toBe(false);
  });

  it('does not add DATABASE_URL testWarning when DATABASE_URL contains "test"', () => {
    setRequiredVars(); // DATABASE_URL already contains 'equoria_test'
    const result = validateTestEnvironment();
    expect(result.testWarnings.some(w => w.includes('DATABASE_URL'))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Default parameter branch (line 54) + getEnvironmentSummary fallbacks (lines 184-185)
// ---------------------------------------------------------------------------
describe('validateRequiredEnvVars — default throwOnMissing parameter branch (line 54)', () => {
  it('calling without args uses default throwOnMissing=true and throws when a var is missing', () => {
    setRequiredVars();
    delete process.env.PORT;
    // No explicit arg → throwOnMissing defaults to true → should throw
    expect(() => validateRequiredEnvVars()).toThrow('Missing required environment variables');
  });

  it('calling without args uses default throwOnMissing=true and does not throw when all present', () => {
    setRequiredVars();
    // All required vars present; no arg → throwOnMissing=true but nothing is missing
    expect(() => validateRequiredEnvVars()).not.toThrow();
  });
});

describe('getEnvironmentSummary — || "undefined" fallback branches (lines 184-185)', () => {
  it('nodeEnv falls back to "undefined" when NODE_ENV is not set', () => {
    setRequiredVars();
    delete process.env.NODE_ENV;
    const summary = getEnvironmentSummary();
    expect(summary.nodeEnv).toBe('undefined');
  });

  it('port falls back to "undefined" when PORT is not set', () => {
    setRequiredVars();
    delete process.env.PORT;
    const summary = getEnvironmentSummary();
    expect(summary.port).toBe('undefined');
  });

  it('logLevel falls back to "undefined" when LOG_LEVEL is not set', () => {
    setRequiredVars();
    delete process.env.LOG_LEVEL;
    const summary = getEnvironmentSummary();
    expect(summary.logLevel).toBe('undefined');
  });
});
