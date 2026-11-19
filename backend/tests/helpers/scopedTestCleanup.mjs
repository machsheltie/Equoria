/**
 * Scoped cleanup helpers for the progression integration tests.
 *
 * These suites run inside the `backend` jest project (modules/users/__tests__)
 * against a real database: a disposable lane DB under the sharded runner, the
 * configured test DB otherwise. A bare `prisma.user.deleteMany({})` here wipes
 * ALL users in that database. Cleanup MUST be
 * scoped to the rows the fixtures created — never unscoped.
 *
 * Reusing these helpers (instead of inlining where-clauses) keeps the scope in
 * one place: never revert a helper back to `{}`.
 */

/** Fixed string PKs created by modules/users/__tests__/progression.integration.test.mjs. */
export const progressionTestUserIds = ['test-user-1', 'test-user-2', 'test-user-3'];

/**
 * Delete ONLY the progression suite's fixture users and their xpEvents.
 * Child rows (xpEvent → user FK) are removed before the parent users.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string[]} [userIds] - fixture user ids to scope to.
 */
export async function cleanupProgressionFixtures(prisma, userIds = progressionTestUserIds) {
  await prisma.xpEvent.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}
