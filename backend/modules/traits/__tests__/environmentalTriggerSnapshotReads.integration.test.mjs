/**
 * The environmental report reads one snapshot (Equoria-q4uem.7 S4).
 *
 * Mechanism (no Prisma mock, no spy), as in traitInteractionSnapshotReads: the
 * shared client module adopts a `globalThis.__prisma` handle installed before it
 * loads, pointed at a REAL PrismaClient with Prisma's query-event logging, so
 * every SQL statement the analysis sends is observed against the real test DB.
 *
 * One report must read: the horse once (1 SELECT on horses) and its groom
 * interactions once (1 SELECT on groom_interactions, plus the 1 SELECT on grooms
 * Prisma issues for the included groom). Before S4 the report re-read them for
 * every section and every evaluated trait: 27 SELECTs (horses 10,
 * groom_interactions 9, grooms 8; Prisma batches some same-tick findUnique calls).
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

const statements = [];
observedClient = new PrismaClient({
  datasources: { db: { url: buildDatabaseUrl(process.env.DATABASE_URL, process.env) } },
  log: [{ emit: 'event', level: 'query' }],
  errorFormat: 'minimal',
});
observedClient.$on('query', event => statements.push(event.query));

const { generateEnvironmentalReport } = await import('../services/environmentalTriggerSystem.mjs');
const { fixtureColor } = await import('../../../tests/helpers/fixtureColor.mjs');
const { buildTriggerFixtures, cleanupTriggerFixtures } = await import('./helpers/environmentalTriggerGrid.mjs');

const selectsOn = table => statements.filter(sql => /^SELECT\b/i.test(sql) && sql.includes(`FROM "public"."${table}"`));

let fx;

beforeAll(async () => {
  expect(prisma).toBe(appClientHandle);
  fx = await buildTriggerFixtures(prisma, randomBytes(6).toString('hex'), fixtureColor);
}, 60000);

afterAll(() => cleanupTriggerFixtures(prisma, fx), 60000);

describe('generateEnvironmentalReport reads one snapshot', () => {
  it('reads the horse once and its interactions once', async () => {
    const [, horseId] = fx.horses.find(([key]) => key === 'curious');
    statements.length = 0;
    const report = await generateEnvironmentalReport(horseId);

    expect(report.traitExpressionProbabilities).toHaveLength(7);
    expect(report.cumulativeExposure.exposureTimeline.length).toBeGreaterThan(0);
    expect(selectsOn('horses')).toHaveLength(1);
    expect(selectsOn('groom_interactions')).toHaveLength(1);
    expect(selectsOn('grooms')).toHaveLength(1);
    expect(statements.filter(sql => /^SELECT\b/i.test(sql))).toHaveLength(3);
  }, 60000);
});
