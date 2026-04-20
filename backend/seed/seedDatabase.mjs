/**
 * seedDatabase.mjs — minimal idempotent test-database seed.
 *
 * Invoked by `npm run seed` / `npm run seed:test` (see backend/package.json).
 * Purpose: after `prisma migrate deploy`, ensure the database has the breed
 * rows that integration + E2E tests depend on, and nothing else. Tests
 * create their own users/horses/etc. in beforeEach hooks, so we deliberately
 * do NOT seed any per-user data here.
 *
 * Idempotent — re-running is safe. Exits 0 on success, non-zero on failure.
 */

import prisma from '../db/index.mjs';
import logger from '../utils/logger.mjs';

const MINIMUM_BREEDS = [
  { name: 'Thoroughbred', description: 'Athletic and versatile racing breed' },
  { name: 'Arabian', description: 'Ancient breed prized for endurance and refinement' },
  { name: 'American Quarter Horse', description: 'Compact, muscular sprint breed' },
  { name: 'Friesian', description: 'Dramatic black heavy breed with feathered legs' },
  { name: 'Andalusian', description: 'Baroque sport breed prized for collection' },
];

async function seedBreeds() {
  let created = 0;
  let skipped = 0;
  for (const breed of MINIMUM_BREEDS) {
    const existing = await prisma.breed.findUnique({ where: { name: breed.name } });
    if (existing) {
      skipped += 1;
      continue;
    }
    await prisma.breed.create({ data: breed });
    created += 1;
  }
  return { created, skipped };
}

async function main() {
  logger.info('[seedDatabase] Starting test-database seed');
  try {
    // Verify DB connectivity up front so a connection failure surfaces here
    // rather than mid-way through the seed.
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    logger.error('[seedDatabase] Database connection failed:', error);
    throw error;
  }

  const { created, skipped } = await seedBreeds();
  logger.info(
    `[seedDatabase] Breeds seeded: ${created} created, ${skipped} already present (${MINIMUM_BREEDS.length} canonical)`,
  );
  logger.info('[seedDatabase] Seed complete');
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async error => {
    logger.error('[seedDatabase] Fatal:', error);
    await prisma.$disconnect().catch(() => {});
    process.exit(1);
  });
