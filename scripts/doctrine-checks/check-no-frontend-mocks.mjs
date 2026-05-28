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
} from '../lib/doctrine-scan-patterns.mjs';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..', '..');
const SCAN_ROOT = path.join(REPO_ROOT, 'frontend', 'src');

if (!fs.existsSync(SCAN_ROOT)) {
  process.exit(0);
}

const FORBIDDEN_TOKENS = makeFrontendMockRegexes();

function walk(dir) {
  const out = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') continue;
      if (/(^|[\\/])__tests__([\\/]|$)/.test(full)) continue;
      if (entry.name === 'tests') continue;
      out.push(...walk(full));
    } else if (entry.isFile() && /\.(ts|tsx|js|jsx|mjs)$/.test(entry.name)) {
      if (/\.(test|spec)\.(ts|tsx|js|jsx|mjs)$/.test(entry.name)) continue;
      if (/\.stories\.(ts|tsx|js|jsx|mjs)$/.test(entry.name)) continue;
      out.push(full);
    }
  }
  return out;
}

const failures = [];

for (const file of walk(SCAN_ROOT)) {
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
