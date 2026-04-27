/**
 * Environment Validation Script for CI/CD Pipeline
 *
 * This script validates the environment configuration including:
 * - Required environment variables
 * - Database connection string format
 * - JWT secret strength
 * - Node.js version compatibility
 * - Package dependencies
 */

// execSync removed - not used in this file
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { getSecretValidationError, isDeployableEnvironment } from '../utils/runtimeSecretPolicy.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Environment validation configuration
const ENV_CONFIG = {
  requiredVars: ['DATABASE_URL', 'JWT_SECRET', 'JWT_REFRESH_SECRET', 'NODE_ENV'],
  optionalVars: ['PORT', 'REDIS_URL', 'LOG_LEVEL', 'CORS_ORIGIN'],
  nodeVersionMin: '18.0.0',
  jwtSecretMinLength: 32,
};

/**
 * Validate Node.js version
 */
function validateNodeVersion() {
  console.log('🔍 Validating Node.js version...');

  const currentVersion = process.version;
  const requiredVersion = ENV_CONFIG.nodeVersionMin;

  // Simple version comparison (assumes semantic versioning)
  const current = currentVersion.slice(1).split('.').map(Number);
  const required = requiredVersion.split('.').map(Number);

  let isValid = false;
  for (let i = 0; i < 3; i++) {
    if (current[i] > required[i]) {
      isValid = true;
      break;
    } else if (current[i] < required[i]) {
      break;
    }
    // If equal, continue to next part
    if (i === 2) {
      isValid = true;
    }
  }

  if (isValid) {
    console.log(`✅ Node.js version ${currentVersion} meets requirement (>= ${requiredVersion})`);
    return {
      valid: true,
      current: currentVersion,
      required: requiredVersion,
    };
  } else {
    console.error(
      `❌ Node.js version ${currentVersion} does not meet requirement (>= ${requiredVersion})`,
    );
    return {
      valid: false,
      current: currentVersion,
      required: requiredVersion,
      error: `Node.js version ${currentVersion} is below required ${requiredVersion}`,
    };
  }
}

/**
 * Validate environment variables
 */
function validateEnvironmentVariables() {
  console.log('🔍 Validating environment variables...');

  const results = {
    valid: true,
    required: {},
    optional: {},
    errors: [],
  };

  // Check required variables
  for (const varName of ENV_CONFIG.requiredVars) {
    const value = process.env[varName];
    if (value) {
      results.required[varName] = {
        present: true,
        length: value.length,
      };
      console.log(`✅ ${varName}: Present (${value.length} characters)`);
    } else {
      results.required[varName] = {
        present: false,
        error: 'Missing required environment variable',
      };
      results.errors.push(`Missing required environment variable: ${varName}`);
      results.valid = false;
      console.error(`❌ ${varName}: Missing`);
    }
  }

  // Check optional variables
  for (const varName of ENV_CONFIG.optionalVars) {
    const value = process.env[varName];
    if (value) {
      results.optional[varName] = {
        present: true,
        value: varName === 'PORT' ? value : '[REDACTED]',
      };
      console.log(`ℹ️ ${varName}: Present`);
    } else {
      results.optional[varName] = {
        present: false,
      };
      console.log(`⚪ ${varName}: Not set (optional)`);
    }
  }

  return results;
}

/**
 * Validate JWT secrets
 */
function validateJwtSecrets() {
  console.log('🔍 Validating JWT secrets...');

  const results = {
    valid: true,
    secrets: {},
    errors: [],
  };

  const secretVars = ['JWT_SECRET', 'JWT_REFRESH_SECRET'];

  for (const varName of secretVars) {
    const secret = process.env[varName];

    if (!secret) {
      results.secrets[varName] = {
        present: false,
        error: 'Secret not found',
      };
      results.errors.push(`${varName} is missing`);
      results.valid = false;
      console.error(`❌ ${varName}: Missing`);
      continue;
    }

    const { length } = secret;
    const hasUppercase = /[A-Z]/.test(secret);
    const hasLowercase = /[a-z]/.test(secret);
    const hasNumbers = /[0-9]/.test(secret);
    const hasSpecialChars = /[^A-Za-z0-9]/.test(secret);

    const isStrong =
      length >= ENV_CONFIG.jwtSecretMinLength && hasUppercase && hasLowercase && hasNumbers;

    results.secrets[varName] = {
      present: true,
      length,
      strong: isStrong,
      checks: {
        minLength: length >= ENV_CONFIG.jwtSecretMinLength,
        hasUppercase,
        hasLowercase,
        hasNumbers,
        hasSpecialChars,
      },
    };

    if (isStrong) {
      console.log(`✅ ${varName}: Strong (${length} characters)`);
    } else {
      results.errors.push(
        `${varName} is weak (length: ${length}, min: ${ENV_CONFIG.jwtSecretMinLength})`,
      );
      results.valid = false;
      console.error(
        `❌ ${varName}: Weak (${length} characters, needs ${ENV_CONFIG.jwtSecretMinLength}+)`,
      );
    }

    const secretPolicyError = getSecretValidationError(varName, secret, process.env.NODE_ENV);
    if (secretPolicyError) {
      results.errors.push(secretPolicyError);
      results.valid = false;
      console.error(`❌ ${varName}: ${secretPolicyError}`);
    } else if (isDeployableEnvironment(process.env.NODE_ENV)) {
      console.log(`✅ ${varName}: Accepted for deployable environment ${process.env.NODE_ENV}`);
    }
  }

  return results;
}

/**
 * Validate database URL format
 */
function validateDatabaseUrl() {
  console.log('🔍 Validating database URL...');

  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('❌ DATABASE_URL: Missing');
    return {
      valid: false,
      error: 'DATABASE_URL environment variable is missing',
    };
  }

  try {
    const url = new URL(databaseUrl);

    const isPostgres = url.protocol === 'postgresql:' || url.protocol === 'postgres:';
    const hasHost = !!url.hostname;
    const hasDatabase = !!url.pathname && url.pathname !== '/';
    const hasCredentials = !!url.username;

    const isValid = isPostgres && hasHost && hasDatabase;

    if (isValid) {
      console.log('✅ DATABASE_URL: Valid PostgreSQL connection string');
      console.log(`   Host: ${url.hostname}:${url.port || 5432}`);
      console.log(`   Database: ${url.pathname.slice(1)}`);
      console.log(`   User: ${url.username || 'not specified'}`);
    } else {
      console.error('❌ DATABASE_URL: Invalid format');
    }

    return {
      valid: isValid,
      protocol: url.protocol,
      host: url.hostname,
      port: url.port || 5432,
      database: url.pathname.slice(1),
      hasCredentials,
      checks: {
        isPostgres,
        hasHost,
        hasDatabase,
        hasCredentials,
      },
    };
  } catch (error) {
    console.error(`❌ DATABASE_URL: Invalid URL format - ${error.message}`);
    return {
      valid: false,
      error: `Invalid URL format: ${error.message}`,
    };
  }
}

/**
 * Validate package dependencies
 */
async function validateDependencies() {
  console.log('🔍 Validating package dependencies...');

  try {
    const packageJsonPath = path.resolve(__dirname, '../package.json');
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));

    // Check if node_modules exists
    const nodeModulesPath = path.resolve(__dirname, '../node_modules');
    let nodeModulesExists = false;

    try {
      await fs.access(nodeModulesPath);
      nodeModulesExists = true;
    } catch {
      nodeModulesExists = false;
    }

    // Count dependencies
    const prodDeps = Object.keys(packageJson.dependencies || {}).length;
    const devDeps = Object.keys(packageJson.devDependencies || {}).length;
    const totalDeps = prodDeps + devDeps;

    if (nodeModulesExists) {
      console.log(`✅ Dependencies: node_modules exists (${totalDeps} total dependencies)`);
      console.log(`   Production: ${prodDeps} packages`);
      console.log(`   Development: ${devDeps} packages`);
    } else {
      console.error('❌ Dependencies: node_modules not found - run npm install');
    }

    return {
      valid: nodeModulesExists,
      nodeModulesExists,
      totalDependencies: totalDeps,
      productionDependencies: prodDeps,
      developmentDependencies: devDeps,
      packageName: packageJson.name,
      packageVersion: packageJson.version,
    };
  } catch (error) {
    console.error(`❌ Dependencies: Error reading package.json - ${error.message}`);
    return {
      valid: false,
      error: error.message,
    };
  }
}

/**
 * Validate TypeScript/ES Modules configuration
 */
async function validateModuleConfiguration() {
  console.log('🔍 Validating module configuration...');

  try {
    const packageJsonPath = path.resolve(__dirname, '../package.json');
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));

    const isESModule = packageJson.type === 'module';
    const hasMainField = !!packageJson.main;
    const mainFile = packageJson.main;

    if (isESModule) {
      console.log('✅ Module type: ES Modules enabled');
    } else {
      console.log('⚪ Module type: CommonJS (default)');
    }

    if (hasMainField) {
      console.log(`✅ Main entry point: ${mainFile}`);
    } else {
      console.log('⚪ Main entry point: Not specified');
    }

    return {
      valid: true, // Not a blocking issue
      isESModule,
      hasMainField,
      mainFile,
      moduleType: isESModule ? 'module' : 'commonjs',
    };
  } catch (error) {
    console.error(`❌ Module configuration: Error - ${error.message}`);
    return {
      valid: false,
      error: error.message,
    };
  }
}

/**
 * Main environment validation function
 */
async function validateEnvironment() {
  console.log('🔧 Starting Environment Validation');
  console.log('==================================');

  const results = {
    timestamp: new Date().toISOString(),
    valid: true,
    checks: {},
    errors: [],
    warnings: [],
  };

  try {
    // Run all validation checks
    results.checks.nodeVersion = validateNodeVersion();
    results.checks.environmentVariables = validateEnvironmentVariables();
    results.checks.jwtSecrets = validateJwtSecrets();
    results.checks.databaseUrl = validateDatabaseUrl();
    results.checks.dependencies = await validateDependencies();
    results.checks.moduleConfiguration = await validateModuleConfiguration();

    // Collect errors and determine overall validity
    Object.values(results.checks).forEach(check => {
      if (!check.valid) {
        results.valid = false;
        if (check.error) {
          results.errors.push(check.error);
        }
        if (check.errors) {
          results.errors.push(...check.errors);
        }
      }
    });

    // Display summary
    console.log('\n📋 Environment Validation Summary');
    console.log('=================================');
    console.log(`Overall Status: ${results.valid ? 'VALID' : 'INVALID'}`);

    Object.entries(results.checks).forEach(([checkName, check]) => {
      const statusIcon = check.valid ? '✅' : '❌';
      console.log(`${statusIcon} ${checkName}: ${check.valid ? 'PASSED' : 'FAILED'}`);
    });

    if (results.errors.length > 0) {
      console.log('\n❌ Errors found:');
      results.errors.forEach(error => console.log(`   - ${error}`));
    }

    return results;
  } catch (error) {
    console.error('❌ Environment validation failed:', error.message);
    results.valid = false;
    results.error = error.message;
    return results;
  }
}

/**
 * Main execution function
 */
async function runEnvironmentValidation() {
  try {
    const results = await validateEnvironment();

    // Output results for CI/CD
    if (process.argv.includes('--json')) {
      console.log(JSON.stringify(results, null, 2));
    }

    // Exit with appropriate code
    if (results.valid) {
      console.log('\n✅ Environment validation PASSED');
      process.exit(0);
    } else {
      console.log('\n❌ Environment validation FAILED');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Environment validation execution failed:', error.message);
    process.exit(1);
  }
}

// Run validation if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runEnvironmentValidation();
}

export {
  validateEnvironment,
  validateNodeVersion,
  validateEnvironmentVariables,
  validateJwtSecrets,
  validateDatabaseUrl,
  validateDependencies,
  validateModuleConfiguration,
};
