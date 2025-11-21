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
  console.log('🧹 Running global teardown...');

  try {
    // 1. Load environment variables (required for imports)
    dotenv.config({
      path: path.join(__dirname, '..', '.env.test'),
      override: true,
    });

    // 2. Import and cleanup Prisma instances (must be after env vars loaded)
    const { cleanupPrismaInstances } = await import('../jest.setup.mjs');
    console.log('[Teardown] Disconnecting Prisma instances...');
    await cleanupPrismaInstances();
    console.log('[Teardown] ✅ Prisma instances disconnected');

    // 3. Force garbage collection if available
    if (global.gc) {
      global.gc();
      console.log('[Teardown] ✅ Garbage collection completed');
    }

    console.log('✅ Global teardown completed successfully');
  } catch (error) {
    console.error('❌ Error during global teardown:', error);
    // Don't throw - allow Jest to exit cleanly
  }
}
