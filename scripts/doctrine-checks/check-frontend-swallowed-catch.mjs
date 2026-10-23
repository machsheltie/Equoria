#!/usr/bin/env node
/**
 * Equoria-axl7d doctrine check: the frontend SWALLOWED-CATCH ratchet.
 *
 * `.claude/rules/FRONTEND_ASYNC_STATE_DOCTRINE.md` section 4 limits silent
 * catches to "genuine environment guards, image fallback, auth/CSRF internals,
 * or optimistic rollback whose call site visibly reports the failure". Nothing
 * stopped a NEW swallowed catch from entering frontend/src while the legacy
 * ones are burned down. This is the shrink-only ratchet that does.
 *
 * ── WHAT COUNTS AS A SWALLOWED CATCH ──────────────────────────────────────
 * A catch arm whose whole body is inert, so the failure never reaches the
 * player, a retry control, or a surface. Found on the TypeScript AST (so
 * comments, strings and JSX text can never fool it) in both shapes:
 *
 *   try { ... } catch (e) { <arm> }
 *   promise.catch(() => <arm>)  /  promise.catch(console.error)
 *
 * and the arm is swallowed when EVERY statement in it is one of:
 *   - nothing at all (empty, or comments only),
 *   - a `console.*(...)` call            (console-only),
 *   - a bare `return`, or a `return` of a constant (null / undefined / true /
 *     false / a number or string literal / `[]` / `{}`)   (fallback-only).
 * Anything else (a state setter, a thrown error, a rethrow, a call that tells
 * the player) makes the arm a handler, not a swallow, and is not counted.
 *
 * ── BLESSED CLASSES ───────────────────────────────────────────────────────
 * An arm that carries a marker comment naming a blessed class is exempt:
 *
 *   // swallowed-catch: storage-guard — private mode / quota; the value is a hint
 *
 * Classes: storage-guard, optimistic-rollback, image-placeholder,
 * api-client-internals. The marker may sit inside the catch block or on one of
 * the two lines directly above the `catch` / `.catch(`. A marker naming any
 * other class does NOT exempt (a typo must not become a free pass). Add a real
 * reason after the class.
 *
 * ── BASELINE ──────────────────────────────────────────────────────────────
 * frontend-swallowed-catch-baseline.json records the legacy count per file. It
 * may only SHRINK:
 *   - observed > baseline (or a file not on the baseline)  -> FAIL, new swallow
 *   - observed < baseline                                  -> FAIL, delete or
 *     decrement the entry in the SAME commit (leftover headroom is space a
 *     future regression hides under)
 *   - a baseline path that no longer exists                -> FAIL, stale entry
 *
 * Scope: frontend/src production code. Tests, `__tests__`, `src/test`,
 * stories and mocks are excluded; the doctrine governs what players run.
 * To remove one: surface the failure (InlineError / the surface's own state /
 * rethrow to the query layer), or, if it is a genuine blessed class, add the
 * marker with a reason.
 *
 * Optional argv[2]: alternate baseline JSON path (sentinel-test hook);
 * production callers pass no argument.
 * Run: `node scripts/doctrine-checks/check-frontend-swallowed-catch.mjs`
 * Auto-runs via scripts/doctrine-checks/run-all.sh (file-name glob).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { readScannedFileSyncTolerant, walkFiles } from '../lib/doctrine-scan-patterns.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..', '..');
const scanRoot = path.join(repoRoot, 'frontend', 'src');
const baselinePath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(scriptDir, 'frontend-swallowed-catch-baseline.json');

const LABEL = 'frontend-swallowed-catch';
const BACKSLASH = String.fromCharCode(92);
const scanFileRe = /\.(ts|tsx|js|jsx|mjs)$/;
const testFileRe = /\.(test|spec|stories)\.[a-z]+$/;
const skipDirs = new Set(['node_modules', 'dist', 'build', '__tests__', '__mocks__', 'test']);

export const blessedClasses = [
  'storage-guard',
  'optimistic-rollback',
  'image-placeholder',
  'api-client-internals',
];
const markerRe = /swallowed-catch:\s*([a-z-]+)/g;

const isConsoleCall = (expr) =>
  ts.isCallExpression(expr) &&
  ts.isPropertyAccessExpression(expr.expression) &&
  ts.isIdentifier(expr.expression.expression) &&
  expr.expression.expression.text === 'console';

/** `console.error` passed by reference, as in `.catch(console.error)`. */
const isConsoleRef = (expr) =>
  ts.isPropertyAccessExpression(expr) &&
  ts.isIdentifier(expr.expression) &&
  expr.expression.text === 'console';

/** A constant a catch arm can fall back to without telling anyone. */
function isConstantFallback(expr) {
  if (ts.isParenthesizedExpression(expr)) return isConstantFallback(expr.expression);
  switch (expr.kind) {
    case ts.SyntaxKind.NullKeyword:
    case ts.SyntaxKind.TrueKeyword:
    case ts.SyntaxKind.FalseKeyword:
    case ts.SyntaxKind.NumericLiteral:
    case ts.SyntaxKind.StringLiteral:
    case ts.SyntaxKind.NoSubstitutionTemplateLiteral:
      return true;
    case ts.SyntaxKind.Identifier:
      return expr.text === 'undefined';
    case ts.SyntaxKind.PrefixUnaryExpression:
      return ts.isNumericLiteral(expr.operand);
    case ts.SyntaxKind.ArrayLiteralExpression:
      return expr.elements.length === 0;
    case ts.SyntaxKind.ObjectLiteralExpression:
      return expr.properties.length === 0;
    default:
      return false;
  }
}

function isInertStatement(stmt) {
  if (ts.isEmptyStatement(stmt)) return true;
  if (ts.isExpressionStatement(stmt)) return isConsoleCall(stmt.expression);
  if (ts.isReturnStatement(stmt)) return !stmt.expression || isConstantFallback(stmt.expression);
  return false;
}

/** Is this catch-arm body (a block or a concise arrow expression) swallowed? */
function isSwallowedBody(body) {
  if (ts.isBlock(body)) return body.statements.every(isInertStatement);
  return isConsoleCall(body) || isConstantFallback(body);
}

/** Does the arm, or the two lines above it, carry a valid blessed marker? */
function hasBlessedMarker(node, sourceFile, lines) {
  const text = node.getText(sourceFile);
  const startLine = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line;
  const above = lines.slice(Math.max(0, startLine - 2), startLine).join('\n');
  for (const haystack of [text, above]) {
    for (const m of haystack.matchAll(markerRe)) {
      if (blessedClasses.includes(m[1])) return true;
    }
  }
  return false;
}

/**
 * Pure detector: the unblessed swallowed catch arms in `src`, as
 * [{ line, kind }] (1-based line). Exported for the sentinel.
 */
export function findSwallowedCatches(src, fileName = 'file.tsx') {
  const kind = /\.(tsx|jsx)$/.test(fileName) ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(fileName, src, ts.ScriptTarget.Latest, true, kind);
  const lines = src.split('\n');
  const found = [];

  const report = (node, shape) => {
    if (hasBlessedMarker(node, sourceFile, lines)) return;
    const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    found.push({ line: line + 1, kind: shape });
  };

  const visit = (node) => {
    if (ts.isCatchClause(node) && isSwallowedBody(node.block)) {
      report(node, 'try-catch');
    } else if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'catch' &&
      node.arguments.length === 1
    ) {
      const handler = node.arguments[0];
      if (isConsoleRef(handler)) {
        report(node, 'promise-catch');
      } else if (
        (ts.isArrowFunction(handler) || ts.isFunctionExpression(handler)) &&
        isSwallowedBody(handler.body)
      ) {
        report(node, 'promise-catch');
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return found;
}

function toRelKey(absPath) {
  return path.relative(repoRoot, absPath).split(BACKSLASH).join('/');
}

function loadBaseline() {
  if (!fs.existsSync(baselinePath)) {
    console.error(`[${LABEL}] baseline not found at ${baselinePath}`);
    process.exit(2);
  }
  return JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
}

function main() {
  const baseline = loadBaseline();

  const files = walkFiles([scanRoot], {
    skipDir: (name) => skipDirs.has(name),
    includeFile: (name) => scanFileRe.test(name) && !testFileRe.test(name),
  });

  const observedByFile = new Map();
  let observedTotal = 0;
  for (const f of files) {
    const src = readScannedFileSyncTolerant(f, LABEL);
    if (src === null) continue; // vanished mid-scan (ENOENT): skipped, noticed
    const hits = findSwallowedCatches(src, f);
    if (hits.length > 0) {
      observedByFile.set(toRelKey(f), hits);
      observedTotal += hits.length;
    }
  }

  const grew = [];
  const shrank = [];
  const stale = [];

  for (const [key, hits] of observedByFile) {
    const allowed = baseline[key] ?? 0;
    if (hits.length > allowed) grew.push({ key, allowed, hits });
  }
  for (const [key, allowed] of Object.entries(baseline)) {
    if (!fs.existsSync(path.join(repoRoot, ...key.split('/')))) {
      stale.push(key);
      continue;
    }
    const observed = observedByFile.get(key)?.length ?? 0;
    if (observed < allowed) shrank.push({ key, allowed, observed });
  }

  const baselineRel = toRelKey(baselinePath);
  const problems = [];
  if (grew.length > 0) {
    problems.push(`[${LABEL}] FAIL: swallowed catches grew above baseline:`);
    for (const g of grew) {
      problems.push(
        `  ${g.key}  baseline=${g.allowed}, observed=${g.hits.length} (+${g.hits.length - g.allowed})` +
          `  at line(s) ${g.hits.map((h) => h.line).join(', ')}`
      );
    }
    problems.push('');
    problems.push(
      'A catch whose whole body is empty, console-only or a constant fallback hides the'
    );
    problems.push('failure from the player (FRONTEND_ASYNC_STATE_DOCTRINE section 4). Fix it:');
    problems.push("  - surface the failure (InlineError / the surface's own state) or let it");
    problems.push('    propagate to the query layer; OR');
    problems.push('  - if it is a genuine blessed class, add a marker comment in the arm:');
    problems.push(`      // swallowed-catch: <${blessedClasses.join('|')}> - <reason>`);
  }
  if (stale.length > 0) {
    problems.push(`[${LABEL}] FAIL: stale baseline entries (file no longer exists on disk):`);
    for (const s of stale) problems.push(`  ${s}`);
  }
  if (shrank.length > 0) {
    problems.push(
      `[${LABEL}] FAIL: baseline headroom left behind (the swallow is gone; the entry is not):`
    );
    for (const s of shrank) {
      problems.push(`  ${s.key}  baseline=${s.allowed}, observed=${s.observed}`);
    }
  }
  if (problems.length > 0) {
    for (const l of problems) console.error(l);
    console.error('');
    console.error(`The baseline (${baselineRel}) may only SHRINK, never grow.`);
    console.error('Removed one? Decrement or delete that entry in the SAME commit.');
    console.error('See Equoria-axl7d.');
    process.exit(1);
  }

  const baselineTotal = Object.values(baseline).reduce((s, n) => s + n, 0);
  console.log(
    `[${LABEL}] OK: scanned ${files.length} frontend/src files; ${observedTotal} swallowed ` +
      `catches across ${observedByFile.size} files, exactly matching the baseline ` +
      `(total=${baselineTotal})`
  );
}

// Main-module guard: the sentinel imports findSwallowedCatches without scanning.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
