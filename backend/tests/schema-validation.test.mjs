/**
 * Schema Validation Test
 * Quick test to verify database schema compatibility
 */

import prisma from '../db/index.mjs';

describe('Schema Validation', () => {
  let testUser;
  let testBreed;

  beforeAll(async () => {
    // Clean up any existing test data
    await prisma.horse.deleteMany({
      where: { name: { startsWith: 'Schema Test' } },
    });
    await prisma.user.deleteMany({
      where: { email: 'schema-test@example.com' },
    });
    await prisma.breed.deleteMany({
      where: { name: 'Schema Test Breed' },
    });
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.horse.deleteMany({
      where: { name: { startsWith: 'Schema Test' } },
    });
    await prisma.user.deleteMany({
      where: { email: 'schema-test@example.com' },
    });
    await prisma.breed.deleteMany({
      where: { name: 'Schema Test Breed' },
    });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Create test breed
    testBreed = await prisma.breed.create({
      data: {
        name: 'Schema Test Breed',
        description: 'Test breed for schema validation',
      },
    });

    // Create test user
    testUser = await prisma.user.create({
      data: {
        id: 'schema-test-user',
        username: 'schematestuser',
        email: 'schema-test@example.com',
        password: 'testpassword',
        firstName: 'Schema',
        lastName: 'Tester',
        money: 5000,
      },
    });
  });

  afterEach(async () => {
    // Clean up after each test
    await prisma.horse.deleteMany({
      where: { name: { startsWith: 'Schema Test' } },
    });
    await prisma.user.deleteMany({
      where: { email: 'schema-test@example.com' },
    });
    await prisma.breed.deleteMany({
      where: { name: 'Schema Test Breed' },
    });
  });

  it('should create horse with basic required fields', async () => {
    const horse = await prisma.horse.create({
      data: {
        name: 'Schema Test Horse',
        sex: 'Mare',
        dateOfBirth: new Date('2023-01-01'),
        age: 365,
        user: { connect: { id: testUser.id } },
        breed: { connect: { id: testBreed.id } },
      },
    });

    expect(horse).toBeTruthy();
    expect(horse.name).toBe('Schema Test Horse');
    expect(horse.sex).toBe('Mare');
    expect(horse.age).toBe(365);
  });

  it('should create horse with groom-related fields', async () => {
    const horse = await prisma.horse.create({
      data: {
        name: 'Schema Test Horse 2',
        sex: 'Stallion',
        dateOfBirth: new Date('2022-01-01'),
        age: 730,
        user: { connect: { id: testUser.id } },
        breed: { connect: { id: testBreed.id } },
        bondScore: 50,
        stressLevel: 20,
        taskLog: { trust_building: 3, desensitization: 2 },
        lastGroomed: new Date(),
        daysGroomedInARow: 5,
        burnoutStatus: 'none',
        epigeneticModifiers: { positive: [], negative: [], hidden: [] },
      },
    });

    expect(horse).toBeTruthy();
    expect(horse.bondScore).toBe(50);
    expect(horse.stressLevel).toBe(20);
    expect(horse.daysGroomedInARow).toBe(5);
    expect(horse.burnoutStatus).toBe('none');
  });

  it('should create groom with all required fields', async () => {
    const groom = await prisma.groom.create({
      data: {
        name: 'Schema Test Groom',
        speciality: 'foal_care',
        skillLevel: 'expert',
        personality: 'gentle',
        sessionRate: 25.0,
        userId: testUser.id,
      },
    });

    expect(groom).toBeTruthy();
    expect(groom.name).toBe('Schema Test Groom');
    expect(groom.speciality).toBe('foal_care');
    expect(groom.skillLevel).toBe('expert');
    expect(groom.personality).toBe('gentle');
    expect(parseFloat(groom.sessionRate)).toBe(25.0);
  });

  it('should create groom assignment', async () => {
    // Create horse and groom first
    const horse = await prisma.horse.create({
      data: {
        name: 'Schema Test Horse 3',
        sex: 'Filly',
        dateOfBirth: new Date('2023-06-01'),
        age: 180,
        user: { connect: { id: testUser.id } },
        breed: { connect: { id: testBreed.id } },
      },
    });

    const groom = await prisma.groom.create({
      data: {
        name: 'Schema Test Groom 2',
        speciality: 'general',
        skillLevel: 'intermediate',
        personality: 'patient',
        sessionRate: 20.0,
        userId: testUser.id,
      },
    });

    const assignment = await prisma.groomAssignment.create({
      data: {
        foalId: horse.id,
        groomId: groom.id,
        userId: testUser.id,
        priority: 1,
        notes: 'Test assignment',
      },
    });

    expect(assignment).toBeTruthy();
    expect(assignment.foalId).toBe(horse.id);
    expect(assignment.groomId).toBe(groom.id);
    expect(assignment.priority).toBe(1);
    expect(assignment.isActive).toBe(true);
  });

  it('should create groom interaction', async () => {
    // Create horse and groom first
    const horse = await prisma.horse.create({
      data: {
        name: 'Schema Test Horse 4',
        sex: 'Colt',
        dateOfBirth: new Date('2023-03-01'),
        age: 270,
        user: { connect: { id: testUser.id } },
        breed: { connect: { id: testBreed.id } },
      },
    });

    const groom = await prisma.groom.create({
      data: {
        name: 'Schema Test Groom 3',
        speciality: 'training',
        skillLevel: 'master',
        personality: 'firm',
        sessionRate: 35.0,
        userId: testUser.id,
      },
    });

    const interaction = await prisma.groomInteraction.create({
      data: {
        foalId: horse.id,
        groomId: groom.id,
        interactionType: 'brushing',
        duration: 30,
        bondingChange: 3,
        stressChange: -2,
        quality: 'excellent',
        cost: 35.0,
        notes: 'Great session',
      },
    });

    expect(interaction).toBeTruthy();
    expect(interaction.foalId).toBe(horse.id);
    expect(interaction.groomId).toBe(groom.id);
    expect(interaction.interactionType).toBe('brushing');
    expect(interaction.duration).toBe(30);
    expect(interaction.bondingChange).toBe(3);
    expect(interaction.stressChange).toBe(-2);
    expect(interaction.quality).toBe('excellent');
  });
});
