/**
 * Integration Tests: User Model — Real Database
 *
 * Tests createUser, getUserById and getUserWithHorses
 * against the real test database. No mocks — every assertion exercises
 * the actual Prisma client and PostgreSQL constraint layer.
 *
 * Story 21R-2 / Change 8: Reclassify and Strengthen Integration Tests
 */

import { describe, test, expect, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createUser, getUserById, getUserWithHorses } from '../services/userModelService.mjs';

// Per-run unique suffix: parallel workers and repeated runs never share fixture names.
const seed = `${randomBytes(4).toString('hex')}${Math.floor(Math.random() * 100000)}`;
const baseEmail = `integration-user-${seed}@test.local`;
const baseUsername = `intuser${seed}`;
// Every email this suite can create. Cleanup is scoped to these exact rows only.
const ownEmails = [baseEmail, `missing-user-${seed}@test.local`, `dup-${seed}@test.local`];

let createdUserId = null;

afterAll(async () => {
  // SCOPED cleanup: only rows this run created (by id, or by this run's exact unique emails/username).
  await prisma.user.deleteMany({
    where: {
      OR: [...(createdUserId ? [{ id: createdUserId }] : []), { email: { in: ownEmails } }, { username: baseUsername }],
    },
  });
  await prisma.$disconnect();
});

describe('User Integration Tests', () => {
  describe('User Creation', () => {
    test('creates a user and returns id, username, email, level, xp, money', async () => {
      const hashedPassword = await bcrypt.hash('TestPassword123!', 10);
      const userData = {
        username: baseUsername,
        email: baseEmail,
        password: hashedPassword,
        firstName: 'Integration',
        lastName: 'Test',
      };

      const result = await createUser(userData);

      expect(result).toMatchObject({
        username: baseUsername,
        email: baseEmail,
        level: 1,
        xp: 0,
        money: 1000,
      });
      expect(typeof result.id).toBe('string');
      expect(result.id.length).toBeGreaterThan(0);
      createdUserId = result.id;
    });

    test('rejects creation when username is missing', async () => {
      await expect(
        createUser({ email: `missing-user-${seed}@test.local`, password: 'x', firstName: 'A', lastName: 'B' }),
      ).rejects.toThrow('Username, email, and password are required.');
    });

    test('rejects creation when email is missing', async () => {
      await expect(
        createUser({ username: `noEmail${seed}`, password: 'x', firstName: 'A', lastName: 'B' }),
      ).rejects.toThrow('Username, email, and password are required.');
    });

    test('rejects duplicate username with the raw Prisma unique-constraint error (P2002)', async () => {
      const hashedPassword = await bcrypt.hash('TestPassword123!', 10);
      // Use same username, different email
      await expect(
        createUser({
          username: baseUsername,
          email: `dup-${seed}@test.local`,
          password: hashedPassword,
          firstName: 'Dup',
          lastName: 'User',
        }),
      ).rejects.toMatchObject({ code: 'P2002', meta: { target: expect.arrayContaining(['username']) } });
    });
  });

  describe('User Retrieval', () => {
    test('retrieves a user by ID', async () => {
      expect(createdUserId).toBeTruthy();
      const user = await getUserById(createdUserId);

      expect(user).not.toBeNull();
      expect(user.id).toBe(createdUserId);
      expect(user.username).toBe(baseUsername);
      expect(user.email).toBe(baseEmail);
    });

    test('returns null for a non-existent UUID', async () => {
      const result = await getUserById('00000000-0000-0000-0000-000000000000');
      expect(result).toBeNull();
    });

    test('throws when id is omitted', async () => {
      await expect(getUserById(null)).rejects.toThrow();
    });
  });

  describe('User with Horses', () => {
    test('retrieves a user with an empty horses array when none are linked', async () => {
      expect(createdUserId).toBeTruthy();
      const result = await getUserWithHorses(createdUserId);

      expect(result).not.toBeNull();
      expect(result.id).toBe(createdUserId);
      expect(Array.isArray(result.horses)).toBe(true);
      // No horses were created for this user, so the array is empty
      expect(result.horses.length).toBe(0);
    });
  });
});
