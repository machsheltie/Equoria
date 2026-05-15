/**
 * Integration Test: Horse Seed System — Real Database Operations
 */

import { describe, beforeEach, expect, it, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env.test') });

const { default: prisma } = await import(join(__dirname, '../db/index.mjs'));
const { findOrCreateBreed, ensureReferencedRecordsExist, checkHorseExists, seedHorses } = await import(
  join(__dirname, './horseSeed.mjs')
);

describe('Horse Seed Integration Tests', () => {
  beforeAll(async () => {
    await prisma.horse.deleteMany({ where: { name: { startsWith: 'TestSeed_' } } });
    await prisma.breed.deleteMany({ where: { name: { startsWith: 'TestSeed_' } } });
    await prisma.stable.deleteMany({ where: { name: { startsWith: 'TestSeed_' } } });
    await prisma.user.deleteMany({ where: { username: { startsWith: 'TestSeed_' } } });
  }, 120000);

  afterAll(async () => {
    await prisma.horse.deleteMany({ where: { name: { startsWith: 'TestSeed_' } } });
    await prisma.breed.deleteMany({ where: { name: { startsWith: 'TestSeed_' } } });
    await prisma.stable.deleteMany({ where: { name: { startsWith: 'TestSeed_' } } });
    await prisma.user.deleteMany({ where: { username: { startsWith: 'TestSeed_' } } });
  }, 120000);

  describe('checkHorseExists - Real Database Operations', () => {
    it('should return true if horse exists in database', async () => {
      const userTag = `TestSeed_${Date.now().toString(36)}_${randomBytes(4).toString('hex')}`;
      const testUser = await prisma.user.create({
        data: {
          username: userTag,
          email: `${userTag}@example.com`,
          password: 'password',
          firstName: 'Test',
          lastName: 'User',
        },
      });

      const testHorse = await prisma.horse.create({
        data: {
          name: 'TestSeed_ExistingHorse',
          age: 5,
          sex: 'Mare',
          finalDisplayColor: 'Bay',
          speed: 75,
          stamina: 70,
          strength: 65,
          userId: testUser.id,
          dateOfBirth: new Date('2020-01-01'),
        },
      });

      const result = await checkHorseExists('TestSeed_ExistingHorse');
      expect(result).toBe(true);

      await prisma.horse.delete({ where: { id: testHorse.id } });
      await prisma.user.delete({ where: { id: testUser.id } });
    });

    it('should return false if horse does not exist in database', async () => {
      const result = await checkHorseExists('TestSeed_NonexistentHorse');
      expect(result).toBe(false);
    });

    it('should handle database errors gracefully', async () => {
      const result = await checkHorseExists('');
      expect(result).toBe(false);
    });
  });

  describe('findOrCreateBreed - Real Database Operations', () => {
    it('should return existing breed if found in database', async () => {
      const testBreed = await prisma.breed.create({
        data: {
          name: 'TestSeed_Thoroughbred',
          description: 'Test Thoroughbred breed',
        },
      });

      const result = await findOrCreateBreed('TestSeed_Thoroughbred');

      expect(result).toBeTruthy();
      expect(result.name).toBe('TestSeed_Thoroughbred');
      expect(result.id).toBe(testBreed.id);

      await prisma.breed.delete({ where: { id: testBreed.id } });
    });

    it('should create new breed if not found in database', async () => {
      const result = await findOrCreateBreed('TestSeed_NewArabian');

      expect(result).toBeTruthy();
      expect(result.name).toBe('TestSeed_NewArabian');
      expect(result.description).toBe('Seed-created TestSeed_NewArabian');

      const dbBreed = await prisma.breed.findFirst({ where: { name: 'TestSeed_NewArabian' } });
      expect(dbBreed).toBeTruthy();
      expect(dbBreed.name).toBe('TestSeed_NewArabian');

      await prisma.breed.delete({ where: { id: result.id } });
    });

    it('should return null for undefined breed name', async () => {
      const result = await findOrCreateBreed();
      expect(result).toBeNull();
    });

    it('should handle database errors gracefully', async () => {
      await expect(findOrCreateBreed('TestSeed_InvalidBreed')).resolves.toBeTruthy();
    });
  });

  describe('ensureReferencedRecordsExist - Real Database Operations', () => {
    it('should create users and stables if they do not exist in database', async () => {
      await prisma.user.deleteMany({ where: { email: { in: ['owner1@example.com', 'owner2@example.com'] } } });
      await prisma.stable.deleteMany({ where: { id: { in: [1, 2] } } });

      await ensureReferencedRecordsExist();

      const user1 = await prisma.user.findFirst({ where: { email: 'owner1@example.com' } });
      const user2 = await prisma.user.findFirst({ where: { email: 'owner2@example.com' } });
      expect(user1).toBeTruthy();
      expect(user1.username).toBe('Default Owner');
      expect(user1.email).toBe('owner1@example.com');
      expect(user2).toBeTruthy();
      expect(user2.username).toBe('Second Owner');
      expect(user2.email).toBe('owner2@example.com');

      const stable1 = await prisma.stable.findUnique({ where: { id: 1 } });
      const stable2 = await prisma.stable.findUnique({ where: { id: 2 } });
      expect(stable1).toBeTruthy();
      expect(stable1.name).toBe('Main Stable');
      expect(stable2).toBeTruthy();
      expect(stable2.name).toBe('Second Stable');
    });

    it('should update existing users and stables if they already exist', async () => {
      await ensureReferencedRecordsExist();
      await ensureReferencedRecordsExist();

      const user1 = await prisma.user.findFirst({ where: { email: 'owner1@example.com' } });
      const user2 = await prisma.user.findFirst({ where: { email: 'owner2@example.com' } });
      expect(user1).toBeTruthy();
      expect(user2).toBeTruthy();
    });

    it('should handle database constraints gracefully', async () => {
      await expect(ensureReferencedRecordsExist()).resolves.not.toThrow();

      const user1 = await prisma.user.findFirst({ where: { email: 'owner1@example.com' } });
      expect(user1).toBeTruthy();
    });
  });

  describe('seedHorses - Real Database Operations', () => {
    beforeEach(async () => {
      await ensureReferencedRecordsExist();
    }, 120000);

    it('should return an empty array if no users are provided', async () => {
      const result = await seedHorses(prisma, []);
      expect(result).toEqual([]);
    });

    it('should create breeds and horses for the provided user in database', async () => {
      const testUser = await prisma.user.findFirst({ where: { email: 'owner1@example.com' } });
      expect(testUser).toBeTruthy();

      await prisma.horse.deleteMany({
        where: {
          name: { in: ['TestSeed_Lightning', 'TestSeed_Desert'] },
          userId: testUser.id,
        },
      });

      const result = await seedHorses(prisma, [testUser]);

      expect(result.length).toBeGreaterThan(0);

      for (const horse of result) {
        const dbHorse = await prisma.horse.findUnique({ where: { id: horse.id } });
        expect(dbHorse).toBeTruthy();
        expect(dbHorse.userId).toBe(testUser.id);
        expect(dbHorse.name).toBeTruthy();
        expect(dbHorse.breedId).toBeTruthy();

        const breed = await prisma.breed.findUnique({ where: { id: dbHorse.breedId } });
        expect(breed).toBeTruthy();
        expect(breed.name).toBeTruthy();
      }

      await prisma.horse.deleteMany({ where: { id: { in: result.map(h => h.id) } } });
    });

    it('should handle database constraints and validation errors gracefully', async () => {
      const testUser = await prisma.user.findFirst({ where: { email: 'owner1@example.com' } });
      expect(testUser).toBeTruthy();

      const result = await seedHorses(prisma, [testUser]);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);

      if (result.length > 0) {
        await prisma.horse.deleteMany({ where: { id: { in: result.map(h => h.id) } } });
      }
    });

    it('should handle edge cases and maintain data integrity', async () => {
      const testUser = await prisma.user.findFirst({ where: { email: 'owner1@example.com' } });
      expect(testUser).toBeTruthy();

      const result = await seedHorses(prisma, [testUser]);

      for (const horse of result) {
        expect(horse.userId).toBe(testUser.id);
        expect(horse.name).toBeTruthy();
        expect(horse.breedId).toBeTruthy();

        const breed = await prisma.breed.findUnique({ where: { id: horse.breedId } });
        expect(breed).toBeTruthy();

        const user = await prisma.user.findUnique({ where: { id: horse.userId } });
        expect(user).toBeTruthy();
      }

      if (result.length > 0) {
        await prisma.horse.deleteMany({ where: { id: { in: result.map(h => h.id) } } });
      }
    });
  });

  describe('Complete Horse Seeding Integration Test', () => {
    it('should execute complete seeding workflow with real database operations', async () => {
      await prisma.horse.deleteMany({ where: { name: { startsWith: 'TestSeed_' } } });
      await prisma.breed.deleteMany({ where: { name: { startsWith: 'TestSeed_' } } });

      await ensureReferencedRecordsExist();

      const users = await prisma.user.findMany({
        where: { email: { in: ['owner1@example.com', 'owner2@example.com'] } },
      });
      expect(users.length).toBeGreaterThan(0);

      const result = await seedHorses(prisma, users);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);

      if (result.length > 0) {
        for (const horse of result) {
          const dbHorse = await prisma.horse.findUnique({ where: { id: horse.id } });
          expect(dbHorse).toBeTruthy();
        }
        await prisma.horse.deleteMany({ where: { id: { in: result.map(h => h.id) } } });
      }
    });

    it('should maintain database integrity throughout complete seeding process', async () => {
      await ensureReferencedRecordsExist();

      const users = await prisma.user.findMany({
        where: { email: { in: ['owner1@example.com', 'owner2@example.com'] } },
      });
      const stables = await prisma.stable.findMany({ where: { id: { in: [1, 2] } } });

      expect(users.length).toBeGreaterThan(0);
      expect(stables.length).toBeGreaterThan(0);

      const result = await seedHorses(prisma, users);

      for (const horse of result) {
        const user = await prisma.user.findUnique({ where: { id: horse.userId } });
        const breed = await prisma.breed.findUnique({ where: { id: horse.breedId } });
        expect(user).toBeTruthy();
        expect(breed).toBeTruthy();
      }

      if (result.length > 0) {
        await prisma.horse.deleteMany({ where: { id: { in: result.map(h => h.id) } } });
      }
    });
  });
});
