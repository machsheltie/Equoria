/**
 * Integration Tests: User Model — Real Database
 *
 * Tests createUser, getUserById, getUserWithHorses, and deleteUser
 * against the real test database. No mocks — every assertion exercises
 * the actual Prisma client and PostgreSQL constraint layer.
 *
 * Story 21R-2 / Change 8: Reclassify and Strengthen Integration Tests
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import bcrypt from 'bcryptjs';
import prisma from '../../packages/database/prismaClient.mjs';
import {
  createUser,
  getUserById,
  getUserWithHorses,
  deleteUser,
} from '../../backend/models/userModel.mjs';

// Unique seed per run to prevent collisions across parallel test suites
const seed = Date.now();
const BASE_EMAIL = `integration-user-${seed}@test.local`;
const BASE_USERNAME = `intuser${seed}`;

let createdUserId = null;

beforeAll(async () => {
  // Clean any leftovers from previous runs with same seed (extremely unlikely but safe)
  await prisma.user.deleteMany({ where: { email: { contains: '@test.local' } } });
});

afterAll(async () => {
  // Remove any users created by these tests
  await prisma.user.deleteMany({ where: { email: { contains: '@test.local' } } });
  await prisma.$disconnect();
});

describe('User Integration Tests', () => {
  describe('User Creation', () => {
    test('creates a user and returns id, username, email, level, xp, money', async () => {
      const hashedPassword = await bcrypt.hash('TestPassword123!', 10);
      const userData = {
        username: BASE_USERNAME,
        email: BASE_EMAIL,
        password: hashedPassword,
        firstName: 'Integration',
        lastName: 'Test',
      };

      const result = await createUser(userData);

      expect(result).toMatchObject({
        username: BASE_USERNAME,
        email: BASE_EMAIL,
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
        createUser({ email: `missing-user-${seed}@test.local`, password: 'x', firstName: 'A', lastName: 'B' })
      ).rejects.toThrow('Username, email, and password are required.');
    });

    test('rejects creation when email is missing', async () => {
      await expect(
        createUser({ username: `noEmail${seed}`, password: 'x', firstName: 'A', lastName: 'B' })
      ).rejects.toThrow('Username, email, and password are required.');
    });

    test('rejects duplicate username with a Duplicate error', async () => {
      const hashedPassword = await bcrypt.hash('TestPassword123!', 10);
      // Use same username, different email
      await expect(
        createUser({
          username: BASE_USERNAME,
          email: `dup-${seed}@test.local`,
          password: hashedPassword,
          firstName: 'Dup',
          lastName: 'User',
        })
      ).rejects.toThrow(/Duplicate value/);
    });
  });

  describe('User Retrieval', () => {
    test('retrieves a user by ID', async () => {
      expect(createdUserId).toBeTruthy();
      const user = await getUserById(createdUserId);

      expect(user).not.toBeNull();
      expect(user.id).toBe(createdUserId);
      expect(user.username).toBe(BASE_USERNAME);
      expect(user.email).toBe(BASE_EMAIL);
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

  describe('User Deletion', () => {
    test('deletes an existing user and returns the deleted record', async () => {
      // Create a disposable user to delete
      const hashedPassword = await bcrypt.hash('TestPassword123!', 10);
      const toDelete = await createUser({
        username: `del${seed}`,
        email: `del-${seed}@test.local`,
        password: hashedPassword,
        firstName: 'Delete',
        lastName: 'Me',
      });

      const deleted = await deleteUser(toDelete.id);
      expect(deleted).not.toBeNull();
      expect(deleted.id).toBe(toDelete.id);

      // Confirm it's actually gone
      const lookup = await getUserById(toDelete.id);
      expect(lookup).toBeNull();
    });

    test('returns null when deleting a non-existent user', async () => {
      const result = await deleteUser('00000000-0000-0000-0000-000000000001');
      expect(result).toBeNull();
    });
  });
});
