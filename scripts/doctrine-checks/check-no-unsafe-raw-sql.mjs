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

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const SCRIPT_DIR = path.dirname(__filename);
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..', '..');
const BACKEND_ROOT = path.join(REPO_ROOT, 'backend');
const ALLOWLIST_PATH = path.join(SCRIPT_DIR, 'unsafe-raw-sql-allowlist.json');

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
    return new Set();
  }
  const parsed = JSON.parse(fs.readFileSync(ALLOWLIST_PATH, 'utf8'));
  const entries = parsed && parsed.allowlist ? Object.keys(parsed.allowlist) : [];
  // Normalize to POSIX-relative paths for cross-platform comparison.
  return new Set(entries.map(p => p.replace(/\\/g, '/')));
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

function main() {
  if (!fs.existsSync(BACKEND_ROOT)) {
    process.stdout.write('[no-unsafe-raw-sql] OK — no backend/ directory present\n');
    return 0;
  }

  const allowlist = loadAllowlist();
  const files = [];
  for (const sub of SCAN_SUBDIRS) {
    walkDir(path.join(BACKEND_ROOT, sub), files);
  }

  const violations = [];
  let inBlockComment = false;

  for (const file of files) {
    const source = readFileTolerant(file);
    if (source === null) continue;
    const rel = path.relative(REPO_ROOT, file).replace(/\\/g, '/');
    const isAllowed = allowlist.has(rel);
    const lines = source.split(/\r?\n/);
    inBlockComment = false;

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];

      // Track /* ... */ block comments so a multi-line block mentioning the
      // token does not count. Simple state machine, sufficient for our files.
      if (inBlockComment) {
        const end = line.indexOf('*/');
        if (end === -1) continue;
        line = line.slice(end + 2);
        inBlockComment = false;
      }
      // Remove any fully-inline /* ... */ spans on this line.
      line = line.replace(/\/\*.*?\*\//g, '');
      const openBlock = line.indexOf('/*');
      if (openBlock !== -1) {
        // Unterminated block comment opens here.
        line = line.slice(0, openBlock);
        inBlockComment = true;
      }

      const code = stripLineComment(line);
      if (UNSAFE_CALL_RX.test(code)) {
        if (!isAllowed) {
          violations.push({ file: rel, line: i + 1, snippet: code.trim().slice(0, 120) });
        }
      }
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
