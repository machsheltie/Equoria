/**
 * Sentinel: 9 integration suites MUST use randomized usernames + emails (Equoria-cs6wf)
 *
 * Adjacent-locations follow-up to Equoria-jjzem (which fixed 3 groom integration
 * suites). The same crash-and-collide defect class — static fixture identifiers
 * tripping User.username / User.email unique constraints after a partial
 * cleanup — was present in 9 additional integration suites:
 *
 *   - horseBreedingWorkflow.integration.test.mjs ('integrationtester')
 *   - competitionWorkflow.integration.test.mjs ('competitionuser')
 *   - leaderboardRoutes.test.mjs ('topplayer1/2/3' + name-based assertions)
 *   - documentation-system-integration.test.mjs ('docintegrationuser')
 *   - api-response-integration.test.mjs ('apiresponseintegrationuser')
 *   - health-monitoring-integration.test.mjs ('healthintegrationuser')
 *   - memory-management-integration.test.mjs ('memoryintegrationuser')
 *   - horseOverview.test.mjs ('testhorseoverviewuser')
 *   - trainingProgression.integration.test.mjs ('trainingprogression')
 *
 * All 9 have been migrated to template-literal fixture identifiers seeded by
 * `randomBytes(6).toString('hex')`, so concurrent runs and post-crash re-runs
 * cannot collide. This sentinel locks the migration in so a future edit
 * cannot regress to the pre-fix static-literal pattern.
 *
 * Detection rules (each applied to the file with single-line and block
 * comments stripped — comments mentioning the historical static literals
 * for context are intentional and do NOT count as live code):
 *
 *  1. No static `username:` literal of length >= 3 (matches a fixture
 *     identifier; intentional validation-test payloads such as
 *     `username: 'ab'` are length-2 and excluded by the {3,} quantifier).
 *  2. No static `email:` literal containing '@' (any string-literal email
 *     is a collision risk on User.email's unique constraint).
 *  3. randomBytes from node:crypto is imported (sentinel-positive: proves
 *     the fix infrastructure is wired — not just absent of bad pattern).
 *  4. At least one scoped cleanup probe on user.email or user.username
 *     using `contains:` or `startsWith:` (so a partial crash leaves stale
 *     rows that the next run's cleanup can find regardless of suffix).
 *
 * Sentinel-positive contract: this file's assertion set was developed by
 * verifying each AC condition is met in the current commit. A future
 * regression that re-introduces a static fixture username, drops the
 * randomBytes import, or replaces scoped cleanup with exact-string
 * findUnique against a literal name WILL fire the corresponding it().
 */

import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const integrationDir = join(__dirname, '..', 'tests', 'integration');

const TARGET_FILES = [
  'horseBreedingWorkflow.integration.test.mjs',
  'competitionWorkflow.integration.test.mjs',
  'leaderboardRoutes.test.mjs',
  'documentation-system-integration.test.mjs',
  'api-response-integration.test.mjs',
  'health-monitoring-integration.test.mjs',
  'memory-management-integration.test.mjs',
  'horseOverview.test.mjs',
  'trainingProgression.integration.test.mjs',
];

/**
 * Strip JavaScript single-line (`//`) and block (slash-star ... star-slash)
 * comments from source so comments mentioning historical static literals
 * for context do not match the sentinel regex. Conservative implementation:
 * does not attempt to honour strings that contain `//` — the integration
 * test files do not contain such strings in code positions that would
 * cause false-stripping (verified manually).
 */
function stripComments(src) {
  // Remove block comments first (non-greedy across newlines).
  let out = src.replace(/\/\*[\s\S]*?\*\//g, '');
  // Then remove single-line comments to end-of-line.
  out = out.replace(/\/\/[^\n]*/g, '');
  return out;
}

// Match `username: 'literal'` where the literal is 3+ chars of typical
// fixture-name shape. The intentional validation payload `username: 'ab'`
// (length 2) is excluded by the {3,} quantifier.
const STATIC_FIXTURE_USERNAME_RE = /\busername:\s*['"][A-Za-z0-9._-]{3,}['"]/g;

// Match `email: '...@...'` — any string-literal email is a unique-constraint
// collision risk and must be template-literal randomized.
const STATIC_EMAIL_RE = /\bemail:\s*['"][^'"]*@[^'"]*['"]/g;

// Match a scoped cleanup probe on user.email or user.username using either
// `contains:` or `startsWith:` (both are valid scoped forms — they catch
// stale rows from a crashed prior run regardless of suffix).
const SCOPED_CLEANUP_RE =
  /(email|username):\s*\{\s*(contains|startsWith):\s*['"][^'"]+['"]/;

describe('Static fixture-identifier sentinel for 9 integration suites (Equoria-cs6wf)', () => {
  for (const filename of TARGET_FILES) {
    describe(filename, () => {
      const rawSrc = readFileSync(join(integrationDir, filename), 'utf8');
      const src = stripComments(rawSrc);

      it('contains no static fixture `username:` literal in live code (must use template-literal with randomBytes)', () => {
        const matches = src.match(STATIC_FIXTURE_USERNAME_RE) ?? [];
        if (matches.length > 0) {
          const matchList = matches.map(m => `  ${m}`).join('\n');
          throw new Error(
            [
              `Found ${matches.length} static fixture username literal(s) in ${filename}:`,
              matchList,
              'Use template-literal form: `TestFixture-cs6wf-${slug}-${randomBytes(6).toString("hex")}`',
            ].join('\n'),
          );
        }
        expect(matches).toEqual([]);
      });

      it('contains no static `email:` literal containing @ in live code (must use template-literal with randomBytes)', () => {
        const matches = src.match(STATIC_EMAIL_RE) ?? [];
        if (matches.length > 0) {
          const matchList = matches.map(m => `  ${m}`).join('\n');
          throw new Error(
            [
              `Found ${matches.length} static email literal(s) in ${filename}:`,
              matchList,
              'Use template-literal form: `testfixture-cs6wf-${slug}-${randomBytes(6).toString("hex")}@example.com`.',
              'If the literal is intentional, e.g. legacy email used only inside a cleanup probe, wrap it via',
              'string concatenation so the regex does not match: `const legacyEmail = `x${\'@\'}y`;`',
            ].join('\n'),
          );
        }
        expect(matches).toEqual([]);
      });

      it('imports randomBytes from node:crypto (sentinel-positive: proves fix infrastructure is wired)', () => {
        // The strip-comments pass would remove a `// import` mention; checking
        // raw source ensures the actual import statement is present.
        expect(rawSrc).toMatch(/from\s+['"]node:crypto['"]/);
        expect(rawSrc).toMatch(/\brandomBytes\b/);
      });

      it('uses scoped cleanup (contains/startsWith) on user email or username (not exact-string lookup)', () => {
        // Pre-fix: `findUnique({ where: { username: 'static-name' } })`.
        // Post-fix: either `startsWith: 'TestFixture-cs6wf-'` or
        // `contains: '<suite-slug>'` against user.email or user.username.
        // Both forms recover stale rows from a crashed prior run.
        const hasScopedCleanup = SCOPED_CLEANUP_RE.test(src);
        if (!hasScopedCleanup) {
          throw new Error(
            `${filename} contains no scoped user-cleanup probe. ` +
              'Expected either `email: { contains: "<slug>" }` or ' +
              '`username: { startsWith: "TestFixture-cs6wf-" }` against User.',
          );
        }
        expect(hasScopedCleanup).toBe(true);
      });
    });
  }
});
