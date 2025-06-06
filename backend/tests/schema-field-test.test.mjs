/**
 * Schema Field Test - Test specific field existence
 */

import prisma from '../db/index.mjs';

describe('Schema Field Test', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should create horse with consecutiveDaysFoalCare field', async () => {
    // Clean up first
    await prisma.horse.deleteMany({
      where: { name: 'Schema Field Test Horse' },
    });
    await prisma.user.deleteMany({
      where: { email: 'schema-field-test@example.com' },
    });
    await prisma.breed.deleteMany({
      where: { name: 'Schema Field Test Breed' },
    });

    // Create test breed
    const testBreed = await prisma.breed.create({
      data: {
        name: 'Schema Field Test Breed',
        description: 'Test breed for schema field validation',
      },
    });

    // Create test user
    const testUser = await prisma.user.create({
      data: {
        id: 'schema-field-test-user',
        username: 'schemafieldtestuser',
        email: 'schema-field-test@example.com',
        password: 'testpassword',
        firstName: 'Schema',
        lastName: 'Field',
        money: 5000,
      },
    });

    // Create horse with consecutiveDaysFoalCare field
    const horse = await prisma.horse.create({
      data: {
        name: 'Schema Field Test Horse',
        sex: 'Mare',
        dateOfBirth: new Date('2023-01-01'),
        age: 365,
        user: { connect: { id: testUser.id } },
        breed: { connect: { id: testBreed.id } },
        bondScore: 50,
        stressLevel: 20,
        taskLog: { trust_building: 3, desensitization: 2 },
        lastGroomed: new Date(),
        daysGroomedInARow: 5,
        consecutiveDaysFoalCare: 7, // This is the field we're testing
        burnoutStatus: 'none',
        epigeneticModifiers: { positive: [], negative: [], hidden: [] },
      },
    });

    expect(horse).toBeTruthy();
    expect(horse.consecutiveDaysFoalCare).toBe(7);
    expect(horse.bondScore).toBe(50);
    expect(horse.stressLevel).toBe(20);
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
