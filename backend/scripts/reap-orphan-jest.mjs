/**
 * Orphan-jest reaper (test-run hygiene, user directive 2026-08-18).
 *
 * A jest run that is killed externally (Ctrl+C on the wrapper, a crashed
 * terminal, a stopped background task) can leave worker processes behind —
 * each one a full node process holding the Express app, a Prisma pool, and
 * up to the configured heap ceiling. On a 16GB machine a few of these brick
 * the laptop. This script finds node processes whose command line mentions
 * jest AND whose parent process is dead (a live run's workers always have a
 * live parent), kills them, and reports what it did.
 *
 * Wired as the `posttest` npm lifecycle script so every `npm test` sweep
 * ends with a reap; also runnable directly: `node scripts/reap-orphan-jest.mjs`.
 * Windows-only by design (the dev machine); CI runners are ephemeral, so on
 * other platforms this is a silent no-op.
 */

import { execFileSync } from 'node:child_process';

function main() {
  if (process.platform !== 'win32') {
    return;
  }

  const psScript = `
    $all = (Get-Process).Id
    $orphans = Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
      Where-Object { $_.CommandLine -match 'jest' -and ($all -notcontains $_.ParentProcessId) -and $_.ProcessId -ne ${process.pid} }
    foreach ($p in $orphans) { Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue }
    Write-Output $orphans.Count
  `;

  try {
    const out = execFileSync('powershell.exe', ['-NoProfile', '-Command', psScript], {
      encoding: 'utf8',
      timeout: 30000,
    }).trim();
    const count = Number.parseInt(out, 10) || 0;
    if (count > 0) {
      console.log(`[reap-orphan-jest] Killed ${count} orphaned jest worker process(es).`);
    }
  } catch (err) {
    // Reaper failure must never fail the test run it trails; report and move on.
    console.warn(`[reap-orphan-jest] Sweep failed (non-fatal): ${err.message}`);
  }
}

main();
