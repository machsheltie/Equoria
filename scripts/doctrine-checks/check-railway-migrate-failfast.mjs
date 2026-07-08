#!/usr/bin/env node
/**
 * Equoria-oey96.35 railway.toml migrate fail-fast doctrine check.
 *
 * Problem: railway.toml's [deploy] startCommand ran `prisma migrate deploy`
 * with a `|| echo "..."` swallow, so a FAILED migration was masked and the
 * server booted anyway against a drifted schema (FAIL-OPEN). Because
 * `migrate deploy` already exits 0 on the no-op case, the `|| echo` never
 * helped the benign case — it ONLY hid real migration failures. This directly
 * contradicts Epic 14's deployment decision ("Fails fast if migration fails —
 * prevents broken server start", docs/sprint-artifacts/14-deployment.md:80-84).
 *
 * This check makes that regression impossible to re-introduce silently: it
 * parses railway.toml's startCommand and FAILS if a `prisma migrate deploy`
 * invocation is followed by a fail-open shell operator (`||`, `;`, a lone `|`,
 * or a lone `&`) — any of which lets the deploy proceed to `node server.mjs`
 * despite a non-zero migrate exit. The ONLY fail-fast terminator is `&&` (or
 * the command genuinely aborting).
 *
 * Why detect the whole fail-open OPERATOR CLASS, not just `|| echo`: OPTIMAL_
 * FIX_DISCIPLINE §1 — the AC ("no `|| echo` in railway.toml") could pass while
 * the same defect returns in a slightly different form (`|| true`, `; node ...`,
 * `| tee`, `& node ...`). Anchoring on the operator that terminates the migrate
 * command catches the class, not the one instance.
 *
 * Robustness (Equoria-oey96.35 review notes):
 *   - Only the FIRST shell operator after `migrate deploy` (skipping the
 *     command's own flags/args, which contain no shell operators) governs the
 *     migrate command's failure propagation. A later `||` guarding the SERVER
 *     start (`migrate deploy && node server.mjs || echo`) does NOT trip this
 *     check — migrate is already gated by the `&&`.
 *   - The legitimate `${DIRECT_URL:-$DATABASE_URL}` parameter-substitution
 *     fallback (commit c6c66db01, Supabase pooler) is NOT a `||` and sits
 *     BEFORE `migrate deploy`, so it is never scanned and never false-positives.
 *   - A subshell close `)` between `migrate deploy` and its `&&` is skipped
 *     (`(... migrate deploy) && ...` is fail-fast).
 *
 * Optional argv[2]: alternate railway.toml path (sentinel-test hook) so the
 * planted-violation sentinel can prove detection FIRES without editing the
 * canonical file. Production callers (run-all.sh, CI) pass no argument.
 * Auto-runs via scripts/doctrine-checks/run-all.sh by file-name pattern.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..', '..');

// argv[2] optionally overrides the scanned file so the sentinel can point the
// check at a planted fail-open / clean fixture. Production callers pass none.
const RAILWAY_TOML_PATH = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(REPO_ROOT, 'railway.toml');

// The migrate command whose failure MUST abort the deploy.
const MIGRATE_RE = /migrate\s+deploy/gi;

/**
 * Return the first shell control operator at or after `fromIdx` in `cmd`, as
 * `{ op, idx }`, or null if none. Two-char operators (`&&`, `||`) are matched
 * before their single-char prefixes so `||` is never mis-read as a lone `|`.
 * Pure — exported for the sentinel.
 */
export function firstShellOperatorAfter(cmd, fromIdx) {
  for (let i = fromIdx; i < cmd.length; i += 1) {
    const c = cmd[i];
    const next = cmd[i + 1];
    if (c === '&' && next === '&') return { op: '&&', idx: i };
    if (c === '|' && next === '|') return { op: '||', idx: i };
    if (c === '|') return { op: '|', idx: i };
    if (c === ';') return { op: ';', idx: i };
    if (c === '&') return { op: '&', idx: i };
  }
  return null;
}

// Operators that, when they terminate the migrate command, let the deploy
// proceed to server start despite a non-zero migrate exit (FAIL-OPEN). `&&`
// is the only fail-fast terminator.
const FAIL_OPEN_OPERATORS = new Set(['||', ';', '|', '&']);

/**
 * Inspect a single startCommand string value. Returns an array of violation
 * descriptors (one per `migrate deploy` whose terminating operator is
 * fail-open). Empty array = fail-fast (or no migrate in this command). Pure —
 * exported for the sentinel.
 */
export function detectStartCommandFailOpen(startCommand) {
  const violations = [];
  MIGRATE_RE.lastIndex = 0;
  let m;
  while ((m = MIGRATE_RE.exec(startCommand)) !== null) {
    const afterMigrate = m.index + m[0].length;
    const found = firstShellOperatorAfter(startCommand, afterMigrate);
    if (found && FAIL_OPEN_OPERATORS.has(found.op)) {
      violations.push({ operator: found.op, operatorIndex: found.idx });
    }
  }
  return violations;
}

/**
 * Extract every `startCommand = <value>` assignment from railway.toml content.
 * Returns [{ value, line }]. Only assignment lines match — TOML `#` comments
 * (e.g. the "Run database migrations" comment) are ignored. Pure — exported
 * for the sentinel.
 */
export function extractStartCommands(tomlContent) {
  const results = [];
  const lines = tomlContent.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const match = /^\s*startCommand\s*=\s*(.+?)\s*$/.exec(lines[i]);
    if (match) {
      results.push({ value: match[1], line: i + 1 });
    }
  }
  return results;
}

function main() {
  if (!fs.existsSync(RAILWAY_TOML_PATH)) {
    // No railway.toml means no Railway deploy startCommand to guard. Do not
    // fabricate a pass for a missing canonical file when running the default
    // path; a missing file is a configuration error worth surfacing.
    console.error(
      `[railway-migrate-failfast] FAIL — railway.toml not found at ${RAILWAY_TOML_PATH}`
    );
    process.exit(1);
  }

  const content = fs.readFileSync(RAILWAY_TOML_PATH, 'utf8');
  const startCommands = extractStartCommands(content);

  const violations = [];
  for (const { value, line } of startCommands) {
    for (const v of detectStartCommandFailOpen(value)) {
      violations.push({ line, operator: v.operator });
    }
  }

  if (violations.length > 0) {
    console.error(
      '[railway-migrate-failfast] FAIL — railway.toml startCommand swallows migration failures (fail-open):'
    );
    for (const v of violations) {
      console.error(
        `  ${path.relative(REPO_ROOT, RAILWAY_TOML_PATH)}:${v.line}  ` +
          `\`prisma migrate deploy\` is terminated by \`${v.operator}\` — a failed migration does NOT abort the deploy.`
      );
    }
    console.error('');
    console.error(
      'A failing `prisma migrate deploy` MUST abort the deploy before `node server.mjs` runs.'
    );
    console.error(
      'Chain the migrate command with `&&` (fail-fast); remove any `|| echo`, `; ...`, `| ...`, or `& ...` after it.'
    );
    console.error(
      'See Equoria-oey96.35 + docs/sprint-artifacts/14-deployment.md:80-84 ("Fails fast if migration fails").'
    );
    process.exit(1);
  }

  const migrateCount = startCommands.filter((s) => /migrate\s+deploy/i.test(s.value)).length;
  console.log(
    `[railway-migrate-failfast] OK — ${startCommands.length} startCommand(s) scanned, ` +
      `${migrateCount} run \`migrate deploy\`, all fail-fast (abort deploy on migrate failure).`
  );
}

// ESM main-module guard: this file is import-safe (the sentinel imports the
// pure detectors above without triggering the scan/exit). main() runs only when
// the file is the direct entrypoint.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
