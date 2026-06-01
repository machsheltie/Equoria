#!/usr/bin/env node
/**
 * Doctrine: GitHub Actions workflows that use `cancel-in-progress: true`
 * MUST include `github.sha` (or `github.run_id`, or a per-PR/issue identifier)
 * in the concurrency group. Otherwise a newer commit cancels the in-flight
 * run from the previous commit, killing long-running jobs mid-execution.
 *
 * Equoria-sv0b: this exact bug masked the broader E2E suite's failures across
 * 14+ commits because every push to master cancelled the e2e-tests job from
 * the previous push before it could complete.
 *
 * What's allowed (per-PR/per-issue scoped — retries SHOULD cancel older):
 *   group: blind-hunter-${{ github.event.pull_request.number }}
 *   group: pr-body-evidence-${{ github.event.pull_request.number }}
 *   group: x-${{ github.event.pull_request.number || github.ref }}
 *
 * What's allowed (per-commit scoped — different commits run independently):
 *   group: ${{ github.workflow }}-${{ github.ref }}-${{ github.sha }}
 *   group: ${{ github.workflow }}-${{ github.run_id }}
 *
 * What's forbidden (ref-only scoped — every commit cancels the previous):
 *   group: ${{ github.workflow }}-${{ github.ref }}        ← THE DEFECT
 *   group: doctrine-gate-${{ github.ref }}                  ← SAME PATTERN
 *
 * Exception: if a workflow only runs short-lived steps (~1 min) where
 * cancellation is harmless, you can opt out with the marker:
 *     # doctrine-allow: workflow-cancel-shortrun
 * on the same line as `cancel-in-progress: true`.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const WORKFLOWS_DIR = '.github/workflows';
const ALLOW_MARKER = 'doctrine-allow: workflow-cancel-shortrun';

// Acceptable group identifiers — at least one must appear in the group line.
const PER_RUN_TOKENS = [
  'github.sha',
  'github.run_id',
  'github.run_number',
  'github.event.pull_request.number',
  'github.event.issue.number',
];

function checkWorkflow(path) {
  const content = readFileSync(path, 'utf8');
  const lines = content.split('\n');

  // Find each `concurrency:` block and inspect its group/cancel-in-progress
  // pair. There can be multiple (workflow-level and job-level).
  const violations = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!/^\s*concurrency:\s*$/.test(line)) {
      continue;
    }

    // Look ahead up to 5 lines for `group:` and `cancel-in-progress:`.
    let group = null;
    let cancel = null;
    let cancelLine = null;
    for (let j = i + 1; j < Math.min(i + 6, lines.length); j += 1) {
      const peek = lines[j];
      // Stop if we de-indent past the concurrency block.
      if (/^\S/.test(peek) || (/^\s*[a-z]+:\s*$/i.test(peek) && !/^\s+/.test(peek))) {
        break;
      }
      const groupMatch = peek.match(/^\s+group:\s*(.+?)\s*$/);
      if (groupMatch) {
        group = groupMatch[1];
      }
      const cancelMatch = peek.match(/^\s+cancel-in-progress:\s*(\S+)/);
      if (cancelMatch) {
        cancel = cancelMatch[1].toLowerCase();
        cancelLine = peek;
      }
    }

    if (cancel !== 'true' || group === null) {
      continue;
    }
    if (cancelLine && cancelLine.includes(ALLOW_MARKER)) {
      continue;
    }

    const hasPerRunToken = PER_RUN_TOKENS.some((tok) => group.includes(tok));
    if (!hasPerRunToken) {
      violations.push({
        path,
        line: i + 1,
        group,
      });
    }
  }

  return violations;
}

function main() {
  let allViolations = [];
  let _filesChecked = 0;

  for (const entry of readdirSync(WORKFLOWS_DIR)) {
    if (!entry.endsWith('.yml') && !entry.endsWith('.yaml')) {
      continue;
    }
    const path = join(WORKFLOWS_DIR, entry);
    _filesChecked += 1;
    allViolations = allViolations.concat(checkWorkflow(path));
  }

  if (allViolations.length === 0) {
    process.exit(0);
  }

  console.error('');
  console.error(
    'Workflow concurrency.cancel-in-progress without per-commit identifier (Equoria-sv0b):'
  );
  for (const v of allViolations) {
    console.error(`  ${v.path}:${v.line}`);
    console.error(`    group: ${v.group}`);
  }
  console.error('');
  console.error('Fix: include `${{ github.sha }}`, `${{ github.run_id }}`, or a per-PR/issue');
  console.error('identifier in the concurrency group so each commit runs independently.');
  console.error('Without it, every push cancels the previous run mid-execution, masking');
  console.error('long-running test failures.');
  console.error('');
  console.error(`If short-run cancellation is intentional, add the same-line marker:`);
  console.error(`    # ${ALLOW_MARKER}`);
  console.error('on the cancel-in-progress: true line.');

  process.exit(1);
}

main();
