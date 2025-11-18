/**
 * Performance Test Data Seeding Script
 *
 * This script seeds the database with performance test data including:
 * - Large datasets for load testing
 * - Complex relationships for query performance testing
 * - Realistic data volumes for memory testing
 */

import prisma from '../db/index.mjs';
import bcrypt from 'bcryptjs';
import { logger } from '../utils/logger.mjs';

// Performance test data configuration
const PERFORMANCE_DATA_CONFIG = {
  users: 100,
  horsesPerUser: 20,
  showsPerUser: 10,
  competitionResultsPerHorse: 50,
  groomsPerUser: 5,
  trainingSessionsPerHorse: 30,
};

/**
 * Generate performance test users
 */
async function seedPerformanceUsers() {
  logger.info('🔄 Seeding performance test users...');

  const users = [];
  // Use configurable bcrypt rounds (default: 12 for 2025 security standards)
  const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10);
  const hashedPassword = await bcrypt.hash('testpassword123', saltRounds);

  for (let i = 1; i <= PERFORMANCE_DATA_CONFIG.users; i++) {
    users.push({
      email: `perftest${i}@equoria.com`,
      username: `perfuser${i}`,
      password: hashedPassword,
      firstName: 'Performance',
      lastName: `User${i}`,
      money: 10000,
      xp: Math.floor(Math.random() * 5000),
      level: Math.floor(Math.random() * 20) + 1,
      settings: {
        notifications: true,
        theme: 'default',
      },
    });
  }

  await prisma.user.createMany({
    data: users,
    skipDuplicates: true,
  });

  logger.info(`✅ Created ${users.length} performance test users`);
  return users;
}

/**
 * Generate performance test horses
 */
async function seedPerformanceHorses() {
  logger.info('🔄 Seeding performance test horses...');

  const users = await prisma.user.findMany({
    where: {
      email: {
        startsWith: 'perftest',
      },
    },
  });

  const breeds = await prisma.breed.findMany();
  const horses = [];

  for (const user of users) {
    for (let i = 1; i <= PERFORMANCE_DATA_CONFIG.horsesPerUser; i++) {
      const breed = breeds[Math.floor(Math.random() * breeds.length)];
      const age = Math.floor(Math.random() * 20) + 1;

      horses.push({
        name: `PerfHorse${user.id}_${i}`,
        sex: Math.random() > 0.5 ? 'stallion' : 'mare',
        dateOfBirth: new Date(Date.now() - age * 7 * 24 * 60 * 60 * 1000), // Age in weeks
        breedId: breed.id,
        userId: user.id,
        health: Math.floor(Math.random() * 20) + 80,
        bonding: Math.floor(Math.random() * 50) + 50,
        stress: Math.floor(Math.random() * 30),
        horseXp: Math.floor(Math.random() * 1000),
        stats: {
          speed: Math.floor(Math.random() * 50) + 50,
          stamina: Math.floor(Math.random() * 50) + 50,
          agility: Math.floor(Math.random() * 50) + 50,
          balance: Math.floor(Math.random() * 50) + 50,
          precision: Math.floor(Math.random() * 50) + 50,
          intelligence: Math.floor(Math.random() * 50) + 50,
          boldness: Math.floor(Math.random() * 50) + 50,
          flexibility: Math.floor(Math.random() * 50) + 50,
          obedience: Math.floor(Math.random() * 50) + 50,
          focus: Math.floor(Math.random() * 50) + 50,
        },
        disciplineScores: {
          racing: Math.floor(Math.random() * 100),
          dressage: Math.floor(Math.random() * 100),
          showJumping: Math.floor(Math.random() * 100),
          crossCountry: Math.floor(Math.random() * 100),
          western: Math.floor(Math.random() * 100),
          gaited: Math.floor(Math.random() * 100),
        },
        traits: {
          positive: [],
          negative: [],
          hidden: [],
        },
        taskLog: {},
        lastGroomed: new Date(),
      });
    }
  }

  // Create horses in batches to avoid memory issues
  const batchSize = 100;
  for (let i = 0; i < horses.length; i += batchSize) {
    const batch = horses.slice(i, i + batchSize);
    await prisma.horse.createMany({
      data: batch,
      skipDuplicates: true,
    });
  }

  logger.info(`✅ Created ${horses.length} performance test horses`);
  return horses.length;
}

/**
 * Generate performance test shows and competitions
 */
async function seedPerformanceShows() {
  logger.info('🔄 Seeding performance test shows...');

  const users = await prisma.user.findMany({
    where: {
      email: {
        startsWith: 'perftest',
      },
    },
  });

  const disciplines = [
    'racing', 'dressage', 'showJumping', 'crossCountry',
    'western', 'gaited', 'endurance', 'eventing',
  ];

  const shows = [];

  for (const user of users) {
    for (let i = 1; i <= PERFORMANCE_DATA_CONFIG.showsPerUser; i++) {
      const discipline = disciplines[Math.floor(Math.random() * disciplines.length)];
      const showDate = new Date(Date.now() + Math.random() * 30 * 24 * 60 * 60 * 1000);

      shows.push({
        name: `Performance Show ${user.id}_${i}`,
        discipline,
        date: showDate,
        location: `Test Location ${i}`,
        prize: Math.floor(Math.random() * 5000) + 1000,
        maxEntries: Math.floor(Math.random() * 50) + 20,
        currentEntries: 0,
        status: 'upcoming',
        hostId: user.id,
      });
    }
  }

  await prisma.show.createMany({
    data: shows,
    skipDuplicates: true,
  });

  logger.info(`✅ Created ${shows.length} performance test shows`);
  return shows;
}

/**
 * Generate performance test competition results
 */
async function seedPerformanceCompetitionResults() {
  logger.info('🔄 Seeding performance test competition results...');

  const horses = await prisma.horse.findMany({
    where: {
      user: {
        email: {
          startsWith: 'perftest',
        },
      },
    },
    include: {
      user: true,
    },
  });

  const shows = await prisma.show.findMany({
    where: {
      host: {
        email: {
          startsWith: 'perftest',
        },
      },
    },
  });

  const results = [];

  for (const horse of horses) {
    const numResults = Math.min(
      PERFORMANCE_DATA_CONFIG.competitionResultsPerHorse,
      shows.length,
    );

    const selectedShows = shows
      .sort(() => 0.5 - Math.random())
      .slice(0, numResults);

    for (const show of selectedShows) {
      const placement = Math.floor(Math.random() * 10) + 1;
      const score = Math.floor(Math.random() * 1000) + 500;
      const prizeWon = placement <= 3 ? Math.floor(show.prize / placement) : 0;

      results.push({
        horseId: horse.id,
        showId: show.id,
        userId: horse.userId,
        placement,
        score,
        prizeWon,
        discipline: show.discipline,
        competitionDate: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000),
      });
    }
  }

  // Create results in batches
  const batchSize = 500;
  for (let i = 0; i < results.length; i += batchSize) {
    const batch = results.slice(i, i + batchSize);
    await prisma.competitionResult.createMany({
      data: batch,
      skipDuplicates: true,
    });
  }

  logger.info(`✅ Created ${results.length} performance test competition results`);
  return results.length;
}

/**
 * Generate performance test grooms
 */
async function seedPerformanceGrooms() {
  logger.info('🔄 Seeding performance test grooms...');

  const users = await prisma.user.findMany({
    where: {
      email: {
        startsWith: 'perftest',
      },
    },
  });

  const personalities = ['calm', 'energetic', 'methodical'];
  const specialties = ['foalCare', 'generalGrooming', 'competition'];
  const grooms = [];

  for (const user of users) {
    for (let i = 1; i <= PERFORMANCE_DATA_CONFIG.groomsPerUser; i++) {
      const personality = personalities[Math.floor(Math.random() * personalities.length)];
      const specialty = specialties[Math.floor(Math.random() * specialties.length)];

      grooms.push({
        name: `PerfGroom${user.id}_${i}`,
        personality,
        specialty,
        skillLevel: Math.floor(Math.random() * 5) + 1,
        experience: Math.floor(Math.random() * 1000),
        userId: user.id,
        isActive: true,
        careerWeeks: Math.floor(Math.random() * 50),
        level: Math.floor(Math.random() * 10) + 1,
      });
    }
  }

  await prisma.groom.createMany({
    data: grooms,
    skipDuplicates: true,
  });

  logger.info(`✅ Created ${grooms.length} performance test grooms`);
  return grooms.length;
}

/**
 * Generate performance test training sessions
 */
async function seedPerformanceTrainingSessions() {
  logger.info('🔄 Seeding performance test training sessions...');

  const horses = await prisma.horse.findMany({
    where: {
      user: {
        email: {
          startsWith: 'perftest',
        },
      },
    },
  });

  const disciplines = ['racing', 'dressage', 'showJumping', 'crossCountry', 'western', 'gaited'];
  const sessions = [];

  for (const horse of horses) {
    for (let i = 1; i <= PERFORMANCE_DATA_CONFIG.trainingSessionsPerHorse; i++) {
      const discipline = disciplines[Math.floor(Math.random() * disciplines.length)];
      const sessionDate = new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000);

      sessions.push({
        horseId: horse.id,
        discipline,
        trainedAt: sessionDate,
        skillImprovement: Math.floor(Math.random() * 10) + 1,
        notes: `Performance training session ${i} for ${discipline}`,
      });
    }
  }

  // Create sessions in batches
  const batchSize = 1000;
  for (let i = 0; i < sessions.length; i += batchSize) {
    const batch = sessions.slice(i, i + batchSize);
    await prisma.trainingLog.createMany({
      data: batch,
      skipDuplicates: true,
    });
  }

  logger.info(`✅ Created ${sessions.length} performance test training sessions`);
  return sessions.length;
}

/**
 * Main performance data seeding function
 */
async function seedPerformanceData() {
  try {
    logger.info('🚀 Starting performance data seeding...');
    logger.info('=====================================');

    // Clean existing performance test data
    logger.info('🧹 Cleaning existing performance test data...');
    await prisma.competitionResult.deleteMany({
      where: {
        user: {
          email: {
            startsWith: 'perftest',
          },
        },
      },
    });

    await prisma.trainingLog.deleteMany({
      where: {
        horse: {
          user: {
            email: {
              startsWith: 'perftest',
            },
          },
        },
      },
    });

    await prisma.groom.deleteMany({
      where: {
        user: {
          email: {
            startsWith: 'perftest',
          },
        },
      },
    });

    await prisma.horse.deleteMany({
      where: {
        user: {
          email: {
            startsWith: 'perftest',
          },
        },
      },
    });

    await prisma.show.deleteMany({
      where: {
        host: {
          email: {
            startsWith: 'perftest',
          },
        },
      },
    });

    await prisma.user.deleteMany({
      where: {
        email: {
          startsWith: 'perftest',
        },
      },
    });

    // Seed performance test data
    await seedPerformanceUsers();
    await seedPerformanceHorses();
    await seedPerformanceShows();
    await seedPerformanceCompetitionResults();
    await seedPerformanceGrooms();
    await seedPerformanceTrainingSessions();

    logger.info('✅ Performance data seeding completed successfully!');
    logger.info('📊 Performance test database ready for load testing');

  } catch (error) {
    logger.error('❌ Performance data seeding failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run seeding if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedPerformanceData()
    .then(() => {
      console.log('✅ Performance data seeding completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Performance data seeding failed:', error);
      process.exit(1);
    });
}

export { seedPerformanceData };
