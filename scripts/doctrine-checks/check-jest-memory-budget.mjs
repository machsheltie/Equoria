#!/usr/bin/env node
/**
 * Jest memory-budget + mock-hygiene doctrine check (user directive 2026-08-18).
 *
 * Problem: jest runs kept OOM-bricking the 16GB laptop. The budget
 * (CONTRIBUTING.md 'Test-Run Resource Budget') was landed in
 * backend/jest.config.mjs and the canonical profile scripts, but the sibling
 * configs (optimized/performance/security) and ad-hoc scripts drifted —
 * jest.config.optimized.mjs was still spawning 50%/100% CPU workers, and
 * several scripts launched node with no heap ceiling. Any single drifted
 * config or script re-bricks the machine.
 *
 * This check walks EVERY live jest config (auto-discovered: jest.config*
 * at the repo root and under backend/, so new configs cannot dodge it) and
 * every package.json script that invokes jest directly, and enforces:
 *
 *   Config files:
 *   - maxWorkers, when set, is an integer <= 2 (never a percentage string)
 *   - workerIdleMemoryLimit is set (the RSS recycle governor)
 *   - forceExit === true (no zombie workers after the run)
 *   - clearMocks / resetMocks / restoreMocks / resetModules all true
 *     (per project block in multi-project configs)
 *   - detectOpenHandles is NOT hardcoded true — it implies --runInBand,
 *     which defeats the worker budget and OOMs full runs (measured
 *     2026-08-18). The sanctioned form is the env gate:
 *     `detectOpenHandles: process.env.DETECT_OPEN_HANDLES === 'true'`.
 *     (Configs are imported with DETECT_OPEN_HANDLES unset, so the gate
 *     evaluates false and only a hardcoded `true` fails.)
 *
 *   Scripts (root + backend package.json, any script whose command runs
 *   node_modules/jest/bin/jest.js directly):
 *   - must carry a --max-old-space-size= heap ceiling
 *   - must pin concurrency: --runInBand or --maxWorkers=1/2
 *
 * Sentinel hook: pass a config path as argv[2] to validate ONLY that file
 * (used by backend/__tests__/jestMemoryBudgetDoctrine.sentinel.test.mjs to
 * prove the check FIRES on a planted violation, per OPTIMAL_FIX §2).
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const HYGIENE_FLAGS = ['clearMocks', 'resetMocks', 'restoreMocks', 'resetModules'];
const MAX_WORKERS_CAP = 2;

function validateWorkerCap(label, value, failures) {
  if (value === undefined) return;
  if (!Number.isInteger(value) || value < 1 || value > MAX_WORKERS_CAP) {
    failures.push(
      `${label}: maxWorkers must be an integer <= ${MAX_WORKERS_CAP} (got ${JSON.stringify(value)}) — percentage allocations re-brick the laptop`
    );
  }
}

function validateHygieneBlock(label, block, failures) {
  for (const flag of HYGIENE_FLAGS) {
    if (block[flag] !== true) {
      failures.push(`${label}: ${flag} must be true (got ${JSON.stringify(block[flag])})`);
    }
  }
}

export function validateJestConfig(name, config, failures = []) {
  // Global-only budget knobs live at the top level.
  validateWorkerCap(`${name} (global)`, config.maxWorkers, failures);
  if (config.workerIdleMemoryLimit === undefined) {
    failures.push(`${name}: workerIdleMemoryLimit must be set (the RSS recycle governor)`);
  }
  if (config.forceExit !== true) {
    failures.push(`${name}: forceExit must be true (kills zombie workers after the run)`);
  }
  if (config.detectOpenHandles === true) {
    failures.push(
      `${name}: detectOpenHandles must not be hardcoded true (implies --runInBand; OOMs full runs). Use the DETECT_OPEN_HANDLES env gate.`
    );
  }

  // Mock/module hygiene: per project block in multi-project configs,
  // top level otherwise.
  if (Array.isArray(config.projects)) {
    for (const project of config.projects) {
      const label = `${name} (project '${project.displayName ?? '?'}')`;
      validateHygieneBlock(label, project, failures);
      validateWorkerCap(label, project.maxWorkers, failures);
      if (project.detectOpenHandles === true) {
        failures.push(
          `${label}: detectOpenHandles must not be hardcoded true. Use the DETECT_OPEN_HANDLES env gate.`
        );
      }
    }
  } else {
    validateHygieneBlock(name, config, failures);
  }
  return failures;
}

export function validateJestScripts(pkgLabel, scripts, failures = []) {
  for (const [scriptName, command] of Object.entries(scripts ?? {})) {
    if (!/node_modules[/\\]jest[/\\]bin[/\\]jest\.js/.test(command)) continue;
    const label = `${pkgLabel} scripts.${scriptName}`;
    if (!command.includes('--max-old-space-size=')) {
      failures.push(`${label}: missing --max-old-space-size= heap ceiling`);
    }
    const pinned =
      command.includes('--runInBand') ||
      /--maxWorkers=[12](?:\s|$|")/.test(command) ||
      /--maxWorkers=[12]\b/.test(command);
    if (!pinned) {
      failures.push(`${label}: missing concurrency pin (--runInBand or --maxWorkers=1/2)`);
    }
  }
  return failures;
}

function discoverConfigFiles() {
  const files = [];
  for (const dir of ['', 'backend']) {
    const abs = path.join(ROOT, dir);
    if (!existsSync(abs)) continue;
    for (const entry of readdirSync(abs)) {
      if (/^jest\.config.*\.(mjs|js|cjs)$/.test(entry)) {
        files.push(path.join(abs, entry));
      }
    }
  }
  return files;
}

async function importConfig(file) {
  // Import with the opt-in gate unset so env-gated detectOpenHandles
  // evaluates false and only hardcoded `true` trips the check.
  delete process.env.DETECT_OPEN_HANDLES;
  const mod = await import(pathToFileURL(file).href);
  return mod.default;
}

async function main() {
  const failures = [];
  const singleTarget = process.argv[2];

  if (singleTarget) {
    const abs = path.resolve(singleTarget);
    const config = await importConfig(abs);
    validateJestConfig(path.basename(abs), config, failures);
  } else {
    for (const file of discoverConfigFiles()) {
      const rel = path.relative(ROOT, file).replaceAll('\\', '/');
      let config;
      try {
        config = await importConfig(file);
      } catch (err) {
        failures.push(`${rel}: failed to import config (${err.message})`);
        continue;
      }
      validateJestConfig(rel, config, failures);
    }
    for (const pkgRel of ['package.json', 'backend/package.json']) {
      const pkg = JSON.parse(readFileSync(path.join(ROOT, pkgRel), 'utf8'));
      validateJestScripts(pkgRel, pkg.scripts, failures);
    }
  }

  if (failures.length) {
    for (const failure of failures) {
      console.error(`[jest-memory-budget] ${failure}`);
    }
    process.exit(1);
  }
  console.log('[jest-memory-budget] PASS');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  await main();
}
