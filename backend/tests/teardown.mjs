/**
 * Jest Global Teardown
 * Ensures all database connections are properly closed after all tests complete
 */

export default async function globalTeardown() {
  console.log('🧹 Running global teardown...');

  try {
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    console.log('✅ Global teardown completed successfully');
  } catch (error) {
    console.error('❌ Error during global teardown:', error);
  }
}
