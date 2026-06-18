/**
 * Jest Global Setup
 *
 * Cleans up known hardcoded test data from previous failed runs before
 * the test suite starts. This prevents unique constraint failures when
 * test afterAll hooks didn't run due to earlier test failures.
 *
 * Removes rows by exact names/emails AND by prefix patterns that are
 * known to accumulate when suite-level afterAll/afterEach hooks don't
 * complete (e.g. jest worker crash, mid-run cancellation).
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default async function globalSetup() {
  console.info('🧹 Running global setup — cleaning leftover test data...');

  try {
    // Do NOT override — env vars set by CI (or the harness) must take
    // precedence over the committed .env.test defaults. Overriding here
    // broke the CI HttpOnly Cookie job: the workflow passes DATABASE_URL=
    // postgresql://postgres:postgres@localhost for the postgres service
    // container, but .env.test contains a dev password that doesn't match,
    // so Prisma auth failed. Local dev still reads .env.test because the
    // shell typically doesn't pre-set DATABASE_URL.
    dotenv.config({
      path: path.join(__dirname, '..', '.env.test'),
    });

    const { default: prisma } = await import('../../packages/database/prismaClient.mjs');

    // ── Step 1: Delete refresh tokens for all known test user patterns ──────
    // Must run BEFORE user deletions to satisfy FK constraints.
    // Pattern list covers every suite that uses email-prefix scoped users.
    const tokenEmailPatterns = [
      { contains: 'tokentest' }, // token-rotation.integration.test.mjs
      { contains: 'tokenunit' }, // token-rotation.unit.test.mjs
      { contains: 'authintegration' }, // auth-system-integration.test.mjs
      { startsWith: 'memory_admin_' }, // memoryAdminGuard.integration.test.mjs
      { startsWith: 'memory_regular_' }, // memoryAdminGuard.integration.test.mjs
      { startsWith: 'acookie-' }, // auth-cookies.test.mjs (defence-in-depth; suite also self-cleans)
      { startsWith: 'cintg-' }, // cookieIntegration.test.mjs (defence-in-depth; suite also self-cleans)
    ];

    for (const pattern of tokenEmailPatterns) {
      await prisma.refreshToken.deleteMany({
        where: { user: { email: pattern } },
      });
    }

    // Also cover known hardcoded emails that have refresh tokens
    await prisma.refreshToken.deleteMany({
      where: {
        user: {
          email: {
            in: [
              'memory@test.com',
              'ratelimit@example.com',
              'securitytest1@test.com',
              'authintegration@test.com',
            ],
          },
        },
      },
    });

    // ── Step 2: FK-ordered user purge helper (Equoria-fefh2.29) ─────────────
    // v58ta made horses_userId_fkey ON DELETE RESTRICT (the prior comment here
    // claimed SET NULL — STALE/WRONG since v58ta). A fixture user that owns a
    // registration starter horse therefore RESTRICT-blocks user.deleteMany,
    // which Step 4 then caught-and-swallowed, emitting the per-run
    // "violates RESTRICT setting of foreign key constraint horses_userId_fkey"
    // warning and leaving stale fixture data. purgeUsers deletes each pattern's
    // horses BEFORE its users so the user delete cannot RESTRICT-fail — which in
    // turn lets the catch below be fail-loud (any remaining error is genuinely
    // unexpected). All deletes stay prefix/id scoped — no broad deleteMany.
    const purgeUsers = async where => {
      await prisma.horse.deleteMany({ where: { user: where } });
      await prisma.user.deleteMany({ where });
    };

    // ── Step 3: Delete hardcoded test horses by name ─────────────────────────
    const testHorseNames = [
      'OWASP Test Horse',
      'Analytics Test Horse',
      'Fearful Horse',
      'Confident Horse',
      'Developing Horse',
      'Population Horse 1',
      'Population Horse 2',
      'Progress Test Horse',
      'Stolen Horse',
      'Consistency Test Horse',
      'Cross System Test Horse',
      'Genetic Test Mare',
      'Genetic Test Stallion',
      'Global Test Horse',
      'Other Horse',
      'Trait Test Foal',
      'Competition Integration Champion',
      'TestHorse Nova',
      'Other User Horse',
    ];
    await prisma.horse.deleteMany({ where: { name: { in: testHorseNames } } });

    // Prefix-pattern leaks from E2E suites
    await prisma.competitionResult.deleteMany({
      where: { showName: { startsWith: 'Readiness Show' } },
    });
    await prisma.show.deleteMany({
      where: { name: { startsWith: 'Readiness Show' } },
    });
    await prisma.horse.deleteMany({
      where: { name: { startsWith: 'Atlas Prime' } },
    });

    // ── Step 4: Delete test users by username/email pattern (FK-ordered) ─────
    // Each purgeUsers() deletes the pattern's horses before its users
    // (Equoria-fefh2.29). refreshTokens were already cleaned in Step 1.

    // Prefix-pattern users (accumulated when afterAll doesn't run)
    const usernamePatterns = [
      { startsWith: 'memory_admin_' }, // memoryAdminGuard.integration.test.mjs
      { startsWith: 'memory_regular_' }, // memoryAdminGuard.integration.test.mjs
      { startsWith: 'tokentest_' }, // token-rotation.integration.test.mjs
      { startsWith: 'tokenunit_' }, // token-rotation.unit.test.mjs
      { startsWith: 'testuser_' }, // generic createTestUser() callers
      { startsWith: 'competitionapi_' }, // competition API tests
      { startsWith: 'acookie_' }, // auth-cookies.test.mjs (defence-in-depth)
      { startsWith: 'cintg_' }, // cookieIntegration.test.mjs (defence-in-depth)
      { startsWith: 'recovery_' }, // recovery users created by createTestHorse()
    ];
    for (const pattern of usernamePatterns) {
      await purgeUsers({ username: pattern });
    }

    // Hardcoded usernames that should not persist between runs
    const testUsernames = ['progresstest', 'testuser123', 'memoryTestUser', 'authintegrationuser'];
    await purgeUsers({ username: { in: testUsernames } });

    // Hardcoded and pattern emails
    const testEmails = [
      'ratelimit@example.com',
      'memory@test.com',
      'securitytest1@test.com',
      'authintegration@test.com',
    ];
    await purgeUsers({ email: { in: testEmails } });

    // Email patterns (contains) for suites that stamp timestamp into the email
    const emailContainsPatterns = [
      'tokentest', // token-rotation.integration.test.mjs
      'tokenunit', // token-rotation.unit.test.mjs
      'authintegration', // auth-system-integration.test.mjs
    ];
    for (const pattern of emailContainsPatterns) {
      await purgeUsers({ email: { contains: pattern } });
    }

    await prisma.$disconnect();
    console.info('✅ Global setup: leftover test data cleaned');
  } catch (error) {
    // Equoria-fefh2.29: FAIL LOUD. With Step 4 now FK-ordered (purgeUsers),
    // a fixture user's horses are deleted before the user, so the known
    // horses_userId_fkey RESTRICT violation can no longer occur. Any error
    // reaching here is therefore UNEXPECTED — a broken/untrustworthy pre-clean
    // that previously hid behind a warning. Surface it and abort: a global
    // setup that silently half-cleans is worse than none (CLAUDE.md §2/§3,
    // EDGE_CASE_FIX_DISCIPLINE §3 fail-closed).
    console.error('❌ Global setup cleanup FAILED (FK-order regression or DB fault):', error);
    throw error;
  }
}
