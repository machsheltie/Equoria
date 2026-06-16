#!/usr/bin/env node
/**
 * Sharded serial test runner (Equoria).
 *
 * Runs the backend Jest suite in BATCHES, each a FRESH `jest --runInBand`
 * process executed SEQUENTIALLY (never concurrently).
 *
 * Why this exists: the monolithic `jest --runInBand` over all ~240 test files
 * runs every file in ONE Node process. Per-file native handles (timers,
 * listeners) and V8 heap accumulate across the run; by file ~200 the process
 * is GC-thrashing and every DB round-trip crawls (a single suite that runs in
 * ~3s alone took 773s late in the monolithic run). Splitting into fresh
 * processes resets the heap between batches, so total wall time drops from
 * ~95min to a few minutes.
 *
 * Why serial (not `--maxWorkers`): the project forbids parallel workers on the
 * real DB — concurrent fixture access produced non-deterministic FK/isolation
 * flakes (pre-push hook history, PRs #105-106). Running batches sequentially
 * keeps DB access serial, preserving that determinism, while still getting the
 * fresh-process heap reset.
 *
 * Each batch has a hard wall-clock timeout (spawnSync `timeout`) so a single
 * pathological file can never stall the machine for hours.
 *
 * Usage:
 *   node scripts/run-suite-sharded.mjs [--jest-shards=8] [--timeout=600] [--heap=4096]
 *   node scripts/run-suite-sharded.mjs [--batch-size=25] [--timeout=600] [--heap=4096] [pattern]
 *     --jest-shards Jest hash shards, run sequentially in fresh processes
 *     --batch-size  test files per fresh process (default 25)
 *     --timeout     hard per-batch wall-clock cap in seconds (default 600)
 *     --heap        --max-old-space-size for each batch process in MB (default 4096)
 *     pattern       optional jest testPathPattern to subset the run
 *
 * Exit code: 0 if every batch passed; 1 if any batch failed or timed out.
 */
import { spawnSync, execSync } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const a = args.find(x => x.startsWith(`--${name}=`));
  return a ? a.split('=')[1] : def;
};

function parseIntegerOption(
  name,
  fallback,
  { allowZero = false, max = Number.MAX_SAFE_INTEGER } = {},
) {
  const raw = opt(name, fallback);
  if (!/^\d+$/.test(raw)) {
    throw new Error(`--${name} must be an integer; received ${JSON.stringify(raw)}`);
  }
  const value = Number.parseInt(raw, 10);
  if (value < (allowZero ? 0 : 1)) {
    throw new Error(`--${name} must be ${allowZero ? 'zero or greater' : 'greater than zero'}`);
  }
  if (value > max) {
    throw new Error(`--${name} must not exceed ${max}`);
  }
  return value;
}

const BATCH_SIZE = parseIntegerOption('batch-size', '25');
const BATCH_TIMEOUT_MS = parseIntegerOption('timeout', '600') * 1000;
const HEAP_MB = parseIntegerOption('heap', '4096');
const JEST_SHARDS = parseIntegerOption('jest-shards', '0', { allowZero: true, max: 100 });
const pattern = args.find(x => !x.startsWith('--'));

const JEST = 'node_modules/jest/bin/jest.js';
const tmp = mkdtempSync(path.join(tmpdir(), 'equoria-shard-'));

function listTestFiles() {
  // jest --listTests prints one absolute path per line on stdout.
  const cmd = ['node', '--experimental-vm-modules', JEST, '--listTests'];
  if (pattern) {
    cmd.push(JSON.stringify(pattern));
  }
  const out = execSync(cmd.join(' '), { encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 });
  return out
    .split('\n')
    .map(s => s.trim())
    .filter(f => f.endsWith('.test.mjs') || f.endsWith('.test.js'));
}

function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) {
    out.push(arr.slice(i, i + n));
  }
  return out;
}

const files = JEST_SHARDS ? [] : listTestFiles();
if (!JEST_SHARDS && files.length === 0) {
  console.error('[shard] No test files matched. Aborting.');
  process.exit(1);
}
const batches = JEST_SHARDS
  ? Array.from({ length: JEST_SHARDS }, (_, index) => ({
      label: `shard ${index + 1}/${JEST_SHARDS}`,
      jestArgs: [`--shard=${index + 1}/${JEST_SHARDS}`],
    }))
  : chunk(files, BATCH_SIZE).map((batch, index) => ({
      label: `batch ${index + 1}`,
      jestArgs: ['--runTestsByPath', ...batch],
      files: batch,
    }));

if (JEST_SHARDS) {
  console.log(
    `[shard] ${JEST_SHARDS} Jest hash shards, sequential fresh processes ` +
      `(heap ${HEAP_MB}MB, hard cap ${BATCH_TIMEOUT_MS / 1000}s each).`,
  );
} else {
  console.log(
    `[shard] ${files.length} test files in ${batches.length} batches of ${BATCH_SIZE} ` +
      `(per-batch heap ${HEAP_MB}MB, hard cap ${BATCH_TIMEOUT_MS / 1000}s, serial).`,
  );
}

let totalSuites = 0,
  passedSuites = 0,
  failedSuites = 0,
  totalTests = 0,
  passedTests = 0,
  failedTests = 0;
const failedSuiteNames = [];
const problemBatches = [];
const startAll = Date.now();

for (let i = 0; i < batches.length; i++) {
  const batch = batches[i];
  const jsonFile = path.join(tmp, `batch-${i}.json`);
  const t0 = Date.now();
  const res = spawnSync(
    'node',
    [
      `--max-old-space-size=${HEAP_MB}`,
      '--experimental-vm-modules',
      JEST,
      '--runInBand',
      '--retryTimes=1',
      '--json',
      `--outputFile=${jsonFile}`,
      ...batch.jestArgs,
    ],
    {
      encoding: 'utf8',
      timeout: BATCH_TIMEOUT_MS,
      killSignal: 'SIGKILL',
      maxBuffer: 256 * 1024 * 1024,
    },
  );
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  const timedOut = res.error && res.error.code === 'ETIMEDOUT';

  let summary = '';
  let jsonParsed = false;
  if (existsSync(jsonFile)) {
    try {
      const j = JSON.parse(readFileSync(jsonFile, 'utf8'));
      jsonParsed = true;
      totalSuites += j.numTotalTestSuites || 0;
      passedSuites += j.numPassedTestSuites || 0;
      failedSuites += j.numFailedTestSuites || 0;
      totalTests += j.numTotalTests || 0;
      passedTests += j.numPassedTests || 0;
      failedTests += j.numFailedTests || 0;
      for (const tr of j.testResults || []) {
        if (tr.status === 'failed' || (tr.numFailingTests || 0) > 0) {
          failedSuiteNames.push(path.relative(process.cwd(), tr.testFilePath || tr.name || '?'));
        }
      }
      summary = `${j.numPassedTests || 0}/${j.numTotalTests || 0} tests, ${j.numFailedTestSuites || 0} suite(s) failed`;
    } catch (e) {
      summary = `(could not parse batch json: ${e.message})`;
    }
  } else {
    summary = timedOut ? 'TIMED OUT — no results written' : 'CRASHED — no results written';
  }

  const ok = !timedOut && res.status === 0 && jsonParsed;
  const tag = ok ? 'PASS' : timedOut ? 'TIMEOUT' : 'FAIL';
  console.log(`[shard] ${batch.label} ${tag} ${secs}s — ${summary}`);
  if (!ok) {
    problemBatches.push({ index: i + 1, label: batch.label, timedOut, files: batch.files });
    if (timedOut || !jsonParsed) {
      console.error(`[shard] Aborting after ${batch.label}; results are incomplete.`);
      break;
    }
  }
}

const wall = ((Date.now() - startAll) / 1000 / 60).toFixed(1);
console.log('\n========== SHARDED SUITE SUMMARY ==========');
console.log(`Wall time:     ${wall} min`);
console.log(`Test suites:   ${passedSuites} passed, ${failedSuites} failed, ${totalSuites} total`);
console.log(`Tests:         ${passedTests} passed, ${failedTests} failed, ${totalTests} total`);
if (failedSuiteNames.length) {
  console.log('\nFailed suites:');
  for (const n of [...new Set(failedSuiteNames)].sort()) {
    console.log(`  FAIL ${n}`);
  }
}
if (problemBatches.length) {
  console.log(`\n${problemBatches.length} batch(es) failed/timed out. Per-batch JSON: ${tmp}`);
}
console.log('===========================================');

process.exit(problemBatches.length || failedSuites ? 1 : 0);
