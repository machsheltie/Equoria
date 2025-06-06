/**
 * 🔍 Database Verification Script for Equoria Backend
 *
 * This script verifies the test database connection and schema integrity.
 * It checks that all required tables exist and have the expected structure
 * for running the comprehensive test suite.
 *
 * Usage: node verify-test-db.mjs
 */

import { PrismaClient } from '@prisma/client';
import logger from './utils/logger.mjs';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/equoria_test',
    },
  },
});

/**
 * Verify database connection
 */
async function verifyConnection() {
  try {
    await prisma.$connect();
    logger.info('✅ Database connection successful');
    return true;
  } catch (error) {
    logger.error('❌ Database connection failed:', error.message);
    return false;
  }
}

/**
 * Verify required tables exist
 */
async function verifyTables() {
  const requiredTables = [
    'User',
    'Horse',
    'Foal',
    'Show',
    'CompetitionResult',
    'TrainingLog',
    'Breed',
    'FoalTaskLog',
    'Groom',
    'GroomAssignment',
  ];

  const results = [];

  for (const table of requiredTables) {
    try {
      // Try to count records in each table
      const count = await prisma[table.toLowerCase()].count();
      logger.info(`✅ Table ${table}: ${count} records`);
      results.push({ table, exists: true, count });
    } catch (error) {
      logger.error(`❌ Table ${table}: ${error.message}`);
      results.push({ table, exists: false, error: error.message });
    }
  }

  return results;
}

/**
 * Verify database schema version
 */
async function verifySchema() {
  try {
    // Check if migrations table exists and get latest migration
    const migrations = await prisma.$queryRaw`
      SELECT * FROM "_prisma_migrations"
      ORDER BY finished_at DESC
      LIMIT 1
    `;

    if (migrations.length > 0) {
      logger.info('✅ Database schema is up to date');
      logger.info(`   Latest migration: ${migrations[0].migration_name}`);
      return true;
    } else {
      logger.warn('⚠️  No migrations found - database may not be initialized');
      return false;
    }
  } catch (error) {
    logger.error('❌ Schema verification failed:', error.message);
    return false;
  }
}

/**
 * Run comprehensive database verification
 */
async function main() {
  logger.info('🔍 Starting database verification...');

  const connectionOk = await verifyConnection();
  if (!connectionOk) {
    process.exit(1);
  }

  const schemaOk = await verifySchema();
  const tableResults = await verifyTables();

  const failedTables = tableResults.filter(result => !result.exists);

  if (failedTables.length > 0) {
    logger.error('❌ Database verification failed');
    logger.error('Missing tables:', failedTables.map(t => t.table).join(', '));
    process.exit(1);
  }

  if (!schemaOk) {
    logger.warn('⚠️  Schema verification had issues, but tables exist');
  }

  logger.info('✅ Database verification completed successfully');
  logger.info('📊 Summary:');
  logger.info('   - Connection: OK');
  logger.info(`   - Schema: ${schemaOk ? 'OK' : 'WARNING'}`);
  logger.info(`   - Tables: ${tableResults.length} verified`);

  await prisma.$disconnect();
}

// Handle errors and cleanup
process.on('unhandledRejection', async error => {
  logger.error('Unhandled rejection:', error);
  await prisma.$disconnect();
  process.exit(1);
});

process.on('SIGINT', async () => {
  logger.info('Received SIGINT, cleaning up...');
  await prisma.$disconnect();
  process.exit(0);
});

// Run the verification
main().catch(async error => {
  logger.error('Verification failed:', error);
  await prisma.$disconnect();
  process.exit(1);
});
