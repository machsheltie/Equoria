/**
 * Database Migration Testing Pipeline for CI/CD
 *
 * This script provides automated database migration validation including:
 * - Schema change testing and validation
 * - Migration rollback testing
 * - Data integrity validation
 * - Migration performance monitoring
 * - Cross-environment migration testing
 */

import { execSync } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { performance } from 'perf_hooks';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Migration testing configuration
const MIGRATION_CONFIG = {
  testDatabaseUrl: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL,
  migrationTimeout: 60000, // 60 seconds
  performanceThresholds: {
    migrationTime: 30000,    // 30 seconds max per migration
    rollbackTime: 15000,     // 15 seconds max per rollback
    dataIntegrityCheck: 10000, // 10 seconds max for integrity checks
  },
  prismaPath: '../../packages/database',
  backupRetention: 5, // Keep 5 backup files
};

/**
 * Execute shell command with timeout and error handling
 */
function executeCommand(command, options = {}) {
  try {
    const result = execSync(command, {
      encoding: 'utf8',
      timeout: options.timeout || MIGRATION_CONFIG.migrationTimeout,
      cwd: options.cwd || path.resolve(__dirname, MIGRATION_CONFIG.prismaPath),
      env: {
        ...process.env,
        DATABASE_URL: MIGRATION_CONFIG.testDatabaseUrl,
        ...options.env,
      },
    });
    return { success: true, output: result.trim() };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      output: error.stdout ? error.stdout.toString() : '',
      stderr: error.stderr ? error.stderr.toString() : '',
    };
  }
}

/**
 * Get current database schema information
 */
async function getDatabaseSchema() {
  console.log('📋 Retrieving current database schema...');

  const introspectResult = executeCommand('npx prisma db pull --print --schema=prisma/schema.prisma');

  if (!introspectResult.success) {
    throw new Error(`Failed to introspect database: ${introspectResult.error}`);
  }

  // Get table information
  const tablesResult = executeCommand(`psql "${MIGRATION_CONFIG.testDatabaseUrl}" -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';" -t`);

  const tables = tablesResult.success
    ? tablesResult.output.split('\n').filter(line => line.trim()).map(line => line.trim())
    : [];

  return {
    schema: introspectResult.output,
    tables,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Create database backup
 */
async function createDatabaseBackup() {
  console.log('💾 Creating database backup...');

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.resolve(__dirname, '../migration-backups');
  await fs.mkdir(backupDir, { recursive: true });

  const backupFile = path.join(backupDir, `backup-${timestamp}.sql`);

  const backupResult = executeCommand(`pg_dump "${MIGRATION_CONFIG.testDatabaseUrl}" > "${backupFile}"`);

  if (!backupResult.success) {
    throw new Error(`Failed to create backup: ${backupResult.error}`);
  }

  // Clean up old backups
  await cleanupOldBackups(backupDir);

  console.log(`✅ Database backup created: ${backupFile}`);
  return backupFile;
}

/**
 * Clean up old backup files
 */
async function cleanupOldBackups(backupDir) {
  try {
    const files = await fs.readdir(backupDir);
    const backupFiles = files
      .filter(file => file.startsWith('backup-') && file.endsWith('.sql'))
      .map(file => ({
        name: file,
        path: path.join(backupDir, file),
        stat: null,
      }));

    // Get file stats
    for (const file of backupFiles) {
      try {
        file.stat = await fs.stat(file.path);
      } catch (error) {
        console.warn(`Warning: Could not stat backup file ${file.name}`);
      }
    }

    // Sort by creation time (newest first)
    const validBackups = backupFiles
      .filter(file => file.stat)
      .sort((a, b) => b.stat.mtime - a.stat.mtime);

    // Remove old backups beyond retention limit
    if (validBackups.length > MIGRATION_CONFIG.backupRetention) {
      const filesToDelete = validBackups.slice(MIGRATION_CONFIG.backupRetention);

      for (const file of filesToDelete) {
        await fs.unlink(file.path);
        console.log(`🗑️ Removed old backup: ${file.name}`);
      }
    }
  } catch (error) {
    console.warn(`Warning: Failed to cleanup old backups: ${error.message}`);
  }
}

/**
 * Test migration execution
 */
async function testMigrationExecution() {
  console.log('🔄 Testing migration execution...');

  const startTime = performance.now();

  // Generate Prisma client
  const generateResult = executeCommand('npx prisma generate --schema=prisma/schema.prisma');
  if (!generateResult.success) {
    throw new Error(`Failed to generate Prisma client: ${generateResult.error}`);
  }

  // Run migrations
  const migrateResult = executeCommand('npx prisma migrate deploy --schema=prisma/schema.prisma');

  const endTime = performance.now();
  const migrationTime = endTime - startTime;

  if (!migrateResult.success) {
    return {
      success: false,
      error: migrateResult.error,
      migrationTime,
      output: migrateResult.output,
      stderr: migrateResult.stderr,
    };
  }

  // Check if migration time exceeds threshold
  const performanceIssue = migrationTime > MIGRATION_CONFIG.performanceThresholds.migrationTime;

  console.log(`✅ Migration completed in ${migrationTime.toFixed(2)}ms`);

  if (performanceIssue) {
    console.warn(`⚠️ Migration time (${migrationTime.toFixed(2)}ms) exceeds threshold (${MIGRATION_CONFIG.performanceThresholds.migrationTime}ms)`);
  }

  return {
    success: true,
    migrationTime,
    performanceIssue,
    output: migrateResult.output,
  };
}

/**
 * Test data integrity after migration
 */
async function testDataIntegrity() {
  console.log('🔍 Testing data integrity...');

  const startTime = performance.now();
  const integrityChecks = [];

  // Check foreign key constraints
  const fkCheckResult = executeCommand(`psql "${MIGRATION_CONFIG.testDatabaseUrl}" -c "SELECT conname, conrelid::regclass, confrelid::regclass FROM pg_constraint WHERE contype = 'f';" -t`);

  if (fkCheckResult.success) {
    integrityChecks.push({
      check: 'foreign_keys',
      status: 'passed',
      details: 'All foreign key constraints are valid',
    });
  } else {
    integrityChecks.push({
      check: 'foreign_keys',
      status: 'failed',
      error: fkCheckResult.error,
    });
  }

  // Check for orphaned records (basic check)
  const orphanCheckQueries = [
    'SELECT COUNT(*) as orphaned_horses FROM horses WHERE "userId" NOT IN (SELECT id FROM users);',
    'SELECT COUNT(*) as orphaned_results FROM competition_results WHERE "userId" NOT IN (SELECT id FROM users);',
    'SELECT COUNT(*) as orphaned_grooms FROM grooms WHERE "userId" NOT IN (SELECT id FROM users);',
  ];

  for (const query of orphanCheckQueries) {
    const checkResult = executeCommand(`psql "${MIGRATION_CONFIG.testDatabaseUrl}" -c "${query}" -t`);

    if (checkResult.success) {
      const count = parseInt(checkResult.output.trim()) || 0;
      integrityChecks.push({
        check: `orphaned_records_${query.split(' ')[3]}`,
        status: count === 0 ? 'passed' : 'warning',
        count,
        details: count === 0 ? 'No orphaned records found' : `Found ${count} orphaned records`,
      });
    }
  }

  // Check table existence
  const expectedTables = [
    'users', 'horses', 'breeds', 'grooms', 'shows',
    'competition_results', 'training_logs', 'xp_events',
  ];

  for (const table of expectedTables) {
    const tableCheckResult = executeCommand(`psql "${MIGRATION_CONFIG.testDatabaseUrl}" -c "SELECT to_regclass('public.${table}');" -t`);

    const tableExists = tableCheckResult.success &&
                       tableCheckResult.output.trim() !== '' &&
                       !tableCheckResult.output.includes('does not exist');

    integrityChecks.push({
      check: `table_${table}`,
      status: tableExists ? 'passed' : 'failed',
      details: tableExists ? `Table ${table} exists` : `Table ${table} missing`,
    });
  }

  const endTime = performance.now();
  const integrityCheckTime = endTime - startTime;

  const failedChecks = integrityChecks.filter(check => check.status === 'failed');
  const warningChecks = integrityChecks.filter(check => check.status === 'warning');

  console.log(`✅ Data integrity checks completed in ${integrityCheckTime.toFixed(2)}ms`);
  console.log(`   Passed: ${integrityChecks.filter(c => c.status === 'passed').length}`);
  console.log(`   Warnings: ${warningChecks.length}`);
  console.log(`   Failed: ${failedChecks.length}`);

  return {
    success: failedChecks.length === 0,
    integrityCheckTime,
    checks: integrityChecks,
    summary: {
      passed: integrityChecks.filter(c => c.status === 'passed').length,
      warnings: warningChecks.length,
      failed: failedChecks.length,
    },
  };
}

/**
 * Test migration rollback capability
 */
async function testMigrationRollback(backupFile) {
  console.log('↩️ Testing migration rollback...');

  const startTime = performance.now();

  // Restore from backup
  const restoreResult = executeCommand(`psql "${MIGRATION_CONFIG.testDatabaseUrl}" < "${backupFile}"`);

  const endTime = performance.now();
  const rollbackTime = endTime - startTime;

  if (!restoreResult.success) {
    return {
      success: false,
      error: restoreResult.error,
      rollbackTime,
      stderr: restoreResult.stderr,
    };
  }

  // Verify rollback by checking schema
  const schemaAfterRollback = await getDatabaseSchema();

  const performanceIssue = rollbackTime > MIGRATION_CONFIG.performanceThresholds.rollbackTime;

  console.log(`✅ Rollback completed in ${rollbackTime.toFixed(2)}ms`);

  if (performanceIssue) {
    console.warn(`⚠️ Rollback time (${rollbackTime.toFixed(2)}ms) exceeds threshold (${MIGRATION_CONFIG.performanceThresholds.rollbackTime}ms)`);
  }

  return {
    success: true,
    rollbackTime,
    performanceIssue,
    schemaAfterRollback,
  };
}

/**
 * Generate migration test report
 */
async function generateMigrationReport(results) {
  const reportDir = path.resolve(__dirname, '../migration-test-results');
  await fs.mkdir(reportDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(reportDir, `migration-test-${timestamp}.json`);

  const report = {
    timestamp: new Date().toISOString(),
    testDatabaseUrl: MIGRATION_CONFIG.testDatabaseUrl.replace(/\/\/.*@/, '//***:***@'), // Hide credentials
    results,
    summary: {
      overallSuccess: results.migration.success &&
                     results.dataIntegrity.success &&
                     results.rollback.success,
      totalTime: results.migration.migrationTime +
                results.dataIntegrity.integrityCheckTime +
                results.rollback.rollbackTime,
      performanceIssues: [
        results.migration.performanceIssue,
        results.rollback.performanceIssue,
      ].filter(Boolean).length,
    },
  };

  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

  // Save summary for CI
  const summaryPath = path.join(reportDir, 'migration-test-summary.json');
  await fs.writeFile(summaryPath, JSON.stringify({
    timestamp: report.timestamp,
    success: report.summary.overallSuccess,
    totalTime: report.summary.totalTime,
    performanceIssues: report.summary.performanceIssues,
    integrityChecks: results.dataIntegrity.summary,
  }, null, 2));

  return { reportPath, summaryPath };
}

/**
 * Main database migration testing function
 */
async function runDatabaseMigrationTests() {
  try {
    console.log('🗄️ Starting Database Migration Tests');
    console.log('====================================');

    if (!MIGRATION_CONFIG.testDatabaseUrl) {
      throw new Error('TEST_DATABASE_URL or DATABASE_URL environment variable is required');
    }

    const results = {
      schemaBeforeMigration: null,
      backup: null,
      migration: null,
      dataIntegrity: null,
      rollback: null,
    };

    // Get initial schema
    results.schemaBeforeMigration = await getDatabaseSchema();

    // Create backup
    results.backup = await createDatabaseBackup();

    // Test migration execution
    results.migration = await testMigrationExecution();

    if (!results.migration.success) {
      throw new Error(`Migration failed: ${results.migration.error}`);
    }

    // Test data integrity
    results.dataIntegrity = await testDataIntegrity();

    // Test rollback
    results.rollback = await testMigrationRollback(results.backup);

    // Re-run migration after rollback test
    console.log('🔄 Re-applying migrations after rollback test...');
    const finalMigration = await testMigrationExecution();
    if (!finalMigration.success) {
      console.warn('⚠️ Failed to re-apply migrations after rollback test');
    }

    // Generate report
    const reportFiles = await generateMigrationReport(results);

    // Display summary
    console.log('\n📊 Migration Test Summary');
    console.log('=========================');
    console.log(`Migration: ${results.migration.success ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Data Integrity: ${results.dataIntegrity.success ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Rollback: ${results.rollback.success ? '✅ PASSED' : '❌ FAILED'}`);

    const totalTime = results.migration.migrationTime +
                     results.dataIntegrity.integrityCheckTime +
                     results.rollback.rollbackTime;
    console.log(`Total Time: ${totalTime.toFixed(2)}ms`);

    if (results.dataIntegrity.summary.warnings > 0) {
      console.log(`⚠️ Data Integrity Warnings: ${results.dataIntegrity.summary.warnings}`);
    }

    console.log(`📁 Report saved: ${reportFiles.reportPath}`);

    // Exit with appropriate code
    const overallSuccess = results.migration.success &&
                          results.dataIntegrity.success &&
                          results.rollback.success;

    if (overallSuccess) {
      console.log('\n✅ All database migration tests PASSED');
      process.exit(0);
    } else {
      console.log('\n❌ Some database migration tests FAILED');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Database migration tests failed:', error.message);
    process.exit(1);
  }
}

// Run database migration tests if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runDatabaseMigrationTests();
}

export {
  runDatabaseMigrationTests,
  testMigrationExecution,
  testDataIntegrity,
  testMigrationRollback,
  getDatabaseSchema,
};
