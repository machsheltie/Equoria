/**
 * trait_history_logs FK integrity sentinel (Equoria-vllv4).
 *
 * The c3kb6 Supabase production restore dropped the trait_history_logs FK
 * constraints because 57 rows referenced deleted horses and 21 referenced
 * deleted grooms. The vllv4 migration cleaned up those orphans and re-added
 * the FKs with their declared onDelete behavior:
 *   - horseId: onDelete: Cascade  → deleting a horse deletes its trait logs
 *   - groomId: onDelete: SetNull  → deleting a groom nulls trait logs' groomId
 *
 * This sentinel proves the FKs are now in place and behave correctly. A
 * regression that drops the constraints (or changes the cascade behavior)
 * fails this test.
 *
 * Real DB, no mocks, scoped fixtures.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import prisma from '../../packages/database/prismaClient.mjs';
import { fixtureColor } from '../tests/helpers/fixtureColor.mjs';

const FIXTURE_PREFIX = 'TestFixture-vllv4';

let user;
const createdUserIds = [];

beforeAll(async () => {
  const tag = randomBytes(4).toString('hex');
  const pw = await bcrypt.hash('TestPassword123!', 1);
  user = await prisma.user.create({
    data: {
      username: `${FIXTURE_PREFIX}-${tag}`,
      email: `${FIXTURE_PREFIX}-${tag}@test.com`,
      password: pw,
      firstName: 'FK',
      lastName: 'Integrity',
      money: 0,
    },
  });
  createdUserIds.push(user.id);
}, 30000);

afterAll(async () => {
  if (createdUserIds.length) {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } }).catch(() => {});
  }
}, 30000);

describe('trait_history_logs FK integrity (Equoria-vllv4)', () => {
  it('STRUCTURAL: both FK constraints exist on trait_history_logs', async () => {
    const fks = await prisma.$queryRaw`
      SELECT conname, pg_get_constraintdef(oid) AS def
      FROM pg_constraint
      WHERE conrelid = 'trait_history_logs'::regclass AND contype = 'f'
    `;
    const names = fks.map(r => r.conname).sort();
    expect(names).toEqual(['trait_history_logs_groomid_fkey', 'trait_history_logs_horseid_fkey']);

    const horseFk = fks.find(r => r.conname === 'trait_history_logs_horseid_fkey');
    expect(horseFk.def).toMatch(/ON DELETE CASCADE/);

    const groomFk = fks.find(r => r.conname === 'trait_history_logs_groomid_fkey');
    expect(groomFk.def).toMatch(/ON DELETE SET NULL/);
  });

  it('SENTINEL: deleting a horse CASCADES — trait_history_logs rows go too', async () => {
    const horse = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `${FIXTURE_PREFIX}-horse-${randomBytes(4).toString('hex')}`,
        sex: 'Mare',
        dateOfBirth: new Date('2020-01-01'),
        age: 5,
        userId: user.id,
      },
    });
    const log = await prisma.traitHistoryLog.create({
      data: {
        horseId: horse.id,
        traitName: 'test-trait',
        sourceType: 'milestone',
        ageInDays: 30,
      },
    });
    expect(log.id).toBeDefined();

    await prisma.horse.delete({ where: { id: horse.id } });

    // Cascade should have wiped the trait log too.
    const after = await prisma.traitHistoryLog.findUnique({ where: { id: log.id } });
    expect(after).toBeNull();
  });

  it('SENTINEL: deleting a groom NULLS trait_history_logs.groomId, row survives', async () => {
    const horse = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `${FIXTURE_PREFIX}-horse-${randomBytes(4).toString('hex')}`,
        sex: 'Mare',
        dateOfBirth: new Date('2020-01-01'),
        age: 5,
        userId: user.id,
      },
    });
    const groom = await prisma.groom.create({
      data: {
        name: `${FIXTURE_PREFIX}-groom-${randomBytes(4).toString('hex')}`,
        speciality: 'foal_care',
        skillLevel: 'intermediate',
        personality: 'gentle',
        experience: 5,
        sessionRate: 20,
        userId: user.id,
      },
    });
    const log = await prisma.traitHistoryLog.create({
      data: {
        horseId: horse.id,
        groomId: groom.id,
        traitName: 'test-trait',
        sourceType: 'groom',
        ageInDays: 30,
      },
    });

    await prisma.groom.delete({ where: { id: groom.id } });

    const after = await prisma.traitHistoryLog.findUnique({ where: { id: log.id } });
    expect(after).not.toBeNull();
    expect(after.groomId).toBeNull();

    // Manual cleanup of the surviving log row (horse cascade will get it
    // via the horse delete below, but be explicit for the test).
    await prisma.horse.delete({ where: { id: horse.id } });
  });

  it('SENTINEL: FK rejects an insert with a non-existent horseId', async () => {
    // Pick a horse id well outside the live serial range. The canonical
    // DB's horses.id is a serial — the largest existing id will always be
    // far less than 2 billion. The negative-int variant was rejected by
    // Prisma's validator BEFORE the DB-level FK could weigh in (the
    // schema's autoincrement integer is unsigned-ish in practice).
    const nonexistentHorseId = 2_000_000_000;
    let caught = null;
    try {
      await prisma.traitHistoryLog.create({
        data: {
          horseId: nonexistentHorseId,
          traitName: 'test-orphan-insert',
          sourceType: 'milestone',
          ageInDays: 30,
        },
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).not.toBeNull();
    expect(String(caught.message)).toMatch(/foreign key|trait_history_logs_horseid_fkey/i);
  });
});
