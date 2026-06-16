/**
 * Full-suite contention diagnostic runner (Equoria-fefh2.15, WS3 Phase A/B).
 *
 * Runs the backend Jest suite at a FIXED worker count while concurrently
 * sampling PostgreSQL connection/lock state and local node process pressure,
 * so the fetchCsrf-timeout wave can be diagnosed from measurements instead of
 * guesses. One invocation = one cell of the worker matrix.
 *
 *   node scripts/diagnose-full-suite.mjs --workers=1        # --runInBand
 *   node scripts/diagnose-full-suite.mjs --workers=2
 *   node scripts/diagnose-full-suite.mjs --workers=4
 *   node scripts/diagnose-full-suite.mjs --workers=50%      # current default
 *
 * Outputs (under backend/diagnostics/, gitignored):
 *   full-run-<label>.json          Jest --json result (suite/test outcomes)
 *   full-run-<label>.pgstats.jsonl 5s samples: pg connections by state,
 *                                  lock waits, longest-running query age
 *   full-run-<label>.proc.jsonl    5s samples: node.exe count + total RSS
 *   full-run-<label>.summary.json  elapsed, exit code, failure clusters,
 *                                  fetchCsrf timeout count, peak metrics
 *
 * Setting EQUORIA_TEST_DIAG=1 (exported to the child run) additionally makes
 * tests/helpers/csrfHelper.mjs emit per-call timing lines to stderr. The flag
 * is opt-in and OFF for normal runs — this script is diagnostic tooling, not
 * part of any gate.
 */

import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, appendFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import pg from 'pg';
import { getPoolConfig } from '../../packages/database/dbPoolConfig.mjs';

const { Client } = pg;

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BACKEND = path.resolve(HERE, '..');
const DIAG_DIR = path.join(BACKEND, 'diagnostics');

function parseArgs(argv) {
  const args = { workers: null };
  for (const a of argv) {
    const m = a.match(/^--workers=(.+)$/);
    if (m) {
      args.workers = m[1];
    }
  }
  if (!args.workers) {
    console.error('usage: node scripts/diagnose-full-suite.mjs --workers=<1|2|4|50%>');
    process.exit(2);
  }
  return args;
}

function labelFor(workers) {
  return workers === '1' ? 'inband' : `w${workers.replace('%', 'pct')}`;
}

function resolveWorkerCount(workers) {
  const percentMatch = workers.match(/^([1-9]\d?|100)%$/);
  if (percentMatch) {
    const percent = Number.parseInt(percentMatch[1], 10);
    return Math.max(1, Math.floor((availableParallelism() * percent) / 100));
  }
  if (!/^[1-9]\d*$/.test(workers)) {
    throw new Error(`Invalid worker count: ${workers}`);
  }
  return Number.parseInt(workers, 10);
}

function assertConnectionBudget(workers, maxConnections, env) {
  const workerCount = resolveWorkerCount(workers);
  const poolSize = getPoolConfig({ ...process.env, ...env, NODE_ENV: 'test' }).connection_limit;
  const reservedConnections = Math.max(1, Math.floor(maxConnections * 0.2));
  const requestedConnections = workerCount * poolSize;

  if (!Number.isInteger(maxConnections) || maxConnections < 2) {
    throw new Error(`Invalid PostgreSQL max_connections value: ${maxConnections}`);
  }
  if (requestedConnections > maxConnections - reservedConnections) {
    throw new Error(
      `Worker/pool budget exceeded: ${workerCount} workers * ${poolSize} connections = ` +
        `${requestedConnections}; limit is ${maxConnections - reservedConnections}`,
    );
  }
  return { workerCount, poolSize, maxConnections, reservedConnections, requestedConnections };
}

/** Resolve the test environment the suite itself will load. */
function testEnvironment() {
  const env = dotenv.parse(readFileSync(path.join(BACKEND, '.env.test')));
  if (!env.DATABASE_URL) {
    throw new Error('DATABASE_URL not found in backend/.env.test');
  }
  return env;
}

async function samplePg(client) {
  const conns = await client.query(
    `SELECT state, count(*)::int AS n
       FROM pg_stat_activity
      WHERE datname = current_database()
      GROUP BY state`,
  );
  const locks = await client.query(
    `SELECT count(*)::int AS waiting
       FROM pg_stat_activity
      WHERE datname = current_database() AND wait_event_type = 'Lock'`,
  );
  const longest = await client.query(
    `SELECT coalesce(max(extract(epoch FROM now() - query_start)), 0)::float AS longest_query_s
       FROM pg_stat_activity
      WHERE datname = current_database() AND state = 'active' AND pid <> pg_backend_pid()`,
  );
  return {
    t: new Date().toISOString(),
    connections: Object.fromEntries(conns.rows.map(r => [r.state ?? 'null', r.n])),
    lockWaits: locks.rows[0].waiting,
    longestQueryS: longest.rows[0].longest_query_s,
  };
}

function sampleProcs() {
  try {
    const out = execFileSync('tasklist', ['/FI', 'IMAGENAME eq node.exe', '/FO', 'CSV', '/NH'], {
      encoding: 'utf8',
    });
    const rows = out
      .trim()
      .split(/\r?\n/)
      .filter(l => l.includes('node.exe'));
    const rssKb = rows.reduce((sum, l) => {
      const cells = l.split('","');
      const mem = (cells[4] ?? '').replace(/[^0-9]/g, '');
      return sum + (Number(mem) || 0);
    }, 0);
    return {
      t: new Date().toISOString(),
      nodeProcs: rows.length,
      totalRssMb: Math.round(rssKb / 1024),
    };
  } catch {
    return { t: new Date().toISOString(), nodeProcs: -1, totalRssMb: -1 };
  }
}

async function main() {
  const { workers } = parseArgs(process.argv.slice(2));
  const label = labelFor(workers);
  mkdirSync(DIAG_DIR, { recursive: true });

  const jsonOut = path.join(DIAG_DIR, `full-run-${label}.json`);
  const pgStatsOut = path.join(DIAG_DIR, `full-run-${label}.pgstats.jsonl`);
  const procOut = path.join(DIAG_DIR, `full-run-${label}.proc.jsonl`);
  const summaryOut = path.join(DIAG_DIR, `full-run-${label}.summary.json`);
  const stderrOut = path.join(DIAG_DIR, `full-run-${label}.stderr.log`);
  writeFileSync(pgStatsOut, '');
  writeFileSync(procOut, '');
  writeFileSync(stderrOut, '');

  const jestArgs = [
    '--experimental-vm-modules',
    '--max-old-space-size=8192',
    path.join(BACKEND, 'node_modules', 'jest', 'bin', 'jest.js'),
    workers === '1' ? '--runInBand' : `--maxWorkers=${workers}`,
    '--json',
    `--outputFile=${jsonOut}`,
  ];

  const testEnv = testEnvironment();

  // The monitor connection must never take the whole runner (and its spawned
  // Jest child) down: under heavy suite load Postgres can reset idle monitor
  // sockets (observed ECONNRESET, 2026-06-12). Handle errors, reconnect lazily.
  let monClient = new Client({ connectionString: testEnv.DATABASE_URL });
  monClient.on('error', () => {
    monClient = null; // next sample reconnects
  });
  await monClient.connect();
  async function getMonClient() {
    if (!monClient) {
      const fresh = new Client({ connectionString: testEnv.DATABASE_URL });
      fresh.on('error', () => {
        monClient = null;
      });
      await fresh.connect();
      monClient = fresh;
    }
    return monClient;
  }

  // Equoria-fefh2.15 WS3 budget check: assert worker × pool connection demand
  // stays under the live max_connections before the heavy run starts.
  const maxConnectionsResult = await (await getMonClient()).query('SHOW max_connections');
  const connectionBudget = assertConnectionBudget(
    workers,
    Number.parseInt(maxConnectionsResult.rows[0].max_connections, 10),
    testEnv,
  );

  console.log(
    `[diagnose] label=${label} budget=${connectionBudget.requestedConnections}/` +
      `${connectionBudget.maxConnections - connectionBudget.reservedConnections} starting: ` +
      `node ${jestArgs.join(' ')}`,
  );
  const started = Date.now();

  const child = spawn(process.execPath, jestArgs, {
    cwd: BACKEND,
    env: { ...process.env, ...testEnv, EQUORIA_TEST_DIAG: '1' },
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  child.stderr.on('data', d => appendFileSync(stderrOut, d));

  let peakConns = 0;
  let peakProcs = 0;
  let peakRssMb = 0;
  let sampling = false; // prevent overlapping samples (pg client is serial)
  let budgetExceeded = false;
  const sampler = setInterval(async () => {
    if (sampling) {
      return;
    }
    sampling = true;
    try {
      const pgSample = await samplePg(await getMonClient());
      const total = Object.values(pgSample.connections).reduce((a, b) => a + b, 0);
      peakConns = Math.max(peakConns, total);
      appendFileSync(pgStatsOut, `${JSON.stringify(pgSample)}\n`);
      const availableConnections =
        connectionBudget.maxConnections - connectionBudget.reservedConnections;
      if (!budgetExceeded && total > availableConnections) {
        budgetExceeded = true;
        appendFileSync(
          pgStatsOut,
          `${JSON.stringify({
            t: new Date().toISOString(),
            error: `Connection budget exceeded: ${total} > ${availableConnections}`,
          })}\n`,
        );
        child.kill('SIGTERM');
      }
    } catch (err) {
      appendFileSync(
        pgStatsOut,
        `${JSON.stringify({ t: new Date().toISOString(), error: err.message })}\n`,
      );
    }
    const procSample = sampleProcs();
    peakProcs = Math.max(peakProcs, procSample.nodeProcs);
    peakRssMb = Math.max(peakRssMb, procSample.totalRssMb);
    appendFileSync(procOut, `${JSON.stringify(procSample)}\n`);
    sampling = false;
  }, 5000);

  const exitCode = await new Promise(resolve => child.on('close', resolve));
  clearInterval(sampler);
  if (monClient) {
    await monClient.end().catch(() => {}); // monitor socket may already be reset
  }
  const elapsedS = Math.round((Date.now() - started) / 1000);

  // Summarize the Jest JSON: first 20 failures + fetchCsrf timeout count.
  let summary = {
    label,
    workers,
    connectionBudget,
    elapsedS,
    exitCode,
    peakConns,
    peakProcs,
    peakRssMb,
    budgetExceeded,
  };
  const stderrLog = readFileSync(stderrOut, 'utf8');
  summary.tooManyClientsCount = (stderrLog.match(/too many clients already/gi) ?? []).length;
  summary.diagCsrfLines = (stderrLog.match(/\[csrf-diag\]/g) ?? []).length;
  try {
    const jest = JSON.parse(readFileSync(jsonOut, 'utf8'));
    const failedSuites = jest.testResults.filter(
      r => r.status === 'failed' || r.numFailingTests > 0,
    );
    const csrfTimeouts = jest.testResults.filter(r => {
      const failureText = [
        r.message ?? '',
        ...(r.assertionResults ?? []).flatMap(assertion => assertion.failureMessages ?? []),
      ].join('\n');
      return (
        /fetchCsrf/i.test(failureText) &&
        /Exceeded timeout|thrown: "Exceeded timeout/i.test(failureText)
      );
    });
    const jestFailureText = jest.testResults
      .flatMap(r => [
        r.message ?? '',
        ...(r.assertionResults ?? []).flatMap(assertion => assertion.failureMessages ?? []),
      ])
      .join('\n');
    summary = {
      ...summary,
      totalSuites: jest.numTotalTestSuites,
      failedSuiteCount: failedSuites.length,
      passedTests: jest.numPassedTests,
      failedTests: jest.numFailedTests,
      csrfTimeoutSuiteCount: csrfTimeouts.length,
      tooManyClientsCount:
        summary.tooManyClientsCount +
        (jestFailureText.match(/too many clients already/gi) ?? []).length,
      first20Failures: failedSuites.slice(0, 20).map(r => ({
        file: path.relative(BACKEND, r.name),
        firstError: (r.message ?? '').split('\n').slice(0, 3).join(' | ').slice(0, 300),
      })),
    };
  } catch (err) {
    summary.summarizeError = err.message;
  }
  writeFileSync(summaryOut, JSON.stringify(summary, null, 2));
  console.log(
    `[diagnose] done label=${label} exit=${exitCode} elapsed=${elapsedS}s -> ${summaryOut}`,
  );
  const normalizedExitCode = Number.isInteger(exitCode) ? exitCode : 1;
  process.exit(budgetExceeded ? 2 : normalizedExitCode);
}

// Equoria-5z0if main-module guard: spawns the full Jest suite (heavy, long) —
// must NOT run on bare import (e.g. parse-check `node -e "import('./x.mjs')"`).
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch(err => {
    console.error('Fatal:', err);
    process.exit(1);
  });
}
