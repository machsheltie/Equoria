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
 * The detector is a pure function over source text, and the SENTINEL-POSITIVE cases
 * prove it FIRES on planted violations rather than merely staying green
 * (.claude/rules/CONTRIBUTING.md: "a doctrine/sentinel test must prove that its
 * detector fires on a planted violation as well as passes on compliant code").
 *
 * THE BOUNDARY OF THIS MATCHER, stated because this campaign's recurring defect is a
 * pattern that matches the common shape and is reported as if it matched all shapes.
 * `findSalaryPassCalls` sees the literal token `processWeeklySalaries(` in code, with
 * comments blanked and `function` declarations skipped. It therefore CANNOT see:
 *   - a dynamically resolved call (`svc['processWeekly' + 'Salaries'](...)`, or a
 *     property access on an imported namespace or default object);
 *   - an aliased import (`import { processWeeklySalaries as pay } from ...; pay(...)`);
 *   - a call assembled in a string and evaluated, or reached through a helper that
 *     receives the function as an argument.
 * It DOES see a call inside a `Promise.all`, a nested call, and an object-literal
 * argument, because the argument list is walked with paren balancing rather than matched
 * with a regex — that is residual A, true of the audit since round 1 and now true of the
 * DISCOVERY too. A scope passed as a variable whose name is not `userId` reads as
 * unscoped and is reported, which fails CLOSED and is the safe direction.
 */

import { describe, it, expect } from '@jest/globals';
import fs from 'node:fs';
import os from 'node:os';
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
  // Fix round 2: `groomEngagementLifecycle.integration` was split along the service
  // boundary and every fee call moved into this file. The completeness case below is
  // what caught the rename — the discovery half doing its job on real work rather than
  // on a fixture.
  'modules/grooms/__tests__/groomFeeArrears.integration.test.mjs',
  // Equoria-2ti1j: the fail-closed case for a non-funds throw. It calls the pass
  // scoped to its own fixture user for exactly the reason this list exists — it
  // blocks the debit on a row lock, and an unscoped run would do that to the pass
  // for every player on the shared development database.
  'modules/grooms/__tests__/groomFeeUncollected.integration.test.mjs',
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
/**
 * Blank comments to SAME-LENGTH whitespace rather than removing them, so every offset —
 * and therefore every reported line number — still refers to the real file.
 *
 * Fix round 1, finding F14: the first version deleted them, so a call at real line 214
 * was reported as "near line 167", off by the 47 lines of header stripped before it. A
 * guard that misdirects whoever it fires on costs debugging time, which is the opposite
 * of its job. Same technique as
 * scripts/doctrine-checks/check-no-retirement-schedule-leak.mjs.
 *
 * @param {string} rawSource
 * @returns {string} the same length, with comment bodies replaced by spaces
 */
function blankComments(rawSource) {
  return rawSource
    .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, m => ' '.repeat(m.length));
}

/**
 * THE ONE CALL-FINDER. Every `processWeeklySalaries(...)` CALL in a source text, with
 * its true file line, its argument text, and whether that text carries a `userId`
 * scope. Used by BOTH the per-file audit and the tree-wide discovery below.
 *
 * Fix round 2, residual A. Round 1 fixed the COUNTING and left the DISCOVERY on
 * `/await\s+processWeeklySalaries\(/` — the very regex that produced the
 * eleven-versus-fifteen undercount, because only the `Promise.all` is awaited, not the
 * calls inside it. A future suite whose ONLY calls sat in a `Promise.all` would
 * therefore never be discovered, never be added to `GUARDED_FILES`, and never be
 * guarded: the guard would be structurally unable to find the thing it exists to find.
 * Sharing one finder is the fix — discovery and audit cannot disagree about what a call
 * is, because they ask the same function.
 *
 * A `function processWeeklySalaries(` declaration is skipped: the tx-conservation suite
 * synthesizes a whole pre-fix function body as a string to feed its own code sentinel,
 * and that string is data, not a call.
 *
 * @param {string} rawSource
 * @returns {Array<{line: number, offset: number, args: string, scoped: boolean, unbalanced?: boolean}>}
 */
export function findSalaryPassCalls(rawSource) {
  const source = blankComments(rawSource);
  const calls = [];
  const needle = 'processWeeklySalaries(';
  let from = 0;
  for (;;) {
    const at = source.indexOf(needle, from);
    if (at === -1) {
      break;
    }
    from = at + needle.length;

    // `export async function processWeeklySalaries(` and friends are declarations.
    if (/function\s+$/.test(source.slice(Math.max(0, at - 20), at))) {
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
    const line = source.slice(0, at).split('\n').length;
    if (depth !== 0) {
      // Fail CLOSED. An unbalanced argument list means the extraction cannot be
      // trusted, and a detector that breaks toward green is worse than none.
      calls.push({ line, offset: at, args: '', scoped: false, unbalanced: true });
      break;
    }
    calls.push({
      line,
      offset: at,
      args: source.slice(from, i - 1),
      scoped: /\buserId\b/.test(source.slice(from, i - 1)),
    });
  }
  return calls;
}

/**
 * Does this source CALL the weekly fee pass at all? The DISCOVERY predicate, and it is
 * the same paren-balanced finder the audit uses — see `findSalaryPassCalls` for why an
 * `await`-anchored regex was not good enough (residual A).
 *
 * @param {string} rawSource
 * @returns {boolean}
 */
export function callsSalaryPass(rawSource) {
  return findSalaryPassCalls(rawSource).length > 0;
}

/**
 * WHAT THIS ASSERTS: every call in the given source passes a `userId` scope.
 *
 * @param {string} rawSource
 * @returns {string[]} human-readable findings; an empty array means compliant
 */
export function auditSalaryPassScoping(rawSource) {
  const findings = [];
  for (const call of findSalaryPassCalls(rawSource)) {
    if (call.unbalanced) {
      findings.push(
        `could not find the end of a processWeeklySalaries( argument list at offset ${call.offset} - ` +
          'the scoping check cannot be trusted, so this is a failure rather than a pass',
      );
      continue;
    }
    if (!call.scoped) {
      findings.push(
        `unscoped processWeeklySalaries call at line ${call.line}: ` +
          `\`processWeeklySalaries(${call.args.trim().slice(0, 60)})\` - pass ` +
          '{ userId: <fixture user>.id }; an unscoped pass releases real players\u2019 grooms',
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

  it('SENTINEL-POSITIVE: DISCOVERY sees a suite whose only calls sit in a Promise.all', () => {
    // Residual A. This is the shape that escaped the previous await-anchored discovery
    // entirely: a whole suite, imports and all, whose ONLY calls to the pass are inside
    // a `Promise.all([...])`. Nothing there is individually awaited.
    const suiteShaped = [
      '/**',
      ' * A future suite. Its header mentions processWeeklySalaries() in prose.',
      ' */',
      "import { processWeeklySalaries } from '../services/groomSalaryService.mjs';",
      '',
      "describe('a future concurrency case', () => {",
      "  it('races two passes', async () => {",
      '    await Promise.all([processWeeklySalaries(now), processWeeklySalaries(now)]);',
      '  });',
      '});',
      '',
    ].join('\n');

    // The OLD discovery regex, quoted here so the miss is DEMONSTRATED rather than
    // asserted from memory. It matches nothing, so the file would never have been
    // discovered, never added to GUARDED_FILES, and never guarded.
    const oldDiscovery = /await\s+processWeeklySalaries\(/;
    expect(oldDiscovery.test(suiteShaped)).toBe(false);

    // The new discovery finds it, and the audit then reports BOTH unscoped calls.
    expect(callsSalaryPass(suiteShaped)).toBe(true);
    expect(findSalaryPassCalls(suiteShaped)).toHaveLength(2);
    expect(auditSalaryPassScoping(suiteShaped)).toHaveLength(2);

    // Discovery is not merely "mentions the name": prose, a bare import and a
    // synthesized declaration are not calls, so a file that only talks about the pass is
    // not dragged into the guarded list.
    expect(callsSalaryPass('// processWeeklySalaries() used to sweep everyone\n')).toBe(false);
    expect(callsSalaryPass("import { processWeeklySalaries } from '../services/groomSalaryService.mjs';\n")).toBe(
      false,
    );
    expect(callsSalaryPass('const planted = `export async function processWeeklySalaries() {}`;')).toBe(false);
  });

  it('the guarded list is complete: no other backend TEST file calls the pass', () => {
    // The list above is only a guarantee if nothing escapes it. Walk the tree and
    // compare, so adding a fifth caller fails HERE rather than silently going
    // unguarded.
    expect(discoverCallers(BACKEND_ROOT).sort()).toEqual([...GUARDED_FILES].sort());
  });

  it('SENTINEL-POSITIVE: DISCOVERY itself is guarded — a Promise.all-only suite is found', () => {
    // Fix round 2, second pass. The first attempt at residual A fixed `callsSalaryPass`
    // and pointed the walk at it, then "proved" it by asserting `callsSalaryPass`
    // directly — which left the WALK unguarded: re-planting the await-anchored regex in
    // the walk kept every case green, because all four real guarded files happen to
    // contain at least one individually-awaited call. A fix whose re-plant passes is not
    // a fixed fix.
    //
    // So discovery now takes an injectable root, and this case runs it over a throwaway
    // directory holding one suite-shaped file whose ONLY calls sit in a `Promise.all`.
    // Narrowing either the walk or the shared finder makes this fail.
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ypb7d-discovery-'));
    try {
      const nested = path.join(dir, 'modules', 'grooms', '__tests__');
      fs.mkdirSync(nested, { recursive: true });
      const fixture = path.join(nested, 'promiseAllOnly.integration.test.mjs');
      fs.writeFileSync(
        fixture,
        [
          '/**',
          ' * A future suite whose header mentions processWeeklySalaries() in prose.',
          ' */',
          "import { processWeeklySalaries } from '../services/groomSalaryService.mjs';",
          '',
          "describe('a future concurrency case', () => {",
          "  it('races two passes', async () => {",
          '    await Promise.all([processWeeklySalaries(now), processWeeklySalaries(now)]);',
          '  });',
          '});',
          '',
        ].join('\n'),
        'utf8',
      );
      // A sibling that only MENTIONS the pass must NOT be discovered, or discovery would
      // drag in every file that imports it.
      fs.writeFileSync(
        path.join(nested, 'mentionsOnly.integration.test.mjs'),
        "import { processWeeklySalaries } from '../services/groomSalaryService.mjs';\n" +
          '// processWeeklySalaries() used to sweep every user.\n',
        'utf8',
      );

      expect(discoverCallers(dir)).toEqual(['modules/grooms/__tests__/promiseAllOnly.integration.test.mjs']);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('SENTINEL-POSITIVE: the detector fires on each shape an unscoped call takes (2)', () => {
    // Kept separate from the discovery case above so a failure names which half broke.
    expect(auditSalaryPassScoping('await processWeeklySalaries(now);')).toHaveLength(1);
    expect(auditSalaryPassScoping('await processWeeklySalaries(now, { userId: u.id });')).toEqual([]);
  });
});

/**
 * Walk `rootDir` and return every TEST file that CALLS the weekly fee pass, as a
 * root-relative POSIX path.
 *
 * The root is a parameter so the case above can drive it over a throwaway fixture
 * directory — without that, the walk itself was unguarded (see that case).
 *
 * @param {string} rootDir
 * @returns {string[]}
 */
function discoverCallers(rootDir) {
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
        // This file itself is excluded: its SENTINEL-POSITIVE cases contain the literal
        // `await processWeeklySalaries(` as STRING ARGUMENTS to the detector. Those are
        // the planted violations the detector must catch, not calls against the
        // database, and comment-stripping cannot tell them apart from real ones.
        // Excluding the sentinel is the narrow, honest boundary; excluding anything else
        // would be hiding a caller.
        if (full === fileURLToPath(import.meta.url)) {
          continue;
        }
        const source = fs.readFileSync(full, 'utf8');
        // Residual A: discovery uses the SAME paren-balanced finder as the audit. The
        // previous await-anchored regex could not see a call inside a `Promise.all`,
        // so a suite whose only calls looked like that would never have been
        // discovered and never guarded. A call, not merely a mention: the import line
        // and the marketplace suite's explanatory comment both name it without
        // calling it, and `callsSalaryPass` blanks comments and skips declarations
        // before deciding.
        if (callsSalaryPass(source)) {
          found.push(path.relative(rootDir, full).replace(/\\/g, '/'));
        }
      }
    }
  };
  walk(rootDir);
  return found;
}
