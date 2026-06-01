import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

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

// Dynamically import Prisma client
const { PrismaClient } = await import('@prisma/client');

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

// Register for cleanup when running Jest tests
// Note: JEST_WORKER_ID is NOT set in --runInBand mode (main process), so we register
// unconditionally in test mode to prevent connection pool exhaustion across 271 suites.
if (process.env.NODE_ENV === 'test') {
  try {
    const jestSetupPath = path.resolve(__dirname, '../../backend/jest.setup.mjs');
    const jestSetupURL = pathToFileURL(jestSetupPath).href;
    const { registerPrismaForCleanup } = await import(jestSetupURL);
    registerPrismaForCleanup(prisma);
  } catch {
    // Silently ignore — this is expected when running standalone scripts with NODE_ENV=test
  }
}

export default prisma;
