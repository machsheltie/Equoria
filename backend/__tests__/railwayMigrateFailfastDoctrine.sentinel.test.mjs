/**
 * Equoria-oey96.35 railway.toml migrate fail-fast doctrine sentinel.
 *
 * Proves the fail-fast ratchet (check-railway-migrate-failfast.mjs) actually
 * fires — not just that it passes when the tree is clean:
 *   1. passes on the real railway.toml (post-fix: migrate deploy chained with
 *      `&&`, aborts the deploy on migrate failure);
 *   2. SENTINEL-POSITIVE: via the argv[2] alternate-file hook, FAILS on a
 *      planted railway.toml whose startCommand carries the exact `|| echo`
 *      swallow the fix removed — proving the detector catches the real defect
 *      shape, not merely absence-of-string;
 *   3. FAILS on the sibling fail-open reformulations (`|| true`, `; node`,
 *      `| tee`, `& node`) — proving it catches the OPERATOR CLASS, so a future
 *      "fix" that swaps `||` for `;` cannot slip through (OPTIMAL_FIX §1/§2);
 *   4. PASSES on a clean fail-fast fixture (negative control — proves it's the
 *      operator, not the plant location, that trips it);
 *   5. unit-tests the pure detectors: the `${DIRECT_URL:-$DATABASE_URL}`
 *      parameter-substitution fallback and a subshell-close `) &&` do NOT
 *      false-positive, and a `|| echo` guarding the SERVER start (AFTER migrate
 *      is already gated by `&&`) is NOT flagged.
 *
 * Without this sentinel a future regex narrowing or walker regression could
 * silently let the fail-open swallow re-emerge — the "test that doesn't really
 * test" pattern CLAUDE.md §3 rejects.
 *
 * Fixtures are written to an os.tmpdir() scratch dir and removed in afterEach;
 * nothing is planted inside the repo tree.
 */

import { describe, it, expect, afterEach } from '@jest/globals';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  detectStartCommandFailOpen,
  extractStartCommands,
  firstShellOperatorAfter,
} from '../../scripts/doctrine-checks/check-railway-migrate-failfast.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const CHECK = path.join(REPO_ROOT, 'scripts/doctrine-checks/check-railway-migrate-failfast.mjs');

// The fail-open startCommand shape as it shipped before the fix (the defect this
// issue removes): a `|| echo` swallow after migrate deploy. The exact
// ${DIRECT_URL:-$DATABASE_URL} substitution is kept (single-quoted, so literal)
// to double-prove it does not false-positive. Single-quoted here to satisfy the
// backend `quotes`/`no-useless-escape` lint rules — the detector cares only
// about `migrate deploy` and the operator that follows it, not quote escaping.
const FAIL_OPEN_START_COMMAND =
  'startCommand = "sh -c \'cd /app/packages/database && ' +
  '(DATABASE_URL=${DIRECT_URL:-$DATABASE_URL} npx prisma migrate deploy ' +
  '|| echo skipped) && cd /app/backend && node server.mjs\'"';

// The fail-fast form (what the fix installs): migrate deploy chained with `&&`.
const FAIL_FAST_START_COMMAND =
  'startCommand = "sh -c \'cd /app/packages/database && ' +
  '(DATABASE_URL=${DIRECT_URL:-$DATABASE_URL} npx prisma migrate deploy) ' +
  '&& cd /app/backend && node server.mjs\'"';

function tomlWith(startCommandLine) {
  return ['[build]', 'builder = "DOCKERFILE"', '', '[deploy]', startCommandLine, ''].join('\n');
}

let scratchDir;

afterEach(() => {
  if (scratchDir) {
    fs.rmSync(scratchDir, { recursive: true, force: true });
    scratchDir = undefined;
  }
});

function writeFixture(content) {
  scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oey96-35-railway-PLANTED-'));
  const p = path.join(scratchDir, 'railway.toml');
  fs.writeFileSync(p, content, 'utf8');
  return p;
}

function runCheck(args = []) {
  return spawnSync('node', [CHECK, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
}

describe('check-railway-migrate-failfast.mjs (Equoria-oey96.35)', () => {
  it('passes on the real railway.toml — migrate deploy is fail-fast (aborts deploy on failure)', () => {
    const res = runCheck();
    expect(res.status).toBe(0);
    expect(res.stdout).toMatch(/railway-migrate-failfast.*OK/);
  });

  it('SENTINEL: FAILS on a planted railway.toml with the exact `|| echo` swallow', () => {
    const fixture = writeFixture(tomlWith(FAIL_OPEN_START_COMMAND));
    const res = runCheck([fixture]);
    expect(res.status).toBe(1);
    expect(res.stderr).toMatch(/railway-migrate-failfast.*FAIL/);
    expect(res.stderr).toMatch(/terminated by `\|\|`/);
  });

  it('NEGATIVE CONTROL: PASSES on a clean fail-fast (`&&`) fixture', () => {
    const fixture = writeFixture(tomlWith(FAIL_FAST_START_COMMAND));
    const res = runCheck([fixture]);
    expect(res.status).toBe(0);
    expect(res.stdout).toMatch(/railway-migrate-failfast.*OK/);
  });

  it('SENTINEL: FAILS on sibling fail-open reformulations (`|| true`, `; node`, `| tee`, `& node`)', () => {
    const cases = [
      { line: 'startCommand = "sh -c \'npx prisma migrate deploy || true && node server.mjs\'"', op: '||' },
      { line: 'startCommand = "sh -c \'npx prisma migrate deploy ; node server.mjs\'"', op: ';' },
      { line: 'startCommand = "sh -c \'npx prisma migrate deploy | tee /tmp/m.log && node server.mjs\'"', op: '|' },
      { line: 'startCommand = "sh -c \'npx prisma migrate deploy & node server.mjs\'"', op: '&' },
    ];
    for (const c of cases) {
      const fixture = writeFixture(tomlWith(c.line));
      const res = runCheck([fixture]);
      expect(res.status).toBe(1);
      expect(res.stderr).toMatch(/railway-migrate-failfast.*FAIL/);
      fs.rmSync(scratchDir, { recursive: true, force: true });
      scratchDir = undefined;
    }
  });

  // ---- pure-detector unit tests (no subprocess) ----

  it('detector flags the fail-open operator class and clears `&&`', () => {
    expect(detectStartCommandFailOpen('npx prisma migrate deploy || echo hi')).toHaveLength(1);
    expect(detectStartCommandFailOpen('npx prisma migrate deploy || true')).toHaveLength(1);
    expect(detectStartCommandFailOpen('npx prisma migrate deploy ; node x')).toHaveLength(1);
    expect(detectStartCommandFailOpen('npx prisma migrate deploy | tee x')).toHaveLength(1);
    expect(detectStartCommandFailOpen('npx prisma migrate deploy & node x')).toHaveLength(1);
    expect(detectStartCommandFailOpen('npx prisma migrate deploy && node x')).toHaveLength(0);
  });

  it('detector does NOT false-positive on ${DIRECT_URL:-$DATABASE_URL} or a subshell-close `) &&`', () => {
    const cmd =
      '(DATABASE_URL="${DIRECT_URL:-$DATABASE_URL}" npx prisma migrate deploy) && cd /app/backend && node server.mjs';
    expect(detectStartCommandFailOpen(cmd)).toHaveLength(0);
  });

  it('detector does NOT flag a `|| echo` guarding SERVER start after migrate is already gated by `&&`', () => {
    const cmd = 'npx prisma migrate deploy && node server.mjs || echo "server crashed"';
    expect(detectStartCommandFailOpen(cmd)).toHaveLength(0);
  });

  it('detector returns empty when the command has no `migrate deploy`', () => {
    expect(detectStartCommandFailOpen('node server.mjs || echo hi')).toHaveLength(0);
  });

  it('firstShellOperatorAfter matches `||`/`&&` before their single-char prefixes', () => {
    expect(firstShellOperatorAfter('a || b', 1)).toEqual({ op: '||', idx: 2 });
    expect(firstShellOperatorAfter('a && b', 1)).toEqual({ op: '&&', idx: 2 });
    expect(firstShellOperatorAfter('a | b', 1)).toEqual({ op: '|', idx: 2 });
    expect(firstShellOperatorAfter('a ; b', 1)).toEqual({ op: ';', idx: 2 });
    expect(firstShellOperatorAfter('a & b', 1)).toEqual({ op: '&', idx: 2 });
    expect(firstShellOperatorAfter('abc', 0)).toBeNull();
  });

  it('extractStartCommands reads assignment lines and ignores TOML comments', () => {
    const toml = ['# startCommand = "not a real assignment"', 'startCommand = "real value"'].join('\n');
    const found = extractStartCommands(toml);
    expect(found).toHaveLength(1);
    expect(found[0].value).toBe('"real value"');
    expect(found[0].line).toBe(2);
  });
});
