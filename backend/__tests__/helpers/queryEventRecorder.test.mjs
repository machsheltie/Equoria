/**
 * Sentinel for queryEventRecorder.mjs (Equoria-hajbq).
 *
 * Prisma delivers `log: [{ emit: 'event', level: 'query' }]` events through
 * the engine's log callback, a native-to-JS delivery separate from the one
 * that resolves the query's promise. Nothing orders the two, so a busy CI
 * runner can resume the awaiting test before the query's event arrives: that
 * test counts 0, and the late event lands in the NEXT test's window (CI run
 * 39020787961: 0 then 2).
 *
 * This file reproduces late delivery deterministically: a real PrismaClient
 * against the real test database, with every query event handed to the
 * recorder 25 ms after Prisma emits it (FIFO preserved, as the engine's single
 * log callback does). The recorder must still attribute each statement to the
 * measurement that issued it, exactly once.
 */

import { describe, it, expect, afterAll } from '@jest/globals';
import { createQueryEventRecorder } from './queryEventRecorder.mjs';

const { PrismaClient } = await import('../../../packages/database/prismaClient.mjs');
const { buildDatabaseUrl } = await import('../../../packages/database/dbPoolConfig.mjs');

const LATE_MS = 25;
const client = new PrismaClient({
  datasources: { db: { url: buildDatabaseUrl(process.env.DATABASE_URL, process.env) } },
  log: [{ emit: 'event', level: 'query' }],
  errorFormat: 'minimal',
});

// The real client, except its query events reach the recorder late.
const lateEvents = {
  $on: (type, listener) => client.$on(type, event => setTimeout(() => listener(event), LATE_MS)),
  $queryRawUnsafe: (...args) => client.$queryRawUnsafe(...args),
};

const recorder = createQueryEventRecorder(lateEvents);

afterAll(() => client.$disconnect());

describe('queryEventRecorder — late query events (Equoria-hajbq)', () => {
  it('counts a statement whose event arrives after the measured call resolves', async () => {
    const { result, statements } = await recorder.measure(() => client.$queryRawUnsafe('SELECT 7 AS "hajbqMeasured"'));

    expect(result).toEqual([{ hajbqMeasured: 7 }]);
    expect(statements).toEqual(['SELECT 7 AS "hajbqMeasured"']);
  });

  it('carries no statement into the next measurement', async () => {
    await recorder.measure(() => client.$queryRawUnsafe('SELECT 8 AS "hajbq_previous"'));
    // Outlasts the late delivery, so a straggler from the previous measurement would land here.
    const { statements } = await recorder.measure(() => new Promise(resolve => setTimeout(resolve, LATE_MS * 3)));

    expect(statements).toEqual([]);
  });

  it('ignores statements issued between measurements', async () => {
    await client.$queryRawUnsafe('SELECT 9 AS "hajbq_unmeasured"');
    const { statements } = await recorder.measure(() => client.$queryRawUnsafe('SELECT 10 AS "hajbq_measured_after"'));

    expect(statements).toEqual(['SELECT 10 AS "hajbq_measured_after"']);
  });
});
