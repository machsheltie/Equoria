import prisma from '../db/index.mjs';
import logger from '../utils/logger.mjs';
import { hashPassword } from '../utils/authUtils.mjs'; // Assuming you have a utility for hashing passwords
// Equoria-o7pnn: seeded horses must arrive with a permanent breed-weighted
// temperament so dev databases never contain NULL-temperament horses.
import { generateTemperamentWithDefault } from '../modules/horses/services/temperamentService.mjs';

/**
 * Creates a test user with horses for development and testing
 */
async function seedUserWithHorses() {
  try {
    logger.info('🌱 Starting user and horse seeding...');

    // Check if test user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: 'test@example.com' },
    });

    if (existingUser) {
      logger.info('✅ Test user already exists, skipping creation');
      return true;
    }

    // Create test user
    const hashedPassword = await hashPassword('TestPassword123!');

    const testUser = await prisma.user.create({
      data: {
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        password: hashedPassword,
        money: 5000,
        level: 5,
        xp: 2500,
        settings: {
          darkMode: true,
          notifications: true,
        },
      },
    });

    logger.info(`✅ Created test user: ${testUser.name} (ID: ${testUser.id})`);

    // Ensure we have a breed
    let breed = await prisma.breed.findFirst();
    if (!breed) {
      breed = await prisma.breed.create({
        data: {
          name: 'Thoroughbred',
          description: 'A hot-blooded horse breed best known for its use in horse racing.',
        },
      });
      logger.info(`✅ Created breed: ${breed.name}`);
    }

    // Create test horses linked to the user
    const horses = await Promise.all([
      prisma.horse.create({
        data: {
          name: 'Thunder',
          age: 4,
          breed: { connect: { id: breed.id } },
          ownerId: testUser.id,
          sex: 'stallion',
          // Equoria-o7pnn: permanent breed-weighted temperament, assigned once.
          temperament: generateTemperamentWithDefault(breed.name),
          healthStatus: 'Good',
          disciplineScores: {
            Racing: 15,
            Dressage: 10,
          },
        },
      }),
      prisma.horse.create({
        data: {
          name: 'Lightning',
          age: 5,
          breed: { connect: { id: breed.id } },
          ownerId: testUser.id,
          sex: 'mare',
          // Equoria-o7pnn: permanent breed-weighted temperament, assigned once.
          temperament: generateTemperamentWithDefault(breed.name),
          healthStatus: 'Good',
          disciplineScores: {
            'Show Jumping': 20,
            'Cross Country': 12,
          },
        },
      }),
      prisma.horse.create({
        data: {
          name: 'Young Star',
          age: 2,
          breed: { connect: { id: breed.id } },
          ownerId: testUser.id,
          sex: 'colt',
          // Equoria-o7pnn: permanent breed-weighted temperament, assigned once.
          temperament: generateTemperamentWithDefault(breed.name),
          healthStatus: 'Good',
        },
      }),
    ]);

    logger.info(`✅ Created ${horses.length} horses for test user:`);
    horses.forEach(horse => {
      logger.info(`   - ${horse.name} (${horse.age} years old, ${horse.sex})`);
    });

    logger.info('🎉 User and horse seeding completed successfully!');
    return true;
  } catch (error) {
    logger.error('❌ Error seeding user and horses:', error);
    return false;
  }
}

// Run the seeding function
seedUserWithHorses()
  .then(success => {
    if (success) {
      logger.info('✅ Seeding completed successfully');
      process.exit(0);
    } else {
      logger.error('❌ Seeding failed');
      process.exit(1);
    }
  })
  .catch(error => {
    logger.error('❌ Seeding error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

export { seedUserWithHorses };
