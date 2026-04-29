#!/usr/bin/env node
/**
 * Phase-3a sweep iteration-2: my first sweep replaced the legacy
 * `${Date.now()}_${Math.random().toString(36).slice(2,6)}` pattern with
 * `${randomUUID()}`. randomUUID() is collision-free but has TWO
 * downstream problems for fixture identifiers used in
 * email/username/horse-name fields:
 *
 *   1. Length: 36 chars. Combined with a prefix (e.g. 'csrftest' = 8
 *      chars), the resulting username is 44+ chars — exceeds the
 *      30-char max validation in /auth/register and similar endpoints.
 *   2. Charset: contains hyphens (`-`). Username validator regex
 *      /^[a-zA-Z0-9_]+$/ rejects hyphens, so /auth/register returns
 *      400 instead of 201.
 *
 * Fix: switch to `randomBytes(8).toString('hex')` — 16 hex chars,
 * alphanumeric only. Entropy: 64 bits, birthday-bound collision at
 * ~2^32 creates (4B). Plenty for test fixtures.
 *
 * Also updates the import: `import { randomUUID } from 'node:crypto'`
 * becomes `import { randomBytes } from 'node:crypto'`.
 *
 * Idempotent: re-running on a file that already uses randomBytes
 * leaves it alone.
 */

import { readFileSync, writeFileSync } from 'node:fs';

const FILES = [
  '__tests__/conformationApiEndpoints.test.mjs',
  '__tests__/integration/advance-onboarding.test.mjs',
  '__tests__/integration/auth-cookies.test.mjs',
  '__tests__/integration/auth-password-reset.test.mjs',
  '__tests__/integration/authenticated-auth-routes-csrf.test.mjs',
  '__tests__/integration/caching-circuit-breaker.test.mjs',
  '__tests__/integration/crossSystemValidation.test.mjs',
  '__tests__/integration/csrf-integration.test.mjs',
  '__tests__/integration/email-verification.test.mjs',
  '__tests__/integration/input-validation.test.mjs',
  '__tests__/integration/rate-limiting.test.mjs',
  '__tests__/integration/security/auth-bypass-attempts.test.mjs',
  '__tests__/integration/security/owasp-comprehensive.test.mjs',
  '__tests__/integration/security/ownership-violations.test.mjs',
  '__tests__/integration/security/parameter-pollution.test.mjs',
  '__tests__/integration/security/rate-limit-enforcement.test.mjs',
  '__tests__/integration/security/sql-injection-attempts.test.mjs',
  '__tests__/integration/security-attack-simulation.test.mjs',
  '__tests__/integration/session-lifecycle.test.mjs',
  '__tests__/integration/token-rotation.test.mjs',
  '__tests__/performance/apiResponseOptimization.test.mjs',
  '__tests__/performance/databaseOptimization.test.mjs',
  '__tests__/routes/apiOptimizationRoutes.test.mjs',
  '__tests__/services/cronJobService.test.mjs',
  '__tests__/unit/cacheHelper.test.mjs',
  '__tests__/unit/email-verification.test.mjs',
  // Also: setup.mjs (the central helper)
  '__tests__/setup.mjs',
];

let totalReplacements = 0;
let touchedFiles = 0;

for (const path of FILES) {
  let content;
  try {
    content = readFileSync(path, 'utf8');
  } catch (e) {
    console.error(`SKIP (read fail): ${path} — ${e.message}`);
    continue;
  }

  let newContent = content;
  let replacements = 0;

  // Replace template-literal usages.
  const tmplRe = /\$\{randomUUID\(\)\}/g;
  const tmplMatches = newContent.match(tmplRe);
  if (tmplMatches) {
    newContent = newContent.replace(tmplRe, "${randomBytes(8).toString('hex')}");
    replacements += tmplMatches.length;
  }

  // Replace bare randomUUID() calls (e.g. const uid = randomUUID();)
  const bareRe = /\brandomUUID\(\)/g;
  const bareMatches = newContent.match(bareRe);
  if (bareMatches) {
    newContent = newContent.replace(bareRe, "randomBytes(8).toString('hex')");
    replacements += bareMatches.length;
  }

  // Update the import: replace `randomUUID` with `randomBytes` in the
  // existing `import { ... } from 'node:crypto'` line.
  const importRe = /(import\s*\{[^}]*?)\brandomUUID\b([^}]*?\}\s*from\s*['"]node:crypto['"]\s*;?)/;
  if (importRe.test(newContent)) {
    newContent = newContent.replace(importRe, '$1randomBytes$2');
  }

  if (replacements === 0) {
    console.log(`SKIP (no randomUUID usages): ${path}`);
    continue;
  }

  writeFileSync(path, newContent, 'utf8');
  totalReplacements += replacements;
  touchedFiles += 1;
  console.log(`OK ${replacements} replacements: ${path}`);
}

console.log(`\nTotal: ${totalReplacements} replacements across ${touchedFiles} files.`);
