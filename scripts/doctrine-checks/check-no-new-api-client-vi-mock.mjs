#!/usr/bin/env node
// Doctrine: do NOT add new vi.mock-of-api-client tests.
// Source: CLAUDE.md "Testing Philosophy" —
//   "Frontend unit tests: Existing tests with mocked API responses may
//    remain. Do NOT add new `vi.mock`-of-API-client tests. Prefer
//    Playwright E2E for all new user-facing feature coverage."
//
// A vi.mock() of the api-client module fakes the entire backend boundary,
// so the test passes even when the real API/controller/DB is broken —
// exactly the failure mode the no-mocks doctrine exists to prevent. The
// files in BASELINE predate this rule and are grandfathered; any NEW
// frontend file (or a brand-new vi.mock-of-api-client in a non-baseline
// file) fails this gate.
//
// Mirror of the Equoria-ip82 sentinel pattern: the check fires on a real
// violation when planted, and passes when removed. Wired into the
// beta-readiness gate via scripts/doctrine-checks/run-all.sh (which is
// GATE 1 of scripts/check-beta-readiness.sh) and the lint:fix CI gate's
// doctrine-checks step.
//
// ── GOVERNANCE / BURN-DOWN (Equoria-fefh2.11) ────────────────────────────
// Owning burn-down issue: Equoria-f12xy.
// Current baseline: 4 grandfathered files (2026-06-10). Was 23 at capture
// (2026-05-18, Equoria-efaz); 15 were migrated to MSW network-boundary
// stubs under f12xy M2–M4, and 4 entries pointing at since-deleted files
// were removed as STALE under Equoria-fefh2.11.
// Target: 0 — migrate each remaining suite to a Playwright E2E against the
// real backend (or an MSW network-boundary stub where E2E is not viable).
//
// To shrink (contributor instruction): delete the file's vi.mock of
// api-client (convert it to a real-API Playwright E2E or remove the mock)
// AND remove the path from BASELINE in the SAME commit, updating the
// "Current baseline" count above. The list may only ever SHRINK — never
// append. A baseline entry whose file no longer exists on disk is STALE
// and fails this check until the entry is removed (stale entries are
// unusable headroom a future violation could hide under).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  isPlantArtifactBasename,
  readScannedFileSyncTolerant,
} from '../lib/doctrine-scan-patterns.mjs';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..', '..');
const SCAN_ROOT = path.join(REPO_ROOT, 'frontend', 'src');

if (!fs.existsSync(SCAN_ROOT)) {
  process.exit(0);
}

// Frozen baseline of pre-existing grandfathered files (captured 2026-05-18,
// Equoria-efaz). Paths are repo-relative with forward slashes. This list
// must only ever SHRINK — never append a new path here. Every entry MUST
// exist on disk; stale entries fail the check (see staleEntries below).
const CANONICAL_BASELINE = [
  // Equoria-f12xy (M2): EnrichmentActivityPanel + MilestoneEvaluationDisplay +
  // BreedingPredictionsPanel + BreedingPairSelection.story-6-1 migrated off
  // vi.mock-of-api-client to MSW at the fetch boundary — removed from baseline
  // (the list may only shrink).
  // Equoria-f12xy (agent-M3): the 9 hook/context suites (AuthContext, useAuth,
  // useHorseCoatGenetics, useHorseGenetics, useSessionGuard,
  // useGameNotifications, useHorseById, useProgression, useTraining) were
  // migrated off vi.mock-of-api-client to MSW network-boundary stubs — removed
  // from baseline (the list may only shrink).
  // Equoria-f12xy (agent-M4): the final 2 .ts suites (useTransactionHistory,
  // leaderboards) were migrated off vi.mock-of-api-client to MSW
  // network-boundary stubs — removed from baseline (the list may only shrink).
  // Equoria-fefh2.11: 4 STALE entries removed — the files no longer exist on
  // disk (HorseDetailPage.ProgressionTab.test.tsx, LoginPage.beta.test.tsx,
  // MessagesPage.test.tsx, ProfilePage.test.tsx). The list may only shrink.
  'frontend/src/pages/__tests__/ForgotPasswordPage.test.tsx',
  'frontend/src/pages/__tests__/LoginPage.test.tsx',
  'frontend/src/pages/__tests__/RegisterPage.test.tsx',
  'frontend/src/pages/__tests__/ResetPasswordPage.test.tsx',
];

// Equoria-fefh2.11: optional baseline-path override (argv[2], a JSON array of
// repo-relative paths) so the doctrineBaselineStale sentinel can prove the
// stale-entry detection FIRES against a planted baseline without editing this
// file. Production callers (run-all.sh, CI) pass no argument and get the
// canonical inline list.
function loadBaselinePaths() {
  const overridePath = process.argv[2];
  if (!overridePath) return CANONICAL_BASELINE;
  const parsed = JSON.parse(fs.readFileSync(path.resolve(overridePath), 'utf8'));
  if (!Array.isArray(parsed) || parsed.some((p) => typeof p !== 'string')) {
    console.error(
      `[api-client-vi-mock] baseline override ${overridePath} must be a JSON array of repo-relative path strings`
    );
    process.exit(2);
  }
  return parsed;
}

const BASELINE = new Set(loadBaselinePaths());

// Equoria-fefh2.11 ratchet: every baseline entry must exist on disk. A stale
// entry (deleted/renamed file) is unusable grandfathered headroom that a
// future violation could silently hide under — the baseline may only shrink.
const staleEntries = [...BASELINE].filter(
  (rel) => !fs.existsSync(path.join(REPO_ROOT, ...rel.split('/')))
);
if (staleEntries.length > 0) {
  console.error(
    '[api-client-vi-mock] FAIL — stale baseline entries (files no longer exist on disk):'
  );
  for (const s of staleEntries) {
    console.error(`  ${s}`);
  }
  console.error(
    '\nThe baseline may only SHRINK: remove the stale path(s) from BASELINE in' +
      '\nscripts/doctrine-checks/check-no-new-api-client-vi-mock.mjs and update' +
      '\nthe "Current baseline" count in the governance header (Equoria-fefh2.11).'
  );
  process.exit(1);
}

// Matches: vi.mock('@/lib/api-client'), vi.mock("../../lib/api-client"),
// vi.mock(`../lib/api-client`, ...). Any module specifier whose path ends
// in api-client (optionally with an extension) is the api-client module.
const API_CLIENT_VI_MOCK = /vi\.mock\(\s*(['"`])[^'"`]*api-client(\.[a-z]+)?\1/;

function walk(dir) {
  const out = [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    // Equoria-q7lqz: a directory can vanish mid-scan when a concurrent jest
    // sentinel suite deletes its temp scaffolding. Tolerate ONLY ENOENT,
    // loudly; any other error (EACCES, …) is a real fault and must crash.
    if (err && err.code === 'ENOENT') {
      console.error(`[api-client-vi-mock] notice: skipped vanished directory ${dir}`);
      return out;
    }
    throw err;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') continue;
      out.push(...walk(full));
    } else if (
      entry.isFile() &&
      /\.(ts|tsx|js|jsx|mjs)$/.test(entry.name) &&
      // Equoria-q7lqz: sentinel plant artifacts (basename contains the
      // UPPERCASE DO_NOT_COMMIT / PLANTED markers) are planted+deleted by
      // concurrent jest sentinels — exclude them at the walker level.
      !isPlantArtifactBasename(entry.name)
    ) {
      out.push(full);
    }
  }
  return out;
}

const violations = [];

for (const file of walk(SCAN_ROOT)) {
  const rel = path.relative(REPO_ROOT, file).split(path.sep).join('/');
  // Equoria-q7lqz: files enumerated by walk() can vanish before this read
  // (concurrent jest sentinel plant+delete). The tolerant reader returns
  // null ONLY on ENOENT (with a one-line notice) and rethrows anything else.
  const content = readScannedFileSyncTolerant(file, 'api-client-vi-mock');
  if (content === null) continue;
  if (!API_CLIENT_VI_MOCK.test(content)) continue;
  if (BASELINE.has(rel)) continue;
  const lines = content.split(/\r?\n/);
  const lineNo = lines.findIndex((l) => API_CLIENT_VI_MOCK.test(l)) + 1;
  violations.push({ file: rel, line: lineNo });
}

if (violations.length > 0) {
  console.error('\nNEW vi.mock-of-api-client detected (CLAUDE.md testing doctrine):');
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}`);
  }
  console.error(
    '\nDo NOT add new vi.mock-of-API-client tests. Mocking the api-client' +
      '\nfakes the entire backend boundary so the test passes even when the' +
      `\nreal API/controller/DB is broken. Use a Playwright E2E test against` +
      `\nthe real backend instead (see tests/e2e/). The ${BASELINE.size} baseline files in` +
      '\ncheck-no-new-api-client-vi-mock.mjs are grandfathered; the list may' +
      '\nonly shrink, never grow (burn-down: Equoria-f12xy).'
  );
  process.exit(1);
}

process.exit(0);
