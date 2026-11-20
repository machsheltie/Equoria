/**
 * Keeps the broad Playwright suite (playwright.config.ts) away from the owner's
 * game (Equoria-8w3ax.2).
 *
 * Her dev backend listens on port 3001 and uses the game database. Until
 * 2026-11-20 a local `npm run test:e2e` started while it was up REUSED it, so
 * global-setup and every spec registered players and created shows in her game.
 * Three things now prevent that:
 *
 *   - the E2E backend gets its own local port (3101; CI keeps 3001) and
 *     playwright.config.ts never reuses a running server, so Playwright refuses
 *     to start rather than talk to a server it did not start;
 *   - assertE2eTestDatabase() refuses any DATABASE_URL that is not a local test
 *     database (the backend guard's rules) before a server starts or a test
 *     process writes. playwright.config.ts calls it in the runner and in every
 *     worker (each worker re-evaluates the config); the backend it starts
 *     inherits that same DATABASE_URL;
 *   - loadE2ePrisma() runs the same check again before any direct Prisma write.
 *
 * Plain .mjs (not .ts) so backend Jest can exercise it directly.
 */
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  assertTestDatabaseUrl,
  readGameDatabaseUrls,
} from '../../../backend/tests/config/testDatabaseGuard.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const prismaClientUrl = pathToFileURL(
  path.join(projectRoot, 'packages', 'database', 'prismaClient.mjs')
).href;

/** Port of the E2E backend in CI (unchanged since Story 21S-3). */
export const ciBackendPort = '3001';
/** Port of the E2E backend on a laptop: never the dev backend's 3001. */
export const localBackendPort = '3101';

/** EQUORIA_BACKEND_PORT when set, otherwise 3001 in CI and 3101 locally. */
export function resolveE2eBackendPort(env = process.env) {
  const configured = env.EQUORIA_BACKEND_PORT?.trim();
  if (configured) {
    return configured;
  }
  return env.CI ? ciBackendPort : localBackendPort;
}

/** Origin of the E2E backend, for specs that call it directly. */
export function e2eBackendUrl(env = process.env) {
  return `http://localhost:${resolveE2eBackendPort(env)}`;
}

/**
 * Throw unless DATABASE_URL is a local test database that backend/.env (the
 * local game) does not use. Returns its host, port and database name.
 */
export function assertE2eTestDatabase(env = process.env) {
  return assertTestDatabaseUrl(env.DATABASE_URL, { gameUrls: readGameDatabaseUrls() });
}

/**
 * The shared Prisma client (packages/database/prismaClient.mjs), returned only
 * after process.env.DATABASE_URL — the URL that client connects to — passed
 * assertE2eTestDatabase().
 */
export async function loadE2ePrisma() {
  assertE2eTestDatabase(process.env);
  const mod = await import(prismaClientUrl);
  if (!mod.default) {
    throw new Error('Could not resolve the prisma client from packages/database/prismaClient.mjs');
  }
  return mod.default;
}
