/**
 * Sentinel for scripts/doctrine-checks/check-no-utc-date-only-fixtures.mjs
 * (Equoria-1lk00).
 *
 * The check flags a date-only Horse column (dateOfBirth, lastBredDate,
 * lastVettedDate) written from UTC-instant arithmetic, which stores the UTC date
 * and reads one day short from 20:00 to 24:00 ET. This proves it FIRES on a
 * planted violation in each shape it claims to catch, honours the exemption
 * marker, ignores comments and the game-clock helpers, and that the tree is
 * clean once the plants are gone.
 *
 * Real check process; each plant is a uniquely named file that is removed.
 */

import { describe, it, expect, afterEach } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..', '..', '..');
const CHECK = path.join(REPO_ROOT, 'scripts', 'doctrine-checks', 'check-no-utc-date-only-fixtures.mjs');
const PLANT_DIR = path.join(REPO_ROOT, 'backend', '__tests__');

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
  const file = path.join(PLANT_DIR, `__1lk00_${name}_sentinel__.mjs`);
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
  ])('fires on a planted %s violation and names the file', (name, body) => {
    const base = plant(name, body);

    const result = runCheck();

    expect(result.code).not.toBe(0);
    expect(result.output).toContain(base);
  });

  it('honours the exemption marker on the line above, and ignores comments and the game-clock helpers', () => {
    const base = plant(
      'allowed',
      [
        '// doctrine-allow: utc-date-only-fixture',
        `const proof = { ${DOB}: new Date(Date.now() - 21 * DAY_MS) };`,
        `// ${DOB}: new Date(Date.now() - 21 * DAY_MS) in a comment`,
        `const ok = { ${DOB}: gameCalendarDate(new Date(), -21), ${BRED}: birthDateForAge(3) };`,
        'const instant = { createdAt: new Date(Date.now() - DAY_MS) };',
        '',
      ].join('\n'),
    );

    expect(runCheck().output).not.toContain(base);
  });

  it('is clean on the converted tree once the plants are gone', () => {
    expect(runCheck()).toEqual({ code: 0, output: '' });
  });
});
