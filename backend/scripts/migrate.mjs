#!/usr/bin/env node

import { fileURLToPath } from 'url';
import path from 'path';
import { execSync } from 'child_process';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Equoria-5z0if: ALL side-effects (env read, dotenv config, chdir, execSync of
// prisma migrate dev) are inside main() and only run when this file is the
// entry point. On bare import the file produces NO side effects.
function main() {
  dotenv.config({ path: path.resolve(__dirname, '../.env') });

  const { DATABASE_URL } = process.env;

  if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is required');
    process.exit(1);
  }

  console.log('🔄 Starting database migration...');

  // Pass CLI arg as migration name (optional)
  const migrationName = process.argv[2] || 'auto-migration';

  try {
    const databaseDir = path.resolve(__dirname, '../../packages/database');
    process.chdir(databaseDir);

    console.log('📦 Generating Prisma client...');
    execSync('npx prisma generate --schema=prisma/schema.prisma', { stdio: 'inherit' });

    console.log('🗄️ Running database migrations...');
    execSync(`npx prisma migrate dev --name ${migrationName} --schema=prisma/schema.prisma`, {
      stdio: 'inherit',
    });

    console.log('✅ Database migration completed successfully!');
  } catch (error) {
    console.error('❌ Database migration failed:', error.message);
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`) {
  main();
}
