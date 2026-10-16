/**
 * Plant, hygiene and run helpers of backend/__tests__/scripts/moduleDependencyGraphDoctrine.sentinel.test.mjs
 * (Equoria-q4uem.4). Moved here unchanged when the sentinel crossed the 800-line test cap
 * (Equoria-rfv9j round); jest collects only *.test.mjs files, so this module is never a suite.
 *
 * Plant hygiene (Equoria-or7o5, S5 review M7): every plant has a unique per-run name; EVERY
 * directory created is recorded in `planted` and removed deepest-first by cleanupPlants(), which
 * asserts absence with lstat (a dangling symlink plant counts as present); strayPlants() scans
 * backend/modules (two levels) and backend/utils for the plant token and tolerates ONLY a foreign
 * directory vanishing mid-scan (Equoria-rfv9j). The gate names the same token in OWN_PLANT_TOKENS.
 */

import { expect } from '@jest/globals';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(HERE, '..', '..', '..');
export const CHECK = path.join(
  REPO_ROOT,
  'scripts/doctrine-checks/check-module-dependency-graph.mjs',
);
export const ALLOWLIST = path.join(
  REPO_ROOT,
  'scripts/doctrine-checks/module-dependency-graph-allowlist.json',
);
export const MODULES = path.join(REPO_ROOT, 'backend/modules');
export const UTILS = path.join(REPO_ROOT, 'backend/utils');
export const RUN_ID = `${process.pid}-${randomBytes(4).toString('hex')}`;
export const PLANT_TOKEN = '_ws4graphplant_';
export const PLANT_MODULE = `${PLANT_TOKEN}${RUN_ID}`;
export const PLANT_MODULE_B = `${PLANT_TOKEN}${RUN_ID}b`;
export const TEST_LABEL =
  "// Test-consumed only (other modules' tests; Equoria-7t1tn tracks moving those tests\n// into the owning module, after which these lines go).\n";
export const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export const relPosix = abs => path.relative(REPO_ROOT, abs).split(path.sep).join('/');
export const PM = `backend/modules/${PLANT_MODULE}`;
export const PMB = `backend/modules/${PLANT_MODULE_B}`;

/** Every path this suite creates (files and EVERY new directory), removed deepest-first in afterEach. */
export const planted = [];

export function plantFile(relFromModules, content) {
  const abs = path.join(MODULES, relFromModules);
  // Record every directory that does not exist yet, shallowest first, so the reverse
  // order of `planted` removes the deepest first and no parent is left behind (M7).
  const missing = [];
  for (let dir = path.dirname(abs); !fs.existsSync(dir); dir = path.dirname(dir)) {
    missing.unshift(dir);
  }
  for (const dir of missing) {
    fs.mkdirSync(dir);
    planted.push(dir);
  }
  fs.writeFileSync(abs, content);
  planted.push(abs);
  return abs;
}

/** True when the path itself is present — lstat, so a DANGLING symlink plant counts as present (existsSync follows the link and says false). */
export function pathPresent(p) {
  try {
    fs.lstatSync(p);
    return true;
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      return false;
    }
    throw err;
  }
}

export function cleanupPlants() {
  for (const p of [...planted].reverse()) {
    fs.rmSync(p, { recursive: true, force: true });
  }
  for (const p of planted) {
    expect(pathPresent(p)).toBe(false);
  }
  planted.length = 0;
}

/** readdir that tolerates ONLY a vanished directory (a sibling suite's transient plant dir, Equoria-rfv9j). */
export function readdirOrEmpty(dir) {
  try {
    return fs.readdirSync(dir);
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      return [];
    }
    throw err;
  }
}

/** No file or directory carrying the plant token under backend/modules (two levels) or backend/utils. */
export function strayPlants() {
  const found = [];
  for (const top of readdirOrEmpty(MODULES)) {
    if (top.includes(PLANT_TOKEN)) {
      found.push(top);
    }
    const abs = path.join(MODULES, top);
    // A foreign transient directory can vanish between the listing and this descent; it holds
    // none of OUR plants, so it contributes nothing (ENOENT only; anything else still throws).
    let isDir = false;
    try {
      isDir = fs.statSync(abs).isDirectory();
    } catch (err) {
      if (!(err && err.code === 'ENOENT')) {
        throw err;
      }
    }
    if (isDir) {
      for (const inner of readdirOrEmpty(abs)) {
        if (inner.includes(PLANT_TOKEN)) {
          found.push(`${top}/${inner}`);
        }
      }
    }
  }
  for (const name of readdirOrEmpty(UTILS)) {
    if (name.includes(PLANT_TOKEN)) {
      found.push(`utils/${name}`);
    }
  }
  return found;
}

export function runCheck(args = []) {
  const res = spawnSync('node', [CHECK, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
  return { status: res.status, out: `${res.stdout}\n${res.stderr}` };
}

/** Run the check with one extra allow-list entry, then restore the file byte-for-byte. */
export function runWithExtraAllowlistEntry(section, key) {
  const original = fs.readFileSync(ALLOWLIST, 'utf8');
  try {
    const json = JSON.parse(original);
    json[section][key] = {
      reason: 'Sentinel plant: a pinned entry that no longer matches anything on disk (stale).',
      issue: 'Equoria-q4uem.4',
    };
    fs.writeFileSync(ALLOWLIST, `${JSON.stringify(json, null, 2)}\n`);
    return runCheck();
  } finally {
    fs.writeFileSync(ALLOWLIST, original);
    expect(fs.readFileSync(ALLOWLIST, 'utf8')).toBe(original);
  }
}
