#!/usr/bin/env node
/**
 * Sharded serial test runner (Equoria).
 *
 * Runs the backend Jest suite in BATCHES, each a FRESH `jest --runInBand`
 * process. Within a lane, batches execute SEQUENTIALLY (never concurrently).
 *
 * Why this exists: the monolithic `jest --runInBand` over all ~240 test files
 * runs every file in ONE Node process. Per-file native handles (timers,
 * listeners) and V8 heap accumulate across the run; by file ~200 the process
 * is GC-thrashing and every DB round-trip crawls (a single suite that runs in
 * ~3s alone took 773s late in the monolithic run). Splitting into fresh
 * processes resets the heap between batches, so total wall time drops from
 * ~95min to a few minutes.
 *
 * Why serial within a lane (not `--maxWorkers`): concurrent fixture access to
 * ONE database produced non-deterministic FK/isolation flakes (pre-push hook
 * history, PRs #105-106). A lane keeps DB access strictly serial.
 *
 * LANES (Equoria-bu9c4.1, 2026-09-14): `--lanes=2` runs two such serial
 * streams concurrently, each against its OWN disposable database created from
 * migrations + canonical seeds by scripts/test-lane-db.mjs and dropped in a
 * finally. The flake cause was the shared database, not concurrency itself, so
 * two lanes with two databases keep the determinism of one serial stream.
 * Hard ceiling: 2 lanes (the machine's two-worker ceiling, CONTRIBUTING.md
 * "Test-run resource budget"), and HEAP_MB * LANES may not exceed HEAP_MB_MAX
 * so the combined V8 cap never exceeds the single-process budget (768MB each
 * for two lanes; a shard measured 871MB peak tree RSS at that cap).
 *
 * CANONICAL-DATABASE PASS: a few sentinels assert properties of the LIVE
 * population (e.g. horseColorDiversitySentinel) and are meaningless on a fresh
 * lane database. With --lanes>1 they are excluded from the lane shards and run
 * afterwards in one short serial pass against the canonical DATABASE_URL; the
 * accounting below still requires every discovered suite to have run once.
 * The list is explicit and short by design (CANONICAL_DB_SUITES).
 *
 * Each batch has a hard wall-clock timeout so a single pathological file can
 * never stall the machine for hours.
 *
 * Usage:
 *   node scripts/run-suite-sharded.mjs [--jest-shards=8] [--lanes=1] [--timeout=600] [--heap=1536]
 *   node scripts/run-suite-sharded.mjs [--batch-size=25] [--timeout=600] [--heap=1536] [pattern]
 *     --jest-shards Jest hash shards, run in fresh processes
 *     --lanes       concurrent serial streams, each with its own database (1..2)
 *     --batch-size  test files per fresh process (default 25; lanes=1 only)
 *     --timeout     hard per-batch wall-clock cap in seconds (default 600)
 *     --heap        --max-old-space-size for each batch process in MB
 *                   (default 1536 for one lane, 768 for two; hard cap 1536/lanes)
 *
 * HEAP (history): from 2026-08-18 to 2026-09-14 this runner carried a
 * user-reconciled 4096MB sequential-envelope exception (Equoria-tdbx9)
 * because every finished test file's VM context stayed resident (~68MB per
 * file measured pre-teardown), so a ~110-file shard could not fit 1536MB.
 * Equoria-k09r9 root-caused that retention to two roots (app host timers and
 * V8's compilation cache pinning vm module registries) and fixed both in
 * tests/config/PrismaCleanupEnvironment.mjs; a full shard then ran at 1536MB
 * with heap flat between files. The exception is retired: parseIntegerOption
 * refuses any --heap above the budget, matching check-jest-memory-budget.mjs,
 * and the canonical invocation is pinned by check-backend-test-profiles.mjs.
 * Larger diagnostic headroom goes through diagnose-full-suite.mjs, never here.
 *
 * RESULT ACCOUNTING: a run passes only when every batch exited 0 with parseable
 * JSON AND the union of executed suite paths equals the set Jest discovers
 * (`--listTests`) for the same invocation. A missing shard, a duplicate, or a
 * suite that silently never ran fails the run even if every executed test
 * passed (Equoria-bu9c4).
 *
 * --retryTimes=1 below is accepted by the Jest 30 CLI but consumed by nothing
 * (measured 2026-09-14, Equoria-bu9c4): it is a no-op kept only until retries
 * are reworked. Do not rely on it.
 *
 * Exit code: 0 if every batch passed and accounting reconciled; 1 otherwise.
 */
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLaneDatabase, destroyLaneDatabase, laneUrlFor, newRunId } from './test-lane-db.mjs';
import jestConfig from '../jest.config.mjs';

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
// Two-worker ceiling (CONTRIBUTING.md): never more than two concurrent jest
// processes on this machine.
const LANES_MAX = 2;
const LANES = parseIntegerOption('lanes', '1', { max: LANES_MAX });
// Heap ceiling (Equoria-5iggk, lowered to the budget 2026-09-14 under
// Equoria-k09r9): refuse any --heap — or a drifted internal default — above
// the ordinary 1536MB budget, divided across lanes so the combined V8 cap of
// concurrent lane processes never exceeds the single-process budget.
const HEAP_MB_MAX = 1536;
const HEAP_MB = parseIntegerOption('heap', LANES > 1 ? '768' : '1536', {
  max: HEAP_MB_MAX / LANES,
});
const JEST_SHARDS = parseIntegerOption('jest-shards', '0', { allowZero: true, max: 100 });
const pattern = args.find(x => !x.startsWith('--'));

if (LANES > 1 && !JEST_SHARDS) {
  throw new Error('--lanes>1 requires --jest-shards=N (batch mode is single-lane only)');
}

const BACKEND = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const JEST = path.join(BACKEND, 'node_modules', 'jest', 'bin', 'jest.js');
const tmp = mkdtempSync(path.join(tmpdir(), 'equoria-shard-'));

function normalizePath(p) {
  return path.resolve(p).replace(/\\/g, '/').toLowerCase();
}

// Suites that assert against the live population and must run on the canonical
// database. Paths are backend-relative. Keep this list short and justified.
const CANONICAL_DB_SUITES = ['__tests__/horseColorDiversitySentinel.test.mjs'];
const canonicalSet = new Set(
  CANONICAL_DB_SUITES.map(rel => normalizePath(path.join(BACKEND, rel))),
);

// A backend-relative suite path as a regex that matches the absolute path on
// both separators (Jest matches ignore patterns against the OS-native path).
function suiteTailPattern(rel) {
  return `${rel
    .split('/')
    .map(part => part.replace(/[.*+?^${}()|[\]\\]/g, match => `\\${match}`))
    .join('[\\\\/]')}$`;
}

// The CLI flag REPLACES the config array rather than extending it (measured
// 2026-09-14: load/perf suites leaked into lane shards), so the live config
// patterns are re-supplied alongside the canonical exclusions. Jest's CLI
// accepts the flag repeated once per pattern.
const configIgnorePatterns = Array.isArray(jestConfig.testPathIgnorePatterns)
  ? jestConfig.testPathIgnorePatterns
  : [];
const canonicalIgnoreArgs =
  LANES > 1
    ? [...configIgnorePatterns, ...CANONICAL_DB_SUITES.map(suiteTailPattern)].map(
        patternText => `--testPathIgnorePatterns=${patternText}`,
      )
    : [];

function listTestFiles() {
  // jest --listTests prints one absolute path per line on stdout.
  const cmd = ['--experimental-vm-modules', JEST, '--listTests'];
  if (pattern) {
    cmd.push(pattern);
  }
  const out = execFileSync(process.execPath, cmd, {
    cwd: BACKEND,
    encoding: 'utf8',
    maxBuffer: 128 * 1024 * 1024,
  });
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

// Discovery manifest: the set every batch's executed suites must reconcile to.
const discovered = listTestFiles();
if (discovered.length === 0) {
  console.error('[shard] No test files matched. Aborting.');
  process.exit(1);
}
const discoveredSet = new Set(discovered.map(normalizePath));

const batches = JEST_SHARDS
  ? Array.from({ length: JEST_SHARDS }, (_, index) => ({
      index,
      label: `shard ${index + 1}/${JEST_SHARDS}`,
      jestArgs: [
        `--shard=${index + 1}/${JEST_SHARDS}`,
        ...canonicalIgnoreArgs,
        ...(pattern ? [pattern] : []),
      ],
    }))
  : chunk(discovered, BATCH_SIZE).map((batch, index) => ({
      index,
      label: `batch ${index + 1}`,
      jestArgs: ['--runTestsByPath', ...batch],
      files: batch,
    }));

if (JEST_SHARDS) {
  console.log(
    `[shard] ${JEST_SHARDS} Jest hash shards over ${discovered.length} discovered suites, ` +
      `${LANES} lane(s) of sequential fresh processes (heap ${HEAP_MB}MB each, hard cap ${BATCH_TIMEOUT_MS / 1000}s per shard).`,
  );
} else {
  console.log(
    `[shard] ${discovered.length} test files in ${batches.length} batches of ${BATCH_SIZE} ` +
      `(per-batch heap ${HEAP_MB}MB, hard cap ${BATCH_TIMEOUT_MS / 1000}s, serial).`,
  );
}

const totals = {
  totalSuites: 0,
  passedSuites: 0,
  failedSuites: 0,
  totalTests: 0,
  passedTests: 0,
  failedTests: 0,
};
const failedSuiteNames = [];
const problemBatches = [];
const executedPaths = [];
const startAll = Date.now();

/** Run one batch in a fresh process; resolves with { status, timedOut }. */
function runBatch(batch, jsonFile, env) {
  return new Promise(resolve => {
    const child = spawn(
      process.execPath,
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
      { cwd: BACKEND, env, stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true },
    );
    let stderrTail = '';
    child.stderr.on('data', chunkData => {
      stderrTail = (stderrTail + chunkData.toString()).slice(-4000);
    });
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, BATCH_TIMEOUT_MS);
    child.on('exit', (status, signal) => {
      clearTimeout(timer);
      resolve({ status, signal, timedOut, stderrTail });
    });
    child.on('error', error => {
      clearTimeout(timer);
      resolve({ status: null, signal: null, timedOut, stderrTail: String(error) });
    });
  });
}

function recordBatch(batch, jsonFile, res, secs) {
  let summary;
  let jsonParsed = false;
  if (existsSync(jsonFile)) {
    try {
      const j = JSON.parse(readFileSync(jsonFile, 'utf8'));
      jsonParsed = true;
      totals.totalSuites += j.numTotalTestSuites || 0;
      totals.passedSuites += j.numPassedTestSuites || 0;
      totals.failedSuites += j.numFailedTestSuites || 0;
      totals.totalTests += j.numTotalTests || 0;
      totals.passedTests += j.numPassedTests || 0;
      totals.failedTests += j.numFailedTests || 0;
      for (const tr of j.testResults || []) {
        const filePath = tr.testFilePath || tr.name;
        if (filePath) {
          executedPaths.push(normalizePath(filePath));
        }
        if (tr.status === 'failed' || (tr.numFailingTests || 0) > 0) {
          failedSuiteNames.push(path.relative(BACKEND, filePath || '?'));
        }
      }
      summary = `${j.numPassedTests || 0}/${j.numTotalTests || 0} tests, ${j.numFailedTestSuites || 0} suite(s) failed`;
    } catch (e) {
      summary = `(could not parse batch json: ${e.message})`;
    }
  } else {
    summary = res.timedOut ? 'TIMED OUT — no results written' : 'CRASHED — no results written';
  }

  const ok = !res.timedOut && res.status === 0 && jsonParsed;
  const tag = ok ? 'PASS' : res.timedOut ? 'TIMEOUT' : 'FAIL';
  console.log(`[shard] ${batch.label} ${tag} ${secs}s — ${summary}`);
  if (!ok) {
    if (!jsonParsed && res.stderrTail) {
      console.error(`[shard] ${batch.label} stderr tail:\n${res.stderrTail.trim()}`);
    }
    problemBatches.push({
      index: batch.index + 1,
      label: batch.label,
      timedOut: res.timedOut,
      fatal: res.timedOut || !jsonParsed,
      files: batch.files,
    });
  }
  return ok;
}

/** Run a lane's batches strictly in sequence; stops the lane on a fatal batch. */
async function runLane(laneBatches, env, laneLabel) {
  for (const batch of laneBatches) {
    const jsonFile = path.join(tmp, `batch-${batch.index}.json`);
    const t0 = Date.now();
    const res = await runBatch(batch, jsonFile, env);
    const secs = ((Date.now() - t0) / 1000).toFixed(1);
    recordBatch(batch, jsonFile, res, secs);
    const fatal = problemBatches.find(p => p.index === batch.index + 1 && p.fatal);
    if (fatal) {
      console.error(`[shard] ${laneLabel}: aborting after ${batch.label}; results are incomplete.`);
      break;
    }
  }
}

async function main() {
  const laneEnvs = [];
  const laneDbs = [];
  const runId = newRunId();
  try {
    if (LANES > 1) {
      for (let lane = 1; lane <= LANES; lane++) {
        const t0 = Date.now();
        const { name, migrations } = await createLaneDatabase({
          runId,
          lane,
          log: line => console.log(line),
        });
        laneDbs.push(name);
        laneEnvs.push({
          ...process.env,
          DATABASE_URL: laneUrlFor(name),
          EQUORIA_TEST_LANE: String(lane),
        });
        console.log(
          `[shard] lane ${lane}/${LANES} database ${name} ready in ${((Date.now() - t0) / 1000).toFixed(1)}s (${migrations} migrations)`,
        );
      }
    } else {
      laneEnvs.push({ ...process.env });
    }

    // Round-robin assignment keeps each lane a contiguous serial stream.
    const perLane = Array.from({ length: LANES }, () => []);
    batches.forEach((batch, i) => perLane[i % LANES].push(batch));
    await Promise.all(
      perLane.map((laneBatches, i) => runLane(laneBatches, laneEnvs[i], `lane ${i + 1}/${LANES}`)),
    );

    if (LANES > 1) {
      const canonicalFiles = discovered.filter(f => canonicalSet.has(normalizePath(f)));
      if (canonicalFiles.length) {
        const canonicalBatch = {
          index: batches.length,
          label: `canonical-db pass (${canonicalFiles.length} suite(s))`,
          jestArgs: ['--runTestsByPath', ...canonicalFiles],
          files: canonicalFiles,
        };
        await runLane([canonicalBatch], { ...process.env }, 'canonical-db pass');
      }
    }
  } finally {
    for (const name of laneDbs) {
      try {
        await destroyLaneDatabase({ name, log: line => console.log(line) });
      } catch (error) {
        console.error(`[shard] failed to drop lane database ${name}: ${error.message}`);
        problemBatches.push({ index: 0, label: `lane cleanup ${name}`, fatal: false });
      }
    }
  }

  // Accounting: every discovered suite ran exactly once, nothing extra ran.
  const executedSet = new Set(executedPaths);
  const duplicates = executedPaths.length - executedSet.size;
  const missing = [...discoveredSet].filter(p => !executedSet.has(p));
  const unexpected = [...executedSet].filter(p => !discoveredSet.has(p));
  const reconciled = duplicates === 0 && missing.length === 0 && unexpected.length === 0;

  const wall = ((Date.now() - startAll) / 1000 / 60).toFixed(1);
  console.log('\n========== SHARDED SUITE SUMMARY ==========');
  console.log(`Wall time:     ${wall} min`);
  console.log(`Lanes:         ${LANES}`);
  console.log(
    `Test suites:   ${totals.passedSuites} passed, ${totals.failedSuites} failed, ${totals.totalSuites} total`,
  );
  console.log(
    `Tests:         ${totals.passedTests} passed, ${totals.failedTests} failed, ${totals.totalTests} total`,
  );
  console.log(
    `Accounting:    ${executedSet.size} executed of ${discoveredSet.size} discovered${
      reconciled
        ? ' — reconciled'
        : ` — MISMATCH (missing ${missing.length}, unexpected ${unexpected.length}, duplicates ${duplicates})`
    }`,
  );
  if (!reconciled) {
    for (const p of missing.slice(0, 20)) {
      console.log(`  MISSING    ${p}`);
    }
    for (const p of unexpected.slice(0, 20)) {
      console.log(`  UNEXPECTED ${p}`);
    }
  }
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

  process.exit(problemBatches.length || totals.failedSuites || !reconciled ? 1 : 0);
}

main().catch(error => {
  console.error('[shard] fatal:', error);
  process.exit(1);
});
