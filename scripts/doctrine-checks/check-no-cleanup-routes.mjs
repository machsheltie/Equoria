#!/usr/bin/env node
// Doctrine: production routers must not expose test-cleanup endpoints.
// Source: 21R "No bypass evidence" — endpoints that wipe DB state for tests
// are bypass infrastructure that must not ship.
//
// Scans backend/routes/ and backend/modules/.../routes for router method calls
// whose path contains "/test/cleanup", "/cleanup-tests", "/__cleanup", or
// similar patterns. Skips files in __tests__/ and tests/ directories.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..', '..');

const SCAN_ROOTS = [
  path.join(REPO_ROOT, 'backend', 'routes'),
  path.join(REPO_ROOT, 'backend', 'modules'),
];

// Patterns inside the route path string. Each must include a test-cleanup
// signal AND not be inside a tests directory.
const FORBIDDEN_PATH_PATTERNS = [
  /\/test\/cleanup/i,
  /\/cleanup-tests?\b/i,
  /\/__cleanup/i,
  /\/test-reset\b/i,
];

// Match: router.<method>('<path>' OR app.<method>('<path>'
const ROUTE_RE =
  /\b(?:router|app)\s*\.\s*(?:get|post|put|patch|delete|all)\s*\(\s*['"`]([^'"`]+)['"`]/g;

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip test directories.
      if (/(^|[\\/])__tests__([\\/]|$)/.test(full)) continue;
      if (/(^|[\\/])tests([\\/]|$)/.test(full)) continue;
      if (entry.name === 'node_modules') continue;
      out.push(...walk(full));
    } else if (entry.isFile() && /\.(mjs|js|ts|cjs)$/.test(entry.name)) {
      // Skip explicit test files even if they snuck into a route dir.
      if (/\.(test|spec)\.(mjs|js|ts)$/.test(entry.name)) continue;
      out.push(full);
    }
  }
  return out;
}

const failures = [];

for (const root of SCAN_ROOTS) {
  for (const file of walk(root)) {
    const content = fs.readFileSync(file, 'utf-8');
    ROUTE_RE.lastIndex = 0;
    let match;
    while ((match = ROUTE_RE.exec(content)) !== null) {
      const routePath = match[1];
      for (const re of FORBIDDEN_PATH_PATTERNS) {
        if (re.test(routePath)) {
          // Compute line number.
          const upto = content.slice(0, match.index);
          const lineNum = upto.split(/\r?\n/).length;
          failures.push({
            file: path.relative(REPO_ROOT, file),
            line: lineNum,
            route: routePath,
          });
        }
      }
    }
  }
}

if (failures.length > 0) {
  console.error('\nForbidden cleanup/test routes in production routers:');
  for (const f of failures) {
    console.error(`  ${f.file}:${f.line}  ${f.route}`);
  }
  console.error(
    '\nProduction routers must not expose test cleanup endpoints. ' +
      'Move cleanup logic into test fixtures (e.g. tests/helpers/testAuth.mjs).'
  );
  process.exit(1);
}

process.exit(0);
