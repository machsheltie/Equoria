import logger from './logger.mjs';
import { getSecretValidationError } from './runtimeSecretPolicy.mjs';

/**
 * Required environment variables with validation rules
 */
const REQUIRED_ENV_VARS = [
  { name: 'DATABASE_URL', minLength: 20 },
  { name: 'JWT_SECRET', minLength: 32 },
  { name: 'JWT_REFRESH_SECRET', minLength: 32 },
  // Story 21S-3: 'beta' added — production-parity Playwright profile.
  // Master 21R: 'beta-readiness' — full readiness-gate runner profile.
  { name: 'NODE_ENV', values: ['development', 'production', 'test', 'beta', 'beta-readiness'] },
  { name: 'PORT', type: 'number' },
];

/**
 * Pure validation function — no side effects.
 * Returns { errors, warnings } arrays so callers can assert on them directly
 * without intercepting process.exit or logger.
 * @param {object} env - environment object to validate (defaults to process.env)
 * @returns {{ errors: string[], warnings: string[] }}
 */
export function checkEnvironment(env = process.env) {
  const errors = [];
  const warnings = [];

  for (const { name, minLength, values, type } of REQUIRED_ENV_VARS) {
    const value = env[name];

    if (!value) {
      errors.push(`Missing required environment variable: ${name}`);
      continue;
    }

    if (minLength && value.length < minLength) {
      errors.push(`${name} must be at least ${minLength} characters (current: ${value.length})`);
    }

    if (values && !values.includes(value)) {
      errors.push(`${name} must be one of: ${values.join(', ')} (current: ${value})`);
    }

    if (type === 'number' && isNaN(Number(value))) {
      errors.push(`${name} must be a number (current: ${value})`);
    }
  }

  // JWT secret strength and deployable secret policy
  for (const secretName of ['JWT_SECRET', 'JWT_REFRESH_SECRET']) {
    const secret = env[secretName];
    const secretError = getSecretValidationError(secretName, secret, env.NODE_ENV);
    if (secretError) {
      errors.push(secretError);
    }

    if (!secret) {
      continue;
    }

    const hasUpperCase = /[A-Z]/.test(secret);
    const hasLowerCase = /[a-z]/.test(secret);
    const hasNumber = /[0-9]/.test(secret);

    if (secret.length >= 32 && !(hasUpperCase || hasLowerCase || hasNumber)) {
      warnings.push(`${secretName} should contain a mix of characters for better entropy`);
    }
  }

  // DATABASE_URL format validation
  if (env.DATABASE_URL) {
    const dbUrl = env.DATABASE_URL;

    if (!dbUrl.startsWith('postgresql://') && !dbUrl.startsWith('postgres://')) {
      errors.push('DATABASE_URL must start with postgresql:// or postgres://');
    }

    const weakPasswords = ['password', 'admin', '123456', 'postgres'];
    const urlMatch = dbUrl.match(/\/\/[^:]+:([^@]+)@/);
    if (urlMatch) {
      const password = urlMatch[1];
      if (weakPasswords.includes(password.toLowerCase())) {
        errors.push('DATABASE_URL contains a weak password. Please use a strong password.');
      }
    }
  }

  // HTTPS enforcement warnings in production (CWE-319)
  if (env.NODE_ENV === 'production') {
    if (env.ALLOWED_ORIGINS) {
      const origins = env.ALLOWED_ORIGINS.split(',');
      const httpOrigins = origins.filter(origin => origin.startsWith('http://'));

      if (httpOrigins.length > 0) {
        warnings.push('ALLOWED_ORIGINS contains HTTP URLs in production');
      }
    }

    const port = parseInt(env.PORT, 10);
    if (port === 80) {
      warnings.push('PORT is set to 80 (HTTP) in production');
    }
  }

  return { errors, warnings };
}

/**
 * Validates environment variables at application startup.
 * Thin wrapper around checkEnvironment() that handles logging and process.exit.
 * @throws {never} Calls process.exit(1) if validation fails
 */
export function validateEnvironment() {
  const { errors, warnings } = checkEnvironment();

  for (const warning of warnings) {
    logger.warn(`[validateEnvironment] SECURITY WARNING: ${warning}`);
  }

  if (errors.length > 0) {
    logger.error('❌ Environment validation failed:');
    errors.forEach(err => logger.error(`  - ${err}`));
    logger.error('\nPlease fix the above errors in your .env file and restart.');
    process.exit(1);
  }

  logger.info('✅ Environment validation passed');
}
