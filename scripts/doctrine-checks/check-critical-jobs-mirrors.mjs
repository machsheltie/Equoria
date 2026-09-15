#!/usr/bin/env node
// Doctrine: the `critical-jobs-ran` skip sentinel in .github/workflows/test.yml
// decides whether a `skipped` job is a defect or a legitimate exclusion by
// comparing against EXPECT_* env values that MIRROR each conditional job's own
// `if:` expression. Nothing in YAML ties a mirror to the condition it mirrors.
//
// Drift is not theoretical and it is not symmetric:
//   - A job's `if:` tightened while its mirror is not  -> the sentinel FALSE-
//     ALARMS. Safe, but it burns the credibility of the one job whose entire
//     value is that people believe it when it goes red (Equoria-axyem.7 I-1).
//   - A currently-unconditional critical job gains an `if:` with no mirror ->
//     same false alarm. This is the clause that catches `beta-readiness-gate`
//     if it ever grows the `if:` its old comment used to claim.
//   - A mirror made MORE restrictive than its job's `if:` -> a genuine skip is
//     excused. That is the unsafe direction, and it is exactly what the
//     verbatim-string comparison below forbids.
//
// The check asserts, for every critical job named in the sentinel's `needs:`:
//   1. it has a `check <job> "$R_*" <expectation>` line in the sentinel;
//   2. if the expectation is literal `true`, the job has NO job-level `if:`;
//   3. if the expectation is `"$EXPECT_FOO"`, the job HAS a job-level `if:`,
//      and EXPECT_FOO's value is exactly `${{ <that same expression> }}`.
// And inversely, that every `check` line names a job in `needs:`.
//
// Optional argv[2]: alternate workflow path (RED-proof hook, mirroring
// check-gates-run-on-prs.mjs). Production callers pass no argument.
//
// Run: `node scripts/doctrine-checks/check-critical-jobs-mirrors.mjs`
// Auto-runs via `scripts/doctrine-checks/run-all.sh`.

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const WORKFLOW = process.argv[2] ? resolve(process.argv[2]) : '.github/workflows/test.yml';
const SENTINEL_JOB = 'critical-jobs-ran';

if (!existsSync(WORKFLOW)) {
  console.error(`[critical-jobs-mirrors] FAIL — workflow not found: ${WORKFLOW}`);
  console.error('  The skip sentinel lives in this file. A missing file is a failure,');
  console.error('  never a vacuous pass.');
  process.exit(1);
}

const lines = readFileSync(WORKFLOW, 'utf8').split(/\r?\n/);

// ── Pass 1: job-level `if:` per job, and the sentinel job's line range. ──────
// Job keys are two-space indented under `jobs:`; job-level keys are four-space
// indented. Step-level `if:` lives deeper (six spaces or more) and under
// `steps:`, so we stop collecting once `    steps:` is seen.
const JOB_KEY = /^ {2}([a-z0-9_-]+):\s*$/;
const JOB_IF = /^ {4}if:\s*(.*?)\s*$/;

const jobIf = new Map(); // job key -> if expression string (job-level only)
const jobOrder = [];
let sentinelStart = -1;
let sentinelEnd = lines.length;

{
  let current = null;
  let inSteps = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const km = line.match(JOB_KEY);
    if (km) {
      if (current === SENTINEL_JOB) sentinelEnd = i;
      current = km[1];
      jobOrder.push(current);
      inSteps = false;
      if (current === SENTINEL_JOB) sentinelStart = i;
      continue;
    }
    if (!current) continue;
    if (/^ {4}steps:\s*$/.test(line)) {
      inSteps = true;
      continue;
    }
    if (inSteps) continue;
    const im = line.match(JOB_IF);
    if (im && !jobIf.has(current)) jobIf.set(current, im[1]);
  }
}

if (sentinelStart === -1) {
  console.error(`[critical-jobs-mirrors] FAIL — job \`${SENTINEL_JOB}\` not found in ${WORKFLOW}.`);
  console.error('  Equoria-axyem.7 added it so that a skipped critical job is red, not grey.');
  console.error('  If it was renamed, update SENTINEL_JOB here; if it was deleted, restore it.');
  process.exit(1);
}

const sentinel = lines.slice(sentinelStart, sentinelEnd);

// ── Pass 2: the sentinel's `needs:` list, EXPECT_* env values, check lines. ──
const needs = [];
{
  let inNeeds = false;
  for (const line of sentinel) {
    if (/^ {4}needs:\s*$/.test(line)) {
      inNeeds = true;
      continue;
    }
    if (inNeeds) {
      const m = line.match(/^ {6}- ([a-z0-9_-]+)\s*$/);
      if (m) {
        needs.push(m[1]);
        continue;
      }
      inNeeds = false;
    }
  }
}

const expects = new Map(); // EXPECT_FOO -> raw value string
for (const line of sentinel) {
  const m = line.match(/^\s+(EXPECT_[A-Z0-9_]+):\s*(.*?)\s*$/);
  if (m) expects.set(m[1], m[2]);
}

// `check <job> "$R_FOO" true` | `check <job> "$R_FOO" "$EXPECT_FOO"`
const checks = new Map(); // job -> expectation token
for (const line of sentinel) {
  const m = line.match(/^\s+check\s+([a-z0-9_-]+)\s+"\$R_[A-Z0-9_]+"\s+(\S+)\s*$/);
  if (m) checks.set(m[1], m[2]);
}

// ── Assertions ──────────────────────────────────────────────────────────────
const failures = [];

if (needs.length === 0) {
  failures.push(
    `\`${SENTINEL_JOB}\` has no parsable \`needs:\` list. The sentinel guards nothing.`
  );
}

for (const job of needs) {
  if (!jobOrder.includes(job)) {
    // check-needs-references.mjs owns this class; named here for completeness.
    failures.push(`\`${SENTINEL_JOB}\` needs \`${job}\`, which is not a job in this workflow.`);
    continue;
  }

  const expectation = checks.get(job);
  if (!expectation) {
    failures.push(
      `\`${job}\` is in \`${SENTINEL_JOB}.needs\` but has no \`check ${job} ...\` line.\n` +
        `      It would be waited on and then never verified — a silent hole in the sentinel.`
    );
    continue;
  }

  const realIf = jobIf.get(job);

  if (expectation === 'true') {
    if (realIf !== undefined) {
      failures.push(
        `\`${job}\` is checked as unconditional (\`true\`) but declares a job-level \`if:\`:\n` +
          `        if: ${realIf}\n` +
          `      On runs that condition excludes, the sentinel will FALSE-ALARM.\n` +
          `      Add an EXPECT_* mirror for it and pass that instead of \`true\`.`
      );
    }
    continue;
  }

  const varMatch = expectation.match(/^"\$(EXPECT_[A-Z0-9_]+)"$/);
  if (!varMatch) {
    failures.push(
      `\`${job}\` has an unrecognised expectation token \`${expectation}\`.\n` +
        `      Expected literal \`true\` or \`"$EXPECT_<NAME>"\`.`
    );
    continue;
  }

  const varName = varMatch[1];
  if (realIf === undefined) {
    failures.push(
      `\`${job}\` is checked against mirror \`${varName}\` but has NO job-level \`if:\`.\n` +
        `      The mirror can only be more restrictive than the job, which EXCUSES a\n` +
        `      genuine skip. Check it as \`true\` instead.`
    );
    continue;
  }

  const raw = expects.get(varName);
  if (raw === undefined) {
    failures.push(
      `\`${job}\` references mirror \`${varName}\`, which is not defined in the env block.`
    );
    continue;
  }

  const inner = raw.match(/^\$\{\{\s*(.*?)\s*\}\}$/);
  if (!inner) {
    failures.push(
      `Mirror \`${varName}\` is not a \`\${{ ... }}\` expression: ${raw}\n` +
        `      It cannot be compared to \`${job}\`'s \`if:\` and cannot be trusted.`
    );
    continue;
  }

  if (inner[1] !== realIf) {
    failures.push(
      `MIRROR DRIFT — \`${job}\`:\n` +
        `        job  if: ${realIf}\n` +
        `        ${varName}: ${inner[1]}\n` +
        `      These must be character-identical. A mirror narrower than its job's\n` +
        `      \`if:\` excuses a real skip; a mirror wider false-alarms.`
    );
  }
}

for (const job of checks.keys()) {
  if (!needs.includes(job)) {
    failures.push(
      `\`${SENTINEL_JOB}\` checks \`${job}\` but does not list it in \`needs:\`.\n` +
        `      \`needs.${job}.result\` would be undefined; under \`set -u\` the step dies.`
    );
  }
}

// ── Report ──────────────────────────────────────────────────────────────────
if (failures.length > 0) {
  console.error(`[critical-jobs-mirrors] FAIL — ${failures.length} violation(s) in ${WORKFLOW}:`);
  for (const f of failures) console.error(`  - ${f}`);
  console.error('');
  console.error('  Doctrine: Equoria-axyem.7 / Equoria-gvslq. The skip sentinel is only');
  console.error('  believable while every EXPECT_* mirror is verbatim its job’s `if:`.');
  process.exit(1);
}

const conditional = [...checks.entries()].filter(([, e]) => e !== 'true').length;
console.log(
  `[critical-jobs-mirrors] OK — ${needs.length} critical job(s) guarded by \`${SENTINEL_JOB}\`; ` +
    `${conditional} mirror(s) match their job's \`if:\` verbatim; ` +
    `${needs.length - conditional} unconditional job(s) confirmed to have no \`if:\`.`
);
