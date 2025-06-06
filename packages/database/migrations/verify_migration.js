#!/usr/bin/env node

/**
 * Migration Verification Script
 * Verifies that the horse bonding and foal training history migration was applied successfully
 * Usage: node packages/database/migrations/verify_migration.js
 */

import { PrismaClient } from '@prisma/client';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Prisma client
const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

/**
 * Check if a column exists in a table
 */
async function checkColumnExists(tableName, columnName) {
  try {
    const result = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = ${tableName} AND column_name = ${columnName}
      ) as exists
    `;
    return result[0]?.exists || false;
  } catch (error) {
    console.error(
      `❌ Error checking column ${tableName}.${columnName}:`,
      error.message
    );
    return false;
  }
}

/**
 * Check if a table exists
 */
async function checkTableExists(tableName) {
  try {
    const result = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = ${tableName}
      ) as exists
    `;
    return result[0]?.exists || false;
  } catch (error) {
    console.error(`❌ Error checking table ${tableName}:`, error.message);
    return false;
  }
}

/**
 * Check if indexes exist
 */
async function checkIndexes(tableName) {
  try {
    const result = await prisma.$queryRaw`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = ${tableName}
      ORDER BY indexname
    `;
    return result.map((row) => row.indexname);
  } catch (error) {
    console.error(`❌ Error checking indexes for ${tableName}:`, error.message);
    return [];
  }
}

/**
 * Test database connection
 */
async function testConnection() {
  try {
    console.log('🔍 Testing database connection...');
    await prisma.$connect();
    console.log('✅ Database connection successful');
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.error('💡 Check your DATABASE_URL environment variable');
    return false;
  }
}

/**
 * Verify Horse table columns
 */
async function verifyHorseColumns() {
  console.log('\n📋 Verifying Horse table columns...');

  const bondScoreExists = await checkColumnExists('Horse', 'bond_score');
  const stressLevelExists = await checkColumnExists('Horse', 'stress_level');

  console.log(`   bond_score column: ${bondScoreExists ? '✅' : '❌'}`);
  console.log(`   stress_level column: ${stressLevelExists ? '✅' : '❌'}`);

  return bondScoreExists && stressLevelExists;
}

/**
 * Verify foal_training_history table
 */
async function verifyFoalTrainingHistoryTable() {
  console.log('\n📋 Verifying foal_training_history table...');

  const tableExists = await checkTableExists('foal_training_history');
  console.log(`   Table exists: ${tableExists ? '✅' : '❌'}`);

  if (!tableExists) {
    return false;
  }

  // Check required columns
  const requiredColumns = [
    'id',
    'horse_id',
    'day',
    'activity',
    'outcome',
    'bond_change',
    'stress_change',
    'timestamp',
  ];
  let allColumnsExist = true;

  for (const column of requiredColumns) {
    const exists = await checkColumnExists('foal_training_history', column);
    console.log(`   ${column} column: ${exists ? '✅' : '❌'}`);
    if (!exists) allColumnsExist = false;
  }

  return allColumnsExist;
}

/**
 * Verify indexes
 */
async function verifyIndexes() {
  console.log('\n📋 Verifying indexes...');

  const indexes = await checkIndexes('foal_training_history');
  const expectedIndexes = [
    'foal_training_history_pkey',
    'foal_training_history_horse_id_idx',
    'foal_training_history_day_idx',
    'foal_training_history_timestamp_idx',
    'foal_training_history_horse_id_day_idx',
  ];

  let allIndexesExist = true;
  for (const expectedIndex of expectedIndexes) {
    const exists = indexes.includes(expectedIndex);
    console.log(`   ${expectedIndex}: ${exists ? '✅' : '❌'}`);
    if (!exists) allIndexesExist = false;
  }

  return allIndexesExist;
}

/**
 * Test basic operations
 */
async function testBasicOperations() {
  console.log('\n🧪 Testing basic operations...');

  try {
    // Test reading horses
    const horseCount = await prisma.horse.count();
    console.log(`   ✅ Can read horses (found ${horseCount} horses)`);

    // Test reading foal training history
    const historyCount = await prisma.foalTrainingHistory.count();
    console.log(
      `   ✅ Can read foal training history (found ${historyCount} records)`
    );

    // Test if we can query horses with new fields
    const horsesWithBonding = await prisma.horse.findMany({
      select: {
        id: true,
        name: true,
        bond_score: true,
        stress_level: true,
      },
      take: 1,
    });

    if (horsesWithBonding.length > 0) {
      const horse = horsesWithBonding[0];
      console.log(
        `   ✅ Can query new fields (horse "${horse.name}": bond=${horse.bond_score}, stress=${horse.stress_level})`
      );
    } else {
      console.log(`   ⚠️  No horses found to test new fields`);
    }

    return true;
  } catch (error) {
    console.error('   ❌ Basic operations failed:', error.message);
    return false;
  }
}

/**
 * Check migration status in Prisma
 */
async function checkMigrationStatus() {
  console.log('\n📋 Checking Prisma migration status...');

  try {
    const result = await prisma.$queryRaw`
      SELECT migration_name, finished_at 
      FROM "_prisma_migrations" 
      WHERE migration_name LIKE '%horse_bonding%'
      ORDER BY finished_at DESC
    `;

    if (result.length > 0) {
      const migration = result[0];
      console.log(`   ✅ Migration found: ${migration.migration_name}`);
      console.log(`   ✅ Applied at: ${migration.finished_at}`);
      return true;
    } else {
      console.log(
        `   ❌ No horse bonding migration found in _prisma_migrations table`
      );
      return false;
    }
  } catch (error) {
    console.error('   ❌ Error checking migration status:', error.message);
    return false;
  }
}

/**
 * Main verification function
 */
async function main() {
  console.log('🚀 Starting Migration Verification');
  console.log('=====================================');

  let allChecksPass = true;

  // Test database connection
  const connectionOk = await testConnection();
  if (!connectionOk) {
    console.log('\n❌ VERIFICATION FAILED: Cannot connect to database');
    process.exit(1);
  }

  // Check migration status
  const migrationOk = await checkMigrationStatus();
  if (!migrationOk) allChecksPass = false;

  // Verify Horse table columns
  const horseColumnsOk = await verifyHorseColumns();
  if (!horseColumnsOk) allChecksPass = false;

  // Verify foal_training_history table
  const tableOk = await verifyFoalTrainingHistoryTable();
  if (!tableOk) allChecksPass = false;

  // Verify indexes
  const indexesOk = await verifyIndexes();
  if (!indexesOk) allChecksPass = false;

  // Test basic operations
  const operationsOk = await testBasicOperations();
  if (!operationsOk) allChecksPass = false;

  // Final result
  console.log('\n=====================================');
  if (allChecksPass) {
    console.log('🎉 VERIFICATION SUCCESSFUL!');
    console.log('✅ All migration components are working correctly');
  } else {
    console.log('❌ VERIFICATION FAILED!');
    console.log('⚠️  Some migration components are missing or not working');
  }

  console.log('\n💡 Troubleshooting tips:');
  console.log(
    '   - If connection fails: Check DATABASE_URL environment variable'
  );
  console.log('   - If migration not found: Run "npx prisma migrate dev"');
  console.log('   - If columns missing: Run the manual migration script');
  console.log(
    '   - If operations fail: Check Prisma client generation with "npx prisma generate"'
  );

  await prisma.$disconnect();
  process.exit(allChecksPass ? 0 : 1);
}

// Handle errors
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled rejection:', error);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught exception:', error);
  process.exit(1);
});

// Run the verification
main().catch((error) => {
  console.error('❌ Verification script failed:', error);
  process.exit(1);
});
