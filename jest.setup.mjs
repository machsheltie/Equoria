// Jest setup file for backend tests
// Loads environment variables for test environment
//
// NOTE: Simplified to avoid import.meta.url which causes issues with Babel transformation.
// Using process.cwd() instead to get the project root directory.

import path from 'path';
import dotenv from 'dotenv';

// Get the project root directory (where package.json is located)
const projectRoot = process.cwd();

// Load environment variables from backend/.env.test
const envPath = path.resolve(projectRoot, 'backend', '.env.test');
dotenv.config({ path: envPath });
