/**
 * Sentinel for the shared-Prisma-method guard (Equoria-qe0b0).
 *
 * 2026-10-23: a test "restored" prisma.$queryRaw with a .bind(prisma) copy.
 * The client is shared by every file in an in-band Jest process, so every later
 * file's tx.$queryRaw ran outside its transaction and an order-dependent gate
 * failure appeared. The custom environment now records $queryRaw, $executeRaw
 * and $transaction when a file starts and fails the file at teardown if any is
 * a different function, putting the originals back.
 *
 * Runs against the REAL extended client from packages/database so the identity
 * semantics (stable property reads, assignment lands) are the ones the gate
 * sees, and drives the real environment class's teardown.
 */
import { describe, it, expect, afterEach } from '@jest/globals';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import prisma from '../../packages/database/prismaClient.mjs';
import PrismaCleanupEnvironment, {
  snapshotGuardedPrismaMethods,
  restoreGuardedPrismaMethods,
} from '../tests/config/PrismaCleanupEnvironment.mjs';

const __filename = fileURLToPath(import.meta.url);
const backendRoot = path.resolve(path.dirname(__filename), '..');
const projectConfig = {
  rootDir: backendRoot,
  testEnvironmentOptions: {},
  globals: {},
  injectGlobals: true,
  fakeTimers: { enableGlobally: false },
};
const environmentContext = { console, docblockPragmas: {}, testPath: __filename };

const names = ['$queryRaw', '$executeRaw', '$transaction'];

describe('Equoria-qe0b0 shared Prisma method guard', () => {
  const originals = Object.fromEntries(names.map(name => [name, prisma[name]]));

  afterEach(() => {
    for (const name of names) {
      prisma[name] = originals[name];
    }
  });

  it('property reads on the extended client are identity-stable', () => {
    for (const name of names) {
      expect(prisma[name]).toBe(prisma[name]);
    }
  });

  it('reports nothing when the methods are untouched', () => {
    const snapshot = snapshotGuardedPrismaMethods({ __prisma: prisma });
    expect(restoreGuardedPrismaMethods(snapshot)).toEqual([]);
  });

  it('reports no client when the sandbox has none', () => {
    expect(snapshotGuardedPrismaMethods({})).toBeNull();
    expect(restoreGuardedPrismaMethods(null)).toEqual([]);
  });

  it.each(names)('detects a .bind(prisma) copy left on %s and puts the original back', name => {
    const snapshot = snapshotGuardedPrismaMethods({ __prisma: prisma });
    prisma[name] = prisma[name].bind(prisma);
    expect(prisma[name]).not.toBe(originals[name]);

    expect(restoreGuardedPrismaMethods(snapshot)).toEqual([name]);
    expect(prisma[name]).toBe(originals[name]);
  });

  it('a restore-by-assignment of the original passes', () => {
    const snapshot = snapshotGuardedPrismaMethods({ __prisma: prisma });
    const real = prisma.$queryRaw;
    prisma.$queryRaw = function wrapped(...args) {
      return real.apply(this, args);
    };
    prisma.$queryRaw = real;
    expect(restoreGuardedPrismaMethods(snapshot)).toEqual([]);
  });

  it('environment teardown fails the file that leaves a method replaced', async () => {
    const env = new PrismaCleanupEnvironment({ globalConfig: {}, projectConfig }, environmentContext);
    env._prismaMethodSnapshot = snapshotGuardedPrismaMethods({ __prisma: prisma });
    prisma.$executeRaw = prisma.$executeRaw.bind(prisma);

    await expect(env.teardown()).rejects.toThrow(/left shared Prisma client method\(s\) replaced: \$executeRaw/);
    expect(prisma.$executeRaw).toBe(originals.$executeRaw);
  });

  it('environment teardown passes when nothing was replaced', async () => {
    const env = new PrismaCleanupEnvironment({ globalConfig: {}, projectConfig }, environmentContext);
    env._prismaMethodSnapshot = snapshotGuardedPrismaMethods({ __prisma: prisma });
    await expect(env.teardown()).resolves.toBeUndefined();
  });
});
