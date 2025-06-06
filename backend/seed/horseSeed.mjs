import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import logger from '../utils/logger.mjs';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env file explicitly BEFORE importing any modules that depend on config
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Validate environment
if (!process.env.DATABASE_URL) {
  logger.error('[seed] DATABASE_URL environment variable is required');
  process.exit(1);
}

logger.info('[seed] Environment loaded successfully');

// Sample horse data
const sampleHorses = [
  {
    name: 'Midnight Comet',
    age: 4,
    breedName: 'Thoroughbred',
    userId: 1,
    stableId: 1,
    sex: 'Stallion',
    dateOfBirth: new Date('2020-05-10'),
    genotype: { coat: 'EE/aa', dilution: 'nCr', markings: ['Tobiano'] },
    phenotypicMarkings: { face: 'Blaze', legs: ['Sock', 'Stocking'] },
    finalDisplayColor: 'Smoky Black Tobiano',
    shade: 'Dark',
    imageUrl: '/images/midnight_comet.jpg',
    trait: 'Agile',
    temperament: 'Spirited',
    precision: 75,
    strength: 80,
    speed: 85,
    agility: 90,
    endurance: 70,
    intelligence: 80,
    personality: 'Spirited',
    totalEarnings: 15000,
    studStatus: 'Public Stud',
    studFee: 500,
    forSale: false,
    healthStatus: 'Excellent',
    lastVettedDate: new Date('2024-05-01'),
    tack: { saddle: 'Western Pleasure', bridle: 'Standard', blanket: 'Show' },
  },
  {
    name: 'Golden Dawn',
    age: 5,
    breedName: 'Arabian',
    userId: 1,
    stableId: 1,
    sex: 'Mare',
    dateOfBirth: new Date('2019-03-15'),
    genotype: { coat: 'ee/AA', dilution: 'ChCh', markings: ['Sabino'] },
    phenotypicMarkings: { face: 'Star', legs: ['Coronet'] },
    finalDisplayColor: 'Champagne Sabino',
    shade: 'Golden',
    imageUrl: '/images/golden_dawn.jpg',
    trait: 'Graceful',
    temperament: 'Calm',
    precision: 80,
    strength: 70,
    speed: 75,
    agility: 85,
    endurance: 80,
    intelligence: 88,
    personality: 'Calm',
    totalEarnings: 25000,
    lastBredDate: new Date('2023-11-01'),
    forSale: true,
    salePrice: 12000,
    healthStatus: 'Very Good',
    lastVettedDate: new Date('2024-04-20'),
    tack: { saddle: 'English All-Purpose', bridle: 'Snaffle', blanket: 'Stable' },
  },
  {
    name: 'Shadowfax Spirit',
    age: 1,
    breedName: 'Thoroughbred',
    userId: 2,
    stableId: 2,
    sex: 'Colt',
    dateOfBirth: new Date('2023-07-22'),
    genotype: { coat: 'Ee/AA', dilution: 'nZ', markings: [] },
    phenotypicMarkings: { face: 'None', legs: [] },
    finalDisplayColor: 'Silver Bay',
    shade: 'Light',
    imageUrl: '/images/shadowfax_spirit.jpg',
    trait: 'Fast Learner',
    temperament: 'Curious',
    precision: 60,
    strength: 65,
    speed: 70,
    agility: 75,
    endurance: 60,
    intelligence: 70,
    personality: 'Curious',
    totalEarnings: 500,
    studStatus: 'Not at Stud',
    studFee: 0,
    forSale: false,
    healthStatus: 'Excellent',
    lastVettedDate: new Date('2024-05-10'),
    tack: { saddle: 'Training', bridle: 'Halter', blanket: 'Turnout' },
  },
];

// Helper to check if horse already exists
async function checkHorseExists(name) {
  const { default: prisma } = await import('../db/index.js');
  try {
    const existingHorse = await prisma.horse.findFirst({
      where: { name },
    });
    return existingHorse !== null;
  } catch (error) {
    logger.warn(`[seed] Failed to check if horse "${name}" exists: ${error.message}`);
    return false; // Assume it doesn't exist and let creation handle any conflicts
  }
}

// Helper to find or create a breed
async function findOrCreateBreed(breedName) {
  const { default: prisma } = await import('../db/index.js');
  if (!breedName) {
    logger.warn('[seed] Breed name is undefined or null. Skipping breed creation/connection.');
    return null;
  }
  try {
    let breed = await prisma.breed.findUnique({
      where: { name: breedName },
    });
    if (!breed) {
      logger.info(`[seed] Breed "${breedName}" not found, creating new one.`);
      breed = await prisma.breed.create({
        data: { name: breedName, description: `Seed-created ${breedName}` },
      });
      logger.info(`[seed] Created breed: ${breed.name} (ID: ${breed.id})`);
    } else {
      logger.info(`[seed] Found existing breed: ${breed.name} (ID: ${breed.id})`);
    }
    return breed;
  } catch (error) {
    logger.error(`[seed] Failed to find or create breed "${breedName}": ${error.message}`);
    throw error;
  }
}

// Ensure referenced records exist
async function ensureReferencedRecordsExist() {
  const { default: prisma } = await import('../db/index.js');
  try {
    await prisma.user.upsert({
      where: { id: 1 },
      update: { username: 'Default User' },
      create: { id: 1, username: 'Default User', email: 'user1@example.com', password: 'password' },
    });
    logger.info('[seed] Ensured User ID 1 exists.');
  } catch (e) {
    logger.warn(`[seed] Could not ensure User ID 1. Error: ${e.message}`);
  }
  try {
    await prisma.user.upsert({
      where: { id: 2 },
      update: { username: 'Second User' },
      create: { id: 2, username: 'Second User', email: 'user2@example.com', password: 'password' },
    });
    logger.info('[seed] Ensured User ID 2 exists.');
  } catch (e) {
    logger.warn(`[seed] Could not ensure User ID 2. Error: ${e.message}`);
  }
  try {
    await prisma.stable.upsert({
      where: { id: 1 },
      update: { name: 'Main Stable' },
      create: { id: 1, name: 'Main Stable' },
    });
    logger.info('[seed] Ensured Stable ID 1 exists.');
  } catch (e) {
    logger.warn(`[seed] Could not ensure Stable ID 1. Error: ${e.message}`);
  }
  try {
    await prisma.stable.upsert({
      where: { id: 2 },
      update: { name: 'Second Stable' },
      create: { id: 2, name: 'Second Stable' },
    });
    logger.info('[seed] Ensured Stable ID 2 exists.');
  } catch (e) {
    logger.warn(`[seed] Could not ensure Stable ID 2. Error: ${e.message}`);
  }
}

// Seed horses function
const seedHorses = async (prisma, users) => {
  if (!users || users.length === 0) {
    logger.warn('No users provided for horse seeding. Skipping horse creation.');
    return [];
  }

  const user = users[0];

  const breedsData = [
    { name: 'Thoroughbred', baseSpeed: 80, baseStamina: 70, baseStrength: 60, rarity: 'Common' },
    { name: 'Arabian', baseSpeed: 75, baseStamina: 80, baseStrength: 50, rarity: 'Rare' },
    { name: 'Quarter Horse', baseSpeed: 70, baseStamina: 60, baseStrength: 80, rarity: 'Common' },
    { name: 'Akhal-Teke', baseSpeed: 85, baseStamina: 75, baseStrength: 65, rarity: 'Epic' },
  ];

  const createdBreeds = [];
  for (const breedData of breedsData) {
    try {
      const breed = await prisma.breed.upsert({
        where: { name: breedData.name },
        update: breedData,
        create: breedData,
      });
      logger.info(`Upserted breed: ${breed.name}`);
      createdBreeds.push(breed);
    } catch (error) {
      logger.error(`Error seeding breed ${breedData.name}: ${error.message}`);
    }
  }

  const horsesData = [
    {
      name: 'Lightning Bolt',
      age: 3,
      sex: 'Stallion',
      color: 'Bay',
      breedId: createdBreeds.find(b => b.name === 'Thoroughbred')?.id,
      userId: user.id,
      speed: 82,
      stamina: 72,
      strength: 62,
      agility: 70,
      endurance: 75,
      intelligence: 60,
      temperament: 'Spirited',
      health: 100,
      forSale: false,
    },
    {
      name: 'Desert Rose',
      age: 5,
      sex: 'Mare',
      color: 'Chestnut',
      breedId: createdBreeds.find(b => b.name === 'Arabian')?.id,
      userId: user.id,
      speed: 78,
      stamina: 83,
      strength: 52,
      agility: 75,
      endurance: 80,
      intelligence: 65,
      temperament: 'Gentle',
      health: 100,
      forSale: true,
      price: 15000,
    },
  ];

  const createdHorses = [];
  for (const horseData of horsesData) {
    if (!horseData.breedId) {
      logger.warn(`Skipping horse ${horseData.name} due to missing breedId.`);
      continue;
    }
    try {
      const horse = await prisma.horse.create({
        data: horseData,
      });
      logger.info(`Created horse: ${horse.name} for user ID: ${user.id}`);
      createdHorses.push(horse);
    } catch (error) {
      logger.error(`Error seeding horse ${horseData.name}: ${error.message}`);
    }
  }
  return createdHorses;
};

async function seedUserWithHorses() {
  const { default: prisma } = await import('../db/index.js');
  logger.info('[seed] Attempting to seed a user with horses...');
  let userToSeed = await prisma.user.findFirst({
    where: { email: 'seeduserwithhorses@example.com' },
  });

  if (!userToSeed) {
    logger.info('[seed] User seeduserwithhorses@example.com not found, creating new one.');
    try {
      userToSeed = await prisma.user.create({
        data: {
          email: 'seeduserwithhorses@example.com',
          username: 'UserWithHorses',
          firstName: 'Seed',
          lastName: 'User',
          password: 'securepassword123', // Ensure this is hashed in a real app
          money: 20000,
          level: 1,
          xp: 0,
          settings: { tutorialCompleted: true },
        },
      });
      logger.info(`[seed] Created user: ${userToSeed.username} (ID: ${userToSeed.id})`);
    } catch (error) {
      logger.error(`[seed] Failed to create user seeduserwithhorses@example.com: ${error.message}`);
      return false; // Indicate failure
    }
  } else {
    logger.info(`[seed] Found existing user: ${userToSeed.username} (ID: ${userToSeed.id})`);
  }

  if (userToSeed) {
    logger.info(`[seed] Seeding horses for user: ${userToSeed.username}`);
    await seedHorses(prisma, [userToSeed]); // Pass user in an array as expected by seedHorses
    return true; // Indicate success
  }
  return false; // Indicate failure if user could not be found or created
}

async function checkUserExists(userId) {
  const { default: prisma } = await import('../db/index.js');
  if (!userId) {
    logger.warn('[seed] checkUserExists called with no userId.');
    return false;
  }
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user) {
      logger.info(`[seed] User with ID ${userId} exists.`);
      return true;
    }
    logger.info(`[seed] User with ID ${userId} does not exist.`);
    return false;
  } catch (error) {
    logger.error(`[seed] Error checking if user ${userId} exists: ${error.message}`);
    return false; // Assume user doesn't exist on error
  }
}

// Main seeding function
async function main() {
  try {
    const { default: prisma } = await import('../db/index.js');

    logger.info('[seed] Starting comprehensive seeding process...');

    // Ensure some base users exist for general horse seeding if needed
    await ensureReferencedRecordsExist();

    // Get some users to assign horses to, or create a default if none exist
    const usersToSeed = await prisma.user.findMany({ take: 2 });
    if (usersToSeed.length === 0) {
      logger.warn('[seed] No users found in DB. Creating a default one for general horse seeding.');
      const defaultUser = await prisma.user.create({
        data: {
          email: 'defaultseeduser@example.com',
          username: 'DefaultSeedUser',
          firstName: 'Default',
          lastName: 'User',
          password: 'password123',
          money: 50000,
          level: 1,
          xp: 0,
          settings: {},
        },
      });
      usersToSeed.push(defaultUser);
      logger.info(`[seed] Created default user ${defaultUser.username} for general horse seeding.`);
    }

    const generalHorseSeedSuccess = await seedHorses(prisma, usersToSeed);
    const userWithHorsesSuccess = await seedUserWithHorses();

    if (!generalHorseSeedSuccess || !userWithHorsesSuccess) {
      logger.error('[seed] Seeding completed with issues. Exiting with error code.');
      process.exit(1);
    }

    logger.info('[seed] All seeding operations completed successfully.');

    await prisma.$disconnect();
    logger.info('[seed] Prisma client disconnected.');
  } catch (error) {
    logger.error(`[seed] Fatal error during seeding process: ${error.message}`);
    logger.error(`[seed] Fatal error stack: ${error.stack}`);
    process.exit(1);
  }
}

// Export functions for testing
export {
  sampleHorses,
  findOrCreateBreed,
  ensureReferencedRecordsExist,
  checkHorseExists,
  seedHorses,
  seedUserWithHorses,
  checkUserExists,
};

// Only run the main function if this script is executed directly (not imported)
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('horseSeed.js')) {
  main();
}
