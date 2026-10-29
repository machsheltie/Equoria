/**
 * Dynamic compatibility reads one input set (Equoria-q4uem.7 S6).
 *
 * Mechanism (no Prisma mock, no spy), as in environmentalTriggerSnapshotReads: the
 * shared client module adopts a `globalThis.__prisma` handle installed before it
 * loads, pointed at a REAL PrismaClient with query-event logging, so every SQL
 * statement is observed against the real test DB.
 *
 * Ranking an owner's five grooms for a horse must read the horse, the grooms
 * and their interactions once each (3 SELECTs); one pair likewise. Before S6
 * every groom re-read the groom, the horse (twice) and its history.
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
// Waits for each measured call's query events; see the helper (Equoria-hajbq).
const { createQueryEventRecorder } = await import('../../../__tests__/helpers/queryEventRecorder.mjs');
const recorder = createQueryEventRecorder(observedClient);

const { loadCompatibilityInputs, rankGrooms, scoreCompatibility } =
  await import('../services/dynamicCompatibilityScoring.mjs');
const { fixtureColor } = await import('../../../tests/helpers/fixtureColor.mjs');
const { buildCompatibilityFixtures, cleanupCompatibilityFixtures } =
  await import('./helpers/dynamicCompatibilityGrid.mjs');

const selects = statements => statements.filter(sql => /^SELECT\b/i.test(sql));
const selectsOn = (statements, table) => selects(statements).filter(sql => sql.includes(`FROM "public"."${table}"`));
const CONTEXT = {
  taskType: 'trustBuilding',
  environmentalFactors: ['quiet', 'familiar', 'structured'],
};

let fx;

beforeAll(async () => {
  expect(prisma).toBe(appClientHandle);
  fx = await buildCompatibilityFixtures(prisma, randomBytes(6).toString('hex'), fixtureColor);
}, 60000);

afterAll(() => cleanupCompatibilityFixtures(prisma, fx), 60000);

describe('dynamic compatibility reads one input set', () => {
  it('ranks five grooms with one read each of the horse, the grooms and the interactions', async () => {
    const { result: ranked, statements } = await recorder.measure(async () =>
      rankGrooms(await loadCompatibilityInputs(fx.horses.nervous.id, { ownerGrooms: true }), CONTEXT),
    );

    expect(ranked.rankedGrooms).toHaveLength(5);
    expect(selectsOn(statements, 'horses')).toHaveLength(1);
    expect(selectsOn(statements, 'grooms')).toHaveLength(1);
    expect(selectsOn(statements, 'groom_interactions')).toHaveLength(1);
    expect(selects(statements)).toHaveLength(3);
  }, 60000);

  it('scores one pair with three reads', async () => {
    const { result: score, statements } = await recorder.measure(async () =>
      scoreCompatibility(
        await loadCompatibilityInputs(fx.horses.nervous.id, { groomIds: [fx.grooms.calm.id] }),
        fx.grooms.calm.id,
        CONTEXT,
      ),
    );

    expect(typeof score.overallScore).toBe('number');
    expect(selects(statements)).toHaveLength(3);
  }, 60000);
});
