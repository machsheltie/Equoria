#!/usr/bin/env node
// Doctrine: every `needs:` entry in a GitHub Actions workflow must reference
// a job that is actually defined in the same workflow file.
// Source: defensive against typo/rename/refactor drift that silently breaks
// gating (a job with a typo in `needs:` simply doesn't run, which is invisible
// in the UI).
//
// Heuristics:
//   - Parse each .yml/.yaml workflow.
//   - Collect job ids from the top-level `jobs:` map.
//   - For each `needs:` value (string or array), verify each name exists.
//   - Exit 1 with a list of unresolved references.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..', '..');
const WORKFLOWS_DIR = path.join(REPO_ROOT, '.github', 'workflows');

if (!fs.existsSync(WORKFLOWS_DIR)) {
  process.exit(0);
}

const failures = [];

function listWorkflowFiles() {
  return fs
    .readdirSync(WORKFLOWS_DIR)
    .filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'))
    .map((f) => path.join(WORKFLOWS_DIR, f));
}

// Lightweight YAML parsing: we only need top-level job ids and `needs:` lines.
// Full YAML parser is overkill and adds a dependency.
function extractJobsAndNeeds(content) {
  const lines = content.split(/\r?\n/);
  const jobIds = new Set();
  const needsRefs = [];

  let inJobsBlock = false;
  let jobsIndent = -1;
  let currentJob = null;
  let currentJobLine = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trimEnd();
    if (trimmed === '' || trimmed.trimStart().startsWith('#')) continue;

    const indent = line.length - line.trimStart().length;

    // Detect top-level `jobs:` block.
    if (!inJobsBlock && /^jobs:\s*$/.test(trimmed)) {
      inJobsBlock = true;
      jobsIndent = indent;
      continue;
    }

    if (inJobsBlock && indent <= jobsIndent && trimmed !== '') {
      // Exited jobs block.
      inJobsBlock = false;
      currentJob = null;
      continue;
    }

    if (!inJobsBlock) continue;

    // Job id is `<id>:` at jobsIndent + 2 (typically).
    const jobMatch = /^(\s+)([A-Za-z0-9_-]+):\s*$/.exec(line);
    if (jobMatch && jobMatch[1].length === jobsIndent + 2) {
      currentJob = jobMatch[2];
      currentJobLine = i + 1;
      jobIds.add(currentJob);
      continue;
    }

    // `needs:` line within a job.
    if (currentJob) {
      const inlineMatch = /^\s+needs:\s*(.+)$/.exec(line);
      if (inlineMatch) {
        const value = inlineMatch[1].trim();
        // Strip trailing comments.
        const noComment = value.replace(/\s+#.*$/, '').trim();
        if (noComment.startsWith('[')) {
          // Inline array: [a, b, c]
          const inner = noComment.replace(/^\[|\]$/g, '');
          const refs = inner
            .split(',')
            .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
            .filter(Boolean);
          for (const ref of refs) {
            needsRefs.push({ job: currentJob, ref, line: i + 1 });
          }
        } else if (!noComment.startsWith('|') && !noComment.startsWith('>')) {
          // Single value (possibly quoted).
          const ref = noComment.replace(/^['"]|['"]$/g, '');
          if (ref) {
            needsRefs.push({ job: currentJob, ref, line: i + 1 });
          } else {
            // Block-form list following on next lines.
            for (let j = i + 1; j < lines.length; j++) {
              const next = lines[j];
              if (next.trim() === '' || next.trim().startsWith('#')) continue;
              const itemMatch = /^\s+-\s+(.+)$/.exec(next);
              if (!itemMatch) break;
              const ref2 = itemMatch[1]
                .replace(/\s+#.*$/, '')
                .trim()
                .replace(/^['"]|['"]$/g, '');
              needsRefs.push({ job: currentJob, ref: ref2, line: j + 1 });
            }
          }
        }
      }
    }
  }

  return { jobIds, needsRefs };
}

for (const file of listWorkflowFiles()) {
  const content = fs.readFileSync(file, 'utf-8');
  const { jobIds, needsRefs } = extractJobsAndNeeds(content);

  for (const { job, ref, line } of needsRefs) {
    if (!jobIds.has(ref)) {
      failures.push(
        `${path.relative(REPO_ROOT, file)}:${line}: job "${job}" has needs: "${ref}" but no job by that id is defined`
      );
    }
  }
}

if (failures.length > 0) {
  console.error('\nUnresolved `needs:` references in workflows:');
  for (const f of failures) console.error(`  ${f}`);
  console.error('\nEvery `needs:` must point to a job defined in the same workflow file.');
  process.exit(1);
}

process.exit(0);
