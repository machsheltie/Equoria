#!/usr/bin/env node
// Doctrine: backend must have zero ESLint ERRORS and zero Prettier drift
// before any push. Source: Equoria-fefh2.27.
//
// Why this lives in the doctrine suite: the pre-push hook runs doctrine
// checks + the Jest suite but never ran eslint/prettier, and under the
// CLAUDE.md --no-verify active exception the MANUAL doctrine run is the only
// client-side gate that executes at all. On 2026-06-10 that gap put CI's
// Lint & Format job red three push-cycles in a row (4 eslint errors from
// concurrent sessions, then 105 prettier-drifted files, then 2 more errors
// introduced by the mass-format itself). This check mirrors exactly what
// CI's "Lint & Format" backend steps enforce, so a push that will fail CI
// fails here first.
//
// Scope decisions (deliberate):
//   - eslint runs with --quiet: ERRORS fail the gate; the 79 tracked
//     warnings (Equoria-fefh2.23) do not. Matches `npm run lint` failing
//     CI only on errors.
//   - prettier --check covers the same tree CI checks (backend/.).
//   - Frontend lint/format are NOT mirrored here (frontend is verified
//     clean and owned by active frontend sessions; widen only if the same
//     treadmill appears there).
//   - Runtime cost ~60-120s. Accepted: it is the price of never pushing a
//     red Lint & Format again while the --no-verify exception stands.
//
// Sentinel-positive proof (recorded on Equoria-fefh2.27): a planted
// `const x = 'a' + 'b'` eslint error and a planted format-drifted file each
// make this check exit 1; removing them returns it to 0. CI independently
// runs the real eslint/prettier, so this mirror cannot silently diverge
// without CI catching the same defect.

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..', '..');
const BACKEND = path.join(REPO_ROOT, 'backend');

// Locate the CLI entry files by direct filesystem probe at backend/ then the
// repo root (hoisted installs). require.resolve cannot be used here: both
// eslint and prettier ship "exports" maps that do NOT expose their bin files
// as importable subpaths, so resolution throws ERR_PACKAGE_PATH_NOT_EXPORTED
// even when the package is installed (this bit the first version of this
// check). Hard fail — never skip — if neither location has them: a lint gate
// that cannot run is a red gate, not a green one. CI's doctrine-gate workflow
// installs backend deps for exactly this reason.
function resolveCli(relPath, label) {
  for (const base of [BACKEND, REPO_ROOT]) {
    const candidate = path.join(base, 'node_modules', ...relPath.split('/'));
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  console.error(
    `[backend-lint-and-format] DOCTRINE VIOLATION\n${label} is not installed ` +
      `(no node_modules/${relPath} under backend/ or the repo root). Run: cd backend && npm ci`
  );
  process.exit(1);
}

function run(label, file, args) {
  try {
    execFileSync(process.execPath, [file, ...args], {
      cwd: BACKEND,
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
    });
    return null;
  } catch (err) {
    const out = `${err.stdout ?? ''}\n${err.stderr ?? ''}`.trim();
    return `${label} FAILED:\n${out.split('\n').slice(-25).join('\n')}`;
  }
}

const eslintCli = resolveCli('eslint/bin/eslint.js', 'ESLint');
const prettierCli = resolveCli('prettier/bin/prettier.cjs', 'Prettier');

const failures = [
  run('eslint (errors only: --quiet)', eslintCli, ['.', '--quiet']),
  run('prettier --check', prettierCli, ['--check', '.']),
].filter(Boolean);

if (failures.length > 0) {
  console.error('[backend-lint-and-format] DOCTRINE VIOLATION');
  for (const f of failures) {
    console.error(`\n${f}`);
  }
  console.error(
    '\nFix with: cd backend && npx eslint . --quiet (see errors) && npx prettier --write .'
  );
  process.exit(1);
}

console.log('[backend-lint-and-format] OK — backend eslint 0 errors, prettier clean');
