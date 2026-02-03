// Test setup file to ensure tests use the correct database
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Suppress console logs during tests to reduce noise (except errors and warnings)
if (process.env.NODE_ENV === 'test') {
  global.console.log = () => {};
  global.console.debug = () => {};
  global.console.info = () => {};
}

// Load test environment variables (override any existing env vars)
dotenv.config({ path: join(__dirname, '..', '.env.test'), override: true });

// Normalize mime API across versions for test-only dependencies.
try {
  const mimeModule = await import('mime');
  const mime = mimeModule.default ?? mimeModule;

  if (mime && !mime.getType && typeof mime.lookup === 'function') {
    mime.getType = mime.lookup.bind(mime);
  }

  if (mime && !mime.lookup && typeof mime.getType === 'function') {
    mime.lookup = mime.getType.bind(mime);
  }
} catch (error) {
  console.warn('Could not normalize mime module for tests:', error.message);
}

// Set NODE_ENV to test if not already set
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'test';
}

// Import and run environment validation after loading .env.test
try {
  const { validateTestEnvironment } = await import('../utils/envValidator.mjs');
  const validationResult = validateTestEnvironment();

  if (!validationResult.success) {
    console.error('❌ Environment validation failed:', validationResult.missing);
    process.exit(1);
  }
} catch (error) {
  console.warn('⚠️  Could not validate environment variables:', error.message);
}

// Legacy verification for backward compatibility
if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.includes('equoria_test')) {
  throw new Error(
    'Tests must use the test database (equoria_test). Check .env.test configuration.'
  );
}

console.log('🧪 Test environment loaded');
console.log('📊 Database:', process.env.DATABASE_URL?.replace(/:[^:@]*@/, ':***@')); // Hide password in logs

// Import Prisma cleanup function
const { cleanupPrismaInstances } = await import('../jest.setup.mjs');

// Register cleanup after each test file completes (afterAll hook)
afterAll(async () => {
  try {
    await cleanupPrismaInstances();
  } catch (error) {
    // Silently ignore cleanup errors to avoid breaking tests
  }
});
