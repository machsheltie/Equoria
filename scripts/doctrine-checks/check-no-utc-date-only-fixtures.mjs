#!/usr/bin/env node
// Doctrine (Equoria-1lk00): a DATE-ONLY Horse column is never written from
// UTC-instant arithmetic.
//
// dateOfBirth, lastBredDate and lastVettedDate are `@db.Date`: Postgres keeps
// the UTC calendar date of whatever instant is written. Every day count in the
// game is an Eastern calendar day (owner ruling 2026-10-09), so a value built as
// `new Date(Date.now() - N days)` (or `now.getTime() - ...`) stores the UTC date,
// which from 20:00 to 24:00 ET is already tomorrow in Eastern, and the horse
// reads one day short. Write these columns with the game-clock helpers:
//   gameCalendarDate(now, -N)   (backend/utils/gameTime.mjs)
//   birthDateForAge(years, now) (backend/utils/horseAge.mjs)
//
// Flags, in backend/ and tests/ (tests, fixtures, seeds and scripts alike):
//   <dateOfBirth|lastBredDate|lastVettedDate>: new Date(Date.now() - ...)
//   <dateOfBirth|lastBredDate|lastVettedDate>: new Date(<x>.getTime() - ...)
// (also `=` assignment and `+` arithmetic). Comment lines are skipped.
//
// Exemption, only for a fixture that writes the UTC date ON PURPOSE (e.g. to
// prove an instant is inside the evening window), on the same line or the line
// above:
//   // doctrine-allow: utc-date-only-fixture

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { walkFiles, readScannedFileSyncTolerant } from '../lib/doctrine-scan-patterns.mjs';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..', '..');
const ROOTS = ['backend', 'tests'].map((dir) => path.join(REPO_ROOT, dir));

const MARKER = 'doctrine-allow: utc-date-only-fixture';
const PATTERN =
  /\b(dateOfBirth|lastBredDate|lastVettedDate)\s*[:=]\s*new Date\(\s*(Date\.now\(\)|[A-Za-z_$][\w$.]*\.getTime\(\))\s*[-+]/;

const skipDir = (name) => name === 'node_modules' || name === '.git' || name === 'coverage';
const includeFile = (name) => /\.(mjs|js|cjs|ts)$/.test(name);

function isCommentLine(line) {
  const t = line.trimStart();
  return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*');
}

const failures = [];
for (const file of walkFiles(ROOTS, { skipDir, includeFile })) {
  const content = readScannedFileSyncTolerant(file, 'no-utc-date-only-fixtures');
  if (content === null) continue;
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isCommentLine(line) || !PATTERN.test(line)) continue;
    if (line.includes(MARKER) || (i > 0 && lines[i - 1].includes(MARKER))) continue;
    failures.push(`${path.relative(REPO_ROOT, file)}:${i + 1}  ${line.trim()}`);
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
