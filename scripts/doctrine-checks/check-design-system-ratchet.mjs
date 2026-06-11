/**
 * Doctrine check: frontend design-system source-audit ratchet
 * (Equoria-o5hub.23, handoff §16.6).
 *
 * Delegates to scripts/design-audit/check-design-system.mjs — fails when any
 * rule's non-excepted match count exceeds scripts/design-audit/baseline.json
 * or when docs/design-system/EXCEPTIONS.md contains an expired exception.
 *
 * Running inside the doctrine suite gives the audit both client-side
 * enforcement (pre-push hook / manual Equoria-64tby contract) and CI
 * enforcement (doctrine-gate workflow) without touching the contended
 * .github/workflows files.
 */

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const audit = path.resolve(here, '..', 'design-audit', 'check-design-system.mjs');

const res = spawnSync(process.execPath, [audit], { encoding: 'utf8' });

if (res.status !== 0) {
  console.error('[design-system-ratchet] DOCTRINE VIOLATION');
  console.error(res.stdout);
  console.error(res.stderr);
  process.exit(1);
}

// Quiet on success — run-all.sh prints OK.
process.exit(0);
