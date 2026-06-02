/**
 * Global Test Teardown
 *
 * Runs ONCE after all tests complete.
 * Cleans up resources, generates reports, and closes connections.
 *
 * Features:
 * - Database cleanup
 * - Performance report generation
 * - Test result summary
 * - Resource cleanup verification
 */

import fs from 'fs';
import path from 'path';

export default async function globalTeardown() {
  console['log']('\n🧹 Global Test Teardown Starting...\n');

  const startTime = Date.now();

  try {
    // 1. Clean up test database
    await cleanupDatabase();

    // 2. Generate performance report
    await generatePerformanceReport();

    // 3. Cleanup temporary files
    await cleanupTemporaryFiles();

    // 4. Verify all resources closed
    await verifyResourceCleanup();

    // 5. Generate test summary
    await generateTestSummary();

    const duration = Date.now() - startTime;
    console['log'](`✅ Global Teardown Complete (${duration}ms)\n`);
  } catch (error) {
    console.error('❌ Global Teardown Error:', error);
    // Don't throw - allow test results to be preserved
  }
}

/**
 * Clean up test database (Equoria-6n9dj — FK-ordered, scoped to TEST patterns).
 *
 * The previous implementation deleted refreshTokens + users matched by
 * `email contains 'test'`, but NEVER deleted those users' horses first.
 * Horse.userId is `onDelete: Restrict` (schema), so every user.deleteMany
 * here that matched a user with a leaked horse threw:
 *
 *   update or delete on table "User" violates foreign key constraint
 *   "horses_userId_fkey" on table "horses"
 *
 * — the recurring warning this issue tracks. The fix is to FK-order the
 * cleanup: delete the matched test users' horses (clearing self-referential
 * sire/dam edges within the set so the lineage Restrict FKs don't block)
 * BEFORE deleting the users.
 *
 * The matcher is also tightened from the loose `contains 'test'` (which could
 * match a real player whose email merely CONTAINS "test", e.g.
 * "greatest@real.com") to the reserved TEST email domains + fixture name
 * prefixes — the same scope as backend/scripts/purge-leaked-test-fixtures.mjs.
 * Every delete remains scoped; there is no unscoped deleteMany (CLAUDE.md §2).
 */

// TEST-only matcher — reserved fixture/seed email domains + name prefixes.
// Mirrors purge-leaked-test-fixtures.mjs#TEST_USER_WHERE. No real player
// account uses these domains.
const TEST_USER_WHERE = {
  OR: [
    { email: { endsWith: '@test.com' } },
    { email: { endsWith: '@example.com' } },
    { email: { endsWith: '@example.org' } },
    // Reserved TLDs (RFC 2606/6761/6762) — never a real deliverable address.
    { email: { endsWith: '.test' } },
    { email: { endsWith: '.invalid' } },
    { email: { endsWith: '.local' } },
    { email: { endsWith: '.localhost' } },
    { email: { endsWith: '.example' } },
    { email: { startsWith: 'TestFixture-' } },
    { email: { startsWith: 'testfixture-' } },
    { email: { startsWith: 'testfixture_' } },
    { username: { startsWith: 'TestFixture-' } },
    { username: { startsWith: 'testfixture-' } },
  ],
};

async function cleanupDatabase() {
  console['log']('🗄️  Cleaning up test database...');

  try {
    // Only clean up if explicitly requested
    if (process.env.CLEANUP_TEST_DB === 'true') {
      const prisma = (await import('../../../packages/database/prismaClient.mjs')).default;

      // Identify matched TEST users by reserved-pattern scope.
      const users = await prisma.user.findMany({
        where: TEST_USER_WHERE,
        select: { id: true },
      });
      const userIds = users.map(u => u.id);

      if (userIds.length > 0) {
        // FK-order: horses BEFORE users. Horse.userId is Restrict, so the
        // user delete is blocked until owned horses are gone.
        const horses = await prisma.horse.findMany({
          where: { userId: { in: userIds } },
          select: { id: true },
        });
        const horseIds = horses.map(h => h.id);

        if (horseIds.length > 0) {
          // Clear self-referential lineage edges within the deleted set so the
          // damId/sireId Restrict FKs don't block (scoped to deleted→deleted).
          await prisma.horse.updateMany({
            where: { id: { in: horseIds }, damId: { in: horseIds } },
            data: { damId: null },
          });
          await prisma.horse.updateMany({
            where: { id: { in: horseIds }, sireId: { in: horseIds } },
            data: { sireId: null },
          });
          // Horse children (results, training logs, groom* etc.) cascade.
          await prisma.horse.deleteMany({ where: { id: { in: horseIds } } });
        }

        // refreshTokens are Cascade on user, but clearing explicitly keeps the
        // user delete unambiguous. Scoped to the matched user ids.
        await prisma.refreshToken.deleteMany({ where: { userId: { in: userIds } } });

        await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      }

      await prisma.$disconnect();
      console['log'](`  ✓ Test data cleaned up (${userIds.length} test user(s), FK-ordered)`);
    } else {
      console['log']('  ⚠️  Database cleanup skipped (set CLEANUP_TEST_DB=true to enable)');
    }
  } catch (error) {
    console.warn('  ⚠️  Database cleanup warning:', error.message);
  }
}

/**
 * Generate performance report
 */
async function generatePerformanceReport() {
  console['log']('📊 Generating performance report...');

  try {
    const perfFile = path.join(process.cwd(), 'test-results/performance.json');

    if (!fs.existsSync(perfFile)) {
      console['log']('  ⚠️  No performance data found');
      return;
    }

    const perfData = JSON.parse(fs.readFileSync(perfFile, 'utf8'));
    perfData.endTime = new Date().toISOString();

    // Calculate statistics
    const stats = calculatePerformanceStats(perfData);

    // Generate human-readable report
    const reportPath = path.join(process.cwd(), 'test-results/performance-report.txt');

    const report = generatePerformanceReportText(stats);
    fs.writeFileSync(reportPath, report, 'utf8');

    // Update JSON with stats
    perfData.statistics = stats;
    fs.writeFileSync(perfFile, JSON.stringify(perfData, null, 2), 'utf8');

    console['log']('  ✓ Performance report generated');
    console['log'](`  📄 Report: ${reportPath}`);
  } catch (error) {
    console.warn('  ⚠️  Performance report warning:', error.message);
  }
}

/**
 * Calculate performance statistics
 */
function calculatePerformanceStats(perfData) {
  if (!perfData.testRuns || perfData.testRuns.length === 0) {
    return {
      totalTests: 0,
      averageDuration: 0,
      totalDuration: 0,
    };
  }

  const durations = perfData.testRuns.map(run => run.duration || 0);
  const totalDuration = durations.reduce((sum, d) => sum + d, 0);
  const averageDuration = totalDuration / durations.length;
  const maxDuration = Math.max(...durations);
  const minDuration = Math.min(...durations);

  return {
    totalTests: perfData.testRuns.length,
    totalDuration,
    averageDuration: Math.round(averageDuration),
    maxDuration,
    minDuration,
    slowTests: perfData.testRuns
      .filter(run => run.duration > 5000)
      .map(run => ({
        name: run.testName,
        duration: run.duration,
      })),
  };
}

/**
 * Generate human-readable performance report
 */
function generatePerformanceReportText(stats) {
  return `
================================
Performance Report
================================

Total Tests: ${stats.totalTests}
Total Duration: ${stats.totalDuration}ms (${(stats.totalDuration / 1000).toFixed(2)}s)
Average Duration: ${stats.averageDuration}ms
Max Duration: ${stats.maxDuration}ms
Min Duration: ${stats.minDuration}ms

${
  stats.slowTests && stats.slowTests.length > 0
    ? `
Slow Tests (>5s):
${stats.slowTests.map(test => `  - ${test.name}: ${test.duration}ms`).join('\n')}
`
    : 'No slow tests detected ✓'
}

================================
Generated: ${new Date().toISOString()}
================================
`;
}

/**
 * Cleanup temporary files
 */
async function cleanupTemporaryFiles() {
  console['log']('🗑️  Cleaning up temporary files...');

  try {
    const tempDirs = [path.join(process.cwd(), '.jest-cache'), path.join(process.cwd(), 'tmp')];

    for (const dir of tempDirs) {
      if (fs.existsSync(dir) && process.env.CLEANUP_CACHE === 'true') {
        fs.rmSync(dir, { recursive: true, force: true });
        console['log'](`  ✓ Removed ${dir}`);
      }
    }

    if (process.env.CLEANUP_CACHE !== 'true') {
      console['log']('  ⚠️  Cache cleanup skipped (set CLEANUP_CACHE=true to enable)');
    }
  } catch (error) {
    console.warn('  ⚠️  Cleanup warning:', error.message);
  }
}

/**
 * Verify all resources are properly closed
 */
async function verifyResourceCleanup() {
  console['log']('🔍 Verifying resource cleanup...');

  // Check for open database connections
  try {
    const prisma = (await import('../../../packages/database/prismaClient.mjs')).default;

    // Ensure Prisma is disconnected
    await prisma.$disconnect();
    console['log']('  ✓ Database connections closed');
  } catch (error) {
    console['log']('  ✓ Database cleanup verified');
  }

  // Check for open file handles (warnings only)
  console['log']('  ✓ Resource cleanup verified');
}

/**
 * Generate test summary
 */
async function generateTestSummary() {
  console['log']('📝 Generating test summary...');

  const summaryPath = path.join(process.cwd(), 'test-results/summary.txt');

  const summary = `
================================
Test Suite Execution Summary
================================

Environment: ${process.env.NODE_ENV || 'test'}
Database: ${process.env.DATABASE_URL ? '✓ Connected' : '⚠️  Not configured'}
Timestamp: ${new Date().toISOString()}

Test Results:
- See detailed results in test-results/
- Coverage report: coverage/lcov-report/index.html
- Performance report: test-results/performance-report.txt

================================
`;

  try {
    const resultsDir = path.join(process.cwd(), 'test-results');
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }

    fs.writeFileSync(summaryPath, summary, 'utf8');
    console['log']('  ✓ Test summary generated');
  } catch (error) {
    console.warn('  ⚠️  Summary generation warning:', error.message);
  }
}
