/**
 * Equoria-fefh2.10 — Sentinel-positive coverage for the placeholder-only-test
 * doctrine check (scripts/doctrine-checks/check-no-placeholder-tests.mjs).
 *
 * The check enforces CLAUDE.md Constitution §3: a test whose only substance is
 * `expect(true).toBe(true)` is a placebo that manufactures false confidence.
 * The training-module placeholders (training-fixed.test.mjs + 12 stubs in
 * trainingControllerDirect.test.mjs) were eradicated under fefh2.10; this
 * sentinel proves the guard that keeps them from coming back actually FIRES
 * (OPTIMAL_FIX_DISCIPLINE §2 — a check without a positive test is a placebo).
 *
 * Proven here, by spawning the REAL check as a child process:
 *  (a) exit 0 on the current clean tree;
 *  (b) PLANTED VIOLATION: a temp placeholder-only test file makes the check
 *      exit 1 AND report the planted file:line;
 *  (c) plants are removed in finally even when assertions fail, and the check
 *      is clean again post-removal;
 *  (d) the scoped exemption marker (`doctrine-allow: placeholder-test`) on the
 *      previous line suppresses the violation;
 *  (e) NEGATIVE CONTROL: a violating file whose NAME carries the canonical
 *      UPPERCASE sentinel-plant marker (DO_NOT_COMMIT) is name-skipped — the
 *      check must not fire on concurrent sentinel plant artifacts.
 *
 * Plant naming note: the check name-skips files containing `PLANTED` /
 * `DO_NOT_COMMIT` (case-sensitive — the canonical UPPERCASE plant markers used
 * by the other doctrine sentinels), so THIS suite's must-fire plants use the
 * lowercase `planted` marker to stay in scope while remaining unmistakably
 * temporary. Every plant is deleted in finally.
 *
 * Pure child-process + fs test: no DB, no app import.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, test, expect } from '@jest/globals';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..', '..', '..');
const CHECK = path.join(REPO_ROOT, 'scripts', 'doctrine-checks', 'check-no-placeholder-tests.mjs');

/** Run the real check; return { code, output } (stdout+stderr combined). */
function runCheck() {
  try {
    const stdout = execFileSync(process.execPath, [CHECK], {
      cwd: REPO_ROOT,
      stdio: 'pipe',
      encoding: 'utf8',
    });
    return { code: 0, output: stdout };
  } catch (err) {
    return {
      code: typeof err.status === 'number' ? err.status : 1,
      output: `${err.stdout ?? ''}${err.stderr ?? ''}`,
    };
  }
}

// SELF-COLLISION GUARD: this sentinel is itself a backend .test.mjs, so it is
// inside the check's scan scope. The vacuous-assert literal is therefore
// assembled by concatenation so no SOURCE line of this file matches the
// scanner — only the PLANTED fixture files contain it as a contiguous line.
const VACUOUS_ASSERT = ['expect(', 'true).', 'toBe(true);'].join('');

// A canonical placeholder-only test body — the exact shape fefh2.10 deleted
// from the training module. The vacuous assert sits on line 4 of the file.
const PLACEHOLDER_BODY = [
  "describe('planted placeholder suite', () => {",
  "  it('should be a placeholder test', () => {",
  '    // justification prose only — no real assertion anywhere in this body',
  `    ${VACUOUS_ASSERT}`,
  '  });',
  '});',
  '',
].join('\n');
const PLACEHOLDER_LINE = 4;

// Same shape but exempted via the scoped marker on the previous line.
const EXEMPTED_BODY = [
  "describe('planted exempted suite', () => {",
  "  it('meta-test of the assertion framework', () => {",
  '    // doctrine-allow: placeholder-test — sentinel fixture, deliberately vacuous',
  `    ${VACUOUS_ASSERT}`,
  '  });',
  '});',
  '',
].join('\n');

/** Plant a file under backend/, run the check, ALWAYS delete in finally. */
function withPlant(relPath, contents, fn) {
  const abs = path.join(REPO_ROOT, relPath);
  fs.writeFileSync(abs, contents, 'utf8');
  try {
    return fn();
  } finally {
    fs.rmSync(abs, { force: true });
  }
}

describe('check-no-placeholder-tests doctrine check (Equoria-fefh2.10)', () => {
  test('(a) exits 0 on the current tree — training placeholders are gone', () => {
    const { code, output } = runCheck();
    expect(code).toBe(0);
    expect(output).toContain('[no-placeholder-tests] OK');
  });

  test('(b)+(c) PLANTED VIOLATION: fires with exit 1 + file:line, clean again after removal', () => {
    const relPath = 'backend/__tests__/__planted_placeholder_fefh2_sentinel_tmp__.test.mjs';
    const result = withPlant(relPath, PLACEHOLDER_BODY, runCheck);

    expect(result.code).toBe(1);
    expect(result.output).toContain(`${relPath}:${PLACEHOLDER_LINE}`);
    expect(result.output).toContain('placeholder-only tests');

    // (c) plant removed (finally already ran) — tree is clean again.
    expect(fs.existsSync(path.join(REPO_ROOT, relPath))).toBe(false);
    expect(runCheck().code).toBe(0);
  });

  test('(b2) fires on the single-line opener form too', () => {
    const relPath = 'backend/__tests__/__planted_placeholder_oneline_fefh2_tmp__.test.mjs';
    const body = `it('placeholder', () => { ${VACUOUS_ASSERT} });\n`;
    const result = withPlant(relPath, body, runCheck);

    expect(result.code).toBe(1);
    expect(result.output).toContain(`${relPath}:1`);
    expect(runCheck().code).toBe(0);
  });

  test('(d) exemption marker on the previous line suppresses the violation', () => {
    const relPath = 'backend/__tests__/__planted_exempted_placeholder_fefh2_tmp__.test.mjs';
    const result = withPlant(relPath, EXEMPTED_BODY, runCheck);

    expect(result.code).toBe(0);
    expect(result.output).toContain('[no-placeholder-tests] OK');
  });

  test('(e) NEGATIVE CONTROL: DO_NOT_COMMIT-named plant artifacts are name-skipped', () => {
    // Concurrent doctrine sentinels plant temp test files named with the
    // UPPERCASE markers; this check must ignore them so run-all.sh stays
    // stable during parallel jest runs (Equoria-q7lqz concurrency class).
    const relPath = 'backend/__tests__/__placeholder_artifact_DO_NOT_COMMIT__.test.mjs';
    const result = withPlant(relPath, PLACEHOLDER_BODY, runCheck);

    expect(result.code).toBe(0);
    expect(result.output).not.toContain(relPath);
  });
});
