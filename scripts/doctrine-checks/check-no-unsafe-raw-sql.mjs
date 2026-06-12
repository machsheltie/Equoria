#!/usr/bin/env node
// Doctrine: backend APP CODE must not introduce NEW unsafe raw SQL execution.
// Source: Equoria-jzu4l (SECURITY: audit + gate unsafe raw SQL execution).
//
// `prisma.$executeRawUnsafe(...)` and `prisma.$queryRawUnsafe(...)` take a
// raw SQL STRING — any user input string-spliced into that text is a
// SQL-injection vector. The safe forms are:
//   - a typed Prisma method (`prisma.x.create/findMany/update/...`), or
//   - the parameterized tagged-template `prisma.$executeRaw`/`$queryRaw`,
//     where each ${interpolation} is bound by the driver, never spliced.
//
// This gate scans backend APP code (NOT tests, scripts, or seed) for any
// `.$executeRawUnsafe(` / `.$queryRawUnsafe(` CALL EXPRESSION and FAILS the
// build for any callsite whose file is not justified in the NARROW allowlist
// `scripts/doctrine-checks/unsafe-raw-sql-allowlist.json`. The allowlist
// covers only the genuinely-unavoidable cases (true DDL with dynamic
// identifiers, or static DDL literals) — adding a new entry is a
// security-review decision, not a convenience.
//
// Scope (APP code): backend/{modules,services,controllers,middleware,
//   models,utils}/**/*.mjs — EXCLUDING any __tests__/ or tests/ directory.
// Out of scope by design: backend/scripts/** (CLI tools, guarded by the
//   main-module-guard sentinel) and backend/seed/** (seed data). Those run
//   on operator-controlled inputs, not request input.
//
// Detection is intentionally narrow: only the literal member-call tokens
//   `.$executeRawUnsafe(` and `.$queryRawUnsafe(`
// count as violations. A mention inside a // comment or /* */ block, a
// string literal, or a doc reference does NOT (the regex requires the `(`
// of a call and we strip line-comments first).
//
// ── STALE-ENTRY RATCHET (Equoria-pc042) ────────────────────────────────────
// The allowlist grandfathers genuinely-unavoidable unsafe-raw-SQL callsites.
// An allowlist entry naming a file that (a) no longer exists on disk OR (b)
// no longer contains ANY unsafe `$executeRawUnsafe(` / `$queryRawUnsafe(`
// call expression is STALE: the unsafe callsite was migrated/deleted but the
// security-review exemption silently lingers. A future regression that
// re-introduces an unsafe call into that same file would be auto-exempted
// with no review. This check FAILS (exit 1) on stale entries, names them,
// and instructs that the allowlist may only SHRINK — mirroring the gates
// allowlist (Equoria-iz9gp) and the three baseline-delta checks
// (Equoria-fefh2.11), proven by
// backend/__tests__/scripts/unsafeRawSqlAllowlistStale.sentinel.test.mjs.
//
// Optional argv[2]: alternate allowlist path (sentinel-test hook,
// Equoria-pc042) — production callers (run-all.sh, CI) pass no argument.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const SCRIPT_DIR = path.dirname(__filename);
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..', '..');
const BACKEND_ROOT = path.join(REPO_ROOT, 'backend');
// Equoria-pc042: argv[2] optionally overrides the allowlist path so the
// stale-entry sentinel can prove detection FIRES against a planted (stale)
// allowlist WITHOUT editing the canonical one. Production callers pass no
// argument.
const ALLOWLIST_PATH = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(SCRIPT_DIR, 'unsafe-raw-sql-allowlist.json');

// App-code roots that this gate scans. Domain logic lives here; this is the
// surface where request input can reach a query builder.
const SCAN_SUBDIRS = ['modules', 'services', 'controllers', 'middleware', 'models', 'utils'];

// The unsafe member-call tokens. `\$` is a literal dollar; the trailing `\(`
// requires an actual call expression (not a bare mention in prose).
const UNSAFE_CALL_RX = /\.\$(?:executeRawUnsafe|queryRawUnsafe)\s*\(/;

// ENOENT-only tolerant read: a file walked into the list can vanish before we
// read it (concurrent jest sentinel plant+delete). Skip loudly on ENOENT;
// rethrow anything else — never a silent catch (EDGE_CASE_FIX_DISCIPLINE §3).
function readFileTolerant(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      process.stderr.write(
        `[no-unsafe-raw-sql] notice: ${path.relative(REPO_ROOT, file)} vanished mid-scan (ENOENT) — skipped\n`,
      );
      return null;
    }
    throw err;
  }
}

function walkDir(dir, results) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Exclude test trees — those legitimately use the unsafe form for
      // fixture setup against the real DB and are not request-path code.
      if (entry.name === '__tests__' || entry.name === 'tests' || entry.name === 'node_modules') {
        continue;
      }
      walkDir(full, results);
    } else if (entry.isFile() && entry.name.endsWith('.mjs')) {
      // Belt-and-suspenders: also skip *.test.mjs / *.spec.mjs that may sit
      // outside a __tests__ dir.
      if (/\.(test|spec)\.mjs$/.test(entry.name)) continue;
      results.push(full);
    }
  }
}

function loadAllowlist() {
  if (!fs.existsSync(ALLOWLIST_PATH)) {
    return [];
  }
  const parsed = JSON.parse(fs.readFileSync(ALLOWLIST_PATH, 'utf8'));
  const entries = parsed && parsed.allowlist ? Object.keys(parsed.allowlist) : [];
  // Normalize to POSIX-relative paths for cross-platform comparison.
  return entries.map(p => p.replace(/\\/g, '/'));
}

// Strip a single-line `//` comment tail from a line so a `.$queryRawUnsafe(`
// mention inside a trailing comment does not count. We do NOT attempt full
// JS lexing — a naive split on `//` is sufficient because the only false
// positive we care about is a comment that mentions the call token, and the
// real callsites never have the token after a `//` on the same line.
function stripLineComment(line) {
  const idx = line.indexOf('//');
  return idx === -1 ? line : line.slice(0, idx);
}

// Apply the same comment-aware scan the main loop uses, returning every REAL
// unsafe-raw-SQL call expression as { line, snippet } (callsites inside //
// line comments or /* */ blocks are excluded). Shared by the main violation
// scan AND the stale-entry check so the two agree on what "still contains an
// unsafe callsite" means — a callsite that survives only in a comment
// correctly counts as REMOVED (→ stale), exactly as the main scan would not
// flag it as a violation.
function findUnsafeCalls(source) {
  const hits = [];
  const lines = source.split(/\r?\n/);
  let inBlockComment = false;
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    if (inBlockComment) {
      const end = line.indexOf('*/');
      if (end === -1) {
        continue;
      }
      line = line.slice(end + 2);
      inBlockComment = false;
    }
    line = line.replace(/\/\*.*?\*\//g, '');
    const openBlock = line.indexOf('/*');
    if (openBlock !== -1) {
      line = line.slice(0, openBlock);
      inBlockComment = true;
    }
    const code = stripLineComment(line);
    if (UNSAFE_CALL_RX.test(code)) {
      hits.push({ line: i + 1, snippet: code.trim().slice(0, 120) });
    }
  }
  return hits;
}

// Equoria-pc042 stale-entry ratchet: every allowlist entry must still name a
// file that exists on disk AND still contains at least one unsafe-raw-SQL
// callsite. A stale exemption is dead weight that could silently auto-exempt
// a future regression that re-introduces an unsafe call into that file.
// Returns { missing, noCallsite } so the caller can report both stale
// flavours distinctly. The allowlist may only SHRINK.
function findStaleAllowlistEntries(allowlistEntries) {
  const missing = [];
  const noCallsite = [];
  for (const rel of allowlistEntries) {
    const abs = path.join(REPO_ROOT, ...rel.split('/'));
    if (!fs.existsSync(abs)) {
      missing.push(rel);
      continue;
    }
    const source = fs.readFileSync(abs, 'utf8');
    if (findUnsafeCalls(source).length === 0) {
      noCallsite.push(rel);
    }
  }
  return { missing, noCallsite };
}

function main() {
  if (!fs.existsSync(BACKEND_ROOT)) {
    process.stdout.write('[no-unsafe-raw-sql] OK — no backend/ directory present\n');
    return 0;
  }

  const allowlistEntries = loadAllowlist();
  const allowlist = new Set(allowlistEntries);

  // Equoria-pc042: stale-entry ratchet runs FIRST. A stale exemption is a
  // definitive doctrine failure independent of any current scan result —
  // surface it loudly before walking the tree.
  const { missing, noCallsite } = findStaleAllowlistEntries(allowlistEntries);
  if (missing.length > 0 || noCallsite.length > 0) {
    process.stderr.write(
      `[no-unsafe-raw-sql] FAIL — stale allowlist entries in ` +
        `${path.relative(REPO_ROOT, ALLOWLIST_PATH).replace(/\\/g, '/')} (Equoria-pc042):\n`,
    );
    for (const rel of missing) {
      process.stderr.write(`  ${rel}  (file no longer exists on disk)\n`);
    }
    for (const rel of noCallsite) {
      process.stderr.write(`  ${rel}  (no $executeRawUnsafe/$queryRawUnsafe callsite remains)\n`);
    }
    process.stderr.write(
      `\nThe allowlist may only SHRINK: remove the stale entr(ies) above.\n` +
        `A migrated/deleted unsafe callsite must not leave a lingering exemption —\n` +
        `otherwise a future regression re-introducing an unsafe call into that file\n` +
        `would be auto-exempted with no security review (Equoria-pc042).\n`,
    );
    return 1;
  }

  const files = [];
  for (const sub of SCAN_SUBDIRS) {
    walkDir(path.join(BACKEND_ROOT, sub), files);
  }

  const violations = [];

  for (const file of files) {
    const source = readFileTolerant(file);
    if (source === null) continue;
    const rel = path.relative(REPO_ROOT, file).replace(/\\/g, '/');
    if (allowlist.has(rel)) continue;

    for (const { line, snippet } of findUnsafeCalls(source)) {
      violations.push({ file: rel, line, snippet });
    }
  }

  if (violations.length === 0) {
    process.stdout.write(
      `[no-unsafe-raw-sql] OK — 0 unallowlisted $executeRawUnsafe/$queryRawUnsafe callsites in backend app code ` +
        `(${allowlist.size} file(s) on the narrow allowlist) (Equoria-jzu4l)\n`,
    );
    return 0;
  }

  process.stderr.write(
    `[no-unsafe-raw-sql] FAIL — ${violations.length} unsafe raw SQL callsite(s) in backend app code ` +
      `not in the narrow allowlist (Equoria-jzu4l).\n` +
      `  Replace with a typed Prisma method or the parameterized $executeRaw/$queryRaw\n` +
      `  TAGGED-TEMPLATE form. If the raw form is genuinely unavoidable (true DDL),\n` +
      `  add a justified entry to scripts/doctrine-checks/unsafe-raw-sql-allowlist.json\n` +
      `  (security-review decision — see SECURITY.md A03).\n\n`,
  );
  for (const v of violations) {
    process.stderr.write(`  ${v.file}:${v.line}  ${v.snippet}\n`);
  }
  return 1;
}

process.exit(main());
