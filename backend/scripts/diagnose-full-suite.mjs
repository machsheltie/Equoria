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
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

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

/** Resolve the test DATABASE_URL the suite itself will use (.env.test). */
function testDbUrl() {
  const envTest = readFileSync(path.join(BACKEND, '.env.test'), 'utf8');
  const line = envTest.split(/\r?\n/).find(l => l.startsWith('DATABASE_URL'));
  if (!line) {
    throw new Error('DATABASE_URL not found in backend/.env.test');
  }
  return line
    .replace(/^DATABASE_URL\s*=\s*/, '')
    .replace(/"/g, '')
    .trim();
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

  console.log(`[diagnose] label=${label} starting: node ${jestArgs.join(' ')}`);
  const started = Date.now();

  const monClient = new Client({ connectionString: testDbUrl() });
  await monClient.connect();

  const child = spawn(process.execPath, jestArgs, {
    cwd: BACKEND,
    env: { ...process.env, EQUORIA_TEST_DIAG: '1' },
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  child.stderr.on('data', d => appendFileSync(stderrOut, d));

  let peakConns = 0;
  let peakProcs = 0;
  let peakRssMb = 0;
  const sampler = setInterval(async () => {
    try {
      const pgSample = await samplePg(monClient);
      const total = Object.values(pgSample.connections).reduce((a, b) => a + b, 0);
      peakConns = Math.max(peakConns, total);
      appendFileSync(pgStatsOut, `${JSON.stringify(pgSample)}\n`);
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
  }, 5000);

  const exitCode = await new Promise(resolve => child.on('close', resolve));
  clearInterval(sampler);
  await monClient.end();
  const elapsedS = Math.round((Date.now() - started) / 1000);

  // Summarize the Jest JSON: first 20 failures + fetchCsrf timeout count.
  let summary = { label, workers, elapsedS, exitCode, peakConns, peakProcs, peakRssMb };
  try {
    const jest = JSON.parse(readFileSync(jsonOut, 'utf8'));
    const failedSuites = jest.testResults.filter(
      r => r.status === 'failed' || r.numFailingTests > 0,
    );
    const csrfTimeouts = jest.testResults.filter(
      r =>
        (r.message ?? '').includes('fetchCsrf') ||
        ((r.message ?? '').match(/Exceeded timeout.*beforeAll|thrown: "Exceeded timeout/) &&
          (r.message ?? '').includes('csrf')),
    );
    const stderrLog = readFileSync(stderrOut, 'utf8');
    summary = {
      ...summary,
      totalSuites: jest.numTotalTestSuites,
      failedSuiteCount: failedSuites.length,
      passedTests: jest.numPassedTests,
      failedTests: jest.numFailedTests,
      csrfTimeoutSuiteCount: csrfTimeouts.length,
      diagCsrfLines: (stderrLog.match(/\[csrf-diag\]/g) ?? []).length,
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
  process.exit(0); // diagnostic runner itself succeeds even when the suite fails
}

// Equoria-5z0if main-module guard: spawns the full Jest suite (heavy, long) —
// must NOT run on bare import (e.g. parse-check `node -e "import('./x.mjs')"`).
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch(err => {
    console.error('Fatal:', err);
    process.exit(1);
  });
}
