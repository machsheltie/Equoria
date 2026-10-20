#!/usr/bin/env node
// Doctrine: production routers must not expose test-fixture endpoints.
// Source: 21R "No bypass evidence" — endpoints that wipe DB state for tests
// are bypass infrastructure that must not ship. Equoria-mwjst extends the same
// rule to endpoints that rewind or skip a server-owned clock (a feed day, a
// cooldown, a foal development day): those are fixture helpers too, and the
// reset-last-fed one let any owner farm permanent stat rolls.
//
// Scans backend/routes/, backend/modules/ and backend/app/ for any STRING
// LITERAL (single, double or template quoted) that matches
// FORBIDDEN_CLEANUP_PATH_PATTERNS ("/test/cleanup", "/cleanup-tests",
// "/__cleanup", ...) or FORBIDDEN_STATE_REWIND_PATH_PATTERNS ("/reset-last-*",
// "/advance-day", "/skip-cooldown", ...). Skips files in __tests__/ and tests/
// directories.
//
// Why every literal and not only `router.<method>('<path>'` (Codex Sol review
// 2026-10-20, Equoria-mwjst): a route can be registered as
// router.route('/x').post(...), on an aliased router (`const r = express.Router()`,
// `r.post(...)`), or from a path constant (`const P = '/x'; router.post(P, ...)`).
// Each of those still spells the forbidden path as a literal somewhere in the
// file, so scanning literals catches all of them. Comments are not scanned.
// Out of reach: a path assembled at runtime ('/reset-' + 'last-fed'); none of
// the forbidden shapes has a legitimate reason to be built that way.

import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Single source of truth for scan DATA (Equoria-4iudq). Structural scan logic
// stays here; the forbidden path patterns live in the shared
// module so they cannot drift between Node doctrine checks.
import {
  FORBIDDEN_CLEANUP_PATH_PATTERNS,
  FORBIDDEN_STATE_REWIND_PATH_PATTERNS,
  walkFiles,
  readScannedFileSyncTolerant,
} from '../lib/doctrine-scan-patterns.mjs';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..', '..');

const SCAN_ROOTS = [
  path.join(REPO_ROOT, 'backend', 'routes'),
  path.join(REPO_ROOT, 'backend', 'modules'),
  // Equoria-q4uem.4 (WS4 S3): the application query layer (backend/app/queries)
  // defines routes too and stays under this gate.
  path.join(REPO_ROOT, 'backend', 'app'),
];

// Strip comments, keeping strings verbatim and every newline (so line numbers
// hold), then yield each string literal with its offset. A small lexer, not a
// regex over raw text: a quote inside a comment, or `//` inside a string,
// must not derail it.
function* stringLiterals(source) {
  let i = 0;
  const n = source.length;
  while (i < n) {
    const ch = source[i];
    const next = source[i + 1];
    if (ch === '/' && next === '/') {
      while (i < n && source[i] !== '\n') i++;
      continue;
    }
    if (ch === '/' && next === '*') {
      const end = source.indexOf('*/', i + 2);
      i = end === -1 ? n : end + 2;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      const start = i;
      i++;
      while (i < n && source[i] !== ch) {
        if (source[i] === '\\') i++;
        else if (ch !== '`' && source[i] === '\n') break; // unterminated: stop at line end
        i++;
      }
      yield { text: source.slice(start + 1, i), index: start };
      i++;
      continue;
    }
    i++;
  }
}

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
  for (const literal of stringLiterals(content)) {
    for (const { re, kind } of FORBIDDEN_PATH_PATTERNS) {
      if (re.test(literal.text)) {
        // Compute line number.
        const upto = content.slice(0, literal.index);
        const lineNum = upto.split(/\r?\n/).length;
        failures.push({
          file: path.relative(REPO_ROOT, file),
          line: lineNum,
          route: literal.text,
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
