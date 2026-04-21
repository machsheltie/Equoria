/**
 * Jest Global Setup
 *
 * Cleans up known hardcoded test data from previous failed runs before
 * the test suite starts. This prevents unique constraint failures when
 * test afterAll hooks didn't run due to earlier test failures.
 *
 * Only removes rows by exact names/emails known to be test-only data.
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default async function globalSetup() {
  console.log('🧹 Running global setup — cleaning leftover test data...');

  try {
    // Do NOT override — env vars set by CI (or the harness) must take
    // precedence over the committed .env.test defaults. Overriding here
    // broke the CI HttpOnly Cookie job: the workflow passes DATABASE_URL=
    // postgresql://postgres:postgres@localhost for the postgres service
    // container, but .env.test contains a dev password that doesn't match,
    // so Prisma auth failed. Local dev still reads .env.test because the
    // shell typically doesn't pre-set DATABASE_URL.
    dotenv.config({
      path: path.join(__dirname, '..', '.env.test'),
    });

    const { default: prisma } = await import('../../packages/database/prismaClient.mjs');

    // Remove hardcoded test horses by name (collected from all test suites)
    const testHorseNames = [
      'OWASP Test Horse',
      'Analytics Test Horse',
      'Fearful Horse',
      'Confident Horse',
      'Developing Horse',
      'Population Horse 1',
      'Population Horse 2',
      'Progress Test Horse',
      'Stolen Horse',
      'Consistency Test Horse',
      'Cross System Test Horse',
      'Genetic Test Mare',
      'Genetic Test Stallion',
      'Global Test Horse',
      'Other Horse',
      'Trait Test Foal',
      'Competition Integration Champion',
      'TestHorse Nova',
      'Other User Horse',
    ];
    await prisma.horse.deleteMany({ where: { name: { in: testHorseNames } } });

    // Remove hardcoded test users by email or username
    const testEmails = ['ratelimit@example.com', 'memory@test.com'];
    await prisma.user.deleteMany({ where: { email: { in: testEmails } } });

    const testUsernames = ['progresstest', 'testuser123'];
    await prisma.user.deleteMany({ where: { username: { in: testUsernames } } });

    await prisma.$disconnect();
    console.log('✅ Global setup: leftover test data cleaned');
  } catch (error) {
    // Non-fatal — tests may still pass if data doesn't exist
    console.warn('⚠️  Global setup cleanup warning:', error.message);
  }
}
