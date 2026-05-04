#!/usr/bin/env node
// Doctrine: every workflow job that runs `playwright test` must include
// service orchestration in the same job — DB migration, dependency install,
// frontend build, and either explicit backend/frontend start or a Playwright
// config with `webServer` defined.
// Source: 21R Beta Readiness Doctrine + Equoria-aong (P1-4 Blind Hunter).
//
// Heuristic check (workflow YAML is non-Turing-complete enough to avoid full
// parsing): for each line that runs `playwright test`, walk back through the
// containing job and verify that prior steps include all required orchestration
// markers. If a job lacks any marker, report it.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..', '..');
const WORKFLOWS_DIR = path.join(REPO_ROOT, '.github', 'workflows');

if (!fs.existsSync(WORKFLOWS_DIR)) {
  process.exit(0);
}

// Required orchestration markers in the same job, prior to the playwright run.
// Either a webServer-config-driven Playwright config exists in the repo
// (sufficient for backend+frontend startup), or the job has explicit start
// steps.
const REQUIRED_MARKERS = [
  { name: 'db migrate', re: /prisma\s+(?:migrate\s+deploy|db\s+push)/ },
  { name: 'dependency install', re: /\bnpm\s+(?:ci|install)\b/ },
];

const PLAYWRIGHT_RUN_RE = /\bnpx\s+playwright\s+test\b/;

// We accept either an explicit webServer config OR explicit start steps.
function repoHasWebServerConfig() {
  const candidates = [
    'playwright.config.ts',
    'playwright.config.js',
    'playwright.beta-readiness.config.ts',
  ];
  for (const c of candidates) {
    const full = path.join(REPO_ROOT, c);
    if (fs.existsSync(full)) {
      const txt = fs.readFileSync(full, 'utf-8');
      if (/webServer\s*:/.test(txt)) return true;
    }
  }
  return false;
}

const webServerConfig = repoHasWebServerConfig();

function listWorkflowFiles() {
  return fs
    .readdirSync(WORKFLOWS_DIR)
    .filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'))
    .map((f) => path.join(WORKFLOWS_DIR, f));
}

// Locate job boundaries by indentation: top-level `jobs:` then 2-space indent.
function findJobsRanges(lines) {
  const ranges = [];
  let inJobsBlock = false;
  let jobsIndent = -1;
  let currentJob = null;
  let currentStart = -1;
  let currentIndent = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const stripped = line.trimEnd();
    if (stripped === '' || stripped.trimStart().startsWith('#')) continue;
    const indent = line.length - line.trimStart().length;

    if (!inJobsBlock && /^jobs:\s*$/.test(stripped)) {
      inJobsBlock = true;
      jobsIndent = indent;
      continue;
    }
    if (!inJobsBlock) continue;

    if (indent <= jobsIndent && stripped !== '') {
      // Exited jobs block.
      if (currentJob) ranges.push({ name: currentJob, start: currentStart, end: i - 1 });
      inJobsBlock = false;
      currentJob = null;
      continue;
    }

    const jobMatch = /^(\s+)([A-Za-z0-9_-]+):\s*$/.exec(line);
    if (jobMatch && jobMatch[1].length === jobsIndent + 2) {
      if (currentJob) ranges.push({ name: currentJob, start: currentStart, end: i - 1 });
      currentJob = jobMatch[2];
      currentStart = i;
      currentIndent = jobMatch[1].length;
    }
  }
  if (currentJob) ranges.push({ name: currentJob, start: currentStart, end: lines.length - 1 });
  return ranges;
}

const failures = [];

for (const file of listWorkflowFiles()) {
  const content = fs.readFileSync(file, 'utf-8');
  const lines = content.split(/\r?\n/);
  const jobs = findJobsRanges(lines);

  for (const job of jobs) {
    let pwLine = -1;
    for (let i = job.start; i <= job.end; i++) {
      if (PLAYWRIGHT_RUN_RE.test(lines[i]) && !/^\s*#/.test(lines[i])) {
        pwLine = i;
        break;
      }
    }
    if (pwLine === -1) continue;

    const jobText = lines.slice(job.start, pwLine + 1).join('\n');
    const missing = [];
    for (const m of REQUIRED_MARKERS) {
      if (!m.re.test(jobText)) missing.push(m.name);
    }

    // Service-start: webServer config OR explicit step that starts backend/frontend.
    const hasExplicitStart =
      /\b(?:nohup|background|--detach|&\s*$|wait-on)\b/m.test(jobText) ||
      /\bnpm\s+run\s+start\b/.test(jobText);
    if (!webServerConfig && !hasExplicitStart) {
      missing.push('service start (webServer config or explicit start)');
    }

    if (missing.length > 0) {
      failures.push({
        file: path.relative(REPO_ROOT, file),
        job: job.name,
        line: pwLine + 1,
        missing,
      });
    }
  }
}

if (failures.length > 0) {
  console.error('\nPlaywright runs missing service orchestration:');
  for (const f of failures) {
    console.error(`  ${f.file}:${f.line}  job "${f.job}" missing: ${f.missing.join(', ')}`);
  }
  console.error(
    '\nEvery `npx playwright test` step must be preceded by DB migrate, npm ci, ' +
      'and service startup (webServer config or explicit start step).'
  );
  process.exit(1);
}

process.exit(0);
