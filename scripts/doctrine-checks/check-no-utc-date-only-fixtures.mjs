#!/usr/bin/env node
// Doctrine (Equoria-1lk00): a DATE-ONLY Horse column is never written from
// UTC-instant arithmetic.
//
// dateOfBirth, lastBredDate and lastVettedDate are `@db.Date`: Postgres keeps
// the UTC calendar date of whatever instant is written. Every day count in the
// game is an Eastern calendar day (owner ruling 2026-10-09), so a value built as
// `new Date(Date.now() - N days)` stores the UTC date, which from 20:00 to 24:00
// ET is already tomorrow in Eastern, and the horse reads one day short. Write
// these columns with the game-clock helpers:
//   gameCalendarDate(now, -N)   (backend/utils/gameTime.mjs)
//   birthDateForAge(years, now) (backend/utils/horseAge.mjs)
//
// Flags, in backend/ and tests/ (tests, fixtures, seeds and scripts alike):
//   1. DIRECT: a date-only field (`:` or `=`) given `new Date(<expr> ± ...)`,
//      where <expr> is anything but a string literal: Date.now(), x.getTime(),
//      a local timestamp `ts`, a Date `now`, ...
//   2. VIA A LOCAL: a date-only field given a name (`dateOfBirth: dob`) or a
//      call (`dateOfBirth: daysAgo(3)`) whose nearest preceding definition in
//      the same file is `const|let|var <name> = [<params> =>] new Date(<expr> ± ...)`.
//
// Limits (honest): one line at a time, so a `new Date(` split across lines, a
// helper defined in ANOTHER file, a `function` declaration, object shorthand
// (`{ dateOfBirth }`) or a value passed through parameters is not seen. Scope is
// approximated by the nearest preceding definition of the name, not real lexical
// scope. A fixed date literal (`new Date('2020-01-01')`) is never flagged: it is
// already a calendar date.
//
// Exemption, only for an instant written ON PURPOSE (a pure-function test, or a
// test proving the time of day is ignored), on the same line or the line above,
// with the reason after it:
//   // doctrine-allow: utc-date-only-fixture — <reason>

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { walkFiles, readScannedFileSyncTolerant } from '../lib/doctrine-scan-patterns.mjs';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..', '..');
const ROOTS = ['backend', 'tests'].map((dir) => path.join(REPO_ROOT, dir));

const MARKER = 'doctrine-allow: utc-date-only-fixture';
const FIELDS = '(?:dateOfBirth|lastBredDate|lastVettedDate)';
// new Date( <not a string literal> ... + or - ... )
const INSTANT_ARITH = String.raw`new Date\(\s*(?!['"\x60])[^;'"\x60]*?[-+][^;'"\x60]*\)`;
const DIRECT = new RegExp(String.raw`\b${FIELDS}\s*[:=]\s*${INSTANT_ARITH}`);
const DEFINITION = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(.*)$/;
const ARROW_PREFIX = String.raw`^(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>\s*`;
const INSTANT_VALUE = new RegExp(`^${INSTANT_ARITH}`);
const INSTANT_FN = new RegExp(`${ARROW_PREFIX}${INSTANT_ARITH}`);
const VIA = new RegExp(String.raw`\b${FIELDS}\s*:\s*([A-Za-z_$][\w$]*)\s*(\()?`, 'g');

const skipDir = (name) => name === 'node_modules' || name === '.git' || name === 'coverage';
const includeFile = (name) => /\.(mjs|js|cjs|ts)$/.test(name);

function isCommentLine(line) {
  const t = line.trimStart();
  return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*');
}

/** Every `const|let|var name = ...` in the file: name -> [{ line, kind }], kind 'value' | 'fn' | null. */
function definitions(lines) {
  const defs = new Map();
  lines.forEach((line, i) => {
    const m = DEFINITION.exec(line);
    if (!m) return;
    const rhs = m[2];
    const kind = INSTANT_VALUE.test(rhs) ? 'value' : INSTANT_FN.test(rhs) ? 'fn' : null;
    if (!defs.has(m[1])) defs.set(m[1], []);
    defs.get(m[1]).push({ line: i, kind });
  });
  return defs;
}

/** The kind of the nearest definition of `name` at or before line `i`. */
function kindAt(defs, name, i) {
  let kind = null;
  for (const def of defs.get(name) ?? []) {
    if (def.line <= i) kind = def.kind;
  }
  return kind;
}

const failures = [];
for (const file of walkFiles(ROOTS, { skipDir, includeFile })) {
  const content = readScannedFileSyncTolerant(file, 'no-utc-date-only-fixtures');
  if (content === null) continue;
  const lines = content.split(/\r?\n/);
  let defs = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isCommentLine(line)) continue;
    if (line.includes(MARKER) || (i > 0 && lines[i - 1].includes(MARKER))) continue;
    let flagged = DIRECT.test(line);
    if (!flagged && /\b(?:dateOfBirth|lastBredDate|lastVettedDate)\s*:/.test(line)) {
      defs ??= definitions(lines);
      for (const m of line.matchAll(VIA)) {
        const kind = kindAt(defs, m[1], i);
        if ((kind === 'value' && !m[2]) || (kind === 'fn' && m[2])) flagged = true;
      }
    }
    if (flagged) failures.push(`${path.relative(REPO_ROOT, file)}:${i + 1}  ${line.trim()}`);
  }
}

if (failures.length > 0) {
  console.error('\nDate-only Horse column written from UTC-instant arithmetic (Equoria-1lk00):');
  for (const f of failures) {
    console.error(`  ${f}`);
  }
  console.error(
    '\nUse gameCalendarDate(now, -days) or birthDateForAge(years, now): the stored date must be the Eastern date.'
  );
  process.exit(1);
}

process.exit(0);
