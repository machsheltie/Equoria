/**
 * populateBreedsFromSql.mjs
 *
 * Reads all 310 breed SQL files from docs/BreedData/ and executes them
 * against the database via Prisma $executeRawUnsafe.
 *
 * Each .txt file is an idempotent INSERT ... ON CONFLICT (name) DO UPDATE
 * statement containing the full breed genetic profile (JSONB).
 *
 * Sanitization performed before execution:
 *   - breed_genetic_profile  →  "breedGeneticProfile"  (actual column name)
 *   - default_trait          →  "defaultTrait"          (actual column name)
 *   - updated_at = NOW()     →  removed (column does not exist)
 *
 * Skipped files: seed.sql, populate_breed_ratings.sql,
 *                populate_breed_temperaments.sql
 * (these are legacy update scripts superseded by the individual .txt files)
 *
 * Usage:
 *   node backend/seed/populateBreedsFromSql.mjs
 *   npm run seed:breeds  (from backend/)
 */

import { readdir, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Resolve path relative to project root (two levels up from backend/seed/)
const BREED_DATA_DIR = join(__dirname, '..', '..', 'docs', 'BreedData');

// Non-breed SQL files to skip
const SKIP_FILES = new Set([
  'seed.sql',
  'populate_breed_ratings.sql',
  'populate_breed_temperaments.sql',
]);

/**
 * Sanitize a raw SQL string from the breed data files.
 *
 * The files reference snake_case column names and an updated_at column that
 * do not match the current Prisma schema. This function normalises them.
 *
 * @param {string} sql - Raw SQL from a .txt breed file
 * @returns {string} - Sanitized SQL ready for execution
 */
export function sanitizeSql(sql) {
  return (
    sql
      // Rename snake_case columns to match Prisma-generated camelCase columns
      .replace(/\bbreed_genetic_profile\b/g, '"breedGeneticProfile"')
      .replace(/\bdefault_trait\b/g, '"defaultTrait"')
      // Remove trailing updated_at assignment from ON CONFLICT DO UPDATE SET
      // Handles both:  ,\n  updated_at = NOW()   and   , updated_at = NOW()
      .replace(/,\s*updated_at\s*=\s*NOW\(\)/gi, '')
  );
}

/**
 * Populate the breeds table from all .txt files in docs/BreedData/.
 *
 * Runs each file as an idempotent upsert. Already-existing breeds are updated;
 * new breeds are inserted.  Errors in individual files are collected and
 * returned rather than aborting the whole run.
 *
 * @param {object} [prismaClient] - Optional Prisma client (injected for testing)
 * @returns {Promise<{processed: number, skipped: number, errors: Array, totalBreeds: number, success: boolean}>}
 */
export async function populateBreedsFromSql(prismaClient) {
  // Allow dependency injection for testing; fall back to real client
  let prisma = prismaClient;
  let ownPrisma = false;

  if (!prisma) {
    const { default: defaultPrisma } = await import('../../packages/database/prismaClient.mjs');
    prisma = defaultPrisma;
    ownPrisma = true;
  }

  const errors = [];
  let processed = 0;
  let skipped = 0;

  try {
    const allFiles = await readdir(BREED_DATA_DIR);

    const breedFiles = allFiles.filter(f => f.endsWith('.txt')).sort();

    for (const file of breedFiles) {
      if (SKIP_FILES.has(file)) {
        skipped++;
        continue;
      }

      const filePath = join(BREED_DATA_DIR, file);

      try {
        const rawSql = await readFile(filePath, 'utf8');
        const sql = sanitizeSql(rawSql);
        await prisma.$executeRawUnsafe(sql);
        processed++;
      } catch (err) {
        errors.push({ file, error: err.message });
      }
    }

    const totalBreeds = await prisma.breed.count();

    return {
      processed,
      skipped,
      errors,
      totalBreeds,
      success: errors.length === 0,
    };
  } finally {
    if (ownPrisma) {
      await prisma.$disconnect();
    }
  }
}

// Allow running directly as a script
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  populateBreedsFromSql()
    .then(result => {
      console.log('✅ Breed population complete');
      console.log(`   Processed : ${result.processed}`);
      console.log(`   Skipped   : ${result.skipped}`);
      console.log(`   Total rows: ${result.totalBreeds}`);
      if (result.errors.length > 0) {
        console.error(`   Errors (${result.errors.length}):`);
        result.errors.forEach(e => console.error(`     ${e.file}: ${e.error}`));
        process.exit(1);
      }
    })
    .catch(err => {
      console.error('Fatal error:', err);
      process.exit(1);
    });
}
