/**
 * Test-database guard (Equoria-8w3ax): tests refuse to start unless they would
 * use a local test database, never the local game database and never a
 * remote (production) host.
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from '@jest/globals';
import {
  assertTestDatabaseUrl,
  guardTestDatabase,
  readGameDatabaseUrls,
  testDatabaseRefusal,
} from '../tests/config/testDatabaseGuard.mjs';
import { laneName, laneUrlFor, newRunId } from '../scripts/test-lane-db.mjs';

const gameUrl = 'postgresql://owner:secretpw@localhost:5432/equoria';
const workDir = mkdtempSync(path.join(tmpdir(), 'equoria-test-db-guard-'));

afterAll(() => {
  rmSync(workDir, { recursive: true, force: true });
});

function envFile(name, content) {
  const file = path.join(workDir, name);
  writeFileSync(file, content);
  return file;
}

describe('accepted test databases', () => {
  it.each([
    ['the local test database', 'postgresql://owner:secretpw@localhost:5432/equoria_test'],
    ['CI test.yml / ci-cd.yml', 'postgresql://test:test@localhost:5432/equoria_test'],
    ['CI security/auth jobs', 'postgresql://postgres:pw@localhost:5432/equoria_test'],
    ['127.0.0.1', 'postgresql://u:p@127.0.0.1:5432/equoria_test'],
    ['IPv6 loopback', 'postgresql://u:p@[::1]:5432/equoria_test'],
    ['postgres:// scheme and query string', 'postgres://u:p@localhost/equoria_test?schema=public'],
  ])('%s', (_label, url) => {
    expect(testDatabaseRefusal(url, { gameUrls: [gameUrl] })).toBeNull();
    expect(assertTestDatabaseUrl(url, { gameUrls: [gameUrl] }).database).toBe(new URL(url).pathname.slice(1));
  });

  it('a lane database the sharded gate creates (real laneName/laneUrlFor)', () => {
    const name = laneName(newRunId(), 2);
    const url = laneUrlFor(name, {
      DATABASE_URL: 'postgresql://owner:secretpw@localhost:5432/equoria_test',
    });
    expect(testDatabaseRefusal(url, { gameUrls: [gameUrl] })).toBeNull();
  });
});

describe('refused databases', () => {
  it.each([
    ['the local game database', gameUrl, /not a test database/],
    ['the postgres admin database', 'postgresql://u:p@localhost:5432/postgres', /not a test/],
    ['a name that only contains test', 'postgresql://u:p@localhost:5432/equoria_testing', /not a test/],
    ['a lookalike lane name', 'postgresql://u:p@localhost:5432/equoria_lane_x', /not a test/],
    [
      'Supabase pooler',
      'postgresql://postgres.abc:pw@aws-0-us-east-1.pooler.supabase.com:6543/postgres',
      /is not local/,
    ],
    ['Supabase direct, even named _test', 'postgresql://u:p@db.abc.supabase.co:5432/equoria_test', /is not local/],
    ['Railway proxy', 'postgresql://u:p@monorail.proxy.rlwy.net:41234/railway', /is not local/],
    ['Railway private network', 'postgresql://u:p@postgres.railway.internal:5432/equoria_test', /is not local/],
    ['a missing value', undefined, /missing/],
    ['an empty value', '', /missing/],
    ['not a URL', 'equoria_test', /missing or is not a postgresql/],
    ['another database engine', 'mysql://u:p@localhost:3306/equoria_test', /not a postgresql/],
  ])('%s', (_label, url, reason) => {
    expect(testDatabaseRefusal(url, { gameUrls: [gameUrl] })).toMatch(reason);
    expect(() => assertTestDatabaseUrl(url, { gameUrls: [gameUrl] })).toThrow(
      /\[test-db-guard\] Refusing to run tests/,
    );
  });

  it('a test-named database that backend/.env also uses for the game', () => {
    const shared = 'postgresql://u:p@localhost:5432/equoria_test';
    expect(testDatabaseRefusal(shared, { gameUrls: [shared] })).toMatch(/backend\/\.env/);
    // localhost and 127.0.0.1 are the same server; the default port is 5432.
    expect(testDatabaseRefusal('postgresql://x:y@127.0.0.1/equoria_test', { gameUrls: [shared] })).toMatch(
      /backend\/\.env/,
    );
    // A different port is a different server.
    expect(testDatabaseRefusal('postgresql://x:y@localhost:5433/equoria_test', { gameUrls: [shared] })).toBeNull();
  });

  it('never prints the password', () => {
    const reason = testDatabaseRefusal(gameUrl, { gameUrls: [gameUrl] });
    expect(reason).not.toMatch(/secretpw/);
    let message = '';
    try {
      assertTestDatabaseUrl(gameUrl);
    } catch (error) {
      message = error.message;
    }
    expect(message).toMatch(/Refusing to run tests/);
    expect(message).not.toMatch(/secretpw/);
  });
});

describe('guardTestDatabase resolves the URL the tests would use', () => {
  it('reads DATABASE_URL from the test env file when the environment has none', () => {
    const file = envFile('.env.test.game', `DATABASE_URL=${gameUrl}\n`);
    const env = {};
    expect(() => guardTestDatabase({ env, envFile: file })).toThrow(/not a test database/);
    expect(env.DATABASE_URL).toBe(gameUrl);
  });

  it('accepts the test database from the env file', () => {
    const file = envFile('.env.test.ok', 'DATABASE_URL=postgresql://u:p@localhost:5432/equoria_test\n');
    expect(guardTestDatabase({ env: {}, envFile: file }).database).toBe('equoria_test');
  });

  it('a value already in the environment (CI, a lane) wins over the file', () => {
    const file = envFile('.env.test.game2', `DATABASE_URL=${gameUrl}\n`);
    const lane = 'postgresql://u:p@localhost:5432/equoria_lane_abcdef_1';
    const env = { DATABASE_URL: lane };
    expect(guardTestDatabase({ env, envFile: file }).database).toBe('equoria_lane_abcdef_1');
    expect(env.DATABASE_URL).toBe(lane);
  });

  it('refuses when neither the environment nor the file names a database', () => {
    const file = envFile('.env.test.empty', 'JWT_SECRET=x\n');
    expect(() => guardTestDatabase({ env: {}, envFile: file })).toThrow(/missing/);
  });

  it('refuses when the test env file is absent and nothing is set', () => {
    expect(() => guardTestDatabase({ env: {}, envFile: path.join(workDir, 'absent.env') })).toThrow(/missing/);
  });
});

describe('readGameDatabaseUrls', () => {
  it('returns DATABASE_URL from the game env file', () => {
    const file = envFile('.env.game', `PORT=3000\nDATABASE_URL=${gameUrl}\n`);
    expect(readGameDatabaseUrls(file)).toEqual([gameUrl]);
  });

  it('returns nothing when the game env file names no database', () => {
    expect(readGameDatabaseUrls(envFile('.env.game.none', 'PORT=3000\n'))).toEqual([]);
  });

  it('returns nothing when there is no game env file (CI)', () => {
    expect(readGameDatabaseUrls(path.join(workDir, 'no.env'))).toEqual([]);
  });
});
