/**
 * Free-memory preflight for local test runs (Equoria-8w3ax): a run starts only
 * when enough memory is free, waits a bounded time for it, then refuses.
 */
import { describe, expect, it } from '@jest/globals';
import { memoryProfiles, readMemoryBudget, refusalMessage, waitForFreeMemory } from './test-memory-preflight.mjs';

const mb = 1024 * 1024;

/** A free-memory reading that walks through `values` (MB), then repeats the last one. */
function readings(values) {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)] * mb;
}

function recordingPause() {
  const pauses = [];
  return { pauses, pause: async ms => void pauses.push(ms) };
}

describe('readMemoryBudget', () => {
  it('defaults: targeted 1536 MB, the full gate more, 60 s wait', () => {
    expect(readMemoryBudget('targeted', {})).toEqual({
      profile: 'targeted',
      minFreeMb: 1536,
      waitSeconds: 60,
    });
    expect(readMemoryBudget('full', {}).minFreeMb).toBe(memoryProfiles.full);
    expect(memoryProfiles.full).toBeGreaterThan(memoryProfiles.targeted);
  });

  it('the environment overrides both limits', () => {
    expect(
      readMemoryBudget('full', {
        EQUORIA_TEST_MIN_FREE_MB: '900',
        EQUORIA_TEST_MEMORY_WAIT_SECONDS: '0',
      }),
    ).toEqual({ profile: 'full', minFreeMb: 900, waitSeconds: 0 });
  });

  it.each([['-1'], ['1.5GB'], ['lots']])('rejects a malformed override %s', raw => {
    expect(() => readMemoryBudget('targeted', { EQUORIA_TEST_MIN_FREE_MB: raw })).toThrow(/whole number/);
    expect(() => readMemoryBudget('targeted', { EQUORIA_TEST_MEMORY_WAIT_SECONDS: raw })).toThrow(/whole number/);
  });

  it('rejects an unknown profile', () => {
    expect(() => readMemoryBudget('everything', {})).toThrow(/unknown memory profile/);
  });
});

describe('waitForFreeMemory', () => {
  const budget = { profile: 'targeted', minFreeMb: 1536, waitSeconds: 60 };

  it('starts at once when enough memory is free', async () => {
    const { pauses, pause } = recordingPause();
    const result = await waitForFreeMemory(budget, { freeBytes: readings([4000]), pause });
    expect(result).toEqual({ ok: true, freeMb: 4000, minFreeMb: 1536, waitedSeconds: 0 });
    expect(pauses).toEqual([]);
  });

  it('waits while memory recovers, then starts', async () => {
    const { pauses, pause } = recordingPause();
    const lines = [];
    const result = await waitForFreeMemory(budget, {
      freeBytes: readings([800, 1000, 1600]),
      pause,
      log: line => lines.push(line),
    });
    expect(result).toEqual({ ok: true, freeMb: 1600, minFreeMb: 1536, waitedSeconds: 10 });
    expect(pauses).toEqual([5000, 5000]);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/800 MB free, targeted test runs need 1536 MB/);
  });

  it('gives up after the bounded wait and the refusal says why', async () => {
    const { pauses, pause } = recordingPause();
    const shortBudget = { ...budget, waitSeconds: 12 };
    const result = await waitForFreeMemory(shortBudget, { freeBytes: readings([700]), pause });
    expect(result).toEqual({ ok: false, freeMb: 700, minFreeMb: 1536, waitedSeconds: 12 });
    expect(pauses).toEqual([5000, 5000, 2000]);
    expect(refusalMessage(shortBudget, result)).toMatch(
      /Refusing to start targeted tests: only 700 MB of memory is free \(need 1536 MB; waited 12s\)/,
    );
  });

  it('a zero minimum never blocks', async () => {
    const result = await waitForFreeMemory(
      { profile: 'full', minFreeMb: 0, waitSeconds: 60 },
      { freeBytes: readings([1]), pause: async () => {} },
    );
    expect(result.ok).toBe(true);
  });
});
