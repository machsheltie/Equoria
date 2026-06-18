/**
 * Jest Global Teardown
 * Ensures all database connections are properly closed after all tests complete
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default async function globalTeardown() {
  console.info('🧹 Running global teardown...');

  try {
    // 1. Load environment variables — do NOT override env already set by the
    // runner (e.g. CI service-container credentials). See tests/setup.mjs.
    dotenv.config({
      path: path.join(__dirname, '..', '.env.test'),
    });

    // Per-file Prisma clients are disconnected by PrismaCleanupEnvironment
    // after suite-owned afterAll hooks. Global teardown runs in another
    // process and therefore has no access to those VM-local registries.

    // 2. Force garbage collection if available
    if (global.gc) {
      global.gc();
      console.info('[Teardown] ✅ Garbage collection completed');
    }

    console.info('✅ Global teardown completed successfully');
  } catch (error) {
    console.error('❌ Error during global teardown:', error);
    // Don't throw - allow Jest to exit cleanly
  }
}
