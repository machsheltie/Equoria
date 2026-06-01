/**
 * Sentinel: 3 groom integration suites MUST use randomized usernames (Equoria-jjzem)
 *
 * Problem: 3 groom integration suites used static, non-randomized usernames
 * (e.g. 'handler-test-user'). If a previous run crashed mid-afterAll (user
 * deleted but child rows partially deleted, or vice versa), the next run's
 * beforeAll hit the unique-constraint on `username` instead of reporting the
 * actual test behavior.
 *
 * The fix: every `username:` literal in these 3 files MUST embed a random
 * suffix (template literal with randomBytes/randHex), AND every `email:`
 * literal MUST also be randomized (User.email is @unique too — without
 * randomization the email collision reproduces the same class of stale-row
 * bug). Cleanup scopes by `startsWith: 'TestFixture-jjzem-'` (matches
 * CONTRIBUTING.md TestFixture- naming convention).
 *
 * Adjacent files (~9 other integration suites with static usernames) are
 * tracked separately per OPTIMAL_FIX_DISCIPLINE.md §3 — this sentinel only
 * locks in the 3 files named by the AC.
 */

import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const integrationDir = join(__dirname, '..', 'tests', 'integration');

const TARGET_FILES = [
  'groomHandlerSystem.test.mjs',
  'groomAssignmentSystem.test.mjs',
  'enhancedGroomInteractions.test.mjs',
];

// Match `username: 'literal-string'` or `username: "literal-string"` — i.e.
// any non-template-literal, non-interpolated string. The valid form must use
// a template literal (backtick) with ${...} interpolation so the test gets a
// per-run unique value.
const STATIC_USERNAME_RE = /\busername:\s*['"][^'"]+['"]/g;
const STATIC_EMAIL_RE = /\bemail:\s*['"][^'"]+@[^'"]+['"]/g;

describe('Static username/email sentinel for 3 groom integration suites (Equoria-jjzem)', () => {
  for (const filename of TARGET_FILES) {
    describe(filename, () => {
      const src = readFileSync(join(integrationDir, filename), 'utf8');

      it('contains no static `username:` literal (must use template-literal with randomBytes)', () => {
        const matches = src.match(STATIC_USERNAME_RE) ?? [];
        // Allow comments that mention the old literal for context: filter out
        // lines inside `where: { username: '...' }` if they are pre-cleanup
        // probes — they would also need to be randomized, so we do NOT exempt.
        if (matches.length > 0) {
          throw new Error(
            `Found ${matches.length} static username literal(s) in ${filename}:\n${matches
              .map(m => `  ${m}`)
              .join('\n')}\nUse template-literal form: \`TestFixture-jjzem-\${randomBytes(6).toString("hex")}\``,
          );
        }
        expect(matches).toEqual([]);
      });

      it('contains no static `email:` literal (must use template-literal with randomBytes)', () => {
        const matches = src.match(STATIC_EMAIL_RE) ?? [];
        if (matches.length > 0) {
          throw new Error(
            `Found ${matches.length} static email literal(s) in ${filename}:\n${matches
              .map(m => `  ${m}`)
              .join(
                '\n',
              )}\nUse template-literal form: \`testfixture-jjzem-\${randomBytes(6).toString("hex")}@example.com\``,
          );
        }
        expect(matches).toEqual([]);
      });

      it('imports randomBytes from node:crypto', () => {
        // Sentinel-positive: verify the fix infrastructure is actually wired
        // (no point in claiming "randomized" if the helper isn't imported).
        expect(src).toMatch(/from\s+['"]node:crypto['"]/);
        expect(src).toMatch(/\brandomBytes\b/);
      });

      it('cleanup uses startsWith TestFixture- prefix (not exact-string lookup)', () => {
        // The pre-fix code did `findUnique({ where: { username: 'static-name' } })`.
        // Post-fix must use `deleteMany({ where: { username: { startsWith: 'TestFixture-jjzem-' } } })`
        // because exact-string lookup against a randomized name cannot find
        // stale rows from a crashed prior run.
        expect(src).toMatch(/startsWith:\s*['"]TestFixture-jjzem-/);
      });
    });
  }
});
