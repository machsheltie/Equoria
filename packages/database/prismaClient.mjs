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

// Connection pool configuration for tests
const connectionConfig = {
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  // Limit connections for test environment
  ...(process.env.NODE_ENV === 'test' && {
    datasources: {
      db: {
        url: `${process.env.DATABASE_URL}?connection_limit=5&pool_timeout=20`,
      },
    },
  }),
};

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient(connectionConfig);
} else {
  if (!global.__prisma) {
    global.__prisma = new PrismaClient(connectionConfig);
  }
  prisma = global.__prisma;
}

// Register for cleanup when running Jest tests
if (process.env.NODE_ENV === 'test' && process.env.JEST_WORKER_ID) {
  try {
    const jestSetupPath = path.resolve(__dirname, '../../backend/jest.setup.mjs');
    const jestSetupURL = pathToFileURL(jestSetupPath).href;
    const { registerPrismaForCleanup } = await import(jestSetupURL);
    registerPrismaForCleanup(prisma);
    console.info('[PrismaClient] Jest cleanup registered successfully.');
  } catch (err) {
    console.warn('[PrismaClient] Could not register for test cleanup:', err.message);
    const attemptedPath = path.resolve(__dirname, '../../backend/jest.setup.mjs');
    console.warn(`[PrismaClient] Attempted to import path: ${attemptedPath}`);
    if (
      err.message.includes('ERR_MODULE_NOT_FOUND') &&
      err.message.includes(pathToFileURL(attemptedPath).href)
    ) {
      console.warn(
        `[PrismaClient] Verified that the file URL ${pathToFileURL(attemptedPath).href} could not be found.`
      );
    }
  }
} else if (process.env.NODE_ENV === 'test') {
  console.warn(
    '[PrismaClient] Skipping Jest cleanup registration: Not in a Jest worker environment (JEST_WORKER_ID not set). This is expected when running standalone scripts with NODE_ENV=test.'
  );
}

export default prisma;
