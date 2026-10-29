import { generateMockShows } from '../utils/generateMockShows.mjs';
// The shared client (as seedDevData.mjs uses): @prisma/client does not resolve from backend/.
import prisma from '../../packages/database/prismaClient.mjs';
import { creditSystemAccount } from '../modules/economy/index.mjs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '../../.env');
dotenv.config({ path: envPath });

/**
 * Check if a show with the given name already exists
 * @param {string} name - Show name to check
 * @returns {boolean} - True if show exists, false otherwise
 */
async function checkShowExists(name) {
  try {
    const existingShow = await prisma.show.findFirst({
      where: { name },
    });
    return !!existingShow;
  } catch (error) {
    console.warn(`Warning: Could not check if show exists: ${error.message}`);
    return false;
  }
}

/**
 * Create a show in the database, funded like a hosted show (Equoria-law5w).
 *
 * A show pays prizes only from its escrow (owner ruling q52), so a seeded show
 * holds its prize the way createShow does: the prize is 10x the entry fee
 * (owner ruling 2026-10-23) and SystemAccount[showEscrow] is credited by it in
 * the same transaction that writes Show.prizeEscrow. A seed has no host to
 * debit, so the prize enters the economy here instead of at payout.
 *
 * @param {Object} showData - Show data object; any `prize` it carries is ignored.
 * @returns {Object|null} - Created show or null if failed
 */
async function createShow(showData) {
  try {
    const prize = showData.entryFee * 10;
    const show = await prisma.$transaction(async tx => {
      if (prize > 0) {
        await creditSystemAccount(tx, 'showEscrow', prize, {
          category: 'showCreatePrizeEscrow',
          description: `Prize escrow for seeded show "${showData.name}"`,
        });
      }
      return tx.show.create({
        data: {
          name: showData.name,
          discipline: showData.discipline,
          levelMin: showData.levelMin,
          levelMax: showData.levelMax,
          entryFee: showData.entryFee,
          prize,
          prizeEscrow: prize,
          feeEscrow: 0,
          runDate: showData.runDate,
          // Entries close when the show runs, as createShow sets it; an undated
          // show could never be entered (owner ruling 2026-10-05/07/12: undated shows refuse entry (Equoria-576c0 B10)).
          closeDate: showData.closeDate ?? showData.runDate,
        },
      });
    });
    console.log(`✅ Created show: ${show.name} (ID: ${show.id})`);
    return show;
  } catch (error) {
    console.error(`❌ Failed to create show ${showData.name}: ${error.message}`);
    return null;
  }
}

/**
 * Seed the database with mock shows
 * @param {number} count - Number of shows to create (default: 10)
 * @returns {boolean} - True if successful, false if there were issues
 */
async function seedShows(count = 10) {
  console.log(`🌱 Starting show seeding process (${count} shows)...`);

  try {
    // Generate mock shows
    const mockShows = generateMockShows(count);
    console.log(`📋 Generated ${mockShows.length} mock shows`);

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (const showData of mockShows) {
      // Check if show already exists (by name)
      const exists = await checkShowExists(showData.name);
      if (exists) {
        console.log(`⏭️  Skipping existing show: ${showData.name}`);
        skipCount++;
        continue;
      }

      // Create the show
      const createdShow = await createShow(showData);
      if (createdShow) {
        successCount++;
      } else {
        errorCount++;
      }
    }

    // Summary
    console.log('\n📊 Seeding Summary:');
    console.log(`✅ Successfully created: ${successCount} shows`);
    console.log(`⏭️  Skipped (already exist): ${skipCount} shows`);
    console.log(`❌ Failed to create: ${errorCount} shows`);
    console.log(`📈 Total processed: ${successCount + skipCount + errorCount} shows`);

    if (errorCount === 0) {
      console.log('\n🎉 Show seeding completed successfully!');
      return true;
    } else {
      console.log('\n⚠️  Show seeding completed with some errors.');
      return false;
    }
  } catch (error) {
    console.error(`💥 Fatal error during show seeding: ${error.message}`);
    return false;
  }
}

/**
 * Main execution function
 */
async function main() {
  try {
    const success = await seedShows(15); // Seed 15 shows by default

    if (success) {
      console.log('\n🏁 Show seeding process completed successfully!');
      process.exit(0);
    } else {
      console.log('\n🚨 Show seeding process completed with errors.');
      process.exit(1);
    }
  } catch (error) {
    console.error(`💥 Unexpected error: ${error.message}`);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Export functions for testing
export { seedShows, createShow, checkShowExists };

// Run main function if this file is executed directly
const currentFileUrl = import.meta.url;
const executedFileUrl = `file:///${process.argv[1].replace(/\\/g, '/')}`;

if (currentFileUrl === executedFileUrl) {
  main();
}
