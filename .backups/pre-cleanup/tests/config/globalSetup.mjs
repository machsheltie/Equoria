/**
 * Global Test Setup
 *
 * Runs ONCE before all tests start.
 * Sets up test database, environment, and shared resources.
 *
 * Features:
 * - Database initialization and migration
 * - Test data seeding
 * - Environment variable configuration
 * - Performance monitoring initialization
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);

export default async function globalSetup() {
  console.log('\n🚀 Global Test Setup Starting...\n');

  const startTime = Date.now();

  try {
    // 1. Load test environment variables
    await loadTestEnvironment();

    // 2. Initialize test database
    await initializeDatabase();

    // 3. Run database migrations
    await runMigrations();

    // 4. Seed test data (optional, controlled by env var)
    if (process.env.SEED_TEST_DATA === 'true') {
      await seedTestData();
    }

    // 5. Setup performance monitoring
    await setupPerformanceMonitoring();

    // 6. Verify environment health
    await verifyEnvironment();

    const duration = Date.now() - startTime;
    console.log(`✅ Global Setup Complete (${duration}ms)\n`);
  } catch (error) {
    console.error('❌ Global Setup Failed:', error);
    throw error;
  }
}

/**
 * Load test-specific environment variables
 */
async function loadTestEnvironment() {
  console.log('📝 Loading test environment...');

  // Load .env.test if exists, otherwise .env
  const envPath = fs.existsSync('.env.test') ? '.env.test' : '.env';
  dotenv.config({ path: envPath });

  // Override NODE_ENV
  process.env.NODE_ENV = 'test';

  // Set test database URL if not already set
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/equoria_test';
  }

  // Set JWT secret for tests
  if (!process.env.JWT_SECRET) {
    process.env.JWT_SECRET = 'test_secret_key_for_jest';
  }

  console.log('  ✓ Environment loaded');
}

/**
 * Initialize test database
 */
async function initializeDatabase() {
  console.log('🗄️  Initializing test database...');

  try {
    // Check if Prisma is available
    const prismaPath = path.join(process.cwd(), '../packages/database/prismaClient.mjs');

    if (!fs.existsSync(prismaPath)) {
      console.log('  ⚠️  Prisma client not found, skipping database init');
      return;
    }

    // Drop and recreate test database (if in CI or explicitly requested)
    if (process.env.CI || process.env.RESET_TEST_DB === 'true') {
      console.log('  🔄 Resetting test database...');
      await execAsync('npx prisma migrate reset --force --skip-seed', {
        cwd: path.join(process.cwd(), '../packages/database'),
      });
    }

    console.log('  ✓ Database initialized');
  } catch (error) {
    console.warn('  ⚠️  Database initialization warning:', error.message);
    // Don't fail setup if database is already initialized
  }
}

/**
 * Run database migrations
 */
async function runMigrations() {
  console.log('📦 Running database migrations...');

  try {
    const migrationsPath = path.join(process.cwd(), '../packages/database/prisma/migrations');

    if (!fs.existsSync(migrationsPath)) {
      console.log('  ⚠️  No migrations found, skipping');
      return;
    }

    await execAsync('npx prisma migrate deploy', {
      cwd: path.join(process.cwd(), '../packages/database'),
      env: {
        ...process.env,
        DATABASE_URL: process.env.DATABASE_URL,
      },
    });

    console.log('  ✓ Migrations applied');
  } catch (error) {
    console.warn('  ⚠️  Migration warning:', error.message);
    // Continue even if migrations fail (might already be applied)
  }
}

/**
 * Seed test data
 */
async function seedTestData() {
  console.log('🌱 Seeding test data...');

  try {
    const seedScript = path.join(process.cwd(), 'tests/fixtures/seed.mjs');

    if (fs.existsSync(seedScript)) {
      const { default: seed } = await import(seedScript);
      await seed();
      console.log('  ✓ Test data seeded');
    } else {
      console.log('  ⚠️  No seed script found, skipping');
    }
  } catch (error) {
    console.warn('  ⚠️  Seeding warning:', error.message);
  }
}

/**
 * Setup performance monitoring
 */
async function setupPerformanceMonitoring() {
  console.log('📊 Setting up performance monitoring...');

  // Create performance data directory
  const perfDir = path.join(process.cwd(), 'test-results');
  if (!fs.existsSync(perfDir)) {
    fs.mkdirSync(perfDir, { recursive: true });
  }

  // Initialize performance tracking file
  const perfFile = path.join(perfDir, 'performance.json');
  const perfData = {
    startTime: new Date().toISOString(),
    testRuns: [],
  };

  fs.writeFileSync(perfFile, JSON.stringify(perfData, null, 2));

  console.log('  ✓ Performance monitoring ready');
}

/**
 * Verify environment is ready for tests
 */
async function verifyEnvironment() {
  console.log('🔍 Verifying environment...');

  const checks = [];

  // Check database connection
  try {
    const prisma = (await import('../../../packages/database/prismaClient.mjs')).default;
    await prisma.$connect();
    checks.push('✓ Database connection');
    await prisma.$disconnect();
  } catch (error) {
    checks.push('⚠️  Database connection (optional)');
  }

  // Check required environment variables
  const requiredVars = ['NODE_ENV', 'JWT_SECRET'];
  for (const varName of requiredVars) {
    if (process.env[varName]) {
      checks.push(`✓ ${varName} configured`);
    } else {
      throw new Error(`Missing required environment variable: ${varName}`);
    }
  }

  checks.forEach((check) => console.log(`  ${check}`));
  console.log('  ✓ Environment verified');
}
