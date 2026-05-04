#!/usr/bin/env node
/**
 * Fix files where sweep-test-fixture-uuids.mjs inserted the
 * `import { randomUUID } from 'node:crypto';` line inside a multi-line
 * import block (between `import {` opening and `} from '...';` closing).
 *
 * Algorithm: scan for `import { randomUUID } from 'node:crypto';`, look
 * at the immediately preceding line. If it's `import {` (no `from`),
 * the insertion is broken — remove the randomUUID line and re-insert
 * it AFTER the matching closing `} from '...';`.
 */

import { readFileSync, writeFileSync } from 'node:fs';

const FILES = [
  '__tests__/integration/caching-circuit-breaker.test.mjs',
  '__tests__/integration/email-verification.test.mjs',
  '__tests__/integration/rate-limiting.test.mjs',
  '__tests__/integration/security/auth-bypass-attempts.test.mjs',
  '__tests__/integration/security/parameter-pollution.test.mjs',
  '__tests__/integration/security/sql-injection-attempts.test.mjs',
  '__tests__/performance/apiResponseOptimization.test.mjs',
  '__tests__/performance/databaseOptimization.test.mjs',
  '__tests__/unit/cacheHelper.test.mjs',
  '__tests__/unit/email-verification.test.mjs',
];

const RANDOM_UUID_LINE = "import { randomUUID } from 'node:crypto';";

for (const path of FILES) {
  let content;
  try {
    content = readFileSync(path, 'utf8');
  } catch (e) {
    console.error(`SKIP (read fail): ${path} — ${e.message}`);
    continue;
  }
  const lines = content.split('\n');

  // Find the broken randomUUID line (where preceding line is `import {`
  // without `from`).
  let brokenIdx = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === RANDOM_UUID_LINE) {
      const prev = lines[i - 1].trim();
      if (prev.startsWith('import') && prev.endsWith('{') && !prev.includes(' from ')) {
        brokenIdx = i;
        break;
      }
    }
  }

  if (brokenIdx === -1) {
    console.log(`SKIP (no broken pattern): ${path}`);
    continue;
  }

  // Remove the broken line.
  lines.splice(brokenIdx, 1);

  // From brokenIdx-1, scan forward for the closing `} from '...';` of
  // the multi-line import block.
  let closeIdx = -1;
  for (let i = brokenIdx; i < lines.length; i++) {
    if (/^\s*\}\s*from\s+['"][^'"]+['"]\s*;?\s*$/.test(lines[i])) {
      closeIdx = i;
      break;
    }
  }

  if (closeIdx === -1) {
    console.error(`FAIL (no close found after broken insertion): ${path}`);
    continue;
  }

  // Insert randomUUID line AFTER the close.
  lines.splice(closeIdx + 1, 0, RANDOM_UUID_LINE);

  writeFileSync(path, lines.join('\n'), 'utf8');
  console.log(`OK fixed: ${path} (broken at line ${brokenIdx + 1}, close at ${closeIdx + 1})`);
}
