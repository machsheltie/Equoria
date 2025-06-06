/**
 * Simple script to create basic breeds for testing
 */

import prisma from '../db/index.mjs';
import logger from '../utils/logger.mjs';

async function createBreeds() {
  try {
    console.log('[createBreeds] Creating basic breeds...');
    logger.info('[createBreeds] Creating basic breeds...');

    const breeds = [
      {
        name: 'Thoroughbred',
        description: 'A hot-blooded horse breed best known for its use in horse racing.',
      },
      {
        name: 'Arabian',
        description: 'One of the oldest horse breeds, known for endurance and intelligence.',
      },
      {
        name: 'Quarter Horse',
        description: 'An American breed known for speed in quarter-mile races.',
      },
      {
        name: 'Akhal-Teke',
        description: 'A rare breed from Turkmenistan known for its metallic coat.',
      },
    ];

    const createdBreeds = [];

    for (const breedData of breeds) {
      // Check if breed already exists
      const existing = await prisma.breed.findFirst({
        where: { name: breedData.name },
      });

      if (existing) {
        logger.info(`[createBreeds] Breed ${breedData.name} already exists (ID: ${existing.id})`);
        createdBreeds.push(existing);
      } else {
        const newBreed = await prisma.breed.create({
          data: breedData,
        });
        logger.info(`[createBreeds] Created breed ${newBreed.name} (ID: ${newBreed.id})`);
        createdBreeds.push(newBreed);
      }
    }

    console.log('\n🎯 BREEDS CREATED');
    console.log('==================');
    createdBreeds.forEach(breed => {
      console.log(`${breed.name} (ID: ${breed.id})`);
    });

    return createdBreeds;
  } catch (error) {
    logger.error(`[createBreeds] Error: ${error.message}`);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  createBreeds()
    .then(() => {
      console.log('\n✅ Breeds created successfully!');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Breed creation failed:', error);
      process.exit(1);
    });
}

export default createBreeds;
