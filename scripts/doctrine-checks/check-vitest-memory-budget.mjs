#!/usr/bin/env node
/**
 * Vitest memory-budget doctrine check (Equoria-7br8i, user directive 2026-08-18).
 *
 * Problem: the 2026-08-18 jest hardening (check-jest-memory-budget.mjs) bound
 * every JEST path to the laptop budget, but the frontend suite (~6075 tests)
 * runs under VITEST, which had no equivalent bound. Audit findings on the
 * 24-CPU / 16GB dev machine (Vitest 4.1.9 runtime, verified in
 * node_modules/vitest/dist/chunks/cli-api.*.js):
 *   - node pools (threads/forks) default maxWorkers to cpus - 1 (= 23 here);
 *   - the browser pool defaults to min(12, cpus - 1) (= 12 here) when
 *     headless and no maxWorkers is set;
 *   - forks inherit V8's default old-space (~4GB on 16GB RAM) when no
 *     --max-old-space-size execArgv is passed.
 * The unit project was pinned at 4 forks with no heap ceiling and the
 * storybook browser project was fully unbounded — the same shape that
 * OOM-bricked the laptop under jest.
 *
 * This check walks every live vitest config (vitest.config.* / vitest.workspace.*
 * at the repo root and under frontend/, plus any vite.config.* carrying a
 * `test:` block) and enforces, per project block (or the whole test config
 * when there is no projects array):
 *
 *   - maxWorkers is PRESENT (absence means the CPU-derived default applies)
 *   - maxWorkers is a literal integer <= 2 (never a percentage string or a
 *     computed expression the check cannot audit)
 *   - non-browser blocks (node pools) carry an execArgv containing a
 *     --max-old-space-size= heap ceiling (browser blocks are chromium pages,
 *     not node processes — execArgv does not apply there)
 *
 * and, mirroring the jest dual pin, that every package.json script (root +
 * frontend) that invokes vitest directly carries --maxWorkers=1/2 so script
 * drift cannot re-parallelize past the config.
 *
 * NOTE — why textual parsing, not import: vitest.config.ts is TypeScript and
 * imports vite/storybook/playwright plugins; importing it from a bare node
 * doctrine script would need a TS loader plus executing plugin factories.
 * The check therefore does a comment-stripped, string-aware structural scan
 * (house precedent: check-file-size-thresholds.mjs and the rethrow-after-log
 * gate are also text-based). Values must be LITERALS so the scan cannot be
 * fooled — an expression like `maxWorkers: cpus()` fails the check by design.
 * The one sanctioned non-literal is the execArgv heap template
 * `--max-old-space-size=${process.env.CI ? 4096 : 1536}` (CI headroom mirror
 * of the jest posture), which still contains the literal flag prefix the
 * check looks for.
 *
 * There is no vitest forks-pool equivalent of jest's workerIdleMemoryLimit
 * (Vitest 4's memoryLimit recycle applies only to vmThreads/vmForks), so the
 * enforceable budget here is: worker cap + per-fork heap ceiling + isolate.
 *
 * Sentinel hook: pass a config path as argv[2] to validate ONLY that file
 * (used by backend/__tests__/vitestMemoryBudgetDoctrine.sentinel.test.mjs to
 * prove the check FIRES on a planted violation, per OPTIMAL_FIX §2).
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const MAX_WORKERS_CAP = 2;

/**
 * Strip // line comments and /* block comments while respecting '\'' / '"'
 * / '`' strings, so commented-out settings (or prose mentioning maxWorkers)
 * can never satisfy or trip the check.
 */
export function stripComments(source) {
  let out = '';
  let i = 0;
  let mode = 'code'; // code | line | block | squote | dquote | template
  while (i < source.length) {
    const ch = source[i];
    const next = source[i + 1];
    if (mode === 'code') {
      if (ch === '/' && next === '/') {
        mode = 'line';
        i += 2;
        continue;
      }
      if (ch === '/' && next === '*') {
        mode = 'block';
        i += 2;
        continue;
      }
      if (ch === "'") mode = 'squote';
      else if (ch === '"') mode = 'dquote';
      else if (ch === '`') mode = 'template';
      out += ch;
      i += 1;
      continue;
    }
    if (mode === 'line') {
      if (ch === '\n') {
        mode = 'code';
        out += ch;
      }
      i += 1;
      continue;
    }
    if (mode === 'block') {
      if (ch === '*' && next === '/') {
        mode = 'code';
        i += 2;
        continue;
      }
      i += 1;
      continue;
    }
    // Inside a string: copy verbatim, honor escapes, exit on the matching quote.
    if (ch === '\\') {
      out += ch + (next ?? '');
      i += 2;
      continue;
    }
    if (
      (mode === 'squote' && ch === "'") ||
      (mode === 'dquote' && ch === '"') ||
      (mode === 'template' && ch === '`')
    ) {
      mode = 'code';
    }
    out += ch;
    i += 1;
  }
  return out;
}

/**
 * Slice the top-level object elements out of the `projects: [ ... ]` array
 * via a string-aware brace/bracket walk. Returns null when the config has no
 * projects array (single-project config — validate the whole text as one
 * block instead).
 */
export function extractProjectBlocks(strippedSource) {
  const keyMatch = /\bprojects\s*:\s*\[/.exec(strippedSource);
  if (!keyMatch) return null;
  const start = keyMatch.index + keyMatch[0].length;
  const blocks = [];
  let depth = 0; // brace depth inside the array
  let bracket = 1; // the projects [ itself
  let blockStart = -1;
  let mode = 'code';
  for (let i = start; i < strippedSource.length; i += 1) {
    const ch = strippedSource[i];
    if (mode !== 'code') {
      if (ch === '\\') {
        i += 1;
        continue;
      }
      if (
        (mode === 'squote' && ch === "'") ||
        (mode === 'dquote' && ch === '"') ||
        (mode === 'template' && ch === '`')
      ) {
        mode = 'code';
      }
      continue;
    }
    if (ch === "'") mode = 'squote';
    else if (ch === '"') mode = 'dquote';
    else if (ch === '`') mode = 'template';
    else if (ch === '[') bracket += 1;
    else if (ch === ']') {
      bracket -= 1;
      if (bracket === 0) break; // end of projects array
    } else if (ch === '{') {
      if (depth === 0 && bracket === 1) blockStart = i;
      depth += 1;
    } else if (ch === '}') {
      depth -= 1;
      if (depth === 0 && bracket === 1 && blockStart !== -1) {
        blocks.push(strippedSource.slice(blockStart, i + 1));
        blockStart = -1;
      }
    }
  }
  return blocks;
}

function blockLabel(block, index) {
  const nameMatch = /\bname\s*:\s*['"]([^'"]+)['"]/.exec(block);
  return nameMatch ? `project '${nameMatch[1]}'` : `project #${index}`;
}

function validateBlock(fileLabel, label, block, failures) {
  const isBrowser = /\bbrowser\s*:\s*\{/.test(block);
  const workerMatches = [...block.matchAll(/\bmaxWorkers\s*:\s*([^,\n}]+)/g)];
  if (workerMatches.length === 0) {
    failures.push(
      `${fileLabel} (${label}): missing maxWorkers — vitest defaults to ${
        isBrowser ? 'min(12, cpus - 1) browser page-workers' : 'cpus - 1 node workers'
      }, which re-bricks the laptop`
    );
  }
  for (const match of workerMatches) {
    const value = match[1].trim();
    if (!/^[12]$/.test(value)) {
      failures.push(
        `${fileLabel} (${label}): maxWorkers must be a literal integer <= ${MAX_WORKERS_CAP} (got ${JSON.stringify(value)}) — percentages and computed expressions are unauditable and re-parallelize`
      );
    }
  }
  if (!isBrowser) {
    const hasHeapCeiling = /\bexecArgv\s*:/.test(block) && block.includes('--max-old-space-size=');
    if (!hasHeapCeiling) {
      failures.push(
        `${fileLabel} (${label}): node-pool block missing execArgv --max-old-space-size= heap ceiling — each fork inherits V8's ~4GB default on a 16GB machine`
      );
    }
  }
}

export function validateVitestConfigSource(fileLabel, source, failures = []) {
  const stripped = stripComments(source);
  // The hanging-process reporter is a heavy diagnostic (Vitest docs: enable
  // only when Vitest cannot exit) — the detectOpenHandles analog. It must be
  // env-gated (VITEST_HANGING_PROCESS), never hardcoded into a standing run.
  if (stripped.includes('hanging-process') && !stripped.includes('VITEST_HANGING_PROCESS')) {
    failures.push(
      `${fileLabel}: 'hanging-process' reporter must not be hardcoded (heavy diagnostic). Use the VITEST_HANGING_PROCESS env gate.`
    );
  }
  const blocks = extractProjectBlocks(stripped);
  if (blocks === null) {
    validateBlock(fileLabel, 'test config', stripped, failures);
  } else if (blocks.length === 0) {
    failures.push(
      `${fileLabel}: projects array present but no project blocks parsed — check the config shape`
    );
  } else {
    blocks.forEach((block, i) => validateBlock(fileLabel, blockLabel(block, i), block, failures));
  }
  return failures;
}

export function validateVitestScripts(pkgLabel, scripts, failures = []) {
  for (const [scriptName, command] of Object.entries(scripts ?? {})) {
    // Direct vitest invocations only (word-boundary; `storybook` etc. don't match).
    if (!/(^|[\s&;("'])vitest(\s|$)/.test(command)) continue;
    const label = `${pkgLabel} scripts.${scriptName}`;
    if (!/--maxWorkers=[12]\b/.test(command)) {
      failures.push(`${label}: missing concurrency pin (--maxWorkers=1 or --maxWorkers=2)`);
    }
  }
  return failures;
}

function discoverConfigFiles() {
  const files = [];
  for (const dir of ['', 'frontend']) {
    const abs = path.join(ROOT, dir);
    if (!existsSync(abs)) continue;
    for (const entry of readdirSync(abs)) {
      const full = path.join(abs, entry);
      if (/^(vitest\.config|vitest\.workspace)\.[cm]?[jt]s$/.test(entry)) {
        files.push(full);
      } else if (/^vite\.config\.[cm]?[jt]s$/.test(entry)) {
        // vite configs only count when they embed a vitest `test:` block.
        const text = stripComments(readFileSync(full, 'utf8'));
        if (/\btest\s*:\s*\{/.test(text)) files.push(full);
      }
    }
  }
  return files;
}

async function main() {
  const failures = [];
  const singleTarget = process.argv[2];

  if (singleTarget) {
    const abs = path.resolve(singleTarget);
    validateVitestConfigSource(path.basename(abs), readFileSync(abs, 'utf8'), failures);
  } else {
    const configs = discoverConfigFiles();
    if (configs.length === 0) {
      failures.push('no vitest config discovered — the frontend suite would run on defaults');
    }
    for (const file of configs) {
      const rel = path.relative(ROOT, file).replaceAll('\\', '/');
      validateVitestConfigSource(rel, readFileSync(file, 'utf8'), failures);
    }
    for (const pkgRel of ['package.json', 'frontend/package.json']) {
      const pkgPath = path.join(ROOT, pkgRel);
      if (!existsSync(pkgPath)) continue;
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
      validateVitestScripts(pkgRel, pkg.scripts, failures);
    }
  }

  if (failures.length) {
    for (const failure of failures) {
      console.error(`[vitest-memory-budget] ${failure}`);
    }
    process.exit(1);
  }
  console.log('[vitest-memory-budget] PASS');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  await main();
}
