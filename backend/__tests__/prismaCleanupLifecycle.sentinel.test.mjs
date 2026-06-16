/**
 * Sentinel for the Jest/Prisma lifecycle contract.
 *
 * The shared Prisma client registers itself for per-test-file cleanup. The
 * cleanup API must see that registration even when Jest and native ESM loading
 * would otherwise create separate module instances.
 */
import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import pg from 'pg';
import { TestEnvironment as NodeEnvironment } from 'jest-environment-node';
import prisma from '../../packages/database/prismaClient.mjs';
import { cleanupPrismaInstances } from '../jest.setup.mjs';
import { PRISMA_CLEANUP_REGISTRY_KEY, registerPrismaForCleanup } from '../../packages/database/prismaTestLifecycle.mjs';
import PrismaCleanupEnvironment from '../tests/config/PrismaCleanupEnvironment.mjs';

const { Client } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, '..');
const repositoryRoot = path.resolve(backendRoot, '..');

const readBackendFile = relativePath => readFileSync(path.join(backendRoot, relativePath), 'utf8');
const readRepositoryFile = relativePath => readFileSync(path.join(repositoryRoot, relativePath), 'utf8');

async function connectionExists(monitor, pid) {
  const result = await monitor.query('SELECT count(*)::int AS count FROM pg_stat_activity WHERE pid = $1', [pid]);
  return result.rows[0].count > 0;
}

describe('Prisma Jest cleanup lifecycle sentinel', () => {
  test('backend Jest profiles clean Prisma in environment teardown, after suite hooks', () => {
    for (const configFile of [
      'jest.config.mjs',
      'jest.config.security.mjs',
      'jest.config.performance.mjs',
      'jest.config.optimized.mjs',
    ]) {
      expect(readBackendFile(configFile)).toContain(
        "testEnvironment: '<rootDir>/tests/config/PrismaCleanupEnvironment.mjs'",
      );
    }

    const setupSource = readBackendFile('tests/setup.mjs');
    expect(setupSource).not.toContain('cleanupPrismaInstances');
    expect(setupSource).not.toMatch(/afterAll\s*\(\s*async\s*\(\)\s*=>\s*\{[\s\S]*?\$disconnect/);

    const environmentSource = readBackendFile('tests/config/PrismaCleanupEnvironment.mjs');
    expect(environmentSource).toContain('await cleanupPrismaInstances(this.global)');
    expect(environmentSource).toContain('await super.teardown()');
    expect(environmentSource.indexOf('await cleanupPrismaInstances(this.global)')).toBeLessThan(
      environmentSource.indexOf('await super.teardown()'),
    );
    expect(readRepositoryFile('jest.config.js')).toContain(
      "testEnvironment: '<rootDir>/tests/config/PrismaCleanupEnvironment.mjs'",
    );
  });

  test('the custom environment drains clients before base environment teardown', async () => {
    const events = [];
    const scope = {};
    const environment = Object.create(PrismaCleanupEnvironment.prototype);
    environment.global = scope;
    registerPrismaForCleanup(
      {
        async $disconnect() {
          events.push('disconnect');
        },
      },
      scope,
    );
    const baseTeardown = jest.spyOn(NodeEnvironment.prototype, 'teardown').mockImplementation(async () => {
      events.push('base teardown');
    });

    try {
      await environment.teardown();
    } finally {
      baseTeardown.mockRestore();
    }

    expect(events).toEqual(['disconnect', 'base teardown']);
  });

  test('the custom environment retries cleanup but still reports the first disconnect failure', async () => {
    const events = [];
    const scope = {};
    const environment = Object.create(PrismaCleanupEnvironment.prototype);
    environment.global = scope;
    let calls = 0;
    registerPrismaForCleanup(
      {
        async $disconnect() {
          calls += 1;
          events.push(`disconnect ${calls}`);
          if (calls === 1) {
            throw new Error('transient disconnect failure');
          }
        },
      },
      scope,
    );
    const baseTeardown = jest.spyOn(NodeEnvironment.prototype, 'teardown').mockImplementation(async () => {
      events.push('base teardown');
    });

    try {
      await expect(environment.teardown()).rejects.toThrow('Failed to disconnect 1 Prisma test client(s)');
    } finally {
      baseTeardown.mockRestore();
    }

    expect(events).toEqual(['disconnect 1', 'disconnect 2', 'base teardown']);
    expect(scope[PRISMA_CLEANUP_REGISTRY_KEY]).toHaveLength(0);
  });

  test('the registry deduplicates clients and removes them after a successful drain', async () => {
    const scope = {};
    let disconnectCalls = 0;
    const client = {
      async $disconnect() {
        disconnectCalls += 1;
      },
    };

    registerPrismaForCleanup(client, scope);
    registerPrismaForCleanup(client, scope);

    expect(scope[PRISMA_CLEANUP_REGISTRY_KEY]).toHaveLength(1);
    await expect(cleanupPrismaInstances(scope)).resolves.toEqual({ disconnected: 1 });
    expect(disconnectCalls).toBe(1);
    expect(scope[PRISMA_CLEANUP_REGISTRY_KEY]).toHaveLength(0);
  });

  test('a rejected disconnect fails loudly and remains registered for diagnosis', async () => {
    const scope = {};
    const disconnectError = new Error('sentinel disconnect failure');
    const client = {
      async $disconnect() {
        throw disconnectError;
      },
    };

    registerPrismaForCleanup(client, scope);

    const cleanupError = await cleanupPrismaInstances(scope).catch(error => error);
    expect(cleanupError).toBeInstanceOf(AggregateError);
    expect(cleanupError.message).toBe('Failed to disconnect 1 Prisma test client(s)');
    expect(cleanupError.errors[0].message).toContain(
      'Prisma test client 1 disconnect failed: sentinel disconnect failure',
    );
    expect(scope[PRISMA_CLEANUP_REGISTRY_KEY]).toEqual([client]);
  });

  test('NODE_ENV=test without JEST_WORKER_ID imports Prisma without registering cleanup', async () => {
    const prismaClientUrl = pathToFileURL(path.join(repositoryRoot, 'packages/database/prismaClient.mjs')).href;
    const workerId = process.env.JEST_WORKER_ID;
    const existingRegistry = globalThis[PRISMA_CLEANUP_REGISTRY_KEY];

    delete process.env.JEST_WORKER_ID;
    delete globalThis[PRISMA_CLEANUP_REGISTRY_KEY];
    try {
      await import(`${prismaClientUrl}?standalone-sentinel=${Date.now()}`);
      expect(globalThis[PRISMA_CLEANUP_REGISTRY_KEY]).toBeUndefined();
    } finally {
      process.env.JEST_WORKER_ID = workerId;
      Object.defineProperty(globalThis, PRISMA_CLEANUP_REGISTRY_KEY, {
        configurable: true,
        value: existingRegistry,
        writable: false,
      });
    }
  });

  test('the cleanup API disconnects the Prisma client registered by prismaClient.mjs', async () => {
    const [{ pid }] = await prisma.$queryRaw`SELECT pg_backend_pid()::int AS pid`;
    const monitor = new Client({ connectionString: process.env.DATABASE_URL });
    await monitor.connect();

    try {
      expect(await connectionExists(monitor, pid)).toBe(true);

      await cleanupPrismaInstances();

      expect(await connectionExists(monitor, pid)).toBe(false);
    } finally {
      await monitor.end();
    }
  });
});
