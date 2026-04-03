/**
 * repairBreedIds.mjs — Repairs NULL breedId on horses caused by the
 * 20260401000000_add_breed_default_trait migration.
 *
 * Root cause: That migration ran `DELETE FROM "breeds" WHERE id NOT IN (SELECT MIN(id)...)`
 * to remove duplicate breed rows. Because the FK is ON DELETE SET NULL, any horse
 * referencing a deleted duplicate breed had its breedId silently set to NULL.
 *
 * This script re-links horses to the correct (surviving) breed record using the
 * horse name → breed name mapping from the original seed data.
 *
 * Usage: node backend/seed/repairBreedIds.mjs
 */

import { PrismaClient } from '../../packages/database/node_modules/@prisma/client/index.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env') });

const prisma = new PrismaClient();

// Horse name → expected breed name mapping from seedDevData.mjs
const HORSE_BREED_MAP = {
  'Midnight Star': 'Thoroughbred',
  'Golden Thunder': 'Arabian',
  'Silver Mist': 'American Saddlebred',
  Eclipse: 'Lusitano',
  'Copper Rose': 'Andalusian',
  'Storm Chaser': 'Paint Horse',
  'Daisy Belle': 'Appaloosa',
  'Lucky Clover': 'American Quarter Horse',
};

async function repairBreedIds() {
  console.log('🔧 Starting breed ID repair...\n');

  // Build breed name → id map from surviving breed records
  const allBreeds = await prisma.breed.findMany({ select: { id: true, name: true } });
  const breedMap = {};
  for (const b of allBreeds) {
    breedMap[b.name] = b.id;
  }
  console.log(`Found ${allBreeds.length} breeds in database:`);
  allBreeds.forEach(b => console.log(`  ID ${b.id}: ${b.name}`));
  console.log();

  let fixed = 0;
  let alreadyOk = 0;
  let notFound = 0;

  for (const [horseName, expectedBreedName] of Object.entries(HORSE_BREED_MAP)) {
    const breedId = breedMap[expectedBreedName];
    if (!breedId) {
      console.warn(`  ⚠️  Breed "${expectedBreedName}" not found in DB — skipping ${horseName}`);
      notFound++;
      continue;
    }

    // Find ALL horses with this name (there could be multiple if re-seeded)
    const horses = await prisma.horse.findMany({
      where: { name: horseName },
      select: { id: true, name: true, breedId: true },
    });

    if (horses.length === 0) {
      console.log(`  ℹ️  Horse "${horseName}" not found in DB — skipping`);
      continue;
    }

    for (const horse of horses) {
      if (horse.breedId === breedId) {
        console.log(`  ✓  ${horseName} (ID ${horse.id}) already linked to ${expectedBreedName}`);
        alreadyOk++;
        continue;
      }

      // Repair: set the correct breedId
      await prisma.horse.update({
        where: { id: horse.id },
        data: { breedId },
      });

      const oldBreed = horse.breedId === null ? 'NULL' : `ID ${horse.breedId}`;
      console.log(
        `  ✅ Fixed ${horseName} (ID ${horse.id}): breedId ${oldBreed} → ${breedId} (${expectedBreedName})`,
      );
      fixed++;
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   Fixed:      ${fixed}`);
  console.log(`   Already OK: ${alreadyOk}`);
  console.log(`   Skipped:    ${notFound} (missing breed in DB)`);

  if (fixed > 0) {
    console.log('\n✅ Repair complete. Re-run the dev server and refresh My Stable.');
  } else if (alreadyOk > 0) {
    console.log('\nℹ️  All horses were already correctly linked. No changes made.');
  }
}

repairBreedIds()
  .catch(err => {
    console.error('❌ Repair failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
