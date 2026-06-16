#!/usr/bin/env node
/**
 * Keeps backend package profiles, pre-push, CI, and DB capacity in sync.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const EXPECTED = {
  full: 'node scripts/run-suite-sharded.mjs --jest-shards=8 --timeout=600 --heap=4096',
  ciPre: "node -e \"require('node:fs').mkdirSync('test-results', { recursive: true })\"",
  ci:
    'node --experimental-vm-modules --max-old-space-size=8192 ' +
    'node_modules/jest/bin/jest.js --maxWorkers=2 --workerIdleMemoryLimit=1500MB ' +
    '--ci --forceExit --json --outputFile=test-results/jest-results.json',
  targeted:
    'node --experimental-vm-modules --max-old-space-size=8192 ' +
    'node_modules/jest/bin/jest.js --runInBand',
  diagnostic: 'node scripts/diagnose-full-suite.mjs',
};
const EXPECTED_ROOT = {
  'test:backend:full': 'npm --prefix backend run test:backend:full',
  'test:backend:ci': 'npm --prefix backend run test:backend:ci',
  'test:backend:targeted': 'npm --prefix backend run test:backend:targeted --',
  'test:backend:diagnostic': 'npm --prefix backend run test:backend:diagnostic --',
};

export function validateBackendTestProfiles({
  backendPackage,
  rootPackage,
  prePush,
  workflowDocument,
  maxWorkers,
  poolSize,
}) {
  const failures = [];
  const scripts = backendPackage.scripts ?? {};

  for (const [profile, expected] of Object.entries(EXPECTED)) {
    const scriptName = profile === 'ciPre' ? 'pretest:backend:ci' : `test:backend:${profile}`;
    const actual = scripts[scriptName];
    if (actual !== expected) {
      failures.push(`${scriptName} drifted from the canonical command`);
    }
  }
  for (const [scriptName, expected] of Object.entries(EXPECTED_ROOT)) {
    if (rootPackage.scripts?.[scriptName] !== expected) {
      failures.push(`root ${scriptName} drifted from the backend profile`);
    }
  }

  const executablePrePushLines = prePush
    .split(/\r?\n/)
    .filter((line) => !line.trimStart().startsWith('#'))
    .map((line) => line.trim());

  if (
    !executablePrePushLines.some(
      (line) =>
        line === 'npm run test:backend:full' ||
        /^if ! npm run test:backend:full;\s*then$/.test(line)
    )
  ) {
    failures.push('pre-push must call test:backend:full');
  }
  if (executablePrePushLines.some((line) => /--shard=/.test(line))) {
    failures.push('pre-push duplicates shard arguments instead of using the full profile');
  }

  const backendSteps = workflowDocument?.jobs?.['backend-tests']?.steps ?? [];
  const backendRunScripts = backendSteps
    .map((step) => step?.run)
    .filter((run) => typeof run === 'string');
  if (!backendRunScripts.some((run) => /^\s*npm run test:backend:ci --(?:\s|\\)/m.test(run))) {
    failures.push('backend CI must call test:backend:ci');
  }
  const resultUpload = backendSteps.find(
    (step) =>
      typeof step?.uses === 'string' &&
      step.uses.startsWith('actions/upload-artifact@') &&
      step?.with?.name === 'backend-test-results-shard-${{ matrix.shard }}'
  );
  if (
    !resultUpload ||
    resultUpload.if !== 'failure()' ||
    resultUpload.with?.path !== './backend/test-results/'
  ) {
    failures.push('backend CI must upload per-shard failure artifacts');
  }
  const summaryStep = backendSteps.find(
    (step) =>
      typeof step?.name === 'string' &&
      step.name.startsWith('Summarize backend failure') &&
      step.if === 'failure()'
  );
  if (
    !summaryStep ||
    typeof summaryStep.run !== 'string' ||
    !summaryStep.run.includes(
      'node scripts/summarize-jest-results.mjs test-results/jest-results.json test-results/jest-summary.txt'
    )
  ) {
    failures.push('backend CI must summarize Jest failures before artifact upload');
  }

  if (!Number.isInteger(maxWorkers) || !Number.isInteger(poolSize)) {
    failures.push('worker/pool budget must use explicit numeric defaults');
  } else if (maxWorkers * poolSize > 80) {
    failures.push(`worker/pool budget exceeds reserved capacity: ${maxWorkers} * ${poolSize} > 80`);
  }

  return failures;
}

async function main() {
  const { default: yaml } = await import('js-yaml');
  const backendPackage = JSON.parse(readFileSync(path.join(ROOT, 'backend/package.json'), 'utf8'));
  const rootPackage = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const [{ default: jestConfig }, { getPoolConfig }] = await Promise.all([
    import(pathToFileURL(path.join(ROOT, 'backend/jest.config.mjs')).href),
    import(pathToFileURL(path.join(ROOT, 'packages/database/dbPoolConfig.mjs')).href),
  ]);
  const failures = validateBackendTestProfiles({
    backendPackage,
    rootPackage,
    prePush: readFileSync(path.join(ROOT, '.husky/pre-push'), 'utf8'),
    workflowDocument: yaml.load(
      readFileSync(path.join(ROOT, '.github/workflows/test.yml'), 'utf8')
    ),
    maxWorkers: jestConfig.maxWorkers,
    poolSize: getPoolConfig({ NODE_ENV: 'test' }).connection_limit,
  });

  if (failures.length) {
    for (const failure of failures) {
      console.error(`[backend-test-profiles] ${failure}`);
    }
    process.exit(1);
  }
  console.log('[backend-test-profiles] PASS');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  await main();
}
