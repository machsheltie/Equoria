// DO NOT MODIFY: Configuration locked for consistency

import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.resolve(__dirname, '..'); // Resolves to the 'backend' directory

// Determine NODE_ENV first
const NODE_ENV = process.env.NODE_ENV || 'development';

// Load environment-specific .env file
if (NODE_ENV === 'test') {
  dotenv.config({ path: path.resolve(projectRoot, 'env.test') }); // Use env.test without leading dot
} else {
  dotenv.config({ path: path.resolve(projectRoot, '.env') }); // Load .env for other environments
}

const requiredVars = ['DATABASE_URL', 'PORT', 'JWT_SECRET', 'JWT_REFRESH_SECRET'];
// const missingVars = requiredVars.filter(key => !process.env[key]); // Original check

const problematicVars = [];

for (const key of requiredVars) {
  const value = process.env[key];
  if (!value) {
    problematicVars.push(`${key} (is missing)`);
  } else if ((key === 'JWT_SECRET' || key === 'JWT_REFRESH_SECRET') && value.trim() === '') {
    problematicVars.push(`${key} (is empty or only whitespace)`);
  }
}

// Always check for missing/problematic vars, regardless of NODE_ENV
if (problematicVars.length > 0) {
  throw new Error(
    `[config] Problematic required environment variables for ${NODE_ENV} environment: ${problematicVars.join('; ')}. Please check your .env or env.test file.`,
  );
}

const {
  PORT,
  DATABASE_URL,
  JWT_SECRET,
  JWT_REFRESH_SECRET,
  ALLOWED_ORIGINS,
  NODE_ENV: ENV,
} = process.env;

const config = {
  port: PORT || '3000',
  dbUrl: DATABASE_URL,
  env: ENV || 'development',
  jwtSecret: JWT_SECRET,
  jwtRefreshSecret: JWT_REFRESH_SECRET,
  allowedOrigins: ALLOWED_ORIGINS
    ? ALLOWED_ORIGINS.split(',')
        .map(origin => origin.trim())
        .filter(origin => origin)
    : [],
};

export default config;
