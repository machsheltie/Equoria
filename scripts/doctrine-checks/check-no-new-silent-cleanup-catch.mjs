#!/usr/bin/env node
/**
 * Equoria-75odq containment doctrine check.
 *
 * Problem: 788 test files contain `.catch(() => {})` (or similar empty-arm
 * variants) that swallow cleanup failures. Per CONTRIBUTING.md "Test Fixtures"
 * § "Cleanup discipline (CLAUDE.md §2)", a silent cleanup catch is the exact
 * landmine that leaks NULL-phenotype rows and trips sentinel Equoria-a429.
 *
 * Full codemod across all 788 sites is too large for one PR. The migration
 * is tracked separately. This check IS the containment gate: a per-file
 * baseline counts the legacy silent-catches; any PR that adds NEW ones (or
 * introduces them to a clean file) fails this check.
 *
 * Migration shrinks the counts in the JSON in lockstep with PRs that
 * replace silent catches with scoped error handlers.
 *
 * Pattern matched: .catch(arrow-fn-with-empty-body) — covers the variants
 * actually present in the codebase:
 *   .catch(() => {})
 *   .catch(()=>{})
 *   .catch(_ => {})
 *   .catch(err => {})       (one arg, ignored, empty body)
 *   .catch(() => undefined)
 *   .catch(() => null)
 *   .catch(() => void 0)
 *
 * Real catch arms with bodies (logging, fail-fast, re-throw) are NOT matched.
 *
 * Equoria-fv6dp: comments are STRIPPED before the count regex runs, so an
 * explanatory comment that mentions the literal pattern (e.g. "migrated a
 * silent .catch(() => {}) arm") is NOT counted as a residual silent catch.
 * Only real CODE counts. This removes the recurring gotcha that forced
 * contributors to reword comments to keep the gate green. The stripper is a
 * conservative char-state machine that protects string and regex literals so
 * a `//` that legitimately appears inside a string (e.g. "https://...") is
 * not mistaken for a comment.
 *
 * Run: `node scripts/doctrine-checks/check-no-new-silent-cleanup-catch.mjs`
 * Integrated into `scripts/doctrine-checks/run-all.sh` by file-name pattern.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..', '..');
const BASELINE_PATH = path.join(SCRIPT_DIR, 'silent-cleanup-catch-baseline.json');

const TEST_GLOBS_DIRS = ['backend'];
const TEST_FILE_RE = /\.(test|spec)\.(m?js|tsx?|jsx?)$/;
const SILENT_CATCH_RE =
  /\.catch\(\s*\(?\s*\w*\s*\)?\s*=>\s*(\{\s*\}|undefined|null|void\s+0)\s*\)/g;

const BACKSLASH = String.fromCharCode(92);

function walk(dir, acc) {
  let ents;
  try {
    ents = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of ents) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (
        e.name === 'node_modules' ||
        e.name === '.git' ||
        e.name === 'dist' ||
        e.name === 'coverage'
      ) {
        continue;
      }
      walk(full, acc);
    } else if (e.isFile() && TEST_FILE_RE.test(e.name)) {
      acc.push(full);
    }
  }
}

/**
 * Equoria-fv6dp: strip `//` line comments and block comments from JS/TS
 * source so the silent-catch count regex only sees real CODE. A naive
 * regex strip would corrupt a `//` or block-comment marker that appears
 * inside a string/template/regex literal (e.g. "https://x", a regex like
 * `/a\/b/`), so this is a char-state machine that tracks whether we are
 * currently inside a string, template literal, or regex literal and only
 * removes comment runs that occur in plain code.
 *
 * Comment characters are replaced with a NON-whitespace sentinel (`~`),
 * NOT with spaces. This is deliberate and load-bearing:
 *
 *   - Blanking the explanatory text destroys any literal pattern a comment
 *     merely MENTIONS (e.g. "migrated a silent .catch(() => {}) arm"
 *     becomes "~~~~~ … ~~~~~"), so it can never false-match. ✅ the fix.
 *   - Using a non-whitespace sentinel (rather than spaces) means a comment
 *     does NOT collapse the surrounding code into something matchable that
 *     wasn't before. Critically: a REAL silent catch whose body is
 *     comment-only —
 *         .catch(() => {
 *           // ignore — already deleted
 *         })
 *     — was NOT matched by the original regex (the comment text sits between
 *     the braces, so `\{\s*\}` failed). If we blanked the comment to spaces,
 *     the body would become `{   }` and START matching — a detection-behaviour
 *     change BEYOND this issue's scope that would grow counts above the
 *     baseline (which this issue must not touch). Blanking to `~` keeps the
 *     body as `{ ~~~ }`, preserving the original regex's exact verdict on
 *     that construct. So this fix changes ONE thing only: comment MENTIONS of
 *     the literal stop counting. Everything the old regex counted, it still
 *     counts; everything it skipped, it still skips.
 *
 * The stripper is a char-state machine that protects string / template /
 * regex literals so a `//` inside a string ("https://x") or a `/.../ ` regex
 * is not mistaken for a comment. It does NOT attempt full JS lexing; the
 * regex-vs-division heuristic errs toward treating `/` as division, which at
 * worst leaves a regex body in place as code — that can only keep a match
 * that was already there, never weaken real detection.
 */
const COMMENT_SENTINEL = '~'; // non-whitespace, not part of the catch pattern
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

function countSilentCatches(filePath) {
  const src = fs.readFileSync(filePath, 'utf8');
  // Equoria-fv6dp: count against comment-stripped source so explanatory
  // comments that mention the literal pattern are not false-counted.
  const code = stripComments(src);
  const matches = code.match(SILENT_CATCH_RE);
  return matches ? matches.length : 0;
}

function loadBaseline() {
  if (!fs.existsSync(BASELINE_PATH)) {
    console.error(`[silent-cleanup-catch] baseline not found at ${BASELINE_PATH}`);
    console.error('[silent-cleanup-catch] run the bootstrap step in the bd notes to regenerate.');
    process.exit(2);
  }
  return JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
}

function toRelKey(absPath) {
  return path.relative(REPO_ROOT, absPath).split(BACKSLASH).join('/');
}

function main() {
  const baseline = loadBaseline();
  const files = [];
  for (const d of TEST_GLOBS_DIRS) walk(path.join(REPO_ROOT, d), files);

  const violations = [];
  let observedTotal = 0;
  const seenInBaseline = new Set();

  for (const f of files) {
    const key = toRelKey(f);
    const observed = countSilentCatches(f);
    observedTotal += observed;
    const baselineCount = baseline[key] ?? 0;
    if (baselineCount > 0) {
      seenInBaseline.add(key);
    }
    if (observed > baselineCount) {
      violations.push({
        file: key,
        baseline: baselineCount,
        observed,
        delta: observed - baselineCount,
      });
    }
  }

  // A file LISTED in the baseline that no longer exists is fine (likely
  // renamed or deleted). We do NOT fail on that case — migration shrinks
  // the baseline. We DO fail when an existing file's count grew, or a new
  // file appeared with silent catches.

  if (violations.length > 0) {
    console.error('[silent-cleanup-catch] FAIL — silent cleanup-catch count grew above baseline:');
    for (const v of violations) {
      console.error(`  ${v.file}: baseline=${v.baseline}, observed=${v.observed} (+${v.delta})`);
    }
    console.error('');
    console.error('Fix:');
    console.error(
      '  - Replace `.catch(() => {})` with `.catch(err => console.warn(`[cleanup] ${err.message}`))`'
    );
    console.error('    or, better, let the cleanup throw (afterAll will fail loudly).');
    console.error(
      '  - See CONTRIBUTING.md § "Test Fixtures — Cleanup discipline" and Equoria-75odq.'
    );
    console.error('  - If you are MIGRATING (count went DOWN), update the baseline JSON to match.');
    process.exit(1);
  }

  const baselineTotal = Object.values(baseline).reduce((s, n) => s + n, 0);
  console.log(
    `[silent-cleanup-catch] OK — observed total=${observedTotal} <= baseline total=${baselineTotal} ` +
      `(${Object.keys(baseline).length} legacy files; ${seenInBaseline.size} still present)`
  );
}

main();
