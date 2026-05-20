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
// 23 files in BASELINE predate this rule and are grandfathered; any NEW
// frontend file (or a brand-new vi.mock-of-api-client in a non-baseline
// file) fails this gate.
//
// Mirror of the Equoria-ip82 sentinel pattern: the check fires on a real
// violation when planted, and passes when removed. Wired into the
// beta-readiness gate via scripts/doctrine-checks/run-all.sh (which is
// GATE 1 of scripts/check-beta-readiness.sh) and the lint:fix CI gate's
// doctrine-checks step.
//
// To legitimately retire a baseline entry, delete the file's vi.mock of
// api-client (convert it to a real-API Playwright E2E or remove the
// mock) AND remove the path from BASELINE. The count must only ever
// shrink.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..', '..');
const SCAN_ROOT = path.join(REPO_ROOT, 'frontend', 'src');

if (!fs.existsSync(SCAN_ROOT)) {
  process.exit(0);
}

// Frozen baseline of pre-existing grandfathered files (captured 2026-05-18,
// Equoria-efaz). Paths are repo-relative with forward slashes. This list
// must only ever SHRINK — never append a new path here.
const BASELINE = new Set([
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
  'frontend/src/pages/__tests__/ForgotPasswordPage.test.tsx',
  'frontend/src/pages/__tests__/HorseDetailPage.ProgressionTab.test.tsx',
  'frontend/src/pages/__tests__/LoginPage.beta.test.tsx',
  'frontend/src/pages/__tests__/LoginPage.test.tsx',
  'frontend/src/pages/__tests__/MessagesPage.test.tsx',
  'frontend/src/pages/__tests__/ProfilePage.test.tsx',
  'frontend/src/pages/__tests__/RegisterPage.test.tsx',
  'frontend/src/pages/__tests__/ResetPasswordPage.test.tsx',
]);

// Matches: vi.mock('@/lib/api-client'), vi.mock("../../lib/api-client"),
// vi.mock(`../lib/api-client`, ...). Any module specifier whose path ends
// in api-client (optionally with an extension) is the api-client module.
const API_CLIENT_VI_MOCK = /vi\.mock\(\s*(['"`])[^'"`]*api-client(\.[a-z]+)?\1/;

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') continue;
      out.push(...walk(full));
    } else if (entry.isFile() && /\.(ts|tsx|js|jsx|mjs)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

const violations = [];

for (const file of walk(SCAN_ROOT)) {
  const rel = path.relative(REPO_ROOT, file).split(path.sep).join('/');
  const content = fs.readFileSync(file, 'utf-8');
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
      '\nreal API/controller/DB is broken. Use a Playwright E2E test against' +
      '\nthe real backend instead (see tests/e2e/). The 23 baseline files in' +
      '\ncheck-no-new-api-client-vi-mock.mjs are grandfathered; the list may' +
      '\nonly shrink, never grow.'
  );
  process.exit(1);
}

process.exit(0);
