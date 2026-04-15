/**
 * prisma-generate.mjs
 *
 * Windows-safe wrapper for `prisma generate`.
 *
 * Problem: On Windows, `query_engine-windows.dll.node` is a native Node.js
 * addon that gets memory-locked by any process that imported @prisma/client.
 * Prisma tries to rename a .tmp file over it on generate, but Windows refuses
 * to rename/overwrite a locked file — EPERM.
 *
 * The subtle issue: killing the server isn't enough on its own because nodemon
 * restarts it immediately, re-locking the DLL before prisma generate can run.
 *
 * Fix:
 *   1. Kill node processes that have the Prisma DLL in their loaded modules.
 *   2. Wait for OS to release handles.
 *   3. Actively DELETE the DLL file — this is the key step. If no process is
 *      holding it, the delete succeeds, and Prisma writes a fresh file without
 *      needing to rename over a locked one. Nodemon's next restart will briefly
 *      fail to find @prisma/client, then succeed once the new DLL exists.
 *   4. If the delete still fails, exit with a clear message.
 */

import { execSync, spawnSync } from 'child_process';
import { readdirSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const clientDir = join(__dirname, '..', 'node_modules', '.prisma', 'client');
const dllFile = join(clientDir, 'query_engine-windows.dll.node');
const isWindows = process.platform === 'win32';

// ── Step 1: Kill processes holding the DLL, then delete the DLL itself ────────
if (isWindows) {
  const myPid = process.pid;
  console.log('[prisma-generate] Checking for processes holding the Prisma query engine DLL…');

  const psScript = `
$myPid = ${myPid}
$killed = 0
Get-Process -Name node -ErrorAction SilentlyContinue |
  Where-Object { $_.Id -ne $myPid } |
  ForEach-Object {
    try {
      $hasPrisma = ($_.Modules | Where-Object { $_.ModuleName -like '*query_engine*' }).Count -gt 0
      if ($hasPrisma) {
        Write-Host "  Stopping PID $($_.Id) - Prisma engine DLL detected"
        Stop-Process -Id $_.Id -Force
        $killed++
      }
    } catch { }
  }
if ($killed -gt 0) {
  Write-Host "  Waiting for OS to release file handles..."
  Start-Sleep -Milliseconds 2000
}
if ($killed -eq 0) { Write-Host "  No processes were holding the DLL." }
`;

  const encoded = Buffer.from(psScript, 'utf16le').toString('base64');
  try {
    execSync(`powershell -NoProfile -EncodedCommand ${encoded}`, { stdio: 'inherit' });
  } catch {
    console.warn('[prisma-generate] PowerShell step failed — proceeding anyway.');
  }

  // Now delete the DLL directly. This is the key step:
  // - If processes are gone: delete succeeds → Prisma writes a fresh file, no rename needed.
  // - If nodemon restarted too fast and re-locked it: delete fails → we tell the user clearly.
  try {
    unlinkSync(dllFile);
    console.log('[prisma-generate] DLL removed — Prisma will write a fresh one.\n');
  } catch (err) {
    if (err.code === 'ENOENT') {
      // File doesn't exist yet — first-time generate, that's fine.
      console.log('[prisma-generate] No existing DLL found — fresh generate.\n');
    } else {
      // Still locked — nodemon restarted the server before we could delete it.
      console.error('\n[prisma-generate] ERROR: Could not remove the Prisma DLL.');
      console.error('  The file is still locked — nodemon likely restarted the server too fast.');
      console.error('  Please stop your backend dev server (Ctrl+C in the nodemon terminal),');
      console.error('  run `npm run generate`, then restart the server with `npm run dev`.\n');
      process.exit(1);
    }
  }
}

// ── Step 2: Remove stale .tmp files left by previous failed generates ─────────
try {
  const files = readdirSync(clientDir);
  const tmpFiles = files.filter((f) => f.includes('.tmp'));
  for (const f of tmpFiles) {
    const fullPath = join(clientDir, f);
    try {
      unlinkSync(fullPath);
      console.log(`[prisma-generate] Removed stale temp file: ${f}`);
    } catch (err) {
      console.warn(`[prisma-generate] Could not remove ${f}: ${err.message}`);
    }
  }
} catch {
  // clientDir may not exist yet on first run — that's fine
}

// ── Step 3: Run prisma generate ───────────────────────────────────────────────
console.log('[prisma-generate] Running prisma generate…\n');
const result = spawnSync('npx', ['prisma', 'generate', '--schema=prisma/schema.prisma'], {
  stdio: 'inherit',
  shell: true,
  cwd: join(__dirname, '..'),
});

process.exit(result.status ?? 0);
