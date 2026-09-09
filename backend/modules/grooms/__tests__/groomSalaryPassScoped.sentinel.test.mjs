/**
 * Equoria-ypb7d.3 — every TEST call to `processWeeklySalaries` must be scoped to a
 * fixture user.
 *
 * WHY THIS EXISTS, AND WHY IT DID NOT NEED TO BEFORE.
 *   Until Equoria-ypb7d.3 a non-payment was a silent no-op:
 *   `terminateGroomsForNonPayment` wrote `terminationReason` to a `GroomAssignment`
 *   column that does not exist, Prisma rejected its first statement, and the
 *   function's own catch swallowed the throw (Equoria-0aybn). So an unscoped
 *   `processWeeklySalaries()` in a test against the shared development database was
 *   merely wasteful: it debited real wallets and wrote payment rows, but it could not
 *   take anything away.
 *
 *   It can now. An unscoped pass puts EVERY underfunded player's grooms into the
 *   one-week grace period, and RELEASES the ones already in it — `Groom.userId`
 *   cleared, active assignments ended, the groom gone from that player's staff and
 *   into the grooms-for-hire pool where anyone may hire them. The shared development
 *   database holds real player data, and CLAUDE.md forbids running broad operations
 *   against it. That is the blast radius Equoria-ypb7d.3 created, so Equoria-ypb7d.3
 *   closes it.
 *
 * WHAT THIS ASSERTS
 *   Every `await processWeeklySalaries(...)` CALL in a backend TEST file passes a
 *   `userId` scope. Production callers (the cron job, the admin trigger) are
 *   deliberately NOT scoped — a real weekly pass must sweep every player — so only
 *   test files are scanned.
 *
 * The detector is a pure function over source text, and the second case proves it
 * FIRES on four planted violations rather than merely staying green
 * (.claude/rules/CONTRIBUTING.md: "a doctrine/sentinel test must prove that its
 * detector fires on a planted violation as well as passes on compliant code").
 */

import { describe, it, expect } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_ROOT = path.resolve(HERE, '..', '..', '..');

/**
 * Every backend test file that calls the weekly fee pass. An explicit list rather
 * than a walk: the list IS the claim, so a new caller has to be added here
 * deliberately, and the third case below proves the list still matches the tree.
 */
const GUARDED_FILES = [
  'modules/grooms/__tests__/groomSalaryIdempotency.integration.test.mjs',
  'modules/grooms/__tests__/groomSalaryServiceTxConservation.integration.test.mjs',
  'modules/grooms/__tests__/groomEngagementLifecycle.integration.test.mjs',
  'tests/integration/groomSalarySystem.test.mjs',
];

/**
 * Pure detector. Returns human-readable findings; an empty array means compliant.
 *
 * Scans CODE, not prose: block and line comments are stripped first, because both
 * guarded suites' headers legitimately quote the bare `processWeeklySalaries()` while
 * explaining the defect, and an unstripped scan would flag the explanation as the
 * thing it warns about — the same false positive the retirement transaction sentinel
 * had to fix.
 *
 * A `function processWeeklySalaries(` declaration is skipped: the tx-conservation
 * suite synthesizes a whole pre-fix function body as a string to feed its own code
 * sentinel, and that string is data, not a call.
 *
 * @param {string} rawSource
 * @returns {string[]}
 */
export function auditSalaryPassScoping(rawSource) {
  const findings = [];
  // Comments are blanked to SAME-LENGTH whitespace rather than removed, so every
  // offset — and therefore every reported line number — still refers to the real file.
  // Fix round 1, finding F14: the first version deleted them, so a call at real line
  // 214 was reported as "near line 167", off by the 47 lines of header stripped before
  // it. A guard that misdirects whoever it fires on costs debugging time, which is the
  // opposite of its job. Same technique as
  // scripts/doctrine-checks/check-no-retirement-schedule-leak.mjs.
  const source = rawSource
    .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, m => ' '.repeat(m.length));

  const needle = 'processWeeklySalaries(';
  let from = 0;
  for (;;) {
    const at = source.indexOf(needle, from);
    if (at === -1) {
      break;
    }
    from = at + needle.length;

    // `export async function processWeeklySalaries(` and friends are declarations.
    const before = source.slice(Math.max(0, at - 20), at);
    if (/function\s+$/.test(before)) {
      continue;
    }

    // Walk the argument list with paren balancing, so a nested call or an object
    // literal cannot end it early.
    let depth = 1;
    let i = from;
    while (i < source.length && depth > 0) {
      if (source[i] === '(') {
        depth += 1;
      } else if (source[i] === ')') {
        depth -= 1;
      }
      i += 1;
    }
    if (depth !== 0) {
      // Fail CLOSED. An unbalanced argument list means the extraction cannot be
      // trusted, and a detector that breaks toward green is worse than none.
      findings.push(
        `could not find the end of a processWeeklySalaries( argument list at offset ${at} — ` +
          'the scoping check cannot be trusted, so this is a failure rather than a pass',
      );
      break;
    }
    const args = source.slice(from, i - 1);

    if (!/\buserId\b/.test(args)) {
      const line = source.slice(0, at).split('\n').length;
      findings.push(
        `unscoped processWeeklySalaries call at line ${line}: \`processWeeklySalaries(${args.trim().slice(0, 60)})\` — ` +
          'pass { userId: <fixture user>.id }; an unscoped pass releases real players’ grooms',
      );
    }
  }

  return findings;
}

describe('Equoria-ypb7d.3 — the weekly fee pass is scoped in every test that calls it', () => {
  it.each(GUARDED_FILES)('%s scopes every processWeeklySalaries call', relative => {
    const absolute = path.join(BACKEND_ROOT, relative);
    expect(fs.existsSync(absolute)).toBe(true);
    const source = fs.readFileSync(absolute, 'utf8');
    // The file must actually call it, or this entry is stale headroom.
    expect(source).toContain('processWeeklySalaries(');
    expect(auditSalaryPassScoping(source)).toEqual([]);
  });

  it('SENTINEL-POSITIVE: the detector fires on each shape an unscoped call takes', () => {
    // (a) the bare call the tx-conservation suite used
    expect(auditSalaryPassScoping('const r = await processWeeklySalaries();')).toEqual([
      expect.stringMatching(/unscoped processWeeklySalaries call/),
    ]);

    // (b) a clock argument but no scope — the idempotency suite's shape
    expect(auditSalaryPassScoping('await processWeeklySalaries(now);')).toEqual([expect.stringMatching(/unscoped/)]);

    // (c) two concurrent unscoped calls: BOTH must be reported, not just the first
    expect(
      auditSalaryPassScoping('await Promise.all([processWeeklySalaries(now), processWeeklySalaries(now)]);'),
    ).toHaveLength(2);

    // (d) an options object that is not a scope
    expect(auditSalaryPassScoping('await processWeeklySalaries(now, { dryRun: true });')).toEqual([
      expect.stringMatching(/unscoped/),
    ]);

    // …and it does NOT fire on the compliant shapes, or the guard would be unusable.
    expect(auditSalaryPassScoping('await processWeeklySalaries(now, { userId: user.id });')).toEqual([]);
    expect(auditSalaryPassScoping('await processWeeklySalaries(undefined, { userId: testUser.id });')).toEqual([]);

    // A comment quoting the bare call is prose, not a call. Both guarded suites' own
    // headers do exactly this while explaining the defect.
    expect(auditSalaryPassScoping('// Defect: processWeeklySalaries() debits every user\n')).toEqual([]);
    expect(auditSalaryPassScoping('/**\n * processWeeklySalaries() used to sweep everyone.\n */\n')).toEqual([]);

    // F14: the reported line number must be the REAL file line. Two lines of header
    // comment, then the call on line 3 — a detector that stripped comments away would
    // say line 1.
    expect(auditSalaryPassScoping('// header\n// header\nawait processWeeklySalaries(now);\n')[0]).toMatch(
      /at line 3\b/,
    );

    // A synthesized declaration is data, not a call.
    expect(auditSalaryPassScoping('const planted = `export async function processWeeklySalaries() {}`;')).toEqual([]);
  });

  it('the guarded list is complete: no other backend TEST file calls the pass', () => {
    // The list above is only a guarantee if nothing escapes it. Walk the tree and
    // compare, so adding a fifth caller fails HERE rather than silently going
    // unguarded.
    const found = [];
    const walk = dir => {
      let entries;
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === 'node_modules') {
            continue;
          }
          walk(full);
        } else if (/\.(test|spec)\.mjs$/.test(entry.name)) {
          // This file itself is excluded: its SENTINEL-POSITIVE cases contain the
          // literal `await processWeeklySalaries(` as STRING ARGUMENTS to the
          // detector. Those are the planted violations the detector must catch, not
          // calls against the database, and comment-stripping cannot tell them apart
          // from real ones. Excluding the sentinel is the narrow, honest boundary;
          // excluding anything else would be hiding a caller.
          if (full === fileURLToPath(import.meta.url)) {
            continue;
          }
          const source = fs.readFileSync(full, 'utf8');
          const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
          // A call, not merely a mention: the import line and the marketplace
          // suite's explanatory comment both name it without calling it.
          if (/await\s+processWeeklySalaries\(/.test(code)) {
            found.push(path.relative(BACKEND_ROOT, full).replace(/\\/g, '/'));
          }
        }
      }
    };
    walk(BACKEND_ROOT);
    expect(found.sort()).toEqual([...GUARDED_FILES].sort());
  });
});
