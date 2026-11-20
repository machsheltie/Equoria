/**
 * The Playwright server profiles never run on the local game database
 * (Equoria-8w3ax.2).
 *
 * NODE_ENV=beta and NODE_ENV=beta-readiness are the two Playwright server
 * profiles (docs/testing/BETA_PROFILE.md). On the laptop config.mjs loads the
 * ignored backend/env.beta or backend/env.beta-readiness for them, and an
 * env.beta copied before 2026-11-20 names the owner's game database, the same
 * one backend/.env (the local dev game) uses. A beta server started without an
 * inherited test DATABASE_URL then created players, horses and shows in her
 * game. This refuses to start such a server instead.
 *
 * backend/.env is gitignored and never deployed, so on Railway and in CI there
 * is no game database to compare against and this check changes nothing.
 * Only host, port and database name are compared and printed, never the URL.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

export const testServerProfiles = new Set(['beta', 'beta-readiness']);

const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const localGameEnvFile = path.join(backendDir, '.env');

const loopbackHosts = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

function databaseTarget(url) {
  if (typeof url !== 'string' || url.trim() === '') {
    return null;
  }
  try {
    const parsed = new URL(url.trim());
    const host = parsed.hostname.toLowerCase();
    return {
      host: loopbackHosts.has(host) ? 'localhost' : host,
      port: parsed.port || '5432',
      database: decodeURIComponent(parsed.pathname.replace(/^\//, '')),
    };
  } catch {
    return null;
  }
}

function readLocalGameDatabaseUrl(file) {
  try {
    return dotenv.parse(readFileSync(file)).DATABASE_URL ?? null;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

/**
 * Why a `nodeEnv` server may not use `databaseUrl`, or null when it may.
 * Only the test server profiles are checked; every other NODE_ENV is untouched.
 */
export function testProfileDatabaseRefusal({
  nodeEnv,
  databaseUrl,
  gameEnvFile = localGameEnvFile,
}) {
  if (!testServerProfiles.has(nodeEnv)) {
    return null;
  }
  const game = databaseTarget(readLocalGameDatabaseUrl(gameEnvFile));
  const target = databaseTarget(databaseUrl);
  if (!game || !target) {
    return null;
  }
  if (game.host !== target.host || game.port !== target.port || game.database !== target.database) {
    return null;
  }
  return (
    `NODE_ENV=${nodeEnv} is a Playwright test profile, but its DATABASE_URL names ` +
    `${target.host}:${target.port}/${target.database}, the local game database backend/.env uses. ` +
    `Point DATABASE_URL in backend/env.${nodeEnv} (or the shell) at the local test database, equoria_test.`
  );
}
