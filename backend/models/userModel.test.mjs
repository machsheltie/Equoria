/**
 * 🧪 User Model — REAL DB integration tests (Equoria-382n6)
 *
 * Per CLAUDE.md Testing Philosophy ("No mocks. Ever. All backend tests run
 * against the real test database"), this suite was converted from mocking
 * the Prisma client and `../modules/users/services/gdprAccountService.mjs`
 * (eraseUserAccount) to running the real userModel functions against the
 * canonical DB.
 *
 * The previous mock-based version asserted that the model *called* Prisma with
 * specific args and returned the mock's value — which proves nothing about the
 * real DB schema, constraints, XP math against persisted rows, or the real
 * eraseUserAccount cascade. This version creates real `TestFixture-` users,
 * exercises the real functions, and asserts on persisted state.
 *
 * Validation-error branches (missing required field, lookups with no id) need
 * no DB row and are exercised directly. Real Prisma error branches (P2002
 * duplicate, P2025 not-found) are driven by real constraint violations.
 *
 * Fixtures use the `TestFixture-` prefix and scoped (id-keyed) cleanup per
 * CONTRIBUTING.md / CLAUDE.md §2. No bare `deleteMany()`; no mocks.
 */

import { describe, afterAll, expect, it } from '@jest/globals';
import { randomBytes } from 'node:crypto';

import prisma from '../../packages/database/prismaClient.mjs';
import {
  createUser,
  getUserById,
  getUserByEmail,
  getUserWithHorses,
  updateUser,
  deleteUser,
  addXpToUser,
  getUserProgress,
  getUserStats,
} from './userModel.mjs';
import { DatabaseError } from '../errors/index.mjs';

const PREFIX = `TestFixture-userModel-${randomBytes(4).toString('hex')}`;
const createdUserIds = [];

function uniqueUserData(suffix, overrides = {}) {
  const tag = randomBytes(4).toString('hex');
  return {
    username: `${PREFIX}-${suffix}-${tag}`,
    email: `${PREFIX}-${suffix}-${tag}@example.com`,
    password: 'TestPassword123!',
    firstName: 'UserModel',
    lastName: suffix,
    ...overrides,
  };
}

/** Create a user via the real model fn and track its id for scoped cleanup. */
async function makeUser(suffix, overrides = {}) {
  const user = await createUser(uniqueUserData(suffix, overrides));
  createdUserIds.push(user.id);
  return user;
}

afterAll(async () => {
  // Scoped cleanup — only the rows this suite created (CLAUDE.md §2).
  if (createdUserIds.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    createdUserIds.length = 0;
  }
});

describe('👤 User Model — Database Operations & Business Logic (real DB)', () => {
  describe('createUser', () => {
    it('creates a user and persists it (email lower-cased, selected fields returned)', async () => {
      const data = uniqueUserData('create', { email: undefined });
      data.email = `${PREFIX}-CREATE-${randomBytes(4).toString('hex')}@EXAMPLE.COM`;

      const result = await createUser(data);
      createdUserIds.push(result.id);

      expect(result.id).toBeTruthy();
      expect(result.username).toBe(data.username);
      expect(result.email).toBe(data.email.toLowerCase());
      // select clause returns these scalar fields:
      expect(result.level).toBe(1);
      expect(result.xp).toBe(0);

      // Round-trip: the row really exists with the lower-cased email.
      const persisted = await prisma.user.findUnique({ where: { id: result.id } });
      expect(persisted.email).toBe(data.email.toLowerCase());
    });

    it('throws if username is missing', async () => {
      const { username: _u, ...incomplete } = uniqueUserData('nousername');
      await expect(createUser(incomplete)).rejects.toThrow('Username, email, and password are required.');
    });

    it('throws if email is missing', async () => {
      const { email: _e, ...incomplete } = uniqueUserData('noemail');
      await expect(createUser(incomplete)).rejects.toThrow('Username, email, and password are required.');
    });

    it('throws if password is missing', async () => {
      const { password: _p, ...incomplete } = uniqueUserData('nopassword');
      await expect(createUser(incomplete)).rejects.toThrow('Username, email, and password are required.');
    });

    it('re-throws P2002 with .code preserved on duplicate username (Equoria-iqdc7)', async () => {
      const first = await makeUser('dupuser');
      // Same username, different email → unique violation on username.
      const dupe = uniqueUserData('dupuser2', { username: first.username });
      await expect(createUser(dupe)).rejects.toMatchObject({ code: 'P2002' });
    });

    it('re-throws P2002 with .code preserved on duplicate email (Equoria-iqdc7)', async () => {
      const first = await prisma.user.findUnique({ where: { id: createdUserIds[createdUserIds.length - 1] } });
      const dupe = uniqueUserData('dupemail', { email: first.email });
      await expect(createUser(dupe)).rejects.toMatchObject({ code: 'P2002' });
    });
  });

  describe('getUserById', () => {
    it('returns the user when found', async () => {
      const user = await makeUser('getbyid');
      const result = await getUserById(user.id);
      expect(result).not.toBeNull();
      expect(result.id).toBe(user.id);
      expect(result.username).toBe(user.username);
    });

    it('returns null when the user is not found', async () => {
      const result = await getUserById('00000000-0000-0000-0000-000000000000');
      expect(result).toBeNull();
    });

    it('throws DatabaseError if id is not provided', async () => {
      await expect(getUserById(null)).rejects.toThrow(new DatabaseError('Lookup failed: User ID is required.'));
      await expect(getUserById()).rejects.toThrow(new DatabaseError('Lookup failed: User ID is required.'));
    });
  });

  describe('getUserByEmail', () => {
    it('returns the user by email (case-insensitive)', async () => {
      const user = await makeUser('getbyemail');
      const persisted = await prisma.user.findUnique({ where: { id: user.id } });
      const result = await getUserByEmail(persisted.email.toUpperCase());
      expect(result).not.toBeNull();
      expect(result.id).toBe(user.id);
    });

    it('throws DatabaseError if email is not provided', async () => {
      await expect(getUserByEmail('')).rejects.toThrow(new DatabaseError('Lookup failed: Email required.'));
      await expect(getUserByEmail(null)).rejects.toThrow(new DatabaseError('Lookup failed: Email required.'));
    });
  });

  describe('getUserWithHorses', () => {
    it('returns the user with an (empty) horses relation', async () => {
      const user = await makeUser('withhorses');
      const result = await getUserWithHorses(user.id);
      expect(result).not.toBeNull();
      expect(result.id).toBe(user.id);
      expect(Array.isArray(result.horses)).toBe(true);
    });

    it('throws DatabaseError if id is not provided', async () => {
      await expect(getUserWithHorses(null)).rejects.toThrow(new DatabaseError('Lookup failed: User ID is required.'));
    });
  });

  describe('updateUser', () => {
    it('updates persisted fields', async () => {
      const user = await makeUser('update');
      const result = await updateUser(user.id, { money: 1500, level: 3 });
      expect(result.money).toBe(1500);
      expect(result.level).toBe(3);

      const persisted = await prisma.user.findUnique({ where: { id: user.id } });
      expect(persisted.money).toBe(1500);
      expect(persisted.level).toBe(3);
    });

    it('throws DatabaseError if id is not provided', async () => {
      await expect(updateUser(null, { money: 1 })).rejects.toThrow(
        new DatabaseError('Update failed: User ID is required.'),
      );
    });

    it('returns null when the user does not exist (P2025)', async () => {
      const result = await updateUser('00000000-0000-0000-0000-000000000000', { money: 1 });
      expect(result).toBeNull();
    });
  });

  describe('deleteUser', () => {
    it('deletes a real user via the real eraseUserAccount cascade', async () => {
      // Track separately so we do not also try to delete it in afterAll.
      const user = await createUser(uniqueUserData('delete'));
      const result = await deleteUser(user.id);
      expect(result).toEqual({ id: user.id });

      // The row is really gone.
      const persisted = await prisma.user.findUnique({ where: { id: user.id } });
      expect(persisted).toBeNull();
    });

    it('throws DatabaseError if id is not provided', async () => {
      await expect(deleteUser(null)).rejects.toThrow(new DatabaseError('Delete failed: User ID is required.'));
    });

    it('returns null when the user does not exist (idempotent erase)', async () => {
      const result = await deleteUser('00000000-0000-0000-0000-000000000000');
      expect(result).toBeNull();
    });
  });

  describe('addXpToUser', () => {
    it('adds XP without leveling up', async () => {
      const user = await makeUser('xp-nolevel', { xp: 50, level: 1 });
      const result = await addXpToUser(user.id, 20);
      // xpThreshold(level+1) = 100*2 = 200; 70 < 200 → no level up.
      expect(result).toMatchObject({
        success: true,
        currentXP: 70,
        currentLevel: 1,
        leveledUp: false,
        levelsGained: 0,
        xpGained: 20,
      });
    });

    it('adds XP and levels up', async () => {
      const user = await makeUser('xp-levelup', { xp: 50, level: 1 });
      const result = await addXpToUser(user.id, 150);
      // 50 + 150 = 200 >= xpThreshold(2)=200 → level 2.
      expect(result).toMatchObject({
        success: true,
        currentXP: 200,
        currentLevel: 2,
        leveledUp: true,
        levelsGained: 1,
        xpGained: 150,
      });
    });

    it('returns an error envelope for a non-positive XP amount', async () => {
      const user = await makeUser('xp-bad');
      const result = await addXpToUser(user.id, -5);
      expect(result).toMatchObject({ success: false, error: 'XP amount must be a positive number.' });
    });

    it('returns an error envelope for a missing user id', async () => {
      const result = await addXpToUser(null, 20);
      expect(result).toMatchObject({ success: false, error: 'User ID is required.' });
    });

    it('returns an error envelope when the user is not found', async () => {
      const result = await addXpToUser('00000000-0000-0000-0000-000000000000', 20);
      expect(result).toMatchObject({ success: false, error: 'User not found.' });
    });
  });

  describe('getUserProgress', () => {
    it('returns progress with XP-to-next-level math against the persisted row', async () => {
      const user = await makeUser('progress', { xp: 50, level: 1 });
      const result = await getUserProgress(user.id);
      expect(result).toEqual({
        userId: user.id,
        level: 1,
        xp: 50,
        xpToNextLevel: 150, // xpThreshold(2)=200 - 50
        xpForNextLevel: 200,
      });
    });

    it('throws DatabaseError if id is not provided', async () => {
      await expect(getUserProgress(null)).rejects.toThrow(
        new DatabaseError('Progress fetch failed: Lookup failed: User ID is required.'),
      );
    });

    it('throws DatabaseError when the user is not found', async () => {
      await expect(getUserProgress('00000000-0000-0000-0000-000000000000')).rejects.toThrow(
        new DatabaseError('Progress fetch failed: User not found.'),
      );
    });
  });

  describe('getUserStats', () => {
    it('returns stats for a user with no horses (count 0, avg age 0)', async () => {
      const user = await makeUser('stats-nohorses', { money: 500, level: 2, xp: 25 });
      const result = await getUserStats(user.id);
      expect(result).toMatchObject({
        id: user.id,
        username: user.username,
        money: 500,
        level: 2,
        xp: 25,
        horseCount: 0,
        averageHorseAge: 0,
      });
    });

    it('returns null for a non-existent user', async () => {
      const result = await getUserStats('00000000-0000-0000-0000-000000000000');
      expect(result).toBeNull();
    });

    it('throws DatabaseError if id is not provided', async () => {
      await expect(getUserStats(null)).rejects.toThrow(new DatabaseError('Stats fetch failed: User ID is required.'));
    });
  });
});
