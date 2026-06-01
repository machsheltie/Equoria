/**
 * Equoria-326tg sentinel.
 *
 * Pre-production lint stance per .claude/rules/console_logging.md is to
 * keep test-directory log output funneled through the structured logger
 * (logger.warn / logger.info) so a future "warn on the bare-console call"
 * rule does not flip the build red. This sentinel scans the two test
 * directories that the Equoria-kqwdm follow-up explicitly scoped out —
 * `backend/tests/` and `backend/__tests__/` — and asserts zero residual
 * matches against the gated TRIGGER token.
 *
 * Sentinel-positive shape: the test plants a file containing the literal
 * TRIGGER token under a sentinel scratch dir and proves the scan fires.
 * Without this positive proof a future regex narrowing could let new
 * bare-console callsites slip past.
 *
 * The TRIGGER token itself is built from concatenation at runtime so THIS
 * sentinel source does not match its own scan — see the TRIGGER constant
 * below.
 */

import { describe, it, expect, afterAll, afterEach } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_ROOT = path.resolve(HERE, '..'); // .../backend
const TARGET_DIRS = [path.join(BACKEND_ROOT, 'tests'), path.join(BACKEND_ROOT, '__tests__')];
const PLANT_DIR = path.join(BACKEND_ROOT, '__tests__', '_console_log_sentinel_scratch');

// Build the trigger string at runtime so THIS file's own source does not
// match the scan against backend/__tests__/.
const TRIGGER = 'console' + '.' + 'log';

/**
 * Recursively walk a directory and return every regular file path.
 * Ignores symlinked junctions (node_modules) so the worktree shim does
 * not explode the walk.
 */
function walk(dir) {
  if (!fs.existsSync(dir)) {
    return [];
  }
  const out = [];
  const stack = [dir];
  while (stack.length > 0) {
    const cur = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(cur, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(cur, entry.name);
      if (entry.isSymbolicLink()) {
        continue;
      }
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name.startsWith('.')) {
          continue;
        }
        stack.push(full);
        continue;
      }
      if (entry.isFile()) {
        out.push(full);
      }
    }
  }
  return out;
}

function findMatches(dirs) {
  const hits = [];
  for (const dir of dirs) {
    for (const file of walk(dir)) {
      let txt;
      try {
        txt = fs.readFileSync(file, 'utf8');
      } catch {
        continue;
      }
      const lines = txt.split(/\r?\n/);
      for (let i = 0; i < lines.length; i += 1) {
        if (lines[i].includes(TRIGGER)) {
          hits.push(`${file}:${i + 1}`);
        }
      }
    }
  }
  return hits;
}

afterEach(() => {
  try {
    fs.rmSync(PLANT_DIR, { recursive: true, force: true });
  } catch {
    // best-effort cleanup; surfacing rm errors would be noise
  }
});

afterAll(() => {
  try {
    fs.rmSync(PLANT_DIR, { recursive: true, force: true });
  } catch {
    // best-effort cleanup
  }
});

describe('no bare-console trigger in backend/tests + backend/__tests__ (Equoria-326tg)', () => {
  it('baseline: zero residual matches in either tests directory', () => {
    const hits = findMatches(TARGET_DIRS);
    // Exclude THIS sentinel file's own path defensively, in case the
    // walker re-enters its own scratch dir on a future refactor.
    const filtered = hits.filter(h => !h.includes('noConsoleLogInTestsDirs.sentinel.test.mjs'));
    expect(filtered).toEqual([]);
  });

  it('SENTINEL: scan fires when a fresh file under backend/__tests__ contains the literal pattern', () => {
    fs.mkdirSync(PLANT_DIR, { recursive: true });
    const planted = path.join(PLANT_DIR, 'planted.test.mjs');
    // Build the planted source via concatenation so the PLANTED file
    // contains the literal trigger but THIS sentinel source does not.
    const PLANTED_LINE = `${TRIGGER}('planted-by-326tg-sentinel');`;
    fs.writeFileSync(
      planted,
      [
        '// PLANTED by noConsoleLogInTestsDirs.sentinel.test.mjs — Equoria-326tg.',
        '// If this file ever lands on master you have a bigger problem than this test.',
        PLANTED_LINE,
        '',
      ].join('\n'),
    );

    const hits = findMatches(TARGET_DIRS);
    const planted_hit = hits.find(h => h.includes('planted.test.mjs'));
    expect(planted_hit).toBeDefined();
  });
});
