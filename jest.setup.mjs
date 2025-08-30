// Jest setup file for backend tests
// Loads environment variables for test environment

import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.resolve(__dirname, 'backend', '.env.test');
dotenv.config({ path: envPath });
