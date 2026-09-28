/**
 * Integration test — foaling commits the pregnancy clear and the foal as ONE
 * transaction (Equoria-bvddn.20). Real DB, real code, no mocks.
 *
 * The defect: foaling cleared the mare's pregnancy in one autocommit write,
 * created the foal in a second, and on failure ran a THIRD write to restore the
 * pregnancy. Anything that stops that third write — a process crash or deploy
 * restart between the steps, or the restore itself being rejected — leaves the
 * mare no longer pregnant and no foal: the pregnancy is silently lost.
 *
 * A crash cannot be staged inside Jest, so the in-process stand-in is a
 * genuine database rejection of BOTH the foal insert and the compensating
 * restore (a scoped temporary CHECK constraint, NOT VALID so existing rows are
 * untouched). With one transaction there is no restore to run: the rollback
 * alone leaves the mare pregnant. A second case rejects only the foal insert;
 * that one also passed before the fix, because the in-process compensation
 * worked — it pins that the atomic path keeps the same outcome.
 *
 * The concurrency case pins that two overlapping job runs for one mare still
 * produce exactly one foal and one foal_born notification.
 */
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma, { Prisma } from '../../../../packages/database/prismaClient.mjs';
import { runFoalingJob, createFoalFromPregnancy } from '../services/foalingService.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const DAY_MS = 24 * 60 * 60 * 1000;
const FIXTURE_PREFIX = 'TestFixture-bvddn20';
const tag = randomBytes(4).toString('hex');
const constraintName = `tf_bvddn20_block_foal_${tag}`;

let testUser;
let breedId;
const cleanup = createCleanupTracker();

function dropConstraint() {
  return prisma.$executeRaw(Prisma.sql`ALTER TABLE horses DROP CONSTRAINT IF EXISTS ${Prisma.raw(constraintName)}`);
}

async function createPregnantMare(label) {
  const dob = new Date(Date.now() - 5 * 365 * DAY_MS);
  const sire = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `${FIXTURE_PREFIX}-Sire-${label}-${tag}`,
      sex: 'Stallion',
      dateOfBirth: dob,
      age: 5,
      breedId,
      userId: testUser.id,
      healthStatus: 'Good',
    },
  });
  const inFoalSinceDate = new Date(Date.now() - 8 * DAY_MS);
  const dam = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `${FIXTURE_PREFIX}-Dam-${label}-${tag}`,
      sex: 'Mare',
      dateOfBirth: dob,
      age: 5,
      breedId,
      userId: testUser.id,
      healthStatus: 'Good',
      inFoalSinceDate,
      pregnancySireId: sire.id,
      pregnancyFeedingsByTier: { performance: 2 },
      pendingFoalName: `${FIXTURE_PREFIX}-Foal-${label}-${tag}`,
    },
  });
  return { sire, dam, inFoalSinceDate };
}

/**
 * Block the foal insert (any row whose damId is this mare) AND any write that
 * leaves this mare pregnant — which is exactly the compensating restore. The
 * pregnancy clear itself (inFoalSinceDate -> NULL) still satisfies it.
 */
async function blockFoalAndRestore(damId) {
  const id = Prisma.raw(String(damId));
  await prisma.$executeRaw(
    Prisma.sql`ALTER TABLE horses ADD CONSTRAINT ${Prisma.raw(constraintName)} CHECK ("damId" IS DISTINCT FROM ${id} AND (id <> ${id} OR "inFoalSinceDate" IS NULL)) NOT VALID`,
  );
}

/** Block only the foal insert; the restore would be allowed. */
async function blockFoalOnly(damId) {
  const id = Prisma.raw(String(damId));
  await prisma.$executeRaw(
    Prisma.sql`ALTER TABLE horses ADD CONSTRAINT ${Prisma.raw(constraintName)} CHECK ("damId" IS DISTINCT FROM ${id}) NOT VALID`,
  );
}

async function expectStillPregnantWithNoFoal(dam, sire, inFoalSinceDate) {
  const after = await prisma.horse.findUnique({
    where: { id: dam.id },
    select: { inFoalSinceDate: true, pregnancySireId: true, pendingFoalName: true },
  });
  expect(after.inFoalSinceDate?.getTime()).toBe(inFoalSinceDate.getTime());
  expect(after.pregnancySireId).toBe(sire.id);
  expect(after.pendingFoalName).toBe(dam.pendingFoalName);
  expect(await prisma.horse.count({ where: { damId: dam.id } })).toBe(0);
}

beforeAll(async () => {
  testUser = await prisma.user.create({
    data: {
      email: `${FIXTURE_PREFIX}-${tag}@test.com`,
      username: `${FIXTURE_PREFIX}-${tag}`.slice(0, 30),
      password: 'irrelevant-hash',
      firstName: 'Atomic',
      lastName: 'Foaling',
      money: 0,
    },
  });
  const breed = await prisma.breed.upsert({
    where: { name: 'Thoroughbred' },
    update: {},
    create: { name: 'Thoroughbred', description: 'bvddn.20 test breed' },
  });
  breedId = breed.id;
}, 60000);

afterAll(async () => {
  cleanup.add(() => dropConstraint(), 'check constraint');
  if (testUser) {
    cleanup.add(() => prisma.notification.deleteMany({ where: { userId: testUser.id } }), 'notifications');
    cleanup.add(() => prisma.horse.deleteMany({ where: { userId: testUser.id, age: 0 } }), 'foals');
    cleanup.add(() => prisma.horse.deleteMany({ where: { userId: testUser.id } }), 'horses');
    cleanup.add(() => prisma.user.deleteMany({ where: { id: testUser.id } }), 'users');
  }
  await cleanup.run();
}, 30000);

describe('foaling is one transaction — the pregnancy is never lost (Equoria-bvddn.20)', () => {
  it('foaling job: when the foal insert AND the restore are both rejected, the mare is still pregnant', async () => {
    const { sire, dam, inFoalSinceDate } = await createPregnantMare('jobboth');

    await blockFoalAndRestore(dam.id);
    let result;
    try {
      result = await runFoalingJob();
    } finally {
      await dropConstraint();
    }

    expect(result.errors.map(e => e.damId)).toContain(dam.id);
    await expectStillPregnantWithNoFoal(dam, sire, inFoalSinceDate);
  });

  it('foal-now path: when the foal insert AND the restore are both rejected, the mare is still pregnant', async () => {
    const { sire, dam, inFoalSinceDate } = await createPregnantMare('directboth');

    await blockFoalAndRestore(dam.id);
    let outcome;
    try {
      outcome = await createFoalFromPregnancy({ damId: dam.id }).then(
        value => ({ threw: false, value }),
        error => ({ threw: true, error }),
      );
    } finally {
      await dropConstraint();
    }

    expect(outcome.threw).toBe(true);
    await expectStillPregnantWithNoFoal(dam, sire, inFoalSinceDate);
  });

  it('foaling job: when only the foal insert is rejected, the mare is still pregnant and foals on the next run', async () => {
    const { sire, dam, inFoalSinceDate } = await createPregnantMare('jobfoal');

    await blockFoalOnly(dam.id);
    let result;
    try {
      result = await runFoalingJob();
    } finally {
      await dropConstraint();
    }

    expect(result.errors.map(e => e.damId)).toContain(dam.id);
    await expectStillPregnantWithNoFoal(dam, sire, inFoalSinceDate);

    await runFoalingJob();
    expect(await prisma.horse.count({ where: { damId: dam.id } })).toBe(1);
  });

  it('two overlapping foaling job runs for one mare produce exactly one foal and one notification', async () => {
    const { dam } = await createPregnantMare('race');

    const [first, second] = await Promise.all([runFoalingJob(), runFoalingJob()]);

    // The losing run skips the mare; it is not an error.
    expect(first.errors.map(e => e.damId)).not.toContain(dam.id);
    expect(second.errors.map(e => e.damId)).not.toContain(dam.id);

    const foals = await prisma.horse.findMany({ where: { damId: dam.id }, select: { id: true } });
    expect(foals).toHaveLength(1);

    const damAfter = await prisma.horse.findUnique({
      where: { id: dam.id },
      select: { inFoalSinceDate: true, pregnancySireId: true },
    });
    expect(damAfter.inFoalSinceDate).toBeNull();
    expect(damAfter.pregnancySireId).toBeNull();

    const notes = await prisma.notification.findMany({
      where: { userId: testUser.id, type: 'foal_born' },
      select: { payload: true },
    });
    const forThisFoal = notes.filter(n => n.payload?.foalId === foals[0].id);
    expect(forThisFoal).toHaveLength(1);
  });
});
