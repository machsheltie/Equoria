/**
 * Jest Test Setup and Cleanup
 *
 * Not wired as a Jest setup file (jest.config.mjs loads tests/setup.mjs; the
 * security profile loads __tests__/setup.mjs). This module only re-exports the
 * Prisma test-lifecycle API for prismaCleanupLifecycle.sentinel.test.mjs.
 *
 * A drifted ~300-line copy of the audit middleware used to live here
 * (Equoria-xbabf); the one real implementation is middleware/auditLog.mjs.
 */
export {
  cleanupPrismaInstances,
  registerPrismaForCleanup,
} from '../packages/database/prismaTestLifecycle.mjs';
