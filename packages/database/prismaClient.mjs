import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

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

let prisma = null;

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
  if (!global.__prisma) {
    global.__prisma = applyHorseSexExtension(new PrismaClient(connectionConfig));
  }
  prisma = global.__prisma;
}

// Register for per-test-file cleanup when running under Jest.
//
// Equoria-fefh2.15 (2026-06-10, measured root cause of the parallel fetchCsrf
// timeout wave): the previous registration dynamically imported
// backend/jest.setup.mjs via a NATIVE pathToFileURL URL. Under Jest's ESM
// loader that import does not resolve to the same module copy that
// tests/setup.mjs (which goes through Jest's registry) drains in its
// per-file afterAll — so the registration Set was never the drained Set,
// $disconnect never ran, and every test file's PrismaClient kept its pool
// connections until worker exit. Measured: 99-100/100 Postgres connections
// (97+ idle) at just --maxWorkers=2, after which every new suite's first DB
// touch hangs and the beforeAll(fetchCsrf) wave times out.
//
// The fix registers on globalThis instead. Jest sandboxes globalThis PER
// TEST FILE, and both this module (imported through the file's registry)
// and tests/setup.mjs's afterAll run inside that same sandbox — so the
// registry is shared by construction, and each file's client is
// disconnected when the file finishes. Outside Jest (standalone scripts
// with NODE_ENV=test) the Set is inert and process exit cleans up.
if (process.env.NODE_ENV === 'test') {
  (globalThis.__equoriaTestPrismaInstances ??= new Set()).add(prisma);
}

export default prisma;
// Re-export the Prisma namespace (Prisma.sql / Prisma.join / Prisma.raw) for
// backend modules building parameterized raw queries — Equoria-lnblu.
export { Prisma };
