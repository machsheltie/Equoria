/**
 * userUpdates — integration tests (Equoria-rr7)
 *
 * Tests updateUserMoney and transferEntryFees against real DB.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../db/index.mjs';
import { updateUserMoney, transferEntryFees } from '../../../utils/userUpdates.mjs';

const RUN_ID = `${randomBytes(4).toString('hex')}_${Math.floor(Math.random() * 100000)}`;
const PREFIX = `USERUPD_TEST_${RUN_ID}`;

let testUser;

beforeAll(async () => {
  testUser = await prisma.user.create({
    data: {
      username: `${PREFIX}_user`,
      email: `userupd_${RUN_ID}@test.invalid`,
      password: 'x',
      firstName: 'UU',
      lastName: 'Test',
      money: 1000,
    },
  });
}, 30000);

afterAll(async () => {
  await prisma.user.deleteMany({ where: { username: { startsWith: PREFIX } } });
}, 30000);

// ---------------------------------------------------------------------------
// updateUserMoney
// ---------------------------------------------------------------------------
describe('updateUserMoney', () => {
  it('increments money by positive amount', async () => {
    const updated = await updateUserMoney(testUser.id, 500);
    expect(Number(updated.money)).toBeGreaterThanOrEqual(1500);
  });

  it('decrements money by negative amount', async () => {
    const before = await prisma.user.findUnique({
      where: { id: testUser.id },
      select: { money: true },
    });
    const updated = await updateUserMoney(testUser.id, -100);
    expect(Number(updated.money)).toBe(Number(before.money) - 100);
  });

  it('throws for invalid userId (null)', async () => {
    await expect(updateUserMoney(null, 100)).rejects.toThrow('Valid user ID is required');
  });

  it('throws for invalid userId (number)', async () => {
    await expect(updateUserMoney(42, 100)).rejects.toThrow('Valid user ID is required');
  });

  it('throws for invalid amount (string)', async () => {
    await expect(updateUserMoney(testUser.id, 'lots')).rejects.toThrow('Valid amount is required');
  });

  it('throws for unknown userId with P2025 code', async () => {
    await expect(updateUserMoney('00000000-0000-0000-0000-000000000000', 50)).rejects.toThrow('User not found');
  });
});

// ---------------------------------------------------------------------------
// transferEntryFees
// ---------------------------------------------------------------------------
describe('transferEntryFees', () => {
  it('returns null when no hostUserId provided', async () => {
    const result = await transferEntryFees(null, 100, 2);
    expect(result).toBeNull();
  });

  it('transfers total fees (entryFee * numEntries) to host user', async () => {
    const before = await prisma.user.findUnique({
      where: { id: testUser.id },
      select: { money: true },
    });
    await transferEntryFees(testUser.id, 50, 3); // 150 total
    const after = await prisma.user.findUnique({
      where: { id: testUser.id },
      select: { money: true },
    });
    expect(Number(after.money)).toBe(Number(before.money) + 150);
  });

  it('throws for unknown hostUserId', async () => {
    await expect(transferEntryFees('00000000-0000-0000-0000-000000000000', 10, 1)).rejects.toThrow();
  });
});
