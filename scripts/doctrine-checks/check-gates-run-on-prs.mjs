#!/usr/bin/env node
// Doctrine: any GitHub Actions job whose key ends in `-gate` must run on PRs,
// not just on master. A gate that only fires after merge is not a gate; it is
// an alarm.
//
// Exemptions go in scripts/doctrine-checks/gates-allowlist.txt, one job key
// per line, with a comment explaining why it is master-only.
//
// ── STALE-ENTRY RATCHET (Equoria-iz9gp) ────────────────────────────────────
// The allowlist grandfathers master-only `*-gate` jobs. An allowlist entry
// naming a job key that no longer exists as a `*-gate` job in ANY workflow is
// STALE: a deleted/renamed gate whose exemption silently lingers. A future
// gate that happens to reuse that key would be auto-exempted with no review.
// This check FAILS (exit 1) on stale entries, names them, and instructs that
// the allowlist may only SHRINK — mirroring the three baseline-delta checks
// (silent-cleanup-catch / rethrow-after-log / api-client-vi-mock) and proven
// by backend/__tests__/scripts/doctrineBaselineStale.sentinel.test.mjs.
//
// Optional argv[2]: alternate allowlist path (sentinel-test hook,
// Equoria-iz9gp) — production callers (run-all.sh, CI) pass no argument.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const WORKFLOWS_DIR = '.github/workflows';
// Equoria-iz9gp: argv[2] optionally overrides the allowlist path so the
// gates-allowlist stale-entry sentinel can prove detection FIRES against a
// planted (stale) allowlist WITHOUT editing the canonical one. Production
// callers pass no argument.
const ALLOWLIST_FILE = process.argv[2]
  ? resolve(process.argv[2])
  : 'scripts/doctrine-checks/gates-allowlist.txt';

const allowlist = new Set();
if (existsSync(ALLOWLIST_FILE)) {
  for (const line of readFileSync(ALLOWLIST_FILE, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    allowlist.add(trimmed);
  }
}

const masterOnly = /^\s*if:\s*github\.ref\s*==\s*'refs\/heads\/master'\s*$/;
const jobKey = /^ {2}([a-z0-9_-]+):\s*$/i;

const violations = [];
// Equoria-iz9gp: every `*-gate` job key seen across all workflows. Used to
// validate that each allowlist entry still names a real gate job.
const knownGateJobs = new Set();

for (const file of readdirSync(WORKFLOWS_DIR)) {
  if (!file.endsWith('.yml') && !file.endsWith('.yaml')) continue;
  const path = join(WORKFLOWS_DIR, file);
  const lines = readFileSync(path, 'utf8').split('\n');

  let currentJob = null;
  let currentJobLine = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(jobKey);
    if (m) {
      currentJob = m[1];
      currentJobLine = i + 1;
      if (currentJob.endsWith('-gate')) {
        knownGateJobs.add(currentJob);
      }
      continue;
    }
    if (!currentJob) continue;
    if (!currentJob.endsWith('-gate')) continue;
    if (allowlist.has(currentJob)) continue;
    if (masterOnly.test(line)) {
      violations.push(
        `${path}:${i + 1}  job '${currentJob}' (defined at line ${currentJobLine}) is master-only`
      );
    }
  }
}

// Equoria-iz9gp stale-entry ratchet: every allowlist entry must still name a
// `*-gate` job that exists in some workflow. A stale exemption is dead weight
// that could silently auto-exempt a future gate reusing the key.
const staleEntries = [...allowlist].filter((key) => !knownGateJobs.has(key));
if (staleEntries.length > 0) {
  console.error(
    '[gates-run-on-prs] FAIL — stale allowlist entries (no `*-gate` job by this key exists in any workflow):'
  );
  for (const s of staleEntries) {
    console.error(`  ${s}`);
  }
  console.error('');
  console.error('The allowlist may only SHRINK: remove the stale job key(s) from');
  console.error(`  ${ALLOWLIST_FILE}`);
  console.error('A deleted/renamed gate must not leave a lingering exemption (Equoria-iz9gp).');
  process.exit(1);
}

if (violations.length > 0) {
  console.log();
  console.log('*-gate jobs that do not run on PRs (forbidden — gates must validate PRs):');
  for (const v of violations) console.log('  ' + v);
  console.log();
  console.log(`To exempt a job, add its key to ${ALLOWLIST_FILE} with a justification comment.`);
  process.exit(1);
}

process.exit(0);
