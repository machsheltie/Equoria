#!/usr/bin/env node
// Doctrine: backend tests must run against the real test database. No mocking
// of prisma / prismaClient.
// Source: CLAUDE.md "Testing Philosophy — No mocks. Ever."
//
// Scans ALL backend test directories (not just backend/tests/integration) for:
//   jest.mock(<path-or-name-containing-prisma>)
//   jest.unstable_mockModule(<path-or-name-containing-prisma>)
//   vi.mock(<path-or-name-containing-prisma>)
//
// Skips comment lines (jsdoc / //) so docstrings describing past migrations
// don't trigger the check.
//
// Per-line exemption marker (only for tests of the mocking framework itself,
// none currently expected):
//   // doctrine-allow: prisma-mock

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Single source of truth for scan DATA (Equoria-4iudq). The mock-call regex
// (incl. vi.mock), the prisma-target regex, and the exemption marker live in
// the shared module; the comment-skip + walk logic stays here.
import {
  makeDbMockCallRegex,
  makeDbMockTargetRegex,
  DB_MOCK_EXEMPTION_MARKER as MARKER,
  walkFiles,
  readScannedFileSyncTolerant,
} from '../lib/doctrine-scan-patterns.mjs';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..', '..');
const BACKEND_ROOT = path.join(REPO_ROOT, 'backend');

if (!fs.existsSync(BACKEND_ROOT)) {
  process.exit(0);
}

// Detect a mock call. The first argument may be a string literal OR a call
// like join(__dirname, '../../packages/database/prismaClient.mjs'), so we
// match the mock invocation and then scan the same line for any string
// literal containing "prisma".
const MOCK_CALL_RE = makeDbMockCallRegex();
const STRING_LITERAL_RE = makeDbMockTargetRegex();

function isCommentLine(line) {
  const t = line.trimStart();
  return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*');
}

// Per-check scope predicates (Equoria-ml7jj). These reproduce this check's
// ORIGINAL local walk skip/include rules verbatim; the shared walkFiles helper
// supplies only the recursion mechanism. Net file-set is unchanged.
//   - Skip node_modules and .git dirs (by name).
//   - Include ONLY .test/.spec files — this scan REQUIRES test files (it scans
//     test directories, unlike the route/frontend scans which skip them).
const skipDir = (name) => name === 'node_modules' || name === '.git';

const includeFile = (name) => /\.(test|spec)\.(mjs|js|ts)$/.test(name);

const failures = [];

for (const file of walkFiles([BACKEND_ROOT], { skipDir, includeFile })) {
  // Equoria-q7lqz/7avnu: a walked test file can vanish before this read
  // (concurrent jest sentinel plant+delete). Tolerant reader returns null ONLY
  // on ENOENT (with a one-line notice) and rethrows anything else.
  const content = readScannedFileSyncTolerant(file, 'no-db-mocks');
  if (content === null) continue;
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isCommentLine(line)) continue;
    if (line.includes(MARKER)) continue;
    if (!MOCK_CALL_RE.test(line)) continue;
    STRING_LITERAL_RE.lastIndex = 0;
    let s;
    while ((s = STRING_LITERAL_RE.exec(line)) !== null) {
      failures.push({
        file: path.relative(REPO_ROOT, file),
        line: i + 1,
        target: s[1],
      });
    }
  }
}

if (failures.length > 0) {
  console.error('\nPrisma mocked in backend tests (forbidden by doctrine):');
  for (const f of failures) {
    console.error(`  ${f.file}:${f.line}  mocks "${f.target}"`);
  }
  console.error(
    '\nMigrate these tests to use the real test DB (see backend/tests/helpers/testAuth.mjs).'
  );
  process.exit(1);
}

process.exit(0);
