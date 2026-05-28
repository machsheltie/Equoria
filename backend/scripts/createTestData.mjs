/**
 * Create test data for API testing
 */

import prisma from '../db/index.mjs';
import { MS_PER_GAME_YEAR } from '../constants/time.mjs';
// Equoria-o7pnn: test-data horses must arrive with a permanent breed-weighted
// temperament so dev databases never contain NULL-temperament horses (mirrors
// the register/advanceOnboarding creation paths).
import { generateTemperamentWithDefault } from '../modules/horses/services/temperamentService.mjs';

async function createTestData() {
  try {
    console.log('🧪 Creating test data...');

    // 1. Create test user
    console.log('Creating test user...');
    const testUser = await prisma.user.create({
      data: {
        username: 'testuser',
        email: 'test@example.com',
        password: 'hashedpassword123',
        firstName: 'Test',
        lastName: 'User',
        money: 10000,
        xp: 100,
        level: 5,
      },
    });
    console.log(`✅ Created user: ${testUser.username} (ID: ${testUser.id})`);

    // 2. Get first breed
    const breed = await prisma.breed.findFirst();
    console.log(`✅ Using breed: ${breed.name} (ID: ${breed.id})`);

    // 3. Create test horses of different ages
    console.log('Creating test horses...');

    const foal = await prisma.horse.create({
      data: {
        name: 'Test Foal',
        sex: 'filly',
        dateOfBirth: new Date(Date.now() - 1 * MS_PER_GAME_YEAR), // 1 game-year = 7 real days
        breedId: breed.id,
        userId: testUser.id,
        // Equoria-o7pnn: permanent breed-weighted temperament, assigned once.
        temperament: generateTemperamentWithDefault(breed.name),
        speed: 50,
        stamina: 45,
        strength: 40,
        focus: 55,
        agility: 60,
        age: 1, // Equoria-9llg/3i1r: horse.age is game-years post Equoria-son6
        taskLog: {},
        lastGroomed: null,
        daysGroomedInARow: 0,
      },
    });
    console.log(`✅ Created foal: ${foal.name} (ID: ${foal.id}, Age: ${foal.age} game-years)`);

    const youngHorse = await prisma.horse.create({
      data: {
        name: 'Test Young Horse',
        sex: 'colt',
        dateOfBirth: new Date(Date.now() - 2 * MS_PER_GAME_YEAR), // 2 game-years = 14 real days
        breedId: breed.id,
        userId: testUser.id,
        // Equoria-o7pnn: permanent breed-weighted temperament, assigned once.
        temperament: generateTemperamentWithDefault(breed.name),
        speed: 60,
        stamina: 55,
        strength: 50,
        focus: 65,
        agility: 70,
        age: 2, // game-years
        taskLog: {},
        lastGroomed: null,
        daysGroomedInARow: 0,
      },
    });
    console.log(
      `✅ Created young horse: ${youngHorse.name} (ID: ${youngHorse.id}, Age: ${youngHorse.age} game-years)`,
    );

    const adultHorse = await prisma.horse.create({
      data: {
        name: 'Test Adult Horse',
        sex: 'stallion',
        dateOfBirth: new Date(Date.now() - 4 * MS_PER_GAME_YEAR), // 4 game-years = 28 real days
        breedId: breed.id,
        userId: testUser.id,
        // Equoria-o7pnn: permanent breed-weighted temperament, assigned once.
        temperament: generateTemperamentWithDefault(breed.name),
        speed: 80,
        stamina: 75,
        strength: 70,
        focus: 85,
        agility: 90,
        age: 4, // game-years
        taskLog: {},
        lastGroomed: null,
        daysGroomedInARow: 0,
      },
    });
    console.log(
      `✅ Created adult horse: ${adultHorse.name} (ID: ${adultHorse.id}, Age: ${adultHorse.age} game-years)`,
    );

    // 4. Create test grooms
    console.log('Creating test grooms...');

    const foalCareGroom = await prisma.groom.create({
      data: {
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
    });
    console.log(
      `✅ Created groom: ${foalCareGroom.name} (ID: ${foalCareGroom.id}, ${foalCareGroom.speciality})`,
    );

    const generalGroom = await prisma.groom.create({
      data: {
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
    });
    console.log(
      `✅ Created groom: ${generalGroom.name} (ID: ${generalGroom.id}, ${generalGroom.speciality})`,
    );

    // 5. Summary
    console.log('\n🎯 TEST DATA CREATED SUCCESSFULLY!');
    console.log('=====================================');
    console.log(`👤 User: ${testUser.username} (ID: ${testUser.id})`);
    console.log(
      `🐎 Horses: ${foal.name} (${foal.id}), ${youngHorse.name} (${youngHorse.id}), ${adultHorse.name} (${adultHorse.id})`,
    );
    console.log(
      `👨‍💼 Grooms: ${foalCareGroom.name} (${foalCareGroom.id}), ${generalGroom.name} (${generalGroom.id})`,
    );
    console.log('\n✅ Ready for API testing!');

    return {
      user: testUser,
      horses: [foal, youngHorse, adultHorse],
      grooms: [foalCareGroom, generalGroom],
    };
  } catch (error) {
    console.error('❌ Error creating test data:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Equoria-5z0if: main-module guard. createTestData() inserts test users +
// horses + grooms into the canonical DB — must NOT run on bare import.
if (
  process.argv[1] &&
  import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`
) {
  createTestData().catch(console.error);
}
