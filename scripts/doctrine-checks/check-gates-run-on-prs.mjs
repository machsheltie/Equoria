#!/usr/bin/env node
// Doctrine: any GitHub Actions job whose key ends in `-gate` must run on PRs,
// not just on master. A gate that only fires after merge is not a gate; it is
// an alarm.
//
// Exemptions go in scripts/doctrine-checks/gates-allowlist.txt, one job key
// per line, with a comment explaining why it is master-only.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const WORKFLOWS_DIR = '.github/workflows';
const ALLOWLIST_FILE = 'scripts/doctrine-checks/gates-allowlist.txt';

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
      continue;
    }
    if (!currentJob) continue;
    if (!currentJob.endsWith('-gate')) continue;
    if (allowlist.has(currentJob)) continue;
    if (masterOnly.test(line)) {
      violations.push(`${path}:${i + 1}  job '${currentJob}' (defined at line ${currentJobLine}) is master-only`);
    }
  }
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
