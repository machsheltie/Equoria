#!/usr/bin/env node
/**
 * Codebase auditor — cross-platform, fail-loud.
 *
 * Scans a directory tree for hygiene / process / security signals and prints a
 * deterministic report. A security/code-quality scanner that silently produces
 * empty results is WORSE than none — it manufactures false confidence. So this
 * tool draws a hard line between two outcomes:
 *
 *   - FINDINGS (TODOs, console.log, a hardcoded-looking secret, …) are SIGNAL,
 *     not a tool failure. They are printed and the process exits 0. A scanner
 *     that exited nonzero merely because the codebase contains a TODO would be
 *     unusable as a recurring check.
 *   - A SCAN FAILURE (the search root does not exist; a file cannot be read for
 *     any reason other than it vanished mid-scan; the directory walk throws)
 *     means the scan DID NOT actually cover the tree. That is never reported as
 *     "Clean" — it throws and the process exits NONZERO with a clear message.
 *
 * Usage:
 *   node utils/agent-skills/auditor.mjs [directory]
 *
 * Defaults to '.' if no directory provided.
 *
 * History:
 *   Equoria-nxmb: rebuilt to be platform-agnostic (the prior version had raw
 *     newlines in single-quoted literals, used `grep -r`, and scanned
 *     node_modules). That rewrite still shelled out to `rg` (ripgrep) and, on
 *     EPERM (rg not on PATH / Windows permissions), swallowed the failure and
 *     reported nothing — a false-green security scanner.
 *   Equoria-lq5li: removed the ripgrep shell-out entirely. The scan is now a
 *     deterministic Node-native fs walk (no `spawnSync`, no PATH dependency,
 *     identical behaviour on Windows and POSIX) reusing the shared, CI-proven
 *     walk + tolerant-read helpers in scripts/lib/doctrine-scan-patterns.mjs.
 *     The walk fails LOUD: only an individual file vanishing mid-scan (ENOENT)
 *     is tolerated; every other error aborts the scan with a nonzero exit.
 *     Scan categories broadened to: secrets, console-noise, TODOs, unsafe-SQL,
 *     public-writes, bypass-flags.
 */

import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
import {
  walkFiles,
  readScannedFileSyncTolerant,
  BYPASS_HEADER_TOKENS,
} from '../../scripts/lib/doctrine-scan-patterns.mjs';

const CHECK_LABEL = 'auditor';
const MAX_LINES_SHOWN = 10;

// Directories never scanned. Mirrors .gitignore expectations + repo conventions.
const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'coverage',
  'logs',
  '.claude',
  '.backups',
  '_bmad-output',
  '.beads',
  '.next',
  '.cache',
  '.vite',
  'out',
]);

const INCLUDE_EXTS = new Set(['.js', '.mjs', '.ts', '.tsx']);

const SKIP_FILE_PATTERNS = [/\.log$/, /\.lock$/, /\.json$/];

// ── Scan categories ────────────────────────────────────────────────────
//
// Each category is a label + a matcher(line) => boolean. Matchers are pure and
// deterministic — given the same line they always return the same result on
// every platform. BYPASS_HEADER_TOKENS is imported from the single-source
// doctrine library so the auditor's bypass-flag set cannot drift from the
// doctrine gate's.

const BYPASS_FLAG_RE = new RegExp(
  BYPASS_HEADER_TOKENS.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'),
  'i',
);

const CATEGORIES = [
  {
    label: 'console.log (hygiene)',
    test: line => /\bconsole\.log\s*\(/.test(line),
  },
  {
    label: 'TODO comments (process)',
    test: line => /\bTODO\b/.test(line),
  },
  {
    label: 'Potential hardcoded secrets',
    // API_KEY / PASSWORD / SECRET / TOKEN assigned a non-empty quoted literal.
    test: line =>
      /\b(?:API_?KEY|PASSWORD|SECRET|TOKEN)\b\s*[:=]\s*["'`][A-Za-z0-9]/i.test(line),
  },
  {
    label: 'Potentially unsafe SQL (string-built queries / raw exec)',
    // $queryRawUnsafe / $executeRawUnsafe, or a SQL keyword glued to template
    // interpolation / string concatenation (the classic injection shape).
    test: line =>
      /\$(?:query|execute)RawUnsafe\s*\(/.test(line) ||
      /\b(?:SELECT|INSERT|UPDATE|DELETE|DROP|WHERE|FROM)\b[^\n]*(?:\$\{|['"`]\s*\+)/i.test(line),
  },
  {
    label: 'World-writable / public-write file modes',
    // chmod 0777/0666 (octal or string) or fs.constants public-write modes.
    test: line =>
      /chmod(?:Sync)?\s*\([^)]*0o?(?:777|666)/.test(line) ||
      /\b0o?(?:777|666)\b/.test(line),
  },
  {
    label: 'Test-bypass / E2E-bypass flags',
    test: line => BYPASS_FLAG_RE.test(line),
  },
];

// ── Walk predicates ────────────────────────────────────────────────────

function skipDir(name) {
  return IGNORED_DIRS.has(name);
}

function includeFile(name) {
  if (SKIP_FILE_PATTERNS.some(rx => rx.test(name))) {
    return false;
  }
  return INCLUDE_EXTS.has(path.extname(name));
}

// ── Scanner ────────────────────────────────────────────────────────────
//
// Collects matches for every category in a SINGLE pass over the file set, so a
// large tree is read once, not once-per-category. Returns a Map<label, hits[]>.
//
// Fail-loud contract: this throws if the root is missing or a file read fails
// for any reason other than the file vanishing mid-scan (ENOENT, tolerated by
// readScannedFileSyncTolerant with a loud per-file notice). It NEVER returns a
// partial/empty result on failure — the caller must let the throw become a
// nonzero exit.

function runScan(searchDir) {
  const absRoot = path.resolve(searchDir);
  if (!fs.existsSync(absRoot)) {
    throw new Error(
      `scan target does not exist: ${searchDir} (resolved: ${absRoot}). ` +
        `Refusing to report a clean scan over a tree that was never read.`,
    );
  }

  // walkFiles throws on any non-ENOENT directory fault (EACCES, EMFILE, …) per
  // its own contract — a genuine environment fault must crash the scan, not be
  // silently swallowed into an empty result.
  const files = walkFiles([absRoot], { skipDir, includeFile });

  const results = new Map(CATEGORIES.map(c => [c.label, []]));

  for (const filePath of files) {
    const contents = readScannedFileSyncTolerant(filePath, CHECK_LABEL);
    if (contents === null) {
      // File vanished between enumeration and read (ENOENT). Tolerated loudly
      // by readScannedFileSyncTolerant; skip it. Any OTHER read error would
      // have thrown out of this loop and aborted the scan.
      continue;
    }
    const lines = contents.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const category of CATEGORIES) {
        if (category.test(line)) {
          results.get(category.label).push(`${filePath}:${i + 1}:${line.trim()}`);
        }
      }
    }
  }

  // Deterministic ordering: sort hits per category so the report is identical
  // across runs and platforms regardless of readdir traversal order.
  for (const hits of results.values()) {
    hits.sort();
  }

  return results;
}

// ── Reporter ───────────────────────────────────────────────────────────

function report(searchDir, results) {
  const out = [];
  out.push('');
  out.push(`CODEBASE AUDITOR REPORT: ${searchDir}`);
  out.push('==================================================');
  out.push('');
  out.push('Scanner backend: Node-native fs walk (deterministic, no shell-out)');

  for (const { label } of CATEGORIES) {
    const hits = results.get(label);
    out.push('');
    if (hits.length === 0) {
      out.push(`Clean: No instances of ${label} found.`);
      continue;
    }
    out.push(`Found ${hits.length} instances of ${label}:`);
    for (const hit of hits.slice(0, MAX_LINES_SHOWN)) {
      const display = hit.length > 120 ? `${hit.substring(0, 117)}...` : hit;
      out.push(`  ${display}`);
    }
    if (hits.length > MAX_LINES_SHOWN) {
      out.push(`  ...and ${hits.length - MAX_LINES_SHOWN} more.`);
    }
  }

  out.push('');
  out.push('==================================================');
  out.push('');
  console.log(out.join('\n'));
}

// ── Entry point ────────────────────────────────────────────────────────
//
// Wrapped in a main-module guard (CONTRIBUTING.md "CLI Scripts" convention) so
// importing this module for unit testing does NOT trigger a scan + process.exit.
// On scan FAILURE we print to stderr and exit nonzero — never a silent clean.

export function main(argv = process.argv) {
  const searchDir = argv[2] || '.';
  let results;
  try {
    results = runScan(searchDir);
  } catch (err) {
    console.error('');
    console.error(`AUDITOR SCAN FAILED: ${err && err.message ? err.message : err}`);
    console.error(
      'The scan did not complete; results are NOT reliable. Exiting nonzero ' +
        'rather than reporting a clean tree.',
    );
    process.exitCode = 1;
    return 1;
  }
  report(searchDir, results);
  return 0;
}

// Equoria-lq5li: ESM main-module guard (CONTRIBUTING.md "CLI Scripts"). Use
// fileURLToPath — NOT string concatenation — so the comparison normalises
// correctly on Windows (file:///C:/... ) as well as POSIX. main() runs a scan
// and may set a nonzero exit code; it must NOT fire on bare import (the unit
// test imports runScan/main without triggering a process-level scan).
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}

export { runScan, CATEGORIES };
