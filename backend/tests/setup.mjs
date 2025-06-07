// Test setup file to ensure tests use the correct database
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load test environment variables
dotenv.config({ path: join(__dirname, '..', '.env.test') });

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
    'Tests must use the test database (equoria_test). Check .env.test configuration.',
  );
}

console.log('🧪 Test environment loaded');
console.log('📊 Database:', process.env.DATABASE_URL?.replace(/:[^:@]*@/, ':***@')); // Hide password in logs
