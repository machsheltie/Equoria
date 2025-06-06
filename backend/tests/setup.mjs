// Test setup file to ensure tests use the correct database
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load test environment variables
dotenv.config({ path: join(__dirname, '..', '.env.test') });

// Verify we're using the test database
if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.includes('equoria_test')) {
  throw new Error(
    'Tests must use the test database (equoria_test). Check .env.test configuration.',
  );
}

// Set NODE_ENV to test if not already set
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'test';
}

console.log('🧪 Test environment loaded');
console.log('📊 Database:', process.env.DATABASE_URL?.replace(/:[^:@]*@/, ':***@')); // Hide password in logs
