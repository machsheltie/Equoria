/**
 * Environment Variable Validator Utility
 *
 * This utility validates that all required environment variables are present
 * and properly configured for the test environment. It provides warnings
 * for missing variables and ensures test reliability.
 *
 * 🎯 PURPOSE:
 * - Validate required environment variables are present
 * - Provide descriptive error messages for missing variables
 * - Log warnings for optional but recommended variables
 * - Ensure test environment consistency
 *
 * 📋 VALIDATION CATEGORIES:
 * - Required: Variables that must be present for tests to run
 * - Optional: Variables that enhance test functionality but aren't critical
 * - Security: Variables related to authentication and security
 * - Database: Variables for database connection and configuration
 */

import logger from './logger.mjs';

/**
 * Required environment variables for test environment
 */
const REQUIRED_ENV_VARS = [
  'NODE_ENV',
  'DATABASE_URL',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'PORT',
];

/**
 * Optional but recommended environment variables
 */
const OPTIONAL_ENV_VARS = [
  'LOG_LEVEL',
  'ALLOWED_ORIGINS',
  'SESSION_SECRET',
  'BCRYPT_ROUNDS',
  'RATE_LIMIT_WINDOW_MS',
  'RATE_LIMIT_MAX_REQUESTS',
  'AUTH_RATE_LIMIT_MAX',
  'JWT_EXPIRES_IN',
  'JWT_REFRESH_EXPIRES_IN',
  'TRAINING_COOLDOWN_DAYS',
  'BREEDING_COOLDOWN_DAYS',
  'SKIP_AUTH_FOR_TESTING',
  'ENABLE_DEBUG_ROUTES',
  'ENABLE_AUDIT_LOGGING',
  'ENABLE_SECURITY_ALERTS',
];

/**
 * Validate that all required environment variables are present
 * @param {boolean} throwOnMissing - Whether to throw an error if variables are missing
 * @returns {Object} Validation result with missing and present variables
 */
export function validateRequiredEnvVars(throwOnMissing = true) {
  const missing = [];
  const present = [];
  const warnings = [];

  // Check required variables
  for (const varName of REQUIRED_ENV_VARS) {
    const value = process.env[varName];
    if (!value || value.trim() === '') {
      missing.push(varName);
    } else {
      present.push(varName);

      // Additional validation for specific variables
      if (varName === 'NODE_ENV' && value !== 'test') {
        warnings.push(`NODE_ENV is '${value}' but should be 'test' for test environment`);
      }

      if (varName === 'DATABASE_URL' && !value.includes('equoria_test')) {
        warnings.push('DATABASE_URL does not appear to point to test database (should contain "equoria_test")');
      }

      if ((varName === 'JWT_SECRET' || varName === 'JWT_REFRESH_SECRET') && value.length < 32) {
        warnings.push(`${varName} is shorter than recommended 32 characters`);
      }
    }
  }

  // Check optional variables and log info about missing ones
  const missingOptional = [];
  for (const varName of OPTIONAL_ENV_VARS) {
    const value = process.env[varName];
    if (!value || value.trim() === '') {
      missingOptional.push(varName);
    }
  }

  const result = {
    success: missing.length === 0,
    missing,
    present,
    warnings,
    missingOptional,
  };

  // Log results
  if (result.success) {
    logger.info(`[envValidator] ✅ All ${REQUIRED_ENV_VARS.length} required environment variables are present`);
  } else {
    logger.error(`[envValidator] ❌ Missing required environment variables: ${missing.join(', ')}`);
  }

  if (warnings.length > 0) {
    warnings.forEach(warning => {
      logger.warn(`[envValidator] ⚠️  ${warning}`);
    });
  }

  if (missingOptional.length > 0) {
    logger.info(`[envValidator] ℹ️  Optional variables not set: ${missingOptional.join(', ')}`);
  }

  // Throw error if required variables are missing and throwOnMissing is true
  if (!result.success && throwOnMissing) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}. ` +
      'Please check your .env.test file and ensure all required variables are set.',
    );
  }

  return result;
}

/**
 * Validate environment variables specifically for test environment
 * @returns {Object} Validation result
 */
export function validateTestEnvironment() {
  logger.info('[envValidator] Validating test environment configuration...');

  const result = validateRequiredEnvVars(false);

  // Additional test-specific validations
  const testSpecificWarnings = [];

  // Check that we're actually in test mode
  if (process.env.NODE_ENV !== 'test') {
    testSpecificWarnings.push('NODE_ENV is not set to "test" - this may cause issues with test configuration');
  }

  // Check database URL points to test database
  if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('test')) {
    testSpecificWarnings.push('DATABASE_URL does not appear to point to a test database');
  }

  // Check for test-friendly settings
  if (process.env.LOG_LEVEL && process.env.LOG_LEVEL !== 'error' && process.env.LOG_LEVEL !== 'warn') {
    testSpecificWarnings.push('LOG_LEVEL is not set to "error" or "warn" - tests may be noisy');
  }

  // Add test-specific warnings to result
  result.testWarnings = testSpecificWarnings;

  if (testSpecificWarnings.length > 0) {
    testSpecificWarnings.forEach(warning => {
      logger.warn(`[envValidator] 🧪 Test Environment: ${warning}`);
    });
  }

  logger.info(`[envValidator] Test environment validation complete. Success: ${result.success}`);

  return result;
}

/**
 * Get a summary of current environment configuration
 * @returns {Object} Environment summary
 */
export function getEnvironmentSummary() {
  return {
    nodeEnv: process.env.NODE_ENV || 'undefined',
    port: process.env.PORT || 'undefined',
    databaseConfigured: !!process.env.DATABASE_URL,
    jwtConfigured: !!process.env.JWT_SECRET,
    logLevel: process.env.LOG_LEVEL || 'undefined',
    requiredVarsCount: REQUIRED_ENV_VARS.length,
    optionalVarsCount: OPTIONAL_ENV_VARS.length,
    presentRequiredVars: REQUIRED_ENV_VARS.filter(varName => process.env[varName]).length,
    presentOptionalVars: OPTIONAL_ENV_VARS.filter(varName => process.env[varName]).length,
  };
}

export default {
  validateRequiredEnvVars,
  validateTestEnvironment,
  getEnvironmentSummary,
  REQUIRED_ENV_VARS,
  OPTIONAL_ENV_VARS,
};
