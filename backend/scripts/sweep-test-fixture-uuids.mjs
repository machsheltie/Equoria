#!/usr/bin/env node
/**
 * Sweep test files: replace Phase-3a collision-prone fixture identifiers
 * (`${Date.now()}_${Math.random().toString(36).slice(2,N)}`) with
 * `${randomUUID()}`. Adds `import { randomUUID } from 'node:crypto'`
 * to each touched file if not already imported.
 *
 * Equoria-3gti follow-on: completes Phase 3a collision-elimination by
 * replacing the still-collision-prone slice(2,4)/slice(2,6) pattern
 * with truly collision-free UUIDs. The 5x verification under just the
 * setup.mjs createTestUser fix proved the pattern is still flaky in
 * inline call sites (auth-password-reset.test.mjs, parameter-pollution.test.mjs).
 *
 * Pattern matched (with slice arg flexibility):
 *   ${Date.now()}_${Math.random().toString(36).slice(2, N)}
 * Replaced with:
 *   ${randomUUID()}
 *
 * Idempotent: re-running on a file that already contains the import
 * does not duplicate the import line.
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
];

const PHASE3A_RE = /\$\{Date\.now\(\)\}_\$\{Math\.random\(\)\.toString\(36\)\.slice\(2,\s*\d+\)\}/g;
const REPLACE_WITH = '${randomUUID()}';

const IMPORT_LINE = "import { randomUUID } from 'node:crypto';";

function ensureImport(content) {
  // Skip if already imported (any form: from 'node:crypto' or from 'crypto')
  if (/from ['"]node:crypto['"]/.test(content) || /from ['"]crypto['"]/.test(content)) {
    // Check if randomUUID is already imported
    if (/import\s*\{[^}]*\brandomUUID\b[^}]*\}\s*from\s*['"]node:crypto['"]/.test(content)) {
      return content;
    }
    if (/import\s*\{[^}]*\brandomUUID\b[^}]*\}\s*from\s*['"]crypto['"]/.test(content)) {
      return content;
    }
    // randomUUID not in existing crypto import; add it via a new import line.
    // (We avoid surgically editing existing destructure to keep the
    // transformation conservative and easy to review.)
  }

  // Insert IMPORT_LINE after the last existing top-level import line.
  // Top-level imports are lines starting with `import ` at column 0,
  // before any non-import non-comment content. We find the LAST such
  // line and insert after it.
  const lines = content.split('\n');
  let lastImportIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^import\s/.test(lines[i])) {
      lastImportIdx = i;
    } else if (lastImportIdx !== -1 && lines[i].trim() !== '' && !lines[i].trim().startsWith('//')) {
      // First non-import, non-blank, non-comment line after imports — stop scanning.
      break;
    }
  }
  if (lastImportIdx === -1) {
    // No imports at all; prepend.
    return `${IMPORT_LINE}\n${content}`;
  }
  lines.splice(lastImportIdx + 1, 0, IMPORT_LINE);
  return lines.join('\n');
}

let totalReplacements = 0;
let touchedFiles = 0;

for (const relPath of FILES) {
  const path = relPath;
  let content;
  try {
    content = readFileSync(path, 'utf8');
  } catch (e) {
    console.error(`SKIP (read fail): ${path} — ${e.message}`);
    continue;
  }
  const matches = content.match(PHASE3A_RE);
  if (!matches || matches.length === 0) {
    console.log(`SKIP (no pattern): ${path}`);
    continue;
  }
  const newContent = ensureImport(content.replace(PHASE3A_RE, REPLACE_WITH));
  writeFileSync(path, newContent, 'utf8');
  totalReplacements += matches.length;
  touchedFiles += 1;
  console.log(`OK ${matches.length} replacements: ${path}`);
}

console.log(`\nTotal: ${totalReplacements} replacements across ${touchedFiles} files.`);
