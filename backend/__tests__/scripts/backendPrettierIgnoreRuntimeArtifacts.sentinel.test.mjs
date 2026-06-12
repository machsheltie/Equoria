/**
 * Equoria-pfn3p — Sentinel-positive proof for the backend/.prettierignore
 * runtime-artifact exclusions.
 *
 * The defect: scripts/doctrine-checks/check-backend-lint-and-format.mjs runs
 * `prettier --check .` from cwd=backend/. Prettier reads backend/.prettierignore
 * (the ignore file in its cwd) and does NOT consult the repo-root .gitignore.
 * The bulk-foaling load driver
 * (backend/tests/load/run-bulk-foaling-cron.mjs) writes
 * backend/load-results/bulk-foaling-cron-summary.json via
 * `JSON.stringify(summary, null, 2)` — which prettier flags as drift (no
 * trailing newline, among other things). Because load-results/ is gitignored
 * at the repo root, a clean CI checkout never has the file (CI stays green),
 * but any LOCAL load run turns the doctrine suite red on a never-shipped
 * artifact. Fix: list load-results/ (and the sibling gitignored runtime
 * dirs) in backend/.prettierignore.
 *
 * This sentinel runs the REAL prettier CLI from cwd=backend/ against the REAL
 * backend/.prettierignore — exactly as the doctrine check does — and proves
 * BOTH arms, so the fix can neither silently weaken (ignore too much) nor
 * regress (stop ignoring load-results):
 *
 *   ARM 1 (stays GREEN): an unformatted JSON planted in backend/load-results/
 *          is IGNORED — `prettier --check` exits 0 against it. Proves the
 *          new exclusion takes effect.
 *
 *   ARM 2 (FAILS):       the SAME unformatted content planted in
 *          backend/services/ (real, never-ignored source dir) makes
 *          `prettier --check` exit 1. Proves the gate still catches genuine
 *          drift in shipped code — the .prettierignore entry is scoped to the
 *          runtime dir, not a blanket weakening.
 *
 * Targeting the planted paths directly (not `.`) keeps the sentinel fast and
 * isolates it from the rest of the backend tree's formatting state, while
 * still exercising the real prettier + real ignore-file resolution that the
 * doctrine gate relies on.
 */

import { describe, it, expect, beforeAll, afterEach } from '@jest/globals';
import { spawnSync } from 'node:child_process';
import fs, { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..', '..');
const BACKEND = path.join(REPO_ROOT, 'backend');

// Resolve the prettier CLI the SAME way check-backend-lint-and-format.mjs does:
// direct filesystem probe at backend/ then repo root (hoisted installs).
// require.resolve cannot reach prettier's bin via its "exports" map.
function resolvePrettierCli() {
  for (const base of [BACKEND, REPO_ROOT]) {
    const candidate = path.join(base, 'node_modules', 'prettier', 'bin', 'prettier.cjs');
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

const prettierCli = resolvePrettierCli();

// Unformatted content mirroring what the load driver actually emits: a JSON
// object serialized with JSON.stringify(value, null, 2), which has NO trailing
// newline — prettier's default for *.json appends one, so this is real drift.
const DRIFTED_JSON = '{\n  "passed": true,\n  "violations": []\n}';

// Plant inside a gitignored runtime dir (load-results/) — must be IGNORED.
const IGNORED_DIR = path.join(BACKEND, 'load-results');
const IGNORED_FILE = path.join(IGNORED_DIR, '_pfn3p_sentinel_artifact.json');

// Plant inside a real, never-ignored source dir (services/) — must be CHECKED.
const SOURCE_DIR = path.join(BACKEND, 'services');
const SOURCE_FILE = path.join(SOURCE_DIR, '_pfn3p_sentinel_drift.json');

function runPrettierCheck(absFile) {
  // Run from cwd=backend so prettier reads backend/.prettierignore, exactly
  // like the doctrine gate. Pass the path relative to backend/ so the ignore
  // patterns (which are relative to the ignore file's dir) match.
  const rel = path.relative(BACKEND, absFile).split(path.sep).join('/');
  return spawnSync(process.execPath, [prettierCli, '--check', rel], {
    cwd: BACKEND,
    encoding: 'utf8',
  });
}

const maybe = prettierCli ? describe : describe.skip;

beforeAll(() => {
  if (!prettierCli) {
    throw new Error(
      'prettier CLI not found under backend/node_modules or repo-root node_modules. ' +
        'Run `cd backend && npm ci` so this sentinel can exercise the real gate.',
    );
  }
});

afterEach(() => {
  for (const f of [IGNORED_FILE, SOURCE_FILE]) {
    try {
      fs.rmSync(f, { force: true });
    } catch {
      // best-effort cleanup
    }
  }
  // Remove load-results/ only if we created it and it is now empty.
  try {
    if (fs.existsSync(IGNORED_DIR) && fs.readdirSync(IGNORED_DIR).length === 0) {
      fs.rmdirSync(IGNORED_DIR);
    }
  } catch {
    // best-effort cleanup
  }
});

maybe('backend/.prettierignore runtime-artifact exclusions (Equoria-pfn3p)', () => {
  it('ARM 1 — unformatted JSON in load-results/ is IGNORED (prettier --check stays green)', () => {
    fs.mkdirSync(IGNORED_DIR, { recursive: true });
    fs.writeFileSync(IGNORED_FILE, DRIFTED_JSON);

    const res = runPrettierCheck(IGNORED_FILE);

    // Exit 0 and prettier reports it found nothing to check (the path was
    // ignored) — NOT a "would reformat" / "Code style issues" failure.
    expect(res.status).toBe(0);
    const out = `${res.stdout ?? ''}\n${res.stderr ?? ''}`;
    expect(out).not.toMatch(/Code style issues/i);
  });

  it('ARM 2 — the SAME unformatted JSON in services/ FAILS prettier --check (gate not weakened)', () => {
    fs.writeFileSync(SOURCE_FILE, DRIFTED_JSON);

    const res = runPrettierCheck(SOURCE_FILE);

    // Non-zero exit and prettier names the drifted source file — proves the
    // gate still catches real drift in shipped code.
    expect(res.status).not.toBe(0);
    const out = `${res.stdout ?? ''}\n${res.stderr ?? ''}`;
    expect(out).toMatch(/_pfn3p_sentinel_drift\.json/);
  });

  it('.prettierignore lists load-results/ (literal regression guard)', () => {
    const ignoreText = fs.readFileSync(path.join(BACKEND, '.prettierignore'), 'utf8');
    const lines = ignoreText.split(/\r?\n/).map(l => l.trim());
    expect(lines).toContain('load-results/');
  });
});
