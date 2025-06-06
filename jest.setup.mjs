// This file is temporarily cleared as environment variables will be loaded via the Jest command.

import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.resolve(__dirname, 'backend', '.env.test');
dotenv.config({ path: envPath });
