/**
 * Horse.earnings column drop sentinel (Equoria-8nmxm).
 *
 * Asserts the dead Horse.earnings (Decimal) column is gone from the live
 * schema and that the production writer (updateHorseEarnings) increments
 * the canonical Horse.totalEarnings (Int) column instead.
 *
 * A regression that re-adds the Decimal column OR re-aims the writer at
 * the wrong column fails this test.
 *
 * Real DB, scoped fixtures.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import prisma from '../../packages/database/prismaClient.mjs';
import { fixtureColor } from '../tests/helpers/fixtureColor.mjs';
import { updateHorseEarnings } from '../utils/horseUpdates.mjs';

const FIXTURE_PREFIX = 'TestFixture-8nmxm';

let user;
let horse;
const createdUserIds = [];
const createdHorseIds = [];

beforeAll(async () => {
  const tag = randomBytes(4).toString('hex');
  const pw = await bcrypt.hash('TestPassword123!', 1);
  user = await prisma.user.create({
    data: {
      username: `${FIXTURE_PREFIX}-${tag}`,
      email: `${FIXTURE_PREFIX}-${tag}@test.com`,
      password: pw,
      firstName: 'Earn',
      lastName: 'Sentinel',
      money: 0,
    },
  });
  createdUserIds.push(user.id);
  horse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `${FIXTURE_PREFIX}-horse-${tag}`,
      sex: 'Mare',
      dateOfBirth: new Date('2019-06-15'),
      age: 6,
      userId: user.id,
      totalEarnings: 100,
    },
  });
  createdHorseIds.push(horse.id);
}, 60000);

afterAll(async () => {
  if (createdHorseIds.length) {
    await prisma.horse
      .deleteMany({ where: { id: { in: createdHorseIds } } })
      .catch(err => console.warn(`[cleanup] ${err.message}`));
  }
  if (createdUserIds.length) {
    await prisma.user
      .deleteMany({ where: { id: { in: createdUserIds } } })
      .catch(err => console.warn(`[cleanup] ${err.message}`));
  }
}, 30000);

describe('Horse.earnings column drop (Equoria-8nmxm)', () => {
  it('STRUCTURAL: Horse.earnings column no longer exists in the live schema', async () => {
    const rows = await prisma.$queryRaw`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'horses'
        AND column_name = 'earnings'
    `;
    expect(rows).toHaveLength(0);
  });

  it('STRUCTURAL: Horse.totalEarnings column DOES exist (the canonical one)', async () => {
    const rows = await prisma.$queryRaw`
      SELECT column_name, data_type FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'horses'
        AND column_name = 'totalEarnings'
    `;
    expect(rows).toHaveLength(1);
    expect(rows[0].data_type).toBe('integer');
  });

  it('SENTINEL: updateHorseEarnings increments Horse.totalEarnings (not the dropped column)', async () => {
    const before = await prisma.horse.findUnique({
      where: { id: horse.id },
      select: { totalEarnings: true },
    });
    await updateHorseEarnings(horse.id, 250);
    const after = await prisma.horse.findUnique({
      where: { id: horse.id },
      select: { totalEarnings: true },
    });
    expect(Number(after.totalEarnings)).toBe(Number(before.totalEarnings ?? 0) + 250);
  });
});
