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
 *   Spawner scripts (Equoria-5mtzl — every .mjs under scripts/ and
 *   backend/scripts/ that launches the jest binary via child_process):
 *   - any literal --max-old-space-size above 1536 fails, as does a jest
 *     spawn carrying no --max-old-space-size= at all. Dynamic caps
 *     (`--max-old-space-size=${VAR}`) satisfy the presence check; their
 *     values are pinned by check-backend-test-profiles.mjs canonical
 *     commands.
 *   - the ONLY escape is an explicit per-file allowlist marker:
 *       // doctrine-allow: jest-heap-exception Equoria-<id> <reason>
 *     Sole current holder: backend/scripts/diagnose-full-suite.mjs
 *     (8192MB diagnostic headroom for whole-suite footprint measurement,
 *     manual-run-only — Equoria-5mtzl).
 *
 * Sentinel hooks: pass a config path as argv[2] to validate ONLY that file;
 * pass `--spawner <path>` to validate ONLY that spawner script (both used by
 * backend/__tests__/jestMemoryBudgetDoctrine.sentinel.test.mjs to prove the
 * check FIRES on planted violations, per OPTIMAL_FIX §2).
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

const SPAWNER_HEAP_CAP_MB = 1536;
// Explicit per-file exception channel (Equoria-5mtzl). Requires an issue id
// AND a reason — a bare marker with no rationale does not count.
const SPAWNER_ALLOW_MARKER =
  /\/\/\s*doctrine-allow:\s*jest-heap-exception\s+Equoria-[A-Za-z0-9.-]+\s+\S/;
// A file is a jest SPAWNER when it touches child_process AND references the
// jest binary path (slash-joined or path.join('jest', 'bin', 'jest.js')
// style). Requiring both keys out reap-orphan-jest.mjs (kills jest workers,
// never launches them) and the doctrine checks that merely name jest.js in
// canonical-command strings.
const JEST_BINARY_RE = /jest[/\\'",\s)]*bin[/\\'",\s)]*jest\.js/;

export function validateJestSpawnerScript(label, source, failures = []) {
  if (!source.includes('child_process') || !JEST_BINARY_RE.test(source)) {
    return failures; // not a jest spawner — out of scope
  }
  if (SPAWNER_ALLOW_MARKER.test(source)) {
    return failures; // documented, user-sanctioned exception (Equoria-5mtzl)
  }
  if (!source.includes('--max-old-space-size=')) {
    failures.push(
      `${label}: spawns jest with no --max-old-space-size= heap ceiling — every jest spawn needs the ${SPAWNER_HEAP_CAP_MB}MB budget cap (or a '// doctrine-allow: jest-heap-exception Equoria-<id> <reason>' marker for a user-sanctioned diagnostic exception)`
    );
    return failures;
  }
  const reported = new Set();
  for (const match of source.matchAll(/--max-old-space-size=(\d+)/g)) {
    const heapMb = Number(match[1]);
    if (heapMb > SPAWNER_HEAP_CAP_MB && !reported.has(heapMb)) {
      reported.add(heapMb);
      failures.push(
        `${label}: spawns jest with --max-old-space-size=${heapMb}, above the ${SPAWNER_HEAP_CAP_MB}MB budget — lower it or carry '// doctrine-allow: jest-heap-exception Equoria-<id> <reason>' for a user-sanctioned diagnostic exception`
      );
    }
  }
  return failures;
}

function discoverSpawnerScripts() {
  const files = [];
  const self = fileURLToPath(import.meta.url);
  const walk = (abs) => {
    for (const entry of readdirSync(abs, { withFileTypes: true })) {
      const full = path.join(abs, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules') walk(full);
      } else if (entry.name.endsWith('.mjs') && path.resolve(full) !== self) {
        files.push(full);
      }
    }
  };
  for (const dir of ['scripts', 'backend/scripts']) {
    const abs = path.join(ROOT, dir);
    if (existsSync(abs)) walk(abs);
  }
  return files;
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

  if (singleTarget === '--spawner') {
    const abs = path.resolve(process.argv[3]);
    validateJestSpawnerScript(path.basename(abs), readFileSync(abs, 'utf8'), failures);
  } else if (singleTarget) {
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
    for (const file of discoverSpawnerScripts()) {
      const rel = path.relative(ROOT, file).replaceAll('\\', '/');
      validateJestSpawnerScript(rel, readFileSync(file, 'utf8'), failures);
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
