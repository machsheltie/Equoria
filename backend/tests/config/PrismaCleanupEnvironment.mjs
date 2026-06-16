/**
 * Jest environment that drains Prisma after all suite-owned hooks complete.
 */
import { TestEnvironment as NodeEnvironment } from 'jest-environment-node';
import { cleanupPrismaInstances } from '../../../packages/database/prismaTestLifecycle.mjs';

export default class PrismaCleanupEnvironment extends NodeEnvironment {
  async teardown() {
    const failures = [];

    try {
      await cleanupPrismaInstances(this.global);
    } catch (error) {
      failures.push(error);
      try {
        await cleanupPrismaInstances(this.global);
      } catch (retryError) {
        failures.push(retryError);
      }
    }

    try {
      await super.teardown();
    } catch (error) {
      failures.push(error);
    }

    if (failures.length === 1) {
      throw failures[0];
    }
    if (failures.length > 1) {
      throw new AggregateError(failures, 'Prisma and Jest environment teardown both failed');
    }
  }
}
