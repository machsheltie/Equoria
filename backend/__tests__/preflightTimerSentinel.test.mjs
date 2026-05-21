/**
 * Sentinel: pre-push preflight scripts must NOT hold the event loop for their
 * full timeout budget on the healthy path. (Equoria-l052p)
 *
 * Both scripts/preflight/db-probe.mjs and db-health.mjs race their real work
 * against a `setTimeout(BUDGET_MS)` rejection. The timer was never
 * clearTimeout()'d, so even when the work resolved in ~150ms the unreferenced
 * timer kept Node's event loop alive for the FULL budget (~5s) — taxing every
 * push and, on a cold-connect spike, letting the timer WIN the race and abort
 * the push with a misleading "DB inconsistency" FATAL.
 *
 * This sentinel proves the timer is cleared: each script must finish in well
 * under its BUDGET_MS on a reachable, healthy canonical DB. Reintroducing the
 * dangling timer makes wall time jump back to ~BUDGET_MS and this test fails.
 *
 * Requires the canonical test DB to be reachable (same precondition the hook
 * itself enforces). Runs the scripts exactly as the hook does: cwd = backend/.
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const backendDir = path.join(repoRoot, 'backend');

// Must match the BUDGET_MS / QUERY_BUDGET_MS in both preflight scripts.
const BUDGET_MS = 5000;

function runPreflight(scriptRelPath) {
  const scriptAbs = path.join(repoRoot, scriptRelPath);
  return new Promise(resolve => {
    const start = Date.now();
    const child = spawn(process.execPath, ['--experimental-vm-modules', scriptAbs], {
      cwd: backendDir,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', d => (stdout += d));
    child.stderr.on('data', d => (stderr += d));
    child.on('close', code => {
      resolve({ code, elapsed: Date.now() - start, stdout, stderr });
    });
  });
}

describe('pre-push preflight timer hygiene (Equoria-l052p)', () => {
  test('db-probe.mjs exits well under its budget (no dangling timer)', async () => {
    const { code, elapsed, stderr } = await runPreflight('scripts/preflight/db-probe.mjs');
    // A dangling timer pins the process to ~BUDGET_MS regardless of work speed.
    expect(elapsed).toBeLessThan(BUDGET_MS);
    // Exit 3 == the budget timer won the race (the bug); 0 == healthy.
    expect(code).not.toBe(3);
    if (code !== 0) {
      throw new Error(`db-probe exited ${code} (expected 0); stderr:\n${stderr}`);
    }
  }, 20000);

  test('db-health.mjs exits well under its budget (no dangling timer)', async () => {
    const { code, elapsed, stderr } = await runPreflight('scripts/preflight/db-health.mjs');
    expect(elapsed).toBeLessThan(BUDGET_MS);
    // Exit 3 == budget timer won (the bug). 0 == healthy; 4 == real
    // inconsistency (orphan rows) — not this fix's concern, so tolerate it as
    // long as the script returned promptly.
    expect(code).not.toBe(3);
    expect([0, 4]).toContain(code);
    if (code === 4) {
      console.warn(`[sentinel] db-health reported a real DB inconsistency (exit 4):\n${stderr}`);
    }
  }, 20000);
});
