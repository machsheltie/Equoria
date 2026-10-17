/**
 * Sentinel for scripts/doctrine-checks/check-no-utc-date-only-fixtures.mjs
 * (Equoria-1lk00).
 *
 * The check flags a date-only Horse column (dateOfBirth, lastBredDate,
 * lastVettedDate) written from UTC-instant arithmetic, which stores the UTC date
 * and reads one day short from 20:00 to 24:00 ET. This proves it FIRES on a
 * planted violation in each shape it claims to catch (direct, and through a
 * local value or helper), honours the exemption marker, ignores comments,
 * literal dates, the game-clock helpers and a name re-bound to a helper, and
 * that the tree is clean once the plants are gone.
 *
 * Plants carry the reserved `__1lk00_utcdob_plant_` token
 * (RESERVED_SCRATCH_PLANT_TOKENS in scripts/lib/doctrine-scan-patterns.mjs), so
 * foreign tree scanners and the gate's one-time test discovery skip them; the
 * check under test walks through walkFiles(), which does not consult that
 * list, so it still sees them. Each plant is removed after its test.
 */

import { describe, it, expect, afterEach } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { isReservedScratchPlantPathSegment } from '../../../scripts/lib/doctrine-scan-patterns.mjs';
import { isPlantedTestPath } from '../../scripts/tree-lane-plan.mjs';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..', '..', '..');
const CHECK = path.join(REPO_ROOT, 'scripts', 'doctrine-checks', 'check-no-utc-date-only-fixtures.mjs');
const PLANT_DIR = path.join(REPO_ROOT, 'backend', '__tests__');
const TOKEN = '__1lk00_utcdob_plant_';

function runCheck() {
  try {
    const stdout = execFileSync(process.execPath, [CHECK], {
      cwd: REPO_ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf-8',
    });
    return { code: 0, output: stdout ?? '' };
  } catch (err) {
    return { code: typeof err.status === 'number' ? err.status : 1, output: `${err.stdout ?? ''}${err.stderr ?? ''}` };
  }
}

// Field names are spliced in so this file's own source never matches the check.
const DOB = 'dateOfBirth';
const BRED = 'lastBredDate';
const VETTED = 'lastVettedDate';

const planted = [];
function plant(name, body) {
  const file = path.join(PLANT_DIR, `${TOKEN}${name}__.mjs`);
  fs.writeFileSync(file, body, 'utf-8');
  planted.push(file);
  return path.basename(file);
}

afterEach(() => {
  for (const file of planted.splice(0)) {
    fs.rmSync(file, { force: true });
  }
});

describe('check-no-utc-date-only-fixtures (Equoria-1lk00)', () => {
  it.each([
    ['dob_date_now', `const h = { ${DOB}: new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000) };\n`],
    ['bred_get_time', `const h = { ${BRED}: new Date(now.getTime() - 40 * MS_PER_DAY) };\n`],
    ['vetted_assign', `h.${VETTED} = new Date(Date.now() - DAY_MS);\n`],
    ['dob_local_ts', `const ts = Date.now();\nconst h = { ${DOB}: new Date(ts - 900 * DAY) };\n`],
    ['dob_local_date', `const h = { ${DOB}: new Date(now - 30 * DAY) };\n`],
    ['dob_via_value', `const dob = new Date(Date.now() - 5 * 365 * DAY_MS);\nconst h = { ${DOB}: dob };\n`],
    ['bred_via_helper', `const daysAgo = n => new Date(ts - n * DAY);\nconst h = { ${BRED}: daysAgo(2) };\n`],
  ])('fires on a planted %s violation and names the file', (name, body) => {
    const base = plant(name, body);

    const result = runCheck();

    expect(result.code).not.toBe(0);
    expect(result.output).toContain(base);
  });

  it('honours the exemption marker, and ignores comments, literal dates, helpers and a name re-bound to a helper', () => {
    const base = plant(
      'allowed',
      [
        '// doctrine-allow: utc-date-only-fixture — pure function given an instant on purpose',
        `const proof = { ${DOB}: new Date(Date.now() - 21 * DAY_MS) };`,
        `// ${DOB}: new Date(Date.now() - 21 * DAY_MS) in a comment`,
        `const literal = { ${DOB}: new Date('2020-01-01'), ${VETTED}: new Date('2024-06-15T12:00:00Z') };`,
        `const ok = { ${DOB}: gameCalendarDate(new Date(), -21), ${BRED}: birthDateForAge(3) };`,
        'const instant = { createdAt: new Date(Date.now() - DAY_MS) };',
        'const dob = new Date(Date.now() - 7 * DAY_MS);',
        'const used = { createdAt: dob };',
        '{',
        '  const dob = gameCalendarDate(new Date(), -7);',
        `  const fine = { ${DOB}: dob };`,
        '}',
        '',
      ].join('\n'),
    );

    expect(runCheck().output).not.toContain(base);
  });

  it('plants carry a reserved scratch token, so test discovery and foreign scanners skip them', () => {
    expect(isReservedScratchPlantPathSegment(`${TOKEN}dob_date_now__.mjs`)).toBe(true);
    expect(isPlantedTestPath(`__tests__/${TOKEN}dob_date_now__.test.mjs`)).toBe(true);
  });

  it('is clean on the converted tree once the plants are gone', () => {
    expect(runCheck()).toEqual({ code: 0, output: '' });
  });
});
