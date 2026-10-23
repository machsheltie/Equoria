/**
 * Sentinel — the weekly Burn-In job boots the same E2E backend as the
 * e2e-tests job and fits inside its own timeout (Equoria-cgx4h).
 *
 * The burn-in job runs the same Playwright suite as e2e-tests but was written
 * without the Redis service, the E2E rate-limit override, or the chromium-only
 * project filter. Every scheduled run since 2026-07-12 therefore failed in
 * about five minutes: the beta-profile backend could not reach Redis,
 * registration never completed and global-setup died in each iteration. The
 * older cancellations (2026-05-03 to 2026-07-05) were the 60-minute job
 * timeout: five passes of a 13 to 24 minute suite do not fit in it.
 *
 * A workflow is not importable, so this reads test.yml as text, like
 * securityScanAuditAllowlist.sentinel.test.mjs, and slices the two jobs.
 */
import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const workflow = readFileSync(path.join(ROOT, '.github/workflows/test.yml'), 'utf8');

const sliceJob = name => {
  const from = workflow.indexOf(`\n  ${name}:\n`);
  expect(from).toBeGreaterThan(-1);
  const rest = workflow.slice(from + 1);
  const next = rest.slice(1).search(/\n {2}[a-z][a-z0-9-]*:\n/);
  return next === -1 ? rest : rest.slice(0, next + 1);
};

const e2eJob = sliceJob('e2e-tests');
const burnIn = sliceJob('burn-in');

const rateLimit = job => /E2E_RATE_LIMIT_MAX:\s*'(\d+)'/.exec(job)?.[1];

describe('burn-in job matches the e2e-tests backend and its time budget (Equoria-cgx4h)', () => {
  it('sliced two distinct jobs', () => {
    expect(e2eJob).toContain("name: 'E2E Tests (Playwright)'");
    expect(burnIn).toContain("name: 'Burn-In (Flaky Detection)'");
    expect(burnIn).not.toContain('E2E Tests (Playwright)');
  });

  it('provisions Redis like e2e-tests, which the beta-profile backend needs', () => {
    expect(e2eJob).toMatch(/\n {6}redis:\n {8}image: redis:7-alpine/);
    expect(burnIn).toMatch(/\n {6}redis:\n {8}image: redis:7-alpine/);
  });

  it('sets the same E2E rate-limit ceiling as e2e-tests', () => {
    expect(rateLimit(e2eJob)).toBeDefined();
    expect(rateLimit(burnIn)).toBe(rateLimit(e2eJob));
  });

  it('runs only the chromium project, the only browser the job installs', () => {
    expect(burnIn).toContain('npx playwright install --with-deps chromium');
    const invocations = burnIn.match(/npx playwright test[^\n]*/g) ?? [];
    expect(invocations.length).toBeGreaterThan(0);
    for (const line of invocations) {
      expect(line).toContain('--project=chromium');
    }
  });

  it('keeps iterations x measured pass time inside the 60-minute job timeout', () => {
    expect(burnIn).toContain('timeout-minutes: 60');
    const loop = /for i in (?:\{1\.\.(\d+)\}|((?:\d+ ?)+)); do/.exec(burnIn);
    expect(loop).not.toBeNull();
    const iterations = loop[1] ? Number(loop[1]) : loop[2].trim().split(/\s+/).length;
    // One pass took 13.5 minutes in the run inspected; setup is about 3 minutes.
    expect(iterations * 13.5 + 3).toBeLessThan(60);
  });
});
