import logger from './logger.mjs';

/**
 * Required environment variables with validation rules
 */
const REQUIRED_ENV_VARS = [
  { name: 'DATABASE_URL', minLength: 20 },
  { name: 'JWT_SECRET', minLength: 32 },
  { name: 'NODE_ENV', values: ['development', 'production', 'test'] },
  { name: 'PORT', type: 'number' },
];

/**
 * Validates environment variables at application startup
 * Fails fast if required variables are missing or invalid
 * @throws {Error} If validation fails (calls process.exit(1))
 */
export function validateEnvironment() {
  const errors = [];

  for (const { name, minLength, values, type } of REQUIRED_ENV_VARS) {
    const value = process.env[name];

    // Check existence
    if (!value) {
      errors.push(`Missing required environment variable: ${name}`);
      continue;
    }

    // Check minimum length
    if (minLength && value.length < minLength) {
      errors.push(
        `${name} must be at least ${minLength} characters (current: ${value.length})`,
      );
    }

    // Check allowed values
    if (values && !values.includes(value)) {
      errors.push(`${name} must be one of: ${values.join(', ')} (current: ${value})`);
    }

    // Check type
    if (type === 'number' && isNaN(Number(value))) {
      errors.push(`${name} must be a number (current: ${value})`);
    }
  }

  // Additional validation: JWT_SECRET strength
  if (process.env.JWT_SECRET) {
    const secret = process.env.JWT_SECRET;

    // Check for placeholder values
    const placeholders = [
      'your-super-secret',
      'change-this',
      'REPLACE_WITH',
      'example',
    ];
    if (placeholders.some((placeholder) => secret.includes(placeholder))) {
      errors.push(
        'JWT_SECRET appears to be a placeholder value. Please generate a real secret.',
      );
    }

    // Check complexity (should have mix of characters)
    const hasUpperCase = /[A-Z]/.test(secret);
    const hasLowerCase = /[a-z]/.test(secret);
    const hasNumber = /[0-9]/.test(secret);

    if (secret.length >= 32 && !(hasUpperCase || hasLowerCase || hasNumber)) {
      // At least some character variety expected
      logger.warn(
        '[validateEnvironment] JWT_SECRET should contain a mix of characters for better entropy',
      );
    }
  }

  // Additional validation: DATABASE_URL format
  if (process.env.DATABASE_URL) {
    const dbUrl = process.env.DATABASE_URL;

    if (!dbUrl.startsWith('postgresql://') && !dbUrl.startsWith('postgres://')) {
      errors.push('DATABASE_URL must start with postgresql:// or postgres://');
    }

    // Check for common weak passwords in URL
    const weakPasswords = ['password', 'admin', '123456', 'postgres'];
    const urlMatch = dbUrl.match(/:([^@]+)@/);
    if (urlMatch) {
      const password = urlMatch[1];
      if (weakPasswords.includes(password.toLowerCase())) {
        errors.push('DATABASE_URL contains a weak password. Please use a strong password.');
      }
    }
  }

  // Log results
  if (errors.length > 0) {
    logger.error('❌ Environment validation failed:');
    errors.forEach((err) => logger.error(`  - ${err}`));
    logger.error('\nPlease fix the above errors in your .env file and restart.');
    process.exit(1);
  }

  logger.info('✅ Environment validation passed');
}
