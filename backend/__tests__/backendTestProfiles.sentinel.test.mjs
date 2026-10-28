/**
 * Sentinel-positive coverage for the backend test-profile doctrine contract.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import backendJestConfig from '../jest.config.mjs';
import { getPoolConfig } from '../../packages/database/dbPoolConfig.mjs';
import { validateBackendTestProfiles } from '../../scripts/doctrine-checks/check-backend-test-profiles.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function actualInputs() {
  const workflowDocument = yaml.load(readFileSync(path.join(ROOT, '.github/workflows/test.yml'), 'utf8'));
  return {
    backendPackage: JSON.parse(readFileSync(path.join(ROOT, 'backend/package.json'), 'utf8')),
    rootPackage: JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8')),
    prePush: readFileSync(path.join(ROOT, '.husky/pre-push'), 'utf8'),
    workflowDocument,
    maxWorkers: backendJestConfig.maxWorkers,
    poolSize: getPoolConfig({ NODE_ENV: 'test' }).connection_limit,
  };
}

describe('backend test profile contract sentinel', () => {
  test('the repository profiles, hook, CI, and connection budget agree', () => {
    expect(validateBackendTestProfiles(actualInputs())).toEqual([]);
  });

  test.each([
    [
      'package profile drift',
      inputs => {
        inputs.backendPackage.scripts['test:backend:full'] = 'jest --runInBand';
      },
      'test:backend:full drifted',
    ],
    [
      'root package alias drift',
      inputs => {
        inputs.rootPackage.scripts['test:backend:full'] = 'npm test';
      },
      'root test:backend:full drifted',
    ],
    // Owner ruling q233 (2026-10-28, Equoria-zstml) replaced the old contract
    // "pre-push must call test:backend:full": the full check runs only on
    // GitHub and the laptop runs only the changed tests.
    [
      'pre-push drops the changed-file checks',
      inputs => {
        inputs.prePush = inputs.prePush.replace('node "$REPO_ROOT/scripts/preflight/changed-checks.mjs"', 'true');
      },
      'pre-push must run scripts/preflight/changed-checks.mjs',
    ],
    [
      'pre-push runs the full sharded backend suite again',
      inputs => {
        inputs.prePush += '\nnpm run test:backend:full\n';
      },
      'pre-push must not run a full test suite',
    ],
    [
      'pre-push runs the whole frontend suite',
      inputs => {
        inputs.prePush += '\nnpm run test:frontend || exit 1\n';
      },
      'pre-push must not run a full test suite',
    ],
    [
      'CI bypasses the canonical profile',
      inputs => {
        const step = inputs.workflowDocument.jobs['backend-tests'].steps.find(candidate =>
          candidate.run?.includes('npm run test:backend:ci --'),
        );
        step.run = step.run.replace('npm run test:backend:ci --', 'npm test --');
      },
      'backend CI must call test:backend:ci',
    ],
    [
      'worker/pool capacity is exceeded',
      inputs => {
        inputs.maxWorkers = 30;
      },
      'worker/pool budget exceeds reserved capacity',
    ],
    [
      'CI artifact path drifts',
      inputs => {
        const step = inputs.workflowDocument.jobs['backend-tests'].steps.find(
          candidate => candidate.with?.name === 'backend-test-results-shard-${{ matrix.shard }}',
        );
        step.with.path = './backend/coverage/';
      },
      'backend CI must upload per-shard failure artifacts',
    ],
    [
      'CI failure summary is removed',
      inputs => {
        const step = inputs.workflowDocument.jobs['backend-tests'].steps.find(candidate =>
          candidate.name?.startsWith('Summarize backend failure'),
        );
        step.run = step.run.replace('node scripts/summarize-jest-results.mjs', 'node scripts/missing-summary.mjs');
      },
      'backend CI must summarize Jest failures',
    ],
  ])('fires on planted violation: %s', (_label, plantViolation, expectedFailure) => {
    const inputs = actualInputs();
    plantViolation(inputs);

    expect(validateBackendTestProfiles(inputs).join('\n')).toContain(expectedFailure);
  });
});
