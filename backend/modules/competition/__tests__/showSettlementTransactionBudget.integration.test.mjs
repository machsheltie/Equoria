/**
 * Show settlement stays inside the connection budget (Equoria-cmw85.1).
 *
 * The defect: executeClosedShows opened one interactive transaction per entry
 * and started them all at once (map + Promise.all). Production runs on a
 * three-connection pool (packages/database/dbPoolConfig.mjs), so a big show
 * filled every connection with settlement transactions and queued the rest
 * behind it, where they could time out mid-settlement; players' own requests
 * waited behind the nightly job too.
 *
 * The contract now: settlement runs its entry transactions one after another,
 * so it never holds more than one transaction (one connection) at a time.
 *
 * Mechanism (no Prisma mock, no spy), as in dynamicCompatibilityReads: the
 * shared client module adopts a `globalThis.__prisma` handle installed before
 * it loads, pointed at a REAL PrismaClient with query-event logging. Prisma
 * logs each interactive transaction's BEGIN and COMMIT/ROLLBACK; the log is in
 * engine execution order, so the running count of open transactions over it is
 * the settlement's real transaction concurrency.
 */

import { describe, it, expect, afterAll } from '@jest/globals';

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

const { executeClosedShows } = await import('../shows/showExecutionService.mjs');
const { createFundedShowFixtures, moneyOf } = await import('./helpers/fundedShowFixtures.mjs');

const PRIZE = 1000;
const ENTRY_FEE = 10;
const ENTRANTS = 12;

const fx = createFundedShowFixtures('TestFixture-cmw851');

afterAll(async () => {
  await fx.cleanup();
  await observedClient.$disconnect();
}, 60000);

/** The most transactions open at once across a statement log. */
function peakOpenTransactions(statements) {
  let open = 0;
  let peak = 0;
  for (const sql of statements) {
    const keyword = sql.trim().toUpperCase();
    if (keyword === 'BEGIN') {
      open += 1;
      peak = Math.max(peak, open);
    } else if (keyword === 'COMMIT' || keyword === 'ROLLBACK') {
      open -= 1;
    }
  }
  return peak;
}

describe('show settlement transaction budget (Equoria-cmw85.1)', () => {
  it('detector: counts overlapping transactions in a log', () => {
    expect(peakOpenTransactions(['BEGIN', 'SELECT 1', 'COMMIT', 'BEGIN', 'COMMIT'])).toBe(1);
    expect(peakOpenTransactions(['BEGIN', 'BEGIN', 'SELECT 1', 'COMMIT', 'BEGIN', 'COMMIT', 'ROLLBACK'])).toBe(2);
  });

  it('settles a 12-entry show holding at most one transaction at a time, paying everyone once', async () => {
    expect(prisma).toBe(appClientHandle);
    const show = await fx.buildClosedShow({ prize: PRIZE, entryFee: ENTRY_FEE, entrantCount: ENTRANTS });
    const heldBefore = await fx.heldMoney(show);

    const { statements } = await recorder.measure(() => executeClosedShows({ body: { showIds: [show.showId] } }, null));

    const begins = statements.filter(sql => sql.trim().toUpperCase() === 'BEGIN');
    expect(begins.length).toBeGreaterThanOrEqual(ENTRANTS); // the detector saw the settlement transactions
    expect(peakOpenTransactions(statements)).toBe(1);

    // Settlement itself is unchanged: every entry has one result, the three
    // placed shares add up to the prize, and every coin is accounted for.
    const results = await prisma.competitionResult.findMany({
      where: { showId: show.showId },
      select: { horseId: true, prizeWon: true },
    });
    expect(results).toHaveLength(ENTRANTS);
    expect(results.reduce((sum, r) => sum + Number(r.prizeWon), 0)).toBe(PRIZE);
    for (const entrant of show.entrants) {
      const row = results.find(r => r.horseId === entrant.horse.id);
      expect(await moneyOf(entrant.owner.id)).toBe(Number(row.prizeWon));
    }
    const after = await prisma.show.findUnique({ where: { id: show.showId } });
    expect(after.status).toBe('completed');
    expect(after.prizeEscrow).toBe(0);
    expect(after.feeEscrow).toBe(0);
    expect(await moneyOf(show.creator.id)).toBe(ENTRY_FEE * ENTRANTS);
    expect(await fx.heldMoney(show)).toBe(heldBefore);
  }, 120000);
});
