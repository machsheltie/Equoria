/**
 * Playwright never runs against the owner's game (Equoria-8w3ax.2).
 *
 * - tests/e2e/helpers/e2eTestStack.mjs: the port the E2E backend gets, the
 *   database check playwright.config.ts and the E2E global setup run, and the
 *   guarded Prisma loader the global setup writes through.
 * - backend/utils/testProfileDatabasePolicy.mjs: a NODE_ENV=beta or
 *   beta-readiness server refuses the database backend/.env (the local game)
 *   names.
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from '@jest/globals';
import {
  assertE2eTestDatabase,
  ciBackendPort,
  e2eBackendUrl,
  loadE2ePrisma,
  localBackendPort,
  resolveE2eBackendPort,
} from '../../tests/e2e/helpers/e2eTestStack.mjs';
import { testProfileDatabaseRefusal } from '../utils/testProfileDatabasePolicy.mjs';

const gameUrl = 'postgresql://owner:secretpw@localhost:5432/equoria';
const workDir = mkdtempSync(path.join(tmpdir(), 'equoria-e2e-db-isolation-'));

afterAll(() => {
  rmSync(workDir, { recursive: true, force: true });
});

/** Run `fn` with process.env.DATABASE_URL set to `url` (deleted when undefined), then restore it. */
async function withDatabaseUrl(url, fn) {
  const saved = process.env.DATABASE_URL;
  try {
    if (url === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = url;
    }
    return await fn();
  } finally {
    if (saved === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = saved;
    }
  }
}

describe('E2E backend port', () => {
  it('is 3101 on a laptop, never the dev backend port 3001', () => {
    expect(localBackendPort).toBe('3101');
    expect(resolveE2eBackendPort({})).toBe('3101');
    expect(e2eBackendUrl({})).toBe('http://localhost:3101');
  });

  it('stays 3001 in CI', () => {
    expect(ciBackendPort).toBe('3001');
    expect(resolveE2eBackendPort({ CI: 'true' })).toBe('3001');
    expect(e2eBackendUrl({ CI: 'true' })).toBe('http://localhost:3001');
  });

  it('follows EQUORIA_BACKEND_PORT in both modes, so the specs and the server agree', () => {
    expect(resolveE2eBackendPort({ EQUORIA_BACKEND_PORT: '3201' })).toBe('3201');
    expect(resolveE2eBackendPort({ CI: 'true', EQUORIA_BACKEND_PORT: ' 3202 ' })).toBe('3202');
    expect(resolveE2eBackendPort({ EQUORIA_BACKEND_PORT: '  ' })).toBe('3101');
  });
});

describe('E2E database check (playwright.config.ts, global setup)', () => {
  it.each([
    ['the local game database', { DATABASE_URL: gameUrl }, /database "equoria" is not a test database/],
    ['a Supabase host', { DATABASE_URL: 'postgresql://u:p@db.abcdefgh.supabase.co:5432/equoria_test' }, /is not local/],
    ['no DATABASE_URL at all', {}, /DATABASE_URL is missing/],
  ])('refuses %s', (_label, env, reason) => {
    expect(() => assertE2eTestDatabase(env)).toThrow(/\[test-db-guard\] Refusing to run tests/);
    expect(() => assertE2eTestDatabase(env)).toThrow(reason);
  });

  it('accepts the local test database CI and the laptop use', () => {
    expect(assertE2eTestDatabase({ DATABASE_URL: 'postgresql://test:test@localhost:5432/equoria_test' })).toMatchObject(
      { host: 'localhost', database: 'equoria_test' },
    );
  });
});

describe('global setup Prisma loader', () => {
  it.each([
    ['the local game database', gameUrl],
    ['a remote host', 'postgresql://u:p@db.example.com:5432/equoria_test'],
    ['no DATABASE_URL', undefined],
  ])('refuses to hand out a client on %s', async (_label, url) => {
    await withDatabaseUrl(url, async () => {
      await expect(loadE2ePrisma()).rejects.toThrow(/\[test-db-guard\] Refusing to run tests/);
    });
  });

  it('hands out the shared client on the test database, connected to a *_test database', async () => {
    const prisma = await loadE2ePrisma();
    const [{ name }] = await prisma.$queryRaw`SELECT current_database() AS name`;
    expect(name).toMatch(/_test$|^equoria_lane_/);
  });
});

describe('beta / beta-readiness server profiles refuse the local game database', () => {
  const gameEnvFile = path.join(workDir, 'game.env');
  writeFileSync(gameEnvFile, `PORT=3001\nDATABASE_URL="${gameUrl}"\n`);

  it.each([
    ['beta', gameUrl],
    ['beta-readiness', gameUrl],
    ['beta', 'postgresql://other:pw@127.0.0.1/equoria'],
  ])('NODE_ENV=%s on %s is refused', (nodeEnv, databaseUrl) => {
    const refusal = testProfileDatabaseRefusal({ nodeEnv, databaseUrl, gameEnvFile });
    expect(refusal).toMatch(/the local game database backend\/\.env uses/);
    expect(refusal).toContain('localhost:5432/equoria');
    expect(refusal).not.toContain('secretpw');
  });

  it.each([
    ['beta on the test database', 'beta', 'postgresql://owner:secretpw@localhost:5432/equoria_test'],
    ['production on the game database', 'production', gameUrl],
    ['development on the game database', 'development', gameUrl],
  ])('%s is allowed', (_label, nodeEnv, databaseUrl) => {
    expect(testProfileDatabaseRefusal({ nodeEnv, databaseUrl, gameEnvFile })).toBeNull();
  });

  it('changes nothing where there is no backend/.env (Railway, CI)', () => {
    const missing = path.join(workDir, 'absent.env');
    expect(testProfileDatabaseRefusal({ nodeEnv: 'beta', databaseUrl: gameUrl, gameEnvFile: missing })).toBeNull();
  });
});
