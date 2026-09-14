/**
 * Sentinel for disposable test-lane databases (Equoria-bu9c4.1).
 *
 * The two-lane gate is only sound if (1) a lane can never be pointed at the
 * canonical database or a remote host, (2) a lane database really is a
 * separate database — a row written in one is invisible from the other and
 * identical fixture ids cannot collide — and (3) cleanup drops exactly the
 * lane databases of one run and nothing else. Each guard is proved in both
 * directions: the planted violation fires and the compliant path passes.
 *
 * Real PostgreSQL, no mocks. Lane databases are created with a random run id,
 * asserted, and dropped in afterAll; the canonical database receives one
 * uniquely-named breed row that is removed by exact id.
 */
import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import pg from 'pg';
import {
  LANE_DB_PREFIX,
  assertLaneName,
  baseDatabaseUrl,
  createLaneDatabase,
  destroyLaneDatabase,
  laneName,
  laneUrlFor,
  listLaneDatabases,
  newRunId,
  reclaimRun,
} from '../scripts/test-lane-db.mjs';

const { Client } = pg;

async function withClient(url, fn) {
  const client = new Client({ connectionString: url, connectionTimeoutMillis: 10000 });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

describe('lane naming and routing guards', () => {
  test('planted violation: canonical, unprefixed and malformed names are refused', () => {
    expect(() => assertLaneName('equoria')).toThrow(/not a lane database name/);
    expect(() => assertLaneName('postgres')).toThrow(/not a lane database name/);
    expect(() => assertLaneName('equoria_replay_sentinel_abcdef')).toThrow(/not a lane/);
    expect(() => assertLaneName(`${LANE_DB_PREFIX}abc_1`)).toThrow(/not a lane/); // run id too short
    expect(() => assertLaneName(`${LANE_DB_PREFIX}abcdef_1; DROP DATABASE equoria`)).toThrow();
    expect(() => laneName('short', 1)).toThrow(/run id/);
    expect(() => laneName('abcdef012345', 0)).toThrow(/lane index/);
    expect(() => laneName('abcdef012345', 100)).toThrow(/lane index/);
  });

  test('compliant names pass and carry the run id and lane index', () => {
    expect(laneName('abcdef012345', 2)).toBe(`${LANE_DB_PREFIX}abcdef012345_2`);
    expect(assertLaneName(laneName(newRunId(), 1))).toMatch(/^equoria_lane_[a-f0-9]{12}_1$/);
  });

  test('planted violation: a remote base URL is refused before any lane URL is built', () => {
    const env = { EQUORIA_LANE_BASE_URL: 'postgresql://app:pw@db.example.com:5432/equoria' };
    expect(() => laneUrlFor(laneName('abcdef012345', 1), env)).toThrow(/local PostgreSQL/);
  });

  test('a lane URL keeps the base credentials and host and swaps only the database', () => {
    const env = { EQUORIA_LANE_BASE_URL: 'postgresql://user:secret@localhost:5432/equoria?x=1' };
    const url = new URL(laneUrlFor(laneName('abcdef012345', 1), env));
    expect(url.hostname).toBe('localhost');
    expect(url.username).toBe('user');
    expect(url.password).toBe('secret');
    expect(url.pathname).toBe(`/${LANE_DB_PREFIX}abcdef012345_1`);
    expect(url.searchParams.get('x')).toBe('1');
  });
});

describe('lane databases are real, isolated, and disposable', () => {
  const runId = newRunId();
  const otherRunId = newRunId();
  const created = [];
  const breedId = 900000 + Math.floor(Math.random() * 90000);
  const breedName = `lane_sentinel_${randomBytes(4).toString('hex')}`;
  let baseUrl;

  beforeAll(async () => {
    baseUrl = baseDatabaseUrl();
    for (const [id, lane] of [
      [runId, 1],
      [runId, 2],
      [otherRunId, 1],
    ]) {
      const { name, migrations } = await createLaneDatabase({ runId: id, lane });
      created.push(name);
      expect(migrations).toBeGreaterThan(0);
    }
  }, 240000);

  afterAll(async () => {
    await withClient(baseUrl, client =>
      client.query('DELETE FROM breeds WHERE id = $1 AND name = $2', [breedId, breedName]),
    );
    // Fail loud: every drop is attempted, and any failure is rethrown after the
    // loop so a leaked lane database is never hidden.
    const dropFailures = [];
    for (const name of created) {
      try {
        await destroyLaneDatabase({ name });
      } catch (error) {
        dropFailures.push(error);
      }
    }
    if (dropFailures.length) {
      throw new AggregateError(dropFailures, 'failed to drop one or more lane databases');
    }
    const leftovers = (await listLaneDatabases()).filter(n => n.includes(runId) || n.includes(otherRunId));
    expect(leftovers).toEqual([]);
  }, 120000);

  test('a lane carries the canonical seed and the same schema as the migration chain', async () => {
    const lane = laneUrlFor(laneName(runId, 1));
    const breeds = await withClient(lane, client => client.query('SELECT COUNT(*)::int AS n FROM breeds'));
    expect(breeds.rows[0].n).toBeGreaterThan(0);
    const table = await withClient(lane, client =>
      client.query("SELECT to_regclass('public.horses') AS horses, to_regclass('public.\"User\"') AS users"),
    );
    expect(table.rows[0].horses).toBe('horses');
    // to_regclass renders mixed-case identifiers quoted.
    expect(table.rows[0].users).toBe('"User"');
  });

  test('the same fixture id written in two lanes and the canonical DB never collides or leaks', async () => {
    const lane1 = laneUrlFor(laneName(runId, 1));
    const lane2 = laneUrlFor(laneName(runId, 2));
    const insert = (url, suffix) =>
      withClient(url, client =>
        client.query('INSERT INTO breeds (id, name, description) VALUES ($1, $2, $3)', [
          breedId,
          suffix === 'base' ? breedName : `${breedName}_${suffix}`,
          'lane isolation sentinel',
        ]),
      );
    // Same primary key in three databases: an isolation failure would surface
    // here as a unique-violation on the second or third insert.
    await insert(lane1, 'lane1');
    await insert(lane2, 'lane2');
    await insert(baseUrl, 'base');

    const seen = async url =>
      (await withClient(url, client => client.query('SELECT name FROM breeds WHERE id = $1', [breedId]))).rows.map(
        r => r.name,
      );
    expect(await seen(lane1)).toEqual([`${breedName}_lane1`]);
    expect(await seen(lane2)).toEqual([`${breedName}_lane2`]);
    expect(await seen(baseUrl)).toEqual([breedName]);
  });

  test('planted violation: collapsing two lanes onto one URL makes the isolation check fail', async () => {
    const lane1 = laneUrlFor(laneName(runId, 1));
    // Deliberately route "lane 2" to lane 1's database — the exact defect the
    // runner must never have — and prove the same-id insert now collides.
    await expect(
      withClient(lane1, client =>
        client.query('INSERT INTO breeds (id, name, description) VALUES ($1, $2, $3)', [
          breedId,
          `${breedName}_collapsed`,
          'planted collapse',
        ]),
      ),
    ).rejects.toMatchObject({ code: '23505' });
  });

  test('reclaim drops only the lanes of the named run', async () => {
    const dropped = await reclaimRun({ runId });
    expect(dropped.sort()).toEqual([laneName(runId, 1), laneName(runId, 2)].sort());
    const remaining = await listLaneDatabases();
    expect(remaining).toContain(laneName(otherRunId, 1));
    expect(remaining).not.toContain(laneName(runId, 1));
    // Mark the two as gone so afterAll does not try to drop them twice.
    created.splice(created.indexOf(laneName(runId, 1)), 1);
    created.splice(created.indexOf(laneName(runId, 2)), 1);
  }, 60000);

  test('planted violation: destroy refuses anything that is not a lane name', async () => {
    await expect(destroyLaneDatabase({ name: 'equoria' })).rejects.toThrow(/not a lane/);
    await expect(destroyLaneDatabase({ name: 'postgres' })).rejects.toThrow(/not a lane/);
    const stillThere = await withClient(baseUrl, client => client.query('SELECT 1 AS ok'));
    expect(stillThere.rows[0].ok).toBe(1);
  });
});
