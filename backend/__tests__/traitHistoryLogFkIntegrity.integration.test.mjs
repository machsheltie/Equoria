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
    await prisma.user
      .deleteMany({ where: { id: { in: createdUserIds } } })
      .catch(err => console.warn(`[cleanup] ${err.message}`));
  }
}, 30000);

describe('trait_history_logs FK integrity (Equoria-vllv4)', () => {
  it('STRUCTURAL: a horseId→horses CASCADE FK and a groomId→grooms SET NULL FK exist', async () => {
    // Match on pg_get_constraintdef() TEXT, NOT exact conname. The constraint
    // NAME differs by environment due to PostgreSQL identifier case-folding:
    //   - The original add_epigenetic migration created QUOTED mixed-case names
    //     ("trait_history_logs_horseId_fkey") — preserved verbatim.
    //   - The vllv4 repair migration re-added them with UNQUOTED names, which
    //     Postgres folds to lowercase (trait_history_logs_horseid_fkey).
    // A FRESH-migrated DB (CI) runs BOTH migrations and therefore carries up to
    // FOUR constraints (2 camelCase + 2 lowercase — distinct identifiers because
    // they differ in case); the prod-restored local DB carries only the 2
    // lowercase ones (c3kb6 had dropped the camelCase pair before vllv4 ran).
    // The SEMANTIC contract — "a FK on each column with the correct ON DELETE
    // behavior exists, and NO FK on those columns has the WRONG behavior" —
    // holds in both, so we assert on the constraint DEFINITION, tolerant of
    // name case and constraint count. The residual duplicate-FK smell on
    // fresh-migrated DBs is a benign double-enforcement (not a behavior bug)
    // tracked + scheduled for a dedup migration under Equoria-zvads.
    const fks = await prisma.$queryRaw`
      SELECT conname, pg_get_constraintdef(oid) AS def
      FROM pg_constraint
      WHERE conrelid = 'trait_history_logs'::regclass AND contype = 'f'
    `;

    const horseFks = fks.filter(r => /FOREIGN KEY \("horseId"\)/.test(r.def));
    const groomFks = fks.filter(r => /FOREIGN KEY \("groomId"\)/.test(r.def));

    // At least one FK on each column (presence half of the contract).
    expect(horseFks.length).toBeGreaterThanOrEqual(1);
    expect(groomFks.length).toBeGreaterThanOrEqual(1);

    // EVERY FK on horseId must reference horses(id) with ON DELETE CASCADE —
    // asserting on all of them (not just .find) means a stray duplicate with
    // the WRONG behavior could not slip through unnoticed.
    for (const fk of horseFks) {
      expect(fk.def).toMatch(/REFERENCES horses\(id\)/);
      expect(fk.def).toMatch(/ON DELETE CASCADE/);
    }
    // EVERY FK on groomId must reference grooms(id) with ON DELETE SET NULL.
    for (const fk of groomFks) {
      expect(fk.def).toMatch(/REFERENCES grooms\(id\)/);
      expect(fk.def).toMatch(/ON DELETE SET NULL/);
    }
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
