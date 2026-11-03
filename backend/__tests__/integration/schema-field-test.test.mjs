/**
 * Schema Field Test - Test specific field existence
 */

import { randomBytes } from 'node:crypto';
import prisma from '../../../packages/database/prismaClient.mjs';
import { fixtureColor } from '../../tests/helpers/fixtureColor.mjs';
import { testHorseData } from '../helpers/createTestHorse.mjs';

// Equoria-qjsga: per-run unique fixture identity. The prior fixed
// `schema-field-test-user` / `schemafieldtestuser` / `schema-field-test@example.com`
// (plus the fixed breed/horse names) collided on the User unique constraints
// if a prior run leaked the row, or with another suite owning the same generic
// identifier. randomBytes gives a unique-per-run suffix; the username stays
// within the 3-30 char /^[A-Za-z0-9_]+$/ register-validator charset.
const SUFFIX = randomBytes(6).toString('hex');
const testUserId = `schema-field-test-user-${SUFFIX}`;
const testUsername = `schemafieldtestuser${SUFFIX}`;
const testEmail = `schema-field-test-${SUFFIX}@example.com`;
const testBreedName = `Schema Field Test Breed ${SUFFIX}`;
const testHorseName = `Schema Field Test Horse ${SUFFIX}`;

describe('Schema Field Test', () => {
  afterAll(async () => {
    // prisma.$disconnect() removed — global teardown handles disconnection
  });

  it('should create horse with consecutiveDaysFoalCare field', async () => {
    // Clean up first — scoped to this run's unique names/email.
    await prisma.horse.deleteMany({
      where: { name: testHorseName },
    });
    await prisma.user.deleteMany({
      where: { email: testEmail },
    });
    await prisma.breed.deleteMany({
      where: { name: testBreedName },
    });

    // Create test breed
    const testBreed = await prisma.breed.create({
      data: {
        name: testBreedName,
        description: 'Test breed for schema field validation',
      },
    });

    // Create test user
    const testUser = await prisma.user.create({
      data: {
        emailVerified: true,
        id: testUserId,
        username: testUsername,
        email: testEmail,
        password: 'TestPassword123!',
        firstName: 'Schema',
        lastName: 'Field',
        money: 5000,
      },
    });

    // Create horse with consecutiveDaysFoalCare field
    const horse = await prisma.horse.create({
      data: await testHorseData(prisma, {
        ...fixtureColor(),
        name: testHorseName,
        sex: 'Mare',
        dateOfBirth: new Date('2023-01-01'),
        age: 365,
        userId: testUser.id,
        breedId: testBreed.id,
        bondScore: 50,
        taskLog: { trustBuilding: 3, desensitization: 2 },
        lastGroomed: new Date(),
        daysGroomedInARow: 5,
        consecutiveDaysFoalCare: 7, // This is the field we're testing
        epigeneticModifiers: { positive: [], negative: [], hidden: [] },
      }),
    });

    expect(horse).toBeTruthy();
    expect(horse.consecutiveDaysFoalCare).toBe(7);
    expect(horse.bondScore).toBe(50);
    expect(horse.daysGroomedInARow).toBe(5);

    // Clean up
    await prisma.horse.delete({
      where: { id: horse.id },
    });
    await prisma.user.delete({
      where: { id: testUser.id },
    });
    await prisma.breed.delete({
      where: { id: testBreed.id },
    });
  });
});
