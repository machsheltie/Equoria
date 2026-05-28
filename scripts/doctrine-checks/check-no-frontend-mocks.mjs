#!/usr/bin/env node
// Doctrine: beta-facing frontend code must not contain mock primary paths.
// Source: CLAUDE.md "21R Beta Readiness Doctrine — No mock primary paths".
//
// Forbidden tokens in frontend/src outside of test files:
//   MOCK_ prefix (constants like MOCK_HORSES, MOCK_USERS)
//   mockApi (mock API client)
//   allMockHorses, mockSummary (specific known mock fixtures)
//   seededFakePlayers, fakeMetrics (seed-based fakes)
//
// Per-line exemption marker:
//   // doctrine-allow: frontend-mock-storybook
// Only legitimate Storybook stories or jsdoc examples should use this marker.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Single source of truth for scan DATA (Equoria-4iudq). The forbidden-token
// RegExps + exemption marker live in the shared module; the walk + line-scan
// logic stays here. The shared token list is the strict superset of the bash
// library's frontend-mock regex (it adds seededFakePlayers / fakeMetrics).
import {
  makeFrontendMockRegexes,
  FRONTEND_MOCK_EXEMPTION_MARKER as MARKER,
  walkFiles,
} from '../lib/doctrine-scan-patterns.mjs';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..', '..');
const SCAN_ROOT = path.join(REPO_ROOT, 'frontend', 'src');

if (!fs.existsSync(SCAN_ROOT)) {
  process.exit(0);
}

const FORBIDDEN_TOKENS = makeFrontendMockRegexes();

// Per-check scope predicates (Equoria-ml7jj). These reproduce this check's
// ORIGINAL local walk skip/include rules verbatim; the shared walkFiles helper
// supplies only the recursion mechanism. Net file-set is unchanged.
//   - Skip node_modules, __tests__ (regex on full path), and a literal `tests`
//     dir name.
//   - Include .ts/.tsx/.js/.jsx/.mjs, EXCEPT .test/.spec and .stories files.
const skipDir = (name, full) =>
  name === 'node_modules' ||
  /(^|[\\/])__tests__([\\/]|$)/.test(full) ||
  name === 'tests';

const includeFile = (name) =>
  /\.(ts|tsx|js|jsx|mjs)$/.test(name) &&
  !/\.(test|spec)\.(ts|tsx|js|jsx|mjs)$/.test(name) &&
  !/\.stories\.(ts|tsx|js|jsx|mjs)$/.test(name);

const failures = [];

for (const file of walkFiles([SCAN_ROOT], { skipDir, includeFile })) {
  const content = fs.readFileSync(file, 'utf-8');
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes(MARKER)) continue;
    for (const re of FORBIDDEN_TOKENS) {
      const m = re.exec(line);
      if (m) {
        failures.push({
          file: path.relative(REPO_ROOT, file),
          line: i + 1,
          token: m[0],
          text: line.trim().slice(0, 120),
        });
      }
    }
  }
}

if (failures.length > 0) {
  console.error('\nMock primary paths found in beta-facing frontend code:');
  for (const f of failures) {
    console.error(`  ${f.file}:${f.line}  ${f.token}    ${f.text}`);
  }
  console.error(
    `\nProduction/beta frontend code must not use mock fixtures. If this is a Storybook story or jsdoc example, append:\n    // ${MARKER}`
  );
  process.exit(1);
}

process.exit(0);
