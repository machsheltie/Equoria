/**
 * Simple Database Connection Test
 */

import prisma from '../db/index.mjs';

describe('Simple Database Test', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should connect to database', async () => {
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    expect(result).toBeTruthy();
    expect(result[0].test).toBe(1);
  });

  it('should create a simple user', async () => {
    // Clean up first
    await prisma.user.deleteMany({
      where: { email: 'simple-test@example.com' },
    });

    const user = await prisma.user.create({
      data: {
        id: 'simple-test-user',
        username: 'simpletestuser',
        email: 'simple-test@example.com',
        password: 'testpassword',
        firstName: 'Simple',
        lastName: 'Test',
        money: 1000,
      },
    });

    expect(user).toBeTruthy();
    expect(user.email).toBe('simple-test@example.com');

    // Clean up
    await prisma.user.delete({
      where: { id: user.id },
    });
  });
});
