/**
 * Setup Test Data for Groom API Testing
 * Creates test users, horses of different ages, and basic grooms
 */

import prisma from '../db/index.mjs';
import logger from '../utils/logger.mjs';

async function setupTestData() {
  try {
    console.log('[setupTestData] Starting test data setup...');
    logger.info('[setupTestData] Starting test data setup...');

    // 1. Create test user
    const testUser = await prisma.user.upsert({
      where: { username: 'testuser' },
      update: {},
      create: {
        username: 'testuser',
        email: 'test@example.com',
        password: 'hashedpassword123',
        firstName: 'Test',
        lastName: 'User',
        coins: 10000,
        experience: 100,
      },
    });
    logger.info(`[setupTestData] Test user created/found: ${testUser.id}`);

    // 2. Get a breed for horses
    const breed = await prisma.breed.findFirst();
    if (!breed) {
      throw new Error('No breeds found. Please run breed seeding first.');
    }

    // 3. Create test horses of different ages
    const horses = await Promise.all([
      // Foal (1 year old - 365 days)
      prisma.horse.upsert({
        where: { name: 'Test Foal' },
        update: {},
        create: {
          name: 'Test Foal',
          age: 365, // 1 year old
          breedId: breed.id,
          userId: testUser.id,
          gender: 'filly',
          color: 'bay',
          speed: 50,
          stamina: 45,
          strength: 40,
          focus: 55,
          agility: 60,
          health: 100,
          happiness: 80,
          energy: 90,
          level: 1,
          experience: 0,
          traits: [],
          taskLog: {},
          lastGroomed: null,
          daysGroomedInARow: 0,
        },
      }),

      // Young horse (2 years old - 730 days)
      prisma.horse.upsert({
        where: { name: 'Test Young Horse' },
        update: {},
        create: {
          name: 'Test Young Horse',
          age: 730, // 2 years old
          breedId: breed.id,
          userId: testUser.id,
          gender: 'colt',
          color: 'chestnut',
          speed: 60,
          stamina: 55,
          strength: 50,
          focus: 65,
          agility: 70,
          health: 100,
          happiness: 85,
          energy: 95,
          level: 2,
          experience: 150,
          traits: [],
          taskLog: {},
          lastGroomed: null,
          daysGroomedInARow: 0,
        },
      }),

      // Adult horse (4 years old - 1460 days)
      prisma.horse.upsert({
        where: { name: 'Test Adult Horse' },
        update: {},
        create: {
          name: 'Test Adult Horse',
          age: 1460, // 4 years old
          breedId: breed.id,
          userId: testUser.id,
          gender: 'stallion',
          color: 'black',
          speed: 80,
          stamina: 75,
          strength: 70,
          focus: 85,
          agility: 90,
          health: 100,
          happiness: 90,
          energy: 100,
          level: 5,
          experience: 500,
          traits: ['confident', 'resilient'],
          taskLog: {},
          lastGroomed: null,
          daysGroomedInARow: 0,
        },
      }),
    ]);

    logger.info(`[setupTestData] Created ${horses.length} test horses`);

    // 4. Create test grooms
    const grooms = await Promise.all([
      prisma.groom.upsert({
        where: { name: 'Sarah Johnson' },
        update: {},
        create: {
          name: 'Sarah Johnson',
          speciality: 'foal_care',
          experience: 8,
          skillLevel: 'expert',
          personality: 'gentle',
          sessionRate: 25.0,
          bio: 'Experienced foal care specialist with gentle approach',
          availability: { weekdays: true, weekends: true },
          userId: testUser.id,
          isActive: true,
        },
      }),

      prisma.groom.upsert({
        where: { name: 'Mike Thompson' },
        update: {},
        create: {
          name: 'Mike Thompson',
          speciality: 'general',
          experience: 5,
          skillLevel: 'intermediate',
          personality: 'energetic',
          sessionRate: 18.0,
          bio: 'General grooming and care specialist',
          availability: { weekdays: true, weekends: false },
          userId: testUser.id,
          isActive: true,
        },
      }),

      prisma.groom.upsert({
        where: { name: 'Emma Davis' },
        update: {},
        create: {
          name: 'Emma Davis',
          speciality: 'training',
          experience: 3,
          skillLevel: 'novice',
          personality: 'patient',
          sessionRate: 15.0,
          bio: 'Training assistant and basic care provider',
          availability: { weekdays: false, weekends: true },
          userId: testUser.id,
          isActive: true,
        },
      }),
    ]);

    logger.info(`[setupTestData] Created ${grooms.length} test grooms`);

    // 5. Display summary
    console.log('\n🎯 TEST DATA SETUP COMPLETE');
    console.log('================================');
    console.log(`👤 Test User: ${testUser.username} (ID: ${testUser.id})`);
    console.log('\n🐎 Test Horses:');
    horses.forEach(horse => {
      const ageYears = Math.floor(horse.age / 365);
      console.log(`  - ${horse.name} (ID: ${horse.id}, Age: ${ageYears} years, ${horse.age} days)`);
    });
    console.log('\n👨‍💼 Test Grooms:');
    grooms.forEach(groom => {
      console.log(`  - ${groom.name} (ID: ${groom.id}, ${groom.speciality}, ${groom.skillLevel})`);
    });
    console.log('\n✅ Ready for API testing!');
    console.log('📊 Use these IDs in your Postman/Thunder Client tests');

    return {
      user: testUser,
      horses,
      grooms,
    };
  } catch (error) {
    logger.error(`[setupTestData] Error: ${error.message}`);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  setupTestData()
    .then(() => {
      console.log('\n🚀 Test data setup completed successfully!');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Test data setup failed:', error);
      process.exit(1);
    });
}

export default setupTestData;
