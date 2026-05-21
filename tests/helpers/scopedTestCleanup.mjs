/**
 * Scoped cleanup helpers for root-level integration tests.
 *
 * These suites run inside the `backend` jest project (jest.config.js testMatch
 * `<rootDir>/../tests/*.test.{js,mjs}`) against the CANONICAL database
 * (.env.test → production DB per CLAUDE.md §2). A bare
 * `prisma.user.deleteMany({})` here wipes ALL real users. Cleanup MUST be
 * scoped to the rows the fixtures created — never unscoped.
 *
 * Reusing these helpers (instead of inlining where-clauses) keeps the scope in
 * one place and lets the sentinel test (tests/scopedTestCleanup.sentinel.test.mjs)
 * exercise the REAL cleanup code: if anyone reverts a helper back to `{}`, the
 * sentinel's non-fixture row gets deleted and the sentinel fails.
 */

/** Fixed string PKs created by tests/progression.integration.test.mjs. */
export const PROGRESSION_TEST_USER_IDS = ['test-user-1', 'test-user-2', 'test-user-3'];

/**
 * Delete ONLY the progression suite's fixture users and their xpEvents.
 * Child rows (xpEvent → user FK) are removed before the parent users.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string[]} [userIds] - fixture user ids to scope to.
 */
export async function cleanupProgressionFixtures(prisma, userIds = PROGRESSION_TEST_USER_IDS) {
  await prisma.xpEvent.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}
