/**
 * Equoria-27xvj: the `Prisma` namespace exported by packages/database/prismaClient.mjs
 * must belong to the SAME @prisma/client copy as the shared client it exports.
 *
 * THE DEFECT (root cause, measured). Prisma tells `Prisma.DbNull` / `Prisma.JsonNull`
 * apart from a plain object by CLASS IDENTITY inside its runtime
 * (`value instanceof ObjectEnumValue`, then `value === instances[name]`). A sentinel
 * minted by one copy of the runtime therefore looks like an ordinary object to a client
 * built from another copy and is serialized as `{}`.
 *
 * Two copies exist under a single-process Jest run (`--runInBand`, which is also what a
 * single-file run does): `tests/globalSetup.mjs` imports prismaClient.mjs in the HOST
 * process, which caches its client on the host's `globalThis.__prisma`, and
 * jest-environment-node forwards host globals the sandbox lacks, so the sandbox sees that
 * handle. The sandbox then evaluates prismaClient.mjs AGAIN; it reuses the forwarded
 * client (host copy) but takes `Prisma` / `PrismaClient` from its own
 * `await import('@prisma/client')` (sandbox copy). With worker processes the handle never
 * crosses, which is why this looked load-order dependent.
 *
 * WHAT THIS PINS, against the real database: writing `Prisma.DbNull` through the shared
 * client stores SQL NULL, `Prisma.JsonNull` stores JSON null, and an error thrown by the
 * shared client is an instance of the exported namespace's error class. Before the fix
 * all three failed in band (the first two stored `{}`).
 *
 * The throwaway row is a uniquely named cron run log whose nullable Json column
 * (`summary`) is the probe; it is deleted by id, fail-loud. (The probe was
 * User.mfaRecoveryCodes until authenticator-app sign-in was removed, owner ruling
 * 2026-10-29, q305; the column is gone, the contract pinned here is unchanged.)
 */

import { describe, it, expect, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma, { Prisma } from '../../packages/database/prismaClient.mjs';
import { createCleanupTracker } from './helpers/failLoudCleanup.mjs';

describe('Equoria-27xvj: Prisma namespace and shared client are one runtime copy', () => {
  const cleanup = createCleanupTracker();
  afterAll(() => cleanup.run(), 30000);

  async function makeProbeRow() {
    const tag = randomBytes(5).toString('hex');
    const row = await prisma.cronRunLog.create({
      data: {
        jobName: `TestFixture-27xvj-${tag}`,
        startedAt: new Date(),
        status: 'success',
        summary: ['seed'],
      },
    });
    cleanup.add(() => prisma.cronRunLog.deleteMany({ where: { id: row.id } }), 'probe cron run log');
    return row;
  }

  async function columnState(rowId) {
    const rows = await prisma.$queryRaw`
      SELECT ("summary" IS NULL) AS "sqlNull", jsonb_typeof("summary"::jsonb) AS "jsonType"
      FROM "cron_run_logs" WHERE "id" = ${rowId}`;
    return rows[0];
  }

  it('Prisma.DbNull written through the shared client stores SQL NULL', async () => {
    const row = await makeProbeRow();
    expect(await columnState(row.id)).toEqual({ sqlNull: false, jsonType: 'array' });

    await prisma.cronRunLog.updateMany({ where: { id: row.id }, data: { summary: Prisma.DbNull } });

    expect(await columnState(row.id)).toEqual({ sqlNull: true, jsonType: null });
  }, 60000);

  it('Prisma.JsonNull written through the shared client stores JSON null, not SQL NULL', async () => {
    const row = await makeProbeRow();

    await prisma.cronRunLog.updateMany({ where: { id: row.id }, data: { summary: Prisma.JsonNull } });

    expect(await columnState(row.id)).toEqual({ sqlNull: false, jsonType: 'null' });
  }, 60000);

  it('an error thrown by the shared client is an instance of the exported namespace class', async () => {
    let thrown;
    try {
      await prisma.user.findUniqueOrThrow({ where: { id: '00000000-0000-0000-0000-000000000000' } });
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeDefined();
    expect(thrown instanceof Prisma.PrismaClientKnownRequestError).toBe(true);
  }, 60000);
});
