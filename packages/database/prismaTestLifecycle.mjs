/**
 * Per-Jest-environment Prisma lifecycle registry.
 *
 * Jest creates a separate VM global for every test file. Storing clients on
 * that global lets the custom environment disconnect them after every suite
 * hook has finished, including suite-owned afterAll cleanup that uses Prisma.
 */
export const PRISMA_CLEANUP_REGISTRY_KEY = '__equoriaPrismaCleanupRegistry';
const DISCONNECT_TIMEOUT_MS = 10000;

async function disconnectWithTimeout(prismaInstance) {
  let timer;
  try {
    await Promise.race([
      prismaInstance.$disconnect(),
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`disconnect timed out after ${DISCONNECT_TIMEOUT_MS}ms`)),
          DISCONNECT_TIMEOUT_MS
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function getRegistry(scope, create) {
  if (!scope || (typeof scope !== 'object' && typeof scope !== 'function')) {
    throw new TypeError('Prisma cleanup requires a valid global scope');
  }

  const existing = scope[PRISMA_CLEANUP_REGISTRY_KEY];
  if (existing !== undefined) {
    if (!Array.isArray(existing)) {
      throw new TypeError('Prisma cleanup registry must be an array');
    }
    return existing;
  }

  if (!create) {
    return null;
  }

  const registry = [];
  Object.defineProperty(scope, PRISMA_CLEANUP_REGISTRY_KEY, {
    configurable: true,
    value: registry,
    writable: false,
  });
  return registry;
}

export function registerPrismaForCleanup(prismaInstance, scope = globalThis) {
  if (!prismaInstance || typeof prismaInstance.$disconnect !== 'function') {
    throw new TypeError('Prisma cleanup registration requires a $disconnect() client');
  }

  const registry = getRegistry(scope, true);
  if (!registry.includes(prismaInstance)) {
    registry.push(prismaInstance);
  }
  return prismaInstance;
}

export async function cleanupPrismaInstances(scope = globalThis) {
  const registry = getRegistry(scope, false);
  if (!registry?.length) {
    return { disconnected: 0 };
  }

  let disconnected = 0;
  const failures = [];

  for (const [index, prismaInstance] of [...registry].entries()) {
    try {
      await disconnectWithTimeout(prismaInstance);
      registry.splice(registry.indexOf(prismaInstance), 1);
      disconnected += 1;
    } catch (error) {
      failures.push(
        new Error(
          `Prisma test client ${index + 1} disconnect failed: ${error?.message ?? String(error)}`,
          { cause: error }
        )
      );
    }
  }

  if (failures.length) {
    throw new AggregateError(
      failures,
      `Failed to disconnect ${failures.length} Prisma test client(s)`
    );
  }

  return { disconnected };
}
