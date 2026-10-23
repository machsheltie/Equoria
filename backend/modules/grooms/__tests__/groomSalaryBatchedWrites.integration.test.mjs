/**
 * The weekly fee pass writes a player's payment rows in one statement
 * (Equoria-cmw85.37).
 *
 * The defect: inside each player's transaction the pass did, per groom, one
 * engagement lookup (plus an insert for a groom with no engagement row) and one
 * payment insert, so the statements per player grew with the size of their
 * staff. The contract now: payment rows land through one createMany and missing
 * engagements through one lookup and one createMany, whatever the staff size.
 *
 * Mechanism (no Prisma mock, no spy), as in dynamicCompatibilityReads: the
 * shared client module adopts a `globalThis.__prisma` handle installed before it
 * loads, pointed at a REAL PrismaClient with query-event logging. The recorded
 * statements are the pass's real SQL.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';

let observedClient = null;
const appClientHandle = new Proxy(
  {},
  {
    get(_target, prop) {
      if (!observedClient) {
        return prop === '$disconnect' ? async () => {} : undefined;
      }
      const value = Reflect.get(observedClient, prop);
      return typeof value === 'function' ? value.bind(observedClient) : value;
    },
  },
);
globalThis.__prisma = appClientHandle;

const { default: prisma, PrismaClient } = await import('../../../../packages/database/prismaClient.mjs');
const { buildDatabaseUrl } = await import('../../../../packages/database/dbPoolConfig.mjs');

observedClient = new PrismaClient({
  datasources: { db: { url: buildDatabaseUrl(process.env.DATABASE_URL, process.env) } },
  log: [{ emit: 'event', level: 'query' }],
  errorFormat: 'minimal',
});
const { createQueryEventRecorder } = await import('../../../__tests__/helpers/queryEventRecorder.mjs');
const recorder = createQueryEventRecorder(observedClient);

const { processWeeklySalaries } = await import('../services/groomSalaryService.mjs');
const { SYSTEM_ACCOUNT_BURN } = await import('../../economy/index.mjs');
const { fixtureColor } = await import('../../../tests/helpers/fixtureColor.mjs');

const PREFIX = `TestFixture-cmw8537-${randomBytes(3).toString('hex')}`;
const STAFF_SIZE = 6;
const FEE_ONE_HORSE = 70; // one groom on one horse (Equoria-95yrv)

let user;
const groomIds = [];
const horseIds = [];

const inserts = (statements, table) =>
  statements.filter(sql => /^INSERT\b/i.test(sql) && sql.includes(`INTO "public"."${table}"`));
const selects = (statements, table) =>
  statements.filter(sql => /^SELECT\b/i.test(sql) && sql.includes(`FROM "public"."${table}"`));

beforeAll(async () => {
  expect(prisma).toBe(appClientHandle);
  await prisma.systemAccount.upsert({
    where: { name: SYSTEM_ACCOUNT_BURN },
    create: { name: SYSTEM_ACCOUNT_BURN, balance: 0 },
    update: {},
  });
  user = await prisma.user.create({
    data: {
      email: `${PREFIX}@test.com`,
      username: PREFIX.slice(0, 30),
      password: 'irrelevant-hash',
      firstName: 'Batch',
      lastName: 'Fees',
      money: 10000,
    },
  });
  for (let i = 0; i < STAFF_SIZE; i++) {
    const groom = await prisma.groom.create({
      data: {
        name: `${PREFIX}-Groom-${i}`,
        speciality: 'general',
        personality: 'gentle',
        skillLevel: 'novice',
        userId: user.id,
      },
    });
    groomIds.push(groom.id);
    const horse = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `${PREFIX}-Horse-${i}`,
        sex: 'Filly',
        dateOfBirth: new Date(),
        age: 0,
        userId: user.id,
      },
    });
    horseIds.push(horse.id);
    await prisma.groomAssignment.create({
      data: { foalId: horse.id, groomId: groom.id, userId: user.id, isActive: true },
    });
  }
}, 60000);

afterAll(async () => {
  await prisma.groomSalaryPayment.deleteMany({ where: { userId: user.id } });
  await prisma.userTransaction.deleteMany({ where: { userId: user.id } });
  await prisma.groomAssignment.deleteMany({ where: { groomId: { in: groomIds } } });
  await prisma.groomEngagement.deleteMany({ where: { groomId: { in: groomIds } } });
  await prisma.horse.deleteMany({ where: { id: { in: horseIds } } });
  await prisma.groom.deleteMany({ where: { id: { in: groomIds } } });
  await prisma.user.deleteMany({ where: { id: user.id } });
  await observedClient.$disconnect();
}, 60000);

describe('weekly fee pass batches a player’s writes (Equoria-cmw85.37)', () => {
  it('pays a six-groom staff with one payment insert and one engagement lookup, and stays idempotent', async () => {
    const now = new Date();
    const { result, statements } = await recorder.measure(() => processWeeklySalaries(now, { userId: user.id }));

    expect(result.successful).toBe(1);
    expect(result.totalAmount).toBe(STAFF_SIZE * FEE_ONE_HORSE);

    // The batching claim: statement counts do not scale with STAFF_SIZE.
    expect(inserts(statements, 'groom_salary_payments')).toHaveLength(1);
    expect(selects(statements, 'groom_engagements')).toHaveLength(1);
    expect(inserts(statements, 'groom_engagements')).toHaveLength(1);

    // Same outcome as the per-row writes: one paid row per groom, each at its fee,
    // every groom with exactly one open engagement, and the wallet debited once.
    const rows = await prisma.groomSalaryPayment.findMany({ where: { userId: user.id } });
    expect(rows).toHaveLength(STAFF_SIZE);
    expect(new Set(rows.map(row => row.groomId))).toEqual(new Set(groomIds));
    for (const row of rows) {
      expect(row).toMatchObject({ amount: FEE_ONE_HORSE, status: 'paid', paymentType: 'weeklySalary' });
    }
    const engagements = await prisma.groomEngagement.findMany({
      where: { groomId: { in: groomIds }, endedAt: null },
    });
    expect(engagements).toHaveLength(STAFF_SIZE);
    const after = await prisma.user.findUnique({ where: { id: user.id }, select: { money: true } });
    expect(Number(after.money)).toBe(10000 - STAFF_SIZE * FEE_ONE_HORSE);

    // Re-running in the same pay week pays nobody twice (Equoria-icqqm still holds).
    const rerun = await processWeeklySalaries(now, { userId: user.id });
    expect(rerun.skipped).toBe(1);
    expect(await prisma.groomSalaryPayment.count({ where: { userId: user.id } })).toBe(STAFF_SIZE);
  }, 60000);
});
