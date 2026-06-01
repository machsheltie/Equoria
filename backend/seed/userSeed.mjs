import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';
import prisma from '../../packages/database/prismaClient.mjs';
import logger from '../utils/logger.mjs';
import { MS_PER_GAME_YEAR } from '../constants/time.mjs';
// Equoria-o7pnn: seeded horses must arrive with a permanent breed-weighted
// temperament so dev databases never contain NULL-temperament horses.
import { generateTemperamentWithDefault } from '../modules/horses/index.mjs';

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

    // Create test user.
    // Equoria-rg7s4: the prior import { hashPassword } from '../utils/authUtils.mjs'
    // referenced a module/function that does not exist anywhere in the codebase
    // (running this seed threw ERR_MODULE_NOT_FOUND). Hash directly with bcryptjs,
    // mirroring the auth controller's bcrypt.hash(password, saltRounds) pattern.
    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10);
    const hashedPassword = await bcrypt.hash('TestPassword123!', saltRounds);

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

    logger.info(`✅ Created test user: ${testUser.username} (ID: ${testUser.id})`);

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
          // 7 real days = 1 game year (PATTERN_LIBRARY horse-age convention).
          dateOfBirth: new Date(Date.now() - 4 * MS_PER_GAME_YEAR),
          // Scalar FK: the app prisma client
          // (packages/database/prismaClient.mjs) persists FKs via scalar
          // columns and THROWS on relation-connect syntax (Equoria-b9zgr
          // two-client divergence). breedId/userId, not relations.
          breedId: breed.id,
          userId: testUser.id,
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
          dateOfBirth: new Date(Date.now() - 5 * MS_PER_GAME_YEAR),
          breedId: breed.id,
          userId: testUser.id,
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
          dateOfBirth: new Date(Date.now() - 2 * MS_PER_GAME_YEAR),
          breedId: breed.id,
          userId: testUser.id,
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

export { seedUserWithHorses };

// Equoria-9eh0t (c3kb6/5z0if): main-module guard. seedUserWithHorses() WRITES
// to the canonical DB (creates a test user + breed + horses). It must NOT run
// on bare import — a parse-check or accidental `node -e "import('./seed/userSeed.mjs')"`
// would otherwise fire those writes against real data. Only run when this file
// is the process entrypoint.
//
// Compare filesystem paths via fileURLToPath, NOT the
// `import.meta.url === \`file://${argv1.replace(/\\/g,'/')}\`` string form from
// CONTRIBUTING.md: on Windows + Node that string form is broken. process.argv[1]
// is `C:\path` (no leading slash), so `file://` + `C:/path` yields
// `file://C:/path` (TWO slashes), while Node emits `import.meta.url` as
// `file:///C:/path` (THREE slashes) — they never match and the seed would NEVER
// run even as the direct entrypoint. fileURLToPath(import.meta.url) decodes to
// the native `C:\path` that process.argv[1] already is, so the comparison holds
// on both Windows and POSIX. (Mirrors backend/seed/populateBreedsFromSql.mjs.)
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
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
}
