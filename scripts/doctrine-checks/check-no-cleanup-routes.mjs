#!/usr/bin/env node
// Doctrine: production routers must not expose test-fixture endpoints.
// Source: 21R "No bypass evidence" — endpoints that wipe DB state for tests
// are bypass infrastructure that must not ship. Equoria-mwjst extends the same
// rule to endpoints that rewind or skip a server-owned clock (a feed day, a
// cooldown, a foal development day): those are fixture helpers too, and the
// reset-last-fed one let any owner farm permanent stat rolls.
//
// Scans backend/routes/ and backend/modules/.../routes for router method calls
// whose path matches FORBIDDEN_CLEANUP_PATH_PATTERNS ("/test/cleanup",
// "/cleanup-tests", "/__cleanup", ...) or FORBIDDEN_STATE_REWIND_PATH_PATTERNS
// ("/reset-last-*", "/advance-day", "/skip-cooldown", ...). Skips files in
// __tests__/ and tests/ directories.

import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Single source of truth for scan DATA (Equoria-4iudq). Structural scan logic
// stays here; the forbidden path patterns + route regex live in the shared
// module so they cannot drift between Node doctrine checks.
import {
  FORBIDDEN_CLEANUP_PATH_PATTERNS,
  FORBIDDEN_STATE_REWIND_PATH_PATTERNS,
  makeRouteRegex,
  walkFiles,
  readScannedFileSyncTolerant,
} from '../lib/doctrine-scan-patterns.mjs';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..', '..');

const SCAN_ROOTS = [
  path.join(REPO_ROOT, 'backend', 'routes'),
  path.join(REPO_ROOT, 'backend', 'modules'),
];

// Match: router.<method>('<path>' OR app.<method>('<path>'
const ROUTE_RE = makeRouteRegex();

const FORBIDDEN_PATH_PATTERNS = [
  ...FORBIDDEN_CLEANUP_PATH_PATTERNS.map((re) => ({ re, kind: 'test-cleanup' })),
  ...FORBIDDEN_STATE_REWIND_PATH_PATTERNS.map((re) => ({ re, kind: 'clock-rewind' })),
];

// Per-check scope predicates (Equoria-ml7jj). These reproduce this check's
// ORIGINAL local walk skip/include rules verbatim; the shared walkFiles helper
// supplies only the recursion mechanism. Net file-set is unchanged.
//   - Skip __tests__ / tests dirs (regex on the full path) and node_modules.
//   - Include .mjs/.js/.ts/.cjs, EXCEPT .test/.spec files that snuck in.
const skipDir = (name, full) =>
  /(^|[\\/])__tests__([\\/]|$)/.test(full) ||
  /(^|[\\/])tests([\\/]|$)/.test(full) ||
  name === 'node_modules';

const includeFile = (name) =>
  /\.(mjs|js|ts|cjs)$/.test(name) && !/\.(test|spec)\.(mjs|js|ts)$/.test(name);

const failures = [];

for (const file of walkFiles(SCAN_ROOTS, { skipDir, includeFile })) {
  // Equoria-q7lqz/7avnu: a walked file can vanish before this read (concurrent
  // jest sentinel plant+delete). Tolerant reader returns null ONLY on ENOENT
  // (with a one-line notice) and rethrows anything else — never a silent catch.
  const content = readScannedFileSyncTolerant(file, 'no-cleanup-routes');
  if (content === null) continue;
  ROUTE_RE.lastIndex = 0;
  let match;
  while ((match = ROUTE_RE.exec(content)) !== null) {
    const routePath = match[1];
    for (const { re, kind } of FORBIDDEN_PATH_PATTERNS) {
      if (re.test(routePath)) {
        // Compute line number.
        const upto = content.slice(0, match.index);
        const lineNum = upto.split(/\r?\n/).length;
        failures.push({
          file: path.relative(REPO_ROOT, file),
          line: lineNum,
          route: routePath,
          kind,
        });
      }
    }
  }
}

if (failures.length > 0) {
  console.error('\nForbidden cleanup/test routes in production routers:');
  for (const f of failures) {
    console.error(`  ${f.file}:${f.line}  ${f.route}  [${f.kind}]`);
  }
  console.error(
    '\nProduction routers must not expose test cleanup endpoints or routes that ' +
      'rewind/skip a server-owned clock. Move that setup into test fixtures that ' +
      'write the test database directly (e.g. tests/helpers/testAuth.mjs).'
  );
  process.exit(1);
}

process.exit(0);
