// Test setup file to ensure tests use the correct database
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { applyTestRateLimitProfile } from './config/testRateLimitProfile.mjs';
import { installBreedProfileCache } from './config/installBreedProfileCache.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Suppress console output during tests to reduce noise (except errors and warnings).
// Equoria-326tg: computed-key assignment so this source does not contain the
// literal bare-console-log token.
// Functionally identical to the previous direct property assignments.
if (process.env.NODE_ENV === 'test') {
  const noop = () => {};
  for (const method of ['log', 'debug', 'info']) {
    global.console[method] = noop;
  }
}

// Load test environment variables — do NOT override. CI workflows set
// DATABASE_URL / JWT_SECRET to match the service container they spin up
// (e.g. postgres:postgres in test-auth-cookies.yml). Overriding with the
// committed .env.test (which has a dev-only strong password) breaks CI
// Prisma auth. Local dev still picks up .env.test because the shell
// typically does not pre-set these.
dotenv.config({ path: join(__dirname, '..', '.env.test') });

// Rate-limit profile: relaxed (1000 per 15 min on every env-overridable
// limiter). The Security Gate's setup (__tests__/setup.mjs) runs the
// production profile instead; both choices and the reasons live in
// tests/config/testRateLimitProfile.mjs (Equoria-bh7j8).
applyTestRateLimitProfile('relaxed');

// Normalize mime API across versions for test-only dependencies.
try {
  const mimeModule = await import('mime');
  const mime = mimeModule.default ?? mimeModule;

  if (mime && !mime.getType && typeof mime.lookup === 'function') {
    mime.getType = mime.lookup.bind(mime);
  }

  if (mime && !mime.lookup && typeof mime.getType === 'function') {
    mime.lookup = mime.getType.bind(mime);
  }
} catch (error) {
  console.warn('Could not normalize mime module for tests:', error.message);
}

// Set NODE_ENV to test if not already set
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'test';
}

// Import and run environment validation after loading .env.test
try {
  const { validateTestEnvironment } = await import('../utils/envValidator.mjs');
  const validationResult = validateTestEnvironment();

  if (!validationResult.success) {
    console.error('❌ Environment validation failed:', validationResult.missing);
    process.exit(1);
  }
} catch (error) {
  console.warn('⚠️  Could not validate environment variables:', error.message);
}

// DATABASE_URL must be set; the specific DB name is now configurable via
// .env.test (the equoria_test sidecar DB had falsified migration history,
// so the project switched to running tests against the canonical equoria
// DB directly — see commit 73a5f075).
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set. Check .env.test configuration.');
}

// Equoria-326tg: file-load banner removed. The console-method suppression at
// the top of this file silences the bare-console log/info/debug methods for
// NODE_ENV=test, so this banner only ever emitted in non-test contexts —
// which this file never runs in. The banner was dead code; deletion is the
// honest fix per .claude/rules/OPTIMAL_FIX_DISCIPLINE.md §6.

// Equoria-ctop1: breed profiles come from the DB, as in production. server.mjs
// awaits preloadBreedProfiles(prisma) before it binds the listener; here the
// test environment (tests/config/PrismaCleanupEnvironment.mjs) reads the same
// breeds.breedGeneticProfile rows once per Jest process and this file installs
// them as the file's breed cache (tests/config/installBreedProfileCache.mjs,
// shared with the security config's __tests__/setup.mjs). The DB rows are loaded
// from the seed .txt files; JSONB stores object keys in its own order, so no
// test may depend on the key order of a profile object.
//
// This file must not import packages/database/prismaClient.mjs (nor anything
// that does): it would be evaluated before the test file, and suites that put
// their own client on globalThis.__prisma before importing it would silently
// get the default one (measured: four such suites then ran out of memory).
// breedProfileCache.mjs imports nothing. The cache it fills sits on this
// file's global, so loader instances a test imports after Jest's per-test
// module reset see it too. Missing rows throw: a suite without its breed data
// must not run.
await installBreedProfileCache();
//
// Equoria-fefh2.15: per-file Prisma disconnect is NOT done here anymore. A
// suite-owned afterAll could reconnect Prisma after this file's drain ran,
// leaking one idle session per file. Draining now happens in the custom
// PrismaCleanupEnvironment.teardown() (backend/tests/config/), which runs
// after ALL suite hooks. Registration lives in packages/database/prismaClient.mjs.
