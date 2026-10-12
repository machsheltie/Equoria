/**
 * Undated conformation shows are scheduled — Equoria-mwjst (Codex review
 * 2026-10-06, finding 3; owner ruling 2026-10-07: backfill the dates).
 *
 * The defect: an open conformation show with closeDate NULL accepted paid
 * entries (wallet 1000 -> 925, escrow 75) but settlement only runs once
 * closeDate has passed, so it never settled and the fees never left escrow.
 *
 * This runs the real migration SQL against the real test database inside a
 * transaction that is always rolled back, so the global UPDATE never touches
 * another suite's rows. It asserts the backfill gives every open undated
 * conformation show the seven-day schedule (openDate, else createdAt, + 7
 * days) and leaves every other show alone; then that a backfilled show whose
 * week has passed is one the settlement scan picks up.
 */

import { describe, it, expect, afterAll } from '@jest/globals';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';

import prisma from '../../../../packages/database/prismaClient.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MIGRATION_SQL = readFileSync(
  path.resolve(
    HERE,
    '../../../../packages/database/prisma/migrations/20261007120000_mwjst_backfill_conformation_show_schedule/migration.sql',
  ),
  'utf8',
);
const DAY_MS = 24 * 60 * 60 * 1000;
const FIXTURE_PREFIX = 'TestFixture-mwjst-backfill';
const tag = randomBytes(4).toString('hex');
const createdIds = [];

class RollBack extends Error {}

async function makeShow(label, data) {
  const show = await prisma.show.create({
    data: {
      name: `${FIXTURE_PREFIX}-${label}-${tag}`,
      discipline: 'Conformation',
      showType: 'conformation',
      status: 'open',
      levelMin: 1,
      levelMax: 10,
      entryFee: 75,
      prize: 0,
      runDate: new Date(),
      openDate: null,
      closeDate: null,
      ...data,
    },
  });
  createdIds.push(show.id);
  return show;
}

/** Apply the migration, read the fixtures back, then undo everything. */
async function afterBackfill(ids) {
  let rows;
  await expect(
    prisma.$transaction(async tx => {
      await tx.$executeRawUnsafe(MIGRATION_SQL);
      rows = await tx.show.findMany({
        where: { id: { in: ids } },
        select: { id: true, openDate: true, closeDate: true, runDate: true },
      });
      throw new RollBack();
    }),
  ).rejects.toBeInstanceOf(RollBack);
  return new Map(rows.map(r => [r.id, r]));
}

afterAll(async () => {
  await prisma.show.deleteMany({ where: { id: { in: createdIds } } });
});

describe('undated conformation shows get the seven-day schedule (mwjst backfill)', () => {
  it('schedules open undated conformation shows and leaves every other show alone', async () => {
    const createdAt = new Date(Date.now() - 3 * DAY_MS);
    const openDate = new Date(Date.now() - 2 * DAY_MS);
    const dated = new Date(Date.now() + 5 * DAY_MS);

    const noDates = await makeShow('nodates', { createdAt });
    const opened = await makeShow('opened', { createdAt, openDate });
    const ridden = await makeShow('ridden', { createdAt, showType: 'ridden', discipline: 'Dressage' });
    const completed = await makeShow('completed', { createdAt, status: 'completed' });
    const scheduled = await makeShow('scheduled', { createdAt, openDate, closeDate: dated });

    const after = await afterBackfill([noDates, opened, ridden, completed, scheduled].map(s => s.id));

    // openDate falls back to creation; closing is seven days later.
    expect(after.get(noDates.id).openDate.getTime()).toBe(createdAt.getTime());
    expect(after.get(noDates.id).closeDate.getTime()).toBe(createdAt.getTime() + 7 * DAY_MS);
    expect(after.get(noDates.id).runDate.getTime()).toBe(createdAt.getTime() + 7 * DAY_MS);
    // An existing openDate is kept and anchors the week.
    expect(after.get(opened.id).openDate.getTime()).toBe(openDate.getTime());
    expect(after.get(opened.id).closeDate.getTime()).toBe(openDate.getTime() + 7 * DAY_MS);

    for (const untouched of [ridden, completed, scheduled]) {
      expect(after.get(untouched.id).closeDate).toEqual(untouched.closeDate);
      expect(after.get(untouched.id).openDate).toEqual(untouched.openDate);
    }

    // The rollback left the real rows as they were.
    const live = await prisma.show.findUnique({ where: { id: noDates.id } });
    expect(live.closeDate).toBeNull();
  });

  it('a backfilled show whose week has passed is due for the nightly settlement', async () => {
    const createdAt = new Date(Date.now() - 10 * DAY_MS);
    const stale = await makeShow('stale', { createdAt });

    let dueIds;
    await expect(
      prisma.$transaction(async tx => {
        await tx.$executeRawUnsafe(MIGRATION_SQL);
        // The settlement scan's own predicate (settleDueConformationShows).
        const due = await tx.show.findMany({
          where: { id: stale.id, status: 'open', showType: 'conformation', closeDate: { lte: new Date() } },
          select: { id: true },
        });
        dueIds = due.map(s => s.id);
        throw new RollBack();
      }),
    ).rejects.toBeInstanceOf(RollBack);

    expect(dueIds).toEqual([stale.id]);
  });
});
