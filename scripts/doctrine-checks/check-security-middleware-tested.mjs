#!/usr/bin/env node
// Doctrine: every backend/middleware/*Security*.mjs file must have at least
// one test that imports it.
// Source: 21R Beta Readiness Doctrine — security middleware must be exercised
// by tests, not shipped with implicit/no coverage.
//
// Implementation: list backend/middleware/*Security*.mjs and
// backend/middleware/security.mjs; for each, verify that some file matching
// **/*.test.{mjs,js,ts} imports it (via static `import` or `require` of a
// path containing the basename without extension).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..', '..');
const MW_DIR = path.join(REPO_ROOT, 'backend', 'middleware');
const BACKEND_ROOT = path.join(REPO_ROOT, 'backend');

if (!fs.existsSync(MW_DIR)) process.exit(0);

const securityMiddleware = fs
  .readdirSync(MW_DIR)
  .filter((f) => /(?:Security|security)\.mjs$/.test(f))
  .map((f) => ({ basename: f.replace(/\.mjs$/, ''), full: path.join(MW_DIR, f) }));

if (securityMiddleware.length === 0) process.exit(0);

function walkTests(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') continue;
      out.push(...walkTests(full));
    } else if (entry.isFile() && /\.(test|spec)\.(mjs|js|ts)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

const testFiles = walkTests(BACKEND_ROOT);
const failures = [];

for (const mw of securityMiddleware) {
  const importPattern = new RegExp(
    `(?:import|require|mockModule)\\s*\\(?\\s*['"\`][^'"\`]*${mw.basename}(?:\\.mjs)?['"\`]`,
    's'
  );
  let found = false;
  for (const tf of testFiles) {
    const content = fs.readFileSync(tf, 'utf-8');
    if (importPattern.test(content)) {
      found = true;
      break;
    }
  }
  if (!found) {
    failures.push(mw.basename);
  }
}

if (failures.length > 0) {
  console.error('\nSecurity middleware lacking test coverage:');
  for (const name of failures) {
    console.error(`  backend/middleware/${name}.mjs — no .test.* file imports it`);
  }
  console.error('\nEvery security middleware must have at least one test file that imports it.');
  process.exit(1);
}

process.exit(0);
