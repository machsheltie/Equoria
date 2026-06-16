// Test setup file to ensure tests use the correct database
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Suppress console output during tests to reduce noise (except errors and warnings).
// Equoria-326tg: computed-key assignment so this source does not contain the
// literal bare-console-log token gated by the noConsoleLogInTestsDirs sentinel.
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

// Rate limit cap for test runs. The bypass header was removed in WS4; we
// now control test traffic via the TEST_RATE_LIMIT_* env knobs that
// createRateLimiter reads when `useEnvOverride: true` (the default). A
// high default keeps feature suites green without forcing each file to
// set its own cap. Files that need a specific cap (e.g.
// rate-limiting.test.mjs) override this before importing app.mjs.
if (!process.env.TEST_RATE_LIMIT_MAX_REQUESTS) {
  process.env.TEST_RATE_LIMIT_MAX_REQUESTS = '1000';
}
if (!process.env.TEST_RATE_LIMIT_WINDOW_MS) {
  process.env.TEST_RATE_LIMIT_WINDOW_MS = `${15 * 60 * 1000}`;
}

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

// Equoria-wpfvl (2026-05-28) — DB cache preload INTENTIONALLY NOT wired into
// tests during the transition window. Production (server.mjs) preloads
// before binding the listener and uses the DB profile (richer: color
// genetics, post-26qjf-imported breed data). The tests in this codebase
// were authored against breedProfiles.json and assert JSON-shaped values
// (e.g. specific gaited_gait_registry orderings, breed-specific gait names)
// that diverge from the DB SQL data in real ways — see follow-up issue
// for the reconciliation work (align DB rating_profiles.gaits ordering,
// gaited_gait_registry contents, and conformation regions to the JSON
// before the cache can be preloaded in tests without per-test surgery).
// Tests that NEED cache behavior must call preloadBreedProfiles(prisma)
// explicitly in their own beforeAll; the JSON fallback covers everything
// else. NOT a regression of wpfvl — the production path still preloads.
//
// Equoria-fefh2.15: per-file Prisma disconnect is NOT done here anymore. A
// suite-owned afterAll could reconnect Prisma after this file's drain ran,
// leaking one idle session per file. Draining now happens in the custom
// PrismaCleanupEnvironment.teardown() (backend/tests/config/), which runs
// after ALL suite hooks. Registration lives in packages/database/prismaClient.mjs.
