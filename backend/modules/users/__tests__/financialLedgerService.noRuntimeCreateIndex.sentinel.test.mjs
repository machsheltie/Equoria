/**
 * financialLedgerService — no-runtime-CREATE-INDEX sentinel (Equoria-z8leh).
 *
 * Asserts that backend/services/financialLedgerService.mjs never reintroduces
 * the runtime `CREATE INDEX IF NOT EXISTS ...` calls that used to live in
 * `ensureLedgerTable`. Those calls were the structural source of the qh6jk
 * migration-history drift — they recreated orphan-named indexes after each
 * cleanup migration DROPped them, producing the shadow-DB diff that broke
 * `prisma migrate dev` on the canonical DB.
 *
 * The two indexes those calls created are now provided by:
 *   (a) the canonical migration 20260414000000_add_user_transactions, and
 *   (b) the schema.prisma @@index decorators on `model UserTransaction`
 *       (`@@index([userId, createdAt])`, `@@index([category])`).
 *
 * So removing the runtime calls is safe on every code path and re-adding
 * them would reintroduce the drift.
 *
 * Sentinel-positive: this test FAILS if the runtime CREATE INDEX pattern
 * is reintroduced. The third assertion proves the regex is not vacuous by
 * matching a planted violation string.
 *
 * Cross-reference: OPTIMAL_FIX_DISCIPLINE.md §2 (sentinel-positive required),
 * §3 (adjacent file is backend/services/databaseOptimizationService.mjs —
 * that one is interlocked with test coverage and is filed as a separate
 * follow-up issue).
 */

import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SERVICE_PATH = resolve(__dirname, '..', '..', '..', 'services', 'financialLedgerService.mjs');

// Match any `$executeRaw*` reference followed (within a short window of
// whitespace, parens, and quote chars — possibly across a newline) by
// `CREATE INDEX`. The window covers both:
//   - function-call form: `$executeRawUnsafe('CREATE INDEX ...')`
//   - tagged-template form: `$executeRaw`CREATE INDEX ...``
//   - multi-line form:    `$executeRawUnsafe(\n    'CREATE INDEX ...')`
// Uses the `s` flag (dotAll) so `.` matches newlines inside the gap.
const RUNTIME_CREATE_INDEX_PATTERN = /\$executeRaw[a-zA-Z]*[\s(`'"]{1,40}CREATE\s+INDEX/is;

function stripCommentLines(source) {
  // Drop any line that is "obviously a comment" so the source's own
  // remediation JSDoc doesn't false-positive. Covers:
  //  - `// ...` single-line comments
  //  - block-comment body lines (start with `*` after trim)
  //  - `/* ... */` opener lines (start with `/*`)
  //  - block-comment closer lines (`*/`)
  return source
    .split('\n')
    .filter(line => {
      const t = line.trim();
      if (t.startsWith('//')) return false;
      if (t.startsWith('*')) return false;
      if (t.startsWith('/*')) return false;
      return true;
    })
    .join('\n');
}

function findRuntimeCreateIndexCalls(source) {
  const violations = [];
  const stripped = stripCommentLines(source);

  // Run the dotAll regex globally over the stripped source so we catch
  // every multi-line `$executeRawUnsafe(\n    'CREATE INDEX ...')`
  // pattern even when the open-paren and the CREATE INDEX are on
  // different lines.
  const globalPattern = new RegExp(RUNTIME_CREATE_INDEX_PATTERN.source, 'gis');
  let m;
  while ((m = globalPattern.exec(stripped)) !== null) {
    // Compute the line number by counting newlines up to the match index.
    const upTo = stripped.slice(0, m.index);
    const line = upTo.split('\n').length;
    violations.push({ line, text: m[0].replace(/\s+/g, ' ').trim() });
  }
  return violations;
}

describe('Equoria-z8leh — financialLedgerService no-runtime-CREATE-INDEX sentinel', () => {
  it('contains no `$executeRaw*(... CREATE INDEX ...)` calls (use schema.prisma @@index instead)', () => {
    const source = readFileSync(SERVICE_PATH, 'utf8');
    const violations = findRuntimeCreateIndexCalls(source);

    // Sentinel-positive diagnostic: if any violations are present, list
    // every offending line + the matched text. The fix is to (a) remove
    // the runtime call, and (b) add the equivalent @@index decorator to
    // the relevant model in packages/database/prisma/schema.prisma.
    expect(violations).toEqual([]);
  });

  it('the regex detector itself FIRES on a planted violation (sentinel-positive)', () => {
    // Prove the detector is not vacuous: a synthetic source string
    // containing the exact pattern we forbid MUST be flagged. Without
    // this, a regex typo could silently let the real test pass while the
    // guard is dead. Includes the multi-line form because the historical
    // call site put the SQL string on the line AFTER `$executeRawUnsafe(`.
    const planted = [
      'function example() {',
      "  await client.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS x ON t (c)');",
      '  await client.$executeRaw`CREATE INDEX another ON t (c)`;',
      '  await client.$executeRawUnsafe(',
      "    'CREATE INDEX IF NOT EXISTS multiline_form ON t (c)',",
      '  );',
      '}',
    ].join('\n');
    const violations = findRuntimeCreateIndexCalls(planted);
    expect(violations.length).toBe(3);
    // All three matches must contain the executeRaw* call site marker —
    // the regex only captures up to `CREATE INDEX`, not the rest of the
    // SQL statement, so we assert on the captured prefix, not the SQL.
    expect(violations[0].text).toMatch(/\$executeRawUnsafe.*CREATE\s+INDEX/i);
    expect(violations[1].text).toMatch(/\$executeRaw.*CREATE\s+INDEX/i);
    expect(violations[2].text).toMatch(/\$executeRawUnsafe.*CREATE\s+INDEX/i);
    // Verify line numbers are distinct (proves we're detecting each
    // separately, not double-counting one match).
    const lines = violations.map(v => v.line);
    expect(new Set(lines).size).toBe(3);
  });

  it('the regex detector does NOT flag JSDoc comments that reference CREATE INDEX', () => {
    // Negative control: documentation that mentions the historical
    // pattern (as the file's JSDoc does) must NOT be flagged. Without
    // this, the file's own remediation notes would be a false positive.
    const docComment = [
      '/**',
      ' * The runtime CREATE INDEX calls have been removed (Equoria-z8leh).',
      ' * See historical $executeRawUnsafe(CREATE INDEX ...) for context.',
      ' */',
    ].join('\n');
    // The `*` lines do not start with `//`, but the `/**` block-comment
    // wrapper doesn't match `$executeRaw\\s*\\(` anyway because there's
    // no actual call expression. Verify:
    const violations = findRuntimeCreateIndexCalls(docComment);
    expect(violations).toEqual([]);
  });
});
