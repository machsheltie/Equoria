#!/usr/bin/env node
/**
 * Playwright workers-budget doctrine check (Equoria-ya5wn, user directive
 * 2026-08-18 — test runs must never OOM-brick the 16GB laptop).
 *
 * Problem: playwright.config.ts shipped `workers: process.env.CI ? 1 :
 * undefined` — CI was pinned but LOCAL runs fell through to Playwright's
 * default (50% of logical cores). Each Playwright worker is a full browser
 * context driving the real backend, so the unbounded local pool is the same
 * laptop-bricking class as the pre-2026-08-18 jest 50%-workers configs
 * (found via the sibling Got Soap project's audit of the identical pattern).
 *
 * Playwright configs are TypeScript, so this is a source scan (same posture
 * as the jest spawner scan in check-jest-memory-budget.mjs), not an import.
 * For every playwright*.config.{ts,mts,js,mjs} at the repo root and under
 * frontend/, it enforces on the `workers:` expression:
 *
 *   - the property must be PRESENT (absent = Playwright's per-CPU default)
 *   - `undefined` must not appear in it (an unbounded fall-through branch)
 *   - no percentage allocation ('50%'-style strings)
 *   - every numeric literal in it is an integer <= 2 (the laptop cap; CI's
 *     `1` and the local `2` both satisfy this)
 *
 * A dynamic expression with no literals (e.g. an env-var cap) satisfies the
 * presence check, mirroring the spawner scan's dynamic-cap posture. The only
 * escape for a genuine exception is the explicit per-file marker:
 *   // doctrine-allow: playwright-workers-exception Equoria-<id> <reason>
 * (no current holders).
 *
 * Sentinel hook: pass a config path as argv[2] to validate ONLY that file
 * (used by backend/__tests__/playwrightWorkersBudgetDoctrine.sentinel.test.mjs
 * to prove the check FIRES on planted violations, per OPTIMAL_FIX §2).
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const WORKERS_CAP = 2;
// Explicit per-file exception channel. Requires an issue id AND a reason —
// a bare marker with no rationale does not count.
const ALLOW_MARKER =
  /\/\/\s*doctrine-allow:\s*playwright-workers-exception\s+Equoria-[A-Za-z0-9.-]+\s+\S/;

export function validatePlaywrightConfigSource(label, source, failures = []) {
  if (ALLOW_MARKER.test(source)) {
    return failures; // documented, user-sanctioned exception
  }
  // The workers expression is single-line in house style; capture to EOL and
  // strip a trailing comma. A multi-line expression only surfaces its first
  // line, which still carries any `undefined`/percentage in practice.
  const match = source.match(/(?:^|[\s{])workers\s*:\s*([^\n]+)/);
  if (!match) {
    failures.push(
      `${label}: no 'workers:' setting — Playwright defaults to 50% of logical cores, which re-bricks the laptop. Pin local workers <= ${WORKERS_CAP}.`
    );
    return failures;
  }
  const expr = match[1].replace(/,\s*$/, '').trim();
  if (/\bundefined\b/.test(expr)) {
    failures.push(
      `${label}: workers expression (${expr}) contains 'undefined' — that branch falls through to Playwright's per-CPU default. Replace it with an integer <= ${WORKERS_CAP}.`
    );
  }
  if (/['"]\d+%['"]/.test(expr)) {
    failures.push(
      `${label}: workers expression (${expr}) uses a percentage allocation — forbidden, same class as jest percentage maxWorkers.`
    );
  }
  for (const literal of expr.matchAll(/\b(\d+)\b/g)) {
    const value = Number(literal[1]);
    if (value < 1 || value > WORKERS_CAP) {
      failures.push(
        `${label}: workers expression (${expr}) contains ${value}, above the laptop cap of ${WORKERS_CAP}`
      );
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
      if (/^playwright.*\.config\.(ts|mts|js|mjs)$/.test(entry)) {
        files.push(path.join(abs, entry));
      }
    }
  }
  return files;
}

function main() {
  const failures = [];
  const singleTarget = process.argv[2];

  if (singleTarget) {
    const abs = path.resolve(singleTarget);
    validatePlaywrightConfigSource(path.basename(abs), readFileSync(abs, 'utf8'), failures);
  } else {
    const files = discoverConfigFiles();
    if (files.length === 0) {
      failures.push(
        'no playwright*.config.* found at repo root or frontend/ — discovery is broken, not the tree'
      );
    }
    for (const file of files) {
      const rel = path.relative(ROOT, file).replaceAll('\\', '/');
      validatePlaywrightConfigSource(rel, readFileSync(file, 'utf8'), failures);
    }
  }

  if (failures.length) {
    for (const failure of failures) {
      console.error(`[playwright-workers-budget] ${failure}`);
    }
    process.exit(1);
  }
  console.log('[playwright-workers-budget] PASS');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main();
}
