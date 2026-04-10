/**
 * Integration Test: User Model — Real Database
 *
 * Tests the real userModel functions against the test database.
 * No mocks of business logic — these tests exercise the actual SQL queries
 * and data mapping. If they fail, the real code is broken.
 */

import { describe, expect, beforeAll, afterAll, test } from '@jest/globals';
import prisma from '../../../packages/database/prismaClient.mjs';
import bcrypt from 'bcryptjs';
import { getUserById, getUserWithHorses, getUserByEmail } from '../../models/userModel.mjs';

const UNIQUE = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

let testUser;
let testHorseIds = [];

beforeAll(async () => {
  const hashedPassword = await bcrypt.hash('TestPassword123!', 10);

  testUser = await prisma.user.create({
    data: {
      username: `user_int_${UNIQUE}`,
      firstName: 'Integration',
      lastName: 'Test',
      email: `user_int_${UNIQUE}@example.com`,
      password: hashedPassword,
      money: 750,
      level: 3,
      xp: 1000,
    },
  });

  // Create two horses owned by this user so getUserWithHorses has data to return
  let breed = await prisma.breed.findFirst({ where: { name: 'Thoroughbred' } });
  if (!breed) {
    breed = await prisma.breed.create({
      data: { name: 'Thoroughbred', description: 'Test breed' },
    });
  }

  const horseNames = [`Comet_${UNIQUE}`, `Starlight_${UNIQUE}`];
  for (const name of horseNames) {
    const horse = await prisma.horse.create({
      data: {
        name,
        sex: 'Female',
        dateOfBirth: new Date('2019-01-01'),
        age: 5,
        breed: { connect: { id: breed.id } },
        user: { connect: { id: testUser.id } },
      },
    });
    testHorseIds.push(horse.id);
  }
});

afterAll(async () => {
  await prisma.horse.deleteMany({ where: { id: { in: testHorseIds } } });
  await prisma.user.delete({ where: { id: testUser.id } });
});

describe('User Model — Real Database', () => {
  describe('getUserById', () => {
    test('returns user for valid ID', async () => {
      const user = await getUserById(testUser.id);

      expect(user).toBeDefined();
      expect(user.id).toBe(testUser.id);
      expect(user.username).toBe(testUser.username);
      expect(user.email).toBe(testUser.email);
      expect(user.money).toBe(750);
      expect(user.level).toBe(3);
      expect(user.xp).toBe(1000);
    });

    test('returns null for non-existent ID', async () => {
      const user = await getUserById('00000000-0000-0000-0000-000000000000');
      expect(user).toBeNull();
    });
  });

  describe('getUserByEmail', () => {
    test('returns user for valid email', async () => {
      const user = await getUserByEmail(testUser.email);

      expect(user).toBeDefined();
      expect(user.id).toBe(testUser.id);
      expect(user.email).toBe(testUser.email);
    });

    test('returns null for non-existent email', async () => {
      const user = await getUserByEmail('nobody_real@fake-domain-xyz.com');
      expect(user).toBeNull();
    });
  });

  describe('getUserWithHorses', () => {
    test('returns user with their horses', async () => {
      const userWithHorses = await getUserWithHorses(testUser.id);

      expect(userWithHorses).toBeDefined();
      expect(userWithHorses.id).toBe(testUser.id);
      expect(Array.isArray(userWithHorses.horses)).toBe(true);
      expect(userWithHorses.horses.length).toBeGreaterThanOrEqual(2);

      const names = userWithHorses.horses.map(h => h.name);
      expect(names).toEqual(expect.arrayContaining([`Comet_${UNIQUE}`, `Starlight_${UNIQUE}`]));
    });

    test('horses are linked to the correct user', async () => {
      const userWithHorses = await getUserWithHorses(testUser.id);

      userWithHorses.horses.forEach(horse => {
        expect(horse.userId).toBe(testUser.id);
      });
    });
  });

  describe('Email uniqueness (real DB constraint)', () => {
    test('attempting to create duplicate email throws', async () => {
      const hashedPassword = await bcrypt.hash('password', 10);
      // .rejects.toThrow() fails under --experimental-vm-modules when the
      // rejection comes from a cross-VM-realm Prisma error class. Use a
      // manual try/catch so the assertion is realm-agnostic.
      let threw = false;
      try {
        await prisma.user.create({
          data: {
            username: `duplicate_${UNIQUE}`,
            firstName: 'Dupe',
            lastName: 'User',
            email: testUser.email, // same email — should violate unique constraint
            password: hashedPassword,
          },
        });
      } catch {
        threw = true;
      }
      expect(threw).toBe(true);
    });
  });
});
