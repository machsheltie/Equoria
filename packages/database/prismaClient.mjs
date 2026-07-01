import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { registerPrismaForCleanup } from './prismaTestLifecycle.mjs';

// Resolve __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from the backend directory
const backendDir = path.resolve(__dirname, '../../backend');
dotenv.config({
  path:
    process.env.NODE_ENV === 'test'
      ? path.join(backendDir, '.env.test')
      : path.join(backendDir, '.env'),
});

// Dynamically import Prisma client. Prisma (the namespace: Prisma.sql/join/raw)
// is re-exported below so backend modules can build parameterized raw queries
// through this wrapper — @prisma/client itself is not resolvable from
// backend/node_modules (it lives in packages/database). (Equoria-lnblu)
const { PrismaClient, Prisma } = await import('@prisma/client');

// Re-exported so tests that need a SECOND client (multi-replica simulations
// like cronDistributedLock) construct it from THIS module's copy of
// @prisma/client. Loading the generated client a second time by absolute
// path creates two JS client copies sharing one native query engine, whose
// transaction bookkeeping can mismatch — interactive transactions then
// silently degrade to autocommit-per-statement (proven via txid_current()
// divergence, Equoria-fefh2.44). One copy per process, always.
export { PrismaClient };

let prisma;

const { buildDatabaseUrl } = await import('./dbPoolConfig.mjs');
const { canonicalizeHorseSex } = await import('./horseSexCanonical.mjs');

// Canonicalize `horse.sex` on every write path. Without this, controllers,
// seeds, scripts, and tests have drifted between Title Case and lowercase
// (Equoria-duz2). The interceptor is the single chokepoint — every Prisma
// write reaches the DB through here.
function canonicalizeHorseSexInData(data) {
  if (
    data &&
    typeof data === 'object' &&
    'sex' in data &&
    data.sex !== null &&
    data.sex !== undefined
  ) {
    data.sex = canonicalizeHorseSex(data.sex);
  }
}

function applyHorseSexExtension(client) {
  return client.$extends({
    name: 'horseSexCanonical',
    query: {
      horse: {
        async create({ args, query }) {
          canonicalizeHorseSexInData(args.data);
          return query(args);
        },
        async update({ args, query }) {
          canonicalizeHorseSexInData(args.data);
          return query(args);
        },
        async updateMany({ args, query }) {
          canonicalizeHorseSexInData(args.data);
          return query(args);
        },
        async upsert({ args, query }) {
          canonicalizeHorseSexInData(args.create);
          canonicalizeHorseSexInData(args.update);
          return query(args);
        },
        async createMany({ args, query }) {
          if (Array.isArray(args.data)) {
            for (const row of args.data) {
              canonicalizeHorseSexInData(row);
            }
          } else {
            canonicalizeHorseSexInData(args.data);
          }
          return query(args);
        },
      },
    },
  });
}

// Connection pool configuration for Prisma
const connectionConfig = {
  datasources: {
    db: {
      url: buildDatabaseUrl(process.env.DATABASE_URL, process.env),
    },
  },
  // Additional test-specific configuration
  ...(process.env.NODE_ENV === 'test' && {
    log: [], // No logging in tests
    errorFormat: 'minimal',
  }),
};

if (process.env.NODE_ENV === 'production') {
  prisma = applyHorseSexExtension(new PrismaClient(connectionConfig));
} else {
  if (!globalThis.__prisma) {
    globalThis.__prisma = applyHorseSexExtension(new PrismaClient(connectionConfig));
  }
  prisma = globalThis.__prisma;
}

// Register for per-test-file cleanup when running under Jest.
//
// Equoria-fefh2.15 (measured root cause of the parallel fetchCsrf timeout
// wave): clients are registered on the current Jest VM global (globalThis is
// sandboxed per test FILE) and drained by the custom PrismaCleanupEnvironment
// in its teardown() — which runs AFTER every suite-owned afterAll hook. The
// earlier fix drained in tests/setup.mjs's afterAll, but suite-owned afterAll
// hooks could reconnect Prisma after that drain, leaving one idle session per
// file until worker exit. Measured pre-fix: 99-100/100 Postgres connections
// (97+ idle) at just --maxWorkers=2, after which every new suite's first DB
// touch hangs and the beforeAll(fetchCsrf) wave times out. JEST_WORKER_ID is
// set even under --runInBand; outside Jest the registration is skipped and
// process exit cleans up.
if (process.env.JEST_WORKER_ID !== undefined) {
  registerPrismaForCleanup(prisma);
}

export default prisma;
// Re-export the Prisma namespace (Prisma.sql / Prisma.join / Prisma.raw) for
// backend modules building parameterized raw queries — Equoria-lnblu.
export { Prisma };
