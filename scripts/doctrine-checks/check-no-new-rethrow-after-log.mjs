#!/usr/bin/env node
/**
 * Equoria-ej9k1 containment doctrine check.
 *
 * Problem: 221 instances across 62 service files match the
 * try/catch-log-rethrow antipattern:
 *   try { ... } catch (error) {
 *     logger.error(`[svc.fn] ...`);
 *     throw error;
 *   }
 *
 * This adds nothing the global error handler doesn't already do AND
 * produces double-logging when callers also log. Per OPTIMAL_FIX §3
 * the full codemod is too big for one PR. This check is the containment
 * gate: a per-file baseline counts the legacy occurrences; any PR that
 * adds NEW ones (or introduces them to a clean file) fails this check.
 *
 * Migration shrinks the counts in the JSON in lockstep with PRs that
 * replace the rethrow-after-log with either (a) just `throw` so the
 * global handler logs once, or (b) a typed ServiceError wrapper that
 * adds genuine context.
 *
 * Pattern matched (single-statement catch body):
 *   catch (...) { logger.(error|warn|info)(...); throw ...; }
 *
 * Catches with additional substantive work (extra cleanup, conditional
 * branches, error transformation beyond throw-the-same) are NOT matched.
 *
 * Equoria-08aav: comments are STRIPPED before the count regex runs, so an
 * explanatory comment that mentions the literal log-then-rethrow pattern
 * (e.g. "removed a catch(e){ logger.error(...); throw e; }") is NOT counted
 * as a residual occurrence. Only real CODE counts. This removes the recurring
 * gotcha (the sibling fv6dp issue saw the same on the silent-cleanup gate)
 * that forced contributors to reword comments to keep the gate green. The
 * stripper is a conservative char-state machine that protects string /
 * template / regex literals so a `//` that legitimately appears inside a
 * string ("https://x") or a `/.../ ` regex is not mistaken for a comment.
 *
 * ── GOVERNANCE / BURN-DOWN (Equoria-fefh2.11) ──────────────────────────────
 * Owning burn-down issue: Equoria-wkdwx.
 * Current baseline: 12 log-then-rethrow catches across 2 files (2026-06-10):
 *   backend/services/cronJobs.mjs (11), backend/scripts/testXpSystem.mjs (1).
 * Target: 0 — remove the try/catch (the global errorHandler logs once) or
 * wrap in a typed error that adds genuine context. The baseline may ONLY
 * shrink, never grow.
 *
 * To shrink (contributor instruction): fix the catch site(s), then
 * decrement (or delete) that file's count in rethrow-after-log-baseline.json
 * in the SAME commit. A baseline entry whose file no longer exists on disk
 * is STALE and fails this check until the entry is removed — stale entries
 * are unusable headroom a future regression could hide under.
 *
 * Optional argv[2]: alternate baseline JSON path (sentinel-test hook,
 * Equoria-fefh2.11) — production callers pass no argument.
 * Auto-runs via scripts/doctrine-checks/run-all.sh by file-name pattern.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  isPlantArtifactBasename,
  readScannedFileSyncTolerant,
} from '../lib/doctrine-scan-patterns.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..', '..');
// Equoria-fefh2.11: argv[2] optionally overrides the baseline path so the
// doctrineBaselineStale sentinel can prove stale-entry detection FIRES
// against a planted baseline. Production callers pass no argument.
const BASELINE_PATH = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(SCRIPT_DIR, 'rethrow-after-log-baseline.json');

const SCAN_DIRS = ['backend'];
const FILE_RE = /\.mjs$/;
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'coverage', '__tests__']);

// Matches: catch (...) { ...logger.error/warn/info(...); throw ...; }
// The [^{}]*? body forbids nested braces, so this only matches
// single-block catches that ONLY log-then-throw (no conditional branches,
// no nested error transformation, no extra cleanup work).
const PATTERN =
  /catch\s*\([^)]*\)\s*\{[^{}]*?logger\.(error|warn|info)\([^)]*\)\s*;\s*throw\s+\w+\s*;?\s*\}/gs;

const BACKSLASH = String.fromCharCode(92);

function walk(dir, acc) {
  let ents;
  try {
    ents = fs.readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    // Equoria-q7lqz: a directory can vanish mid-scan when a concurrent jest
    // sentinel suite deletes its temp scaffolding. Tolerate ONLY ENOENT,
    // loudly; any other error (EACCES, …) is a real fault and must crash.
    if (err && err.code === 'ENOENT') {
      console.error(`[rethrow-after-log] notice: skipped vanished directory ${dir}`);
      return;
    }
    throw err;
  }
  for (const e of ents) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      walk(full, acc);
    } else if (
      e.isFile() &&
      FILE_RE.test(e.name) &&
      !e.name.endsWith('.test.mjs') &&
      !e.name.endsWith('.spec.mjs') &&
      // Equoria-q7lqz: sentinel plant artifacts (basename contains the
      // UPPERCASE DO_NOT_COMMIT / PLANTED markers) are planted+deleted by
      // concurrent jest sentinels — exclude them at the walker level.
      !isPlantArtifactBasename(e.name)
    ) {
      acc.push(full);
    }
  }
}

/**
 * Equoria-08aav: strip `//` line comments and block comments from JS/TS
 * source so the rethrow-after-log count regex only sees real CODE. Ported
 * verbatim from the sibling silent-cleanup-catch gate (Equoria-fv6dp) — see
 * scripts/doctrine-checks/check-no-new-silent-cleanup-catch.mjs for the
 * full rationale. A naive regex strip would corrupt a `//` or block-comment
 * marker that appears inside a string/template/regex literal (e.g.
 * "https://x", a regex like `/a\/b/`), so this is a char-state machine that
 * tracks whether we are currently inside a string, template literal, or
 * regex literal and only removes comment runs that occur in plain code.
 *
 * Comment characters are replaced with a NON-whitespace sentinel (`~`),
 * NOT with spaces. This is deliberate and load-bearing — IDENTICAL reasoning
 * to fv6dp, and it matters here too because PATTERN's body is `[^{}]*?`:
 *
 *   - Blanking the explanatory text destroys any literal pattern a comment
 *     merely MENTIONS, so it can never false-match. ✅ the fix.
 *   - Using a non-whitespace sentinel (rather than spaces) means a comment
 *     does NOT collapse the surrounding code into something matchable that
 *     wasn't before. A REAL log-then-rethrow whose catch body interleaves a
 *     comment —
 *         catch (e) {
 *           // note
 *           logger.error('...'); throw e;
 *         }
 *     — already matched the original regex (the comment text is part of the
 *     `[^{}]*?` body run). Blanking that comment to `~` keeps the body intact
 *     as code chars, so the verdict is unchanged. Blanking to spaces would
 *     likewise leave it matching, but the `~` choice guarantees we never
 *     ALTER any existing match shape. The ONLY behaviour change is that
 *     comment MENTIONS of the literal stop counting; everything the old
 *     regex counted, it still counts; everything it skipped, it still skips.
 *
 * The regex-vs-division heuristic errs toward treating `/` as division,
 * which at worst leaves a regex body in place as code — that can only keep a
 * match that was already there, never weaken real detection.
 */
const COMMENT_SENTINEL = '~'; // non-whitespace, not part of the rethrow pattern
function stripComments(src) {
  let out = '';
  let i = 0;
  const n = src.length;
  // State: which literal context (if any) we're inside.
  let inLine = false; // // ... (until newline)
  let inBlock = false; // /* ... */
  let inString = false; // ' or " or `
  let stringQuote = '';
  let inRegex = false;

  // For the regex-vs-division heuristic: track the last non-space, non-
  // comment code character emitted. A `/` starts a regex literal only when
  // the previous significant token suggests an expression position
  // (operators, `(`, `,`, `=`, `return`, etc.), not after an identifier,
  // number, `)`, or `]` (which imply division).
  let lastSignificant = '';

  const isRegexAllowedBefore = (ch) => {
    if (ch === '') return true; // start of file
    // After these, a `/` is a regex literal, not division.
    return '(,=:[!&|?{};+-*%~^<>'.includes(ch);
  };

  while (i < n) {
    const ch = src[i];
    const next = i + 1 < n ? src[i + 1] : '';

    if (inLine) {
      if (ch === '\n') {
        inLine = false;
        out += ch; // keep the newline — the comment ends here
      } else {
        out += COMMENT_SENTINEL; // blank comment char to non-whitespace
      }
      i += 1;
      continue;
    }

    if (inBlock) {
      if (ch === '*' && next === '/') {
        inBlock = false;
        out += COMMENT_SENTINEL + COMMENT_SENTINEL; // blank the closing */
        i += 2;
      } else {
        // Blank EVERY block-comment char (including newlines) to the
        // non-whitespace sentinel so a multi-line comment body can never
        // reduce to whitespace and create/keep a match it shouldn't.
        out += COMMENT_SENTINEL;
        i += 1;
      }
      continue;
    }

    if (inString) {
      out += ch;
      if (ch === '\\') {
        // Escaped char: copy the next char verbatim, don't let it end string.
        if (i + 1 < n) {
          out += src[i + 1];
          i += 2;
          continue;
        }
      } else if (ch === stringQuote) {
        inString = false;
        lastSignificant = ch;
      }
      i += 1;
      continue;
    }

    if (inRegex) {
      out += ch;
      if (ch === '\\') {
        if (i + 1 < n) {
          out += src[i + 1];
          i += 2;
          continue;
        }
      } else if (ch === '/') {
        inRegex = false;
        lastSignificant = ch;
      } else if (ch === '\n') {
        // Unterminated regex (shouldn't happen in valid code) — bail out of
        // regex state at newline so we don't swallow the rest of the file.
        inRegex = false;
      }
      i += 1;
      continue;
    }

    // Not in any literal/comment: detect what starts here.
    if (ch === '/' && next === '/') {
      inLine = true;
      out += '  ';
      i += 2;
      continue;
    }
    if (ch === '/' && next === '*') {
      inBlock = true;
      out += '  ';
      i += 2;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      inString = true;
      stringQuote = ch;
      out += ch;
      i += 1;
      continue;
    }
    if (ch === '/' && isRegexAllowedBefore(lastSignificant)) {
      // Treat as regex literal start.
      inRegex = true;
      out += ch;
      i += 1;
      continue;
    }

    out += ch;
    if (ch.trim() !== '') {
      lastSignificant = ch;
    }
    i += 1;
  }

  return out;
}

function countMatches(filePath) {
  // Equoria-q7lqz: files enumerated by walk() can vanish before this read
  // (concurrent jest sentinel plant+delete). The tolerant reader returns
  // null ONLY on ENOENT (with a one-line notice) and rethrows anything else.
  const src = readScannedFileSyncTolerant(filePath, 'rethrow-after-log');
  if (src === null) return 0;
  // Equoria-08aav: count against comment-stripped source so explanatory
  // comments that mention the literal pattern are not false-counted.
  const code = stripComments(src);
  const matches = code.match(PATTERN);
  return matches ? matches.length : 0;
}

function loadBaseline() {
  if (!fs.existsSync(BASELINE_PATH)) {
    console.error(`[rethrow-after-log] baseline not found at ${BASELINE_PATH}`);
    process.exit(2);
  }
  return JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
}

function toRelKey(absPath) {
  return path.relative(REPO_ROOT, absPath).split(BACKSLASH).join('/');
}

// Equoria-fefh2.11 ratchet: every baseline key must exist on disk. A stale
// entry (deleted/renamed file) is unusable grandfathered headroom that a
// future regression could silently hide under — the baseline may only shrink.
function assertNoStaleBaselineEntries(baseline) {
  const stale = Object.keys(baseline).filter(
    (key) => !fs.existsSync(path.join(REPO_ROOT, ...key.split('/')))
  );
  if (stale.length > 0) {
    console.error(
      '[rethrow-after-log] FAIL — stale baseline entries (files no longer exist on disk):'
    );
    for (const s of stale) {
      console.error(`  ${s}`);
    }
    console.error('');
    console.error('The baseline may only SHRINK: remove the stale path(s) from');
    console.error(`  ${BASELINE_PATH}`);
    console.error('and update the counts/governance header (Equoria-fefh2.11 / Equoria-wkdwx).');
    process.exit(1);
  }
}

function main() {
  const baseline = loadBaseline();
  assertNoStaleBaselineEntries(baseline);
  const files = [];
  for (const d of SCAN_DIRS) walk(path.join(REPO_ROOT, d), files);

  const violations = [];
  let observedTotal = 0;
  const seenInBaseline = new Set();

  for (const f of files) {
    const key = toRelKey(f);
    const observed = countMatches(f);
    observedTotal += observed;
    const baselineCount = baseline[key] ?? 0;
    if (baselineCount > 0) seenInBaseline.add(key);
    if (observed > baselineCount) {
      violations.push({
        file: key,
        baseline: baselineCount,
        observed,
        delta: observed - baselineCount,
      });
    }
  }

  if (violations.length > 0) {
    console.error('[rethrow-after-log] FAIL — count grew above baseline:');
    for (const v of violations) {
      console.error(`  ${v.file}: baseline=${v.baseline}, observed=${v.observed} (+${v.delta})`);
    }
    console.error('');
    console.error('Fix:');
    console.error('  - If the catch only logs and rethrows, REMOVE the try/catch entirely');
    console.error('    — the global errorHandler already logs once with full context.');
    console.error('  - If the context is genuinely useful, wrap with a typed error:');
    console.error('      throw new ServiceError("...", { cause: error })');
    console.error('  - If you are MIGRATING (count went DOWN), update the baseline JSON.');
    console.error('  - See Equoria-ej9k1 + OPTIMAL_FIX §3.');
    process.exit(1);
  }

  const baselineTotal = Object.values(baseline).reduce((s, n) => s + n, 0);
  console.log(
    `[rethrow-after-log] OK — observed total=${observedTotal} <= baseline total=${baselineTotal} ` +
      `(${Object.keys(baseline).length} legacy files; ${seenInBaseline.size} still present)`
  );
}

main();
