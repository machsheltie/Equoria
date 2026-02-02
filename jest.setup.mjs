// Jest setup file for backend tests
// Loads environment variables for test environment
//
// NOTE: Simplified to avoid import.meta.url which causes issues with Babel transformation.
// Using process.cwd() instead to get the project root directory.

import path from 'path';
import dotenv from 'dotenv';
import { afterAll } from '@jest/globals';

// Get the project root directory (where package.json is located)
const projectRoot = process.cwd();

// Load environment variables from backend/.env.test
const envPath = path.resolve(projectRoot, 'backend', '.env.test');
dotenv.config({ path: envPath });

// Ensure database connection is closed after each test suite to prevent pool exhaustion
afterAll(async () => {
  try {
    // Dynamically import prisma to avoid eager loading which interferes with mocking
    const { default: prisma } = await import('./packages/database/prismaClient.mjs');
    await prisma.$disconnect();
  } catch (error) {
    // Ignore errors during disconnect (e.g. if prisma was never initialized or mocked)
  }
});
