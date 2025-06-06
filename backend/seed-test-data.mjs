import { generateMockShows } from '../utils/generateMockShows.mjs';
import { PrismaClient } from '../../packages/database/node_modules/@prisma/client/index.mjs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '../../.env');
dotenv.config({ path: envPath });

const prisma = new PrismaClient();

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
 * Create a show in the database
 * @param {Object} showData - Show data object
 * @returns {Object|null} - Created show or null if failed
 */
async function createShow(showData) {
  try {
    const show = await prisma.show.create({
      data: {
        name: showData.name,
        discipline: showData.discipline,
        levelMin: showData.levelMin,
        levelMax: showData.levelMax,
        entryFee: showData.entryFee,
        prize: showData.prize,
        runDate: showData.runDate,
      },
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
