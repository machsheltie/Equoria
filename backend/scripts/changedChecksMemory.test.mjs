/**
 * The pre-push changed-checks runner takes the same free-memory preflight as
 * `npm run test:backend:targeted` before it starts a test runner
 * (Equoria-8w3ax.1): too little free memory refuses, a push with no tests to
 * run never waits on memory, and a bad override fails closed.
 */
import { describe, expect, it } from '@jest/globals';
import os from 'node:os';
import { memoryAllowsTests } from '../../scripts/preflight/changed-checks.mjs';

function collector() {
  const lines = [];
  return { lines, log: line => void lines.push(line) };
}

describe('memoryAllowsTests (pre-push hook)', () => {
  it('refuses to start tests when free memory is below the threshold', async () => {
    const { lines, log } = collector();
    const env = { EQUORIA_TEST_MIN_FREE_MB: '99999999', EQUORIA_TEST_MEMORY_WAIT_SECONDS: '0' };
    expect(await memoryAllowsTests(3, { log, env })).toBe(false);
    expect(lines.join('\n')).toMatch(/REFUSED: \[memory\] Refusing to start targeted tests/);
  });

  it('starts tests when free memory meets the threshold', async () => {
    const { lines, log } = collector();
    const env = { EQUORIA_TEST_MIN_FREE_MB: '1', EQUORIA_TEST_MEMORY_WAIT_SECONDS: '0' };
    expect(os.freemem()).toBeGreaterThan(1024 * 1024);
    expect(await memoryAllowsTests(3, { log, env })).toBe(true);
    expect(lines.join('\n')).toMatch(/starting/);
  });

  it('does not check or wait on memory when there are no tests to run', async () => {
    const { lines, log } = collector();
    const env = { EQUORIA_TEST_MIN_FREE_MB: '99999999', EQUORIA_TEST_MEMORY_WAIT_SECONDS: '600' };
    expect(await memoryAllowsTests(0, { log, env })).toBe(true);
    expect(lines).toEqual([]);
  });

  it('fails closed on an override that is not a whole number', async () => {
    const { lines, log } = collector();
    expect(await memoryAllowsTests(1, { log, env: { EQUORIA_TEST_MIN_FREE_MB: 'lots' } })).toBe(false);
    expect(lines.join('\n')).toMatch(/EQUORIA_TEST_MIN_FREE_MB must be a whole number/);
  });
});
