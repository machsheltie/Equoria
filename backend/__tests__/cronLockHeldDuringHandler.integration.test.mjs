/**
 * Equoria-mquci — the production cron lock is held for the whole handler.
 *
 * cronDistributedLock.integration.test.mjs proves one direction: a session that
 * already holds the lock makes withAdvisoryLock skip. This file proves the other,
 * the one the issue worried about: while withAdvisoryLock's own handler is
 * running (and issuing its own queries on the shared pool, as every cron job
 * does), a second Postgres session — the second replica — can never take the
 * same lock; and the instant the handler returns, it can.
 *
 * The contender is a raw `pg` session using pg_try_advisory_lock, which shares
 * one advisory-lock space with the production pg_try_advisory_xact_lock.
 * Real DB, no mocks.
 */

import { describe, it, expect } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import pg from 'pg';
import prisma from '../../packages/database/prismaClient.mjs';
import { withAdvisoryLock, jobNameToLockKey } from '../utils/cronLock.mjs';

const JOB = `mquci-${randomBytes(4).toString('hex')}`;

async function contenderCanTake(client, key) {
  const { rows } = await client.query('SELECT pg_try_advisory_lock($1::bigint) AS locked', [key.toString()]);
  return rows[0].locked === true;
}

describe('withAdvisoryLock holds the lock for the full handler (Equoria-mquci)', () => {
  it('keeps a second session out while the handler works, then lets it in', async () => {
    const key = jobNameToLockKey(JOB);
    const contender = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await contender.connect();
    try {
      const attempts = [];

      const outcome = await withAdvisoryLock(JOB, async () => {
        attempts.push(await contenderCanTake(contender, key));
        // The handler's own work goes through the shared Prisma pool, as a real job's does.
        await prisma.$queryRaw`SELECT 1`;
        await prisma.$queryRaw`SELECT 2`;
        attempts.push(await contenderCanTake(contender, key));
        await new Promise(resolve => setTimeout(resolve, 300));
        attempts.push(await contenderCanTake(contender, key));
        return { totalProcessed: 1 };
      });

      expect(outcome.acquired).toBe(true);
      expect(attempts).toEqual([false, false, false]);

      // Released with the handler: the same contender now takes it, then lets go.
      expect(await contenderCanTake(contender, key)).toBe(true);
      await contender.query('SELECT pg_advisory_unlock($1::bigint)', [key.toString()]);
    } finally {
      await contender.end();
    }
  }, 60000);

  it('detector: a lock held on a different key does not keep the contender out', async () => {
    const contender = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await contender.connect();
    try {
      const otherKey = jobNameToLockKey(`${JOB}-unrelated`);
      let sawTakeable = null;
      await withAdvisoryLock(JOB, async () => {
        sawTakeable = await contenderCanTake(contender, otherKey);
      });
      expect(sawTakeable).toBe(true);
      await contender.query('SELECT pg_advisory_unlock($1::bigint)', [otherKey.toString()]);
    } finally {
      await contender.end();
    }
  }, 60000);
});
