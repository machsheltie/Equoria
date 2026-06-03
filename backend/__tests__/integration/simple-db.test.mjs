/**
 * Simple Database Connection Test
 */

import { randomBytes } from 'node:crypto';
import prisma from '../../../packages/database/prismaClient.mjs';

// Equoria-qjsga: per-run unique fixture identity (id/username/email). The
// prior fixed `simple-test-user` / `simpletestuser` / `simple-test@example.com`
// values collided on the User unique constraints if a prior run leaked the row
// (e.g. the test threw between create and the end-of-test cleanup, so no
// pre-create sweep guarded it) or if another suite owned the same generic
// identifier. randomBytes gives a unique-per-run id; the username stays within
// the 3-30 char /^[A-Za-z0-9_]+$/ register-validator charset (no hyphens here
// since these are direct prisma.user.create rows, but kept conservative).
const SUFFIX = randomBytes(6).toString('hex');

describe('Simple Database Test', () => {
  afterAll(async () => {
    // prisma.$disconnect() removed — global teardown handles disconnection
  });

  it('should connect to database', async () => {
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    expect(result).toBeTruthy();
    expect(result[0].test).toBe(1);
  });

  it('should create a simple user', async () => {
    const id = `simple-test-user-${SUFFIX}`;
    const username = `simpletestuser${SUFFIX}`;
    const email = `simple-test-${SUFFIX}@example.com`;

    // Clean up first — scoped to this run's unique email.
    await prisma.user.deleteMany({
      where: { email },
    });

    const user = await prisma.user.create({
      data: {
        id,
        username,
        email,
        password: 'TestPassword123!',
        firstName: 'Simple',
        lastName: 'Test',
        money: 1000,
      },
    });

    expect(user).toBeTruthy();
    expect(user.email).toBe(email);

    // Clean up — scoped to the id this test created.
    await prisma.user.deleteMany({
      where: { id: user.id },
    });
  });
});
