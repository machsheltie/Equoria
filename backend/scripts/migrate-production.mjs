#!/usr/bin/env node

import { fileURLToPath } from 'url';
import path from 'path';
import { execSync } from 'child_process';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Equoria-5z0if: ALL side-effects (env read, dotenv config, chdir, execSync of
// prisma migrate deploy) are inside main() and only run when this file is the
// entry point. On bare import the file produces NO side effects — no prisma
// generate, no migrate deploy against whatever DATABASE_URL is on the
// importer's env, no process.exit. Mirrors the db-reset-test.mjs hardening.
function main() {
  dotenv.config({ path: path.resolve(__dirname, '../.env') });

  const { DATABASE_URL } = process.env;

  if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is required');
    process.exit(1);
  }

  console.log('🔄 Starting production database migration...');

  try {
    const databaseDir = path.resolve(__dirname, '../../packages/database');
    process.chdir(databaseDir);

    console.log('📦 Generating Prisma client...');
    execSync('npx prisma generate --schema=prisma/schema.prisma', { stdio: 'inherit' });

    console.log('🗄️ Running production database migrations...');
    // Use prisma migrate deploy for production environments
    // This applies all pending migrations without prompting for confirmation
    execSync('npx prisma migrate deploy --schema=prisma/schema.prisma', {
      stdio: 'inherit',
    });

    console.log('✅ Production database migration completed successfully!');
  } catch (error) {
    console.error('❌ Production database migration failed:', error.message);
    process.exit(1);
  }
}

if (
  process.argv[1] &&
  import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`
) {
  main();
}
