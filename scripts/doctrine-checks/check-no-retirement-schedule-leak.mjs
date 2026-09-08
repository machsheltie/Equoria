#!/usr/bin/env node
// Doctrine: a groom's retirement age must stay undiscoverable to the player
// until the week it takes effect (owner ruling 2026-09-08, Equoria-sg79g).
// The age lives on the 1:1 `GroomRetirementSchedule` table, so Prisma only
// emits it when a query explicitly `include`s or `select`s the relation.
// The two files below are the only legitimate callers of that relation;
// anywhere else, `retirementSchedule` as a Prisma include/select key is the
// exact moment a player-facing read could start leaking the hidden age.
//
// Detection is a textual match on the object-key form `retirementSchedule:`,
// bare OR quoted (`retirementSchedule:`, `'retirementSchedule':`,
// `"retirementSchedule":`) — colon on the SAME LINE as the identifier. In this
// codebase that token has no meaning other than a Prisma include/select key
// on `Groom` — there is no other field, variable, or type named
// `retirementSchedule` — so the key form alone is sufficient without parsing
// brace nesting.
//
// WHAT THIS DOES NOT CATCH (read this before trusting it as a guarantee):
//   1. A DYNAMICALLY COMPUTED include/select — e.g. a key built from a
//      variable, a spread object, or `JSON.parse`'d shape — never appears in
//      source as the literal token `retirementSchedule:` and is invisible to
//      this scan.
//   2. Someone COPYING the age value into a different column or response
//      field once it has already been read inside the two owner files below
//      (e.g. stashing it on `groom.debugRetirementAge`). This check only
//      guards the Prisma include/select boundary, not what an owner file does
//      with the value afterward.
//   3. A key whose colon sits on a FOLLOWING line (e.g. `retirementSchedule\n
//      : true`). Detection is per line (so violation reports can cite a line
//      number, matching the convention of the sibling checks this mirrors);
//      a colon separated from the identifier by a line break is invisible to
//      this scan.
// This is a cheap static tripwire, not a full data-flow guarantee.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Equoria-q7lqz: a walked file/dir can vanish mid-scan (a concurrent Jest
// sentinel plants and deletes its own scratch files). Tolerate ONLY ENOENT,
// loudly, via the shared helpers — never a bespoke silent catch. Mirrors
// check-no-prisma-in-routes.mjs and check-no-unsafe-raw-sql.mjs.
import {
  readScannedFileSyncTolerant,
  readdirSyncTolerant,
} from '../lib/doctrine-scan-patterns.mjs';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..', '..');
const BACKEND_ROOT = path.join(REPO_ROOT, 'backend');

if (!fs.existsSync(BACKEND_ROOT)) {
  process.exit(0);
}

// The only two files allowed to include/select the relation (verified against
// current source, Equoria-sg79g / Task 19-21).
const OWNER_FILES = new Set([
  'backend/modules/grooms/services/groomRetirementScheduleService.mjs',
  'backend/modules/grooms/services/groomRetirementService.mjs',
]);

const KEY_RX = /\b['"]?retirementSchedule['"]?\s*:/;

function walkDir(dir, results) {
  const entries = readdirSyncTolerant(dir, { withFileTypes: true }, 'no-retirement-schedule-leak');
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '__tests__' || entry.name === 'tests') {
        continue;
      }
      walkDir(full, results);
    } else if (
      entry.isFile() &&
      /\.mjs$/.test(entry.name) &&
      !/\.(test|spec)\.mjs$/.test(entry.name)
    ) {
      results.push(full);
    }
  }
}

const files = [];
walkDir(BACKEND_ROOT, files);

const violations = [];

for (const file of files) {
  const rel = path.relative(REPO_ROOT, file).replace(/\\/g, '/');
  if (OWNER_FILES.has(rel)) continue;

  const source = readScannedFileSyncTolerant(file, 'no-retirement-schedule-leak');
  if (source === null) continue; // vanished mid-scan (ENOENT) — skip, noticed
  const lines = source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')) // strip block comments
    .split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const code = lines[i].replace(/\/\/.*$/, ''); // strip trailing line comment
    if (KEY_RX.test(code)) {
      violations.push({ file: rel, line: i + 1, snippet: lines[i].trim().slice(0, 120) });
    }
  }
}

if (violations.length === 0) {
  process.stdout.write(
    `[no-retirement-schedule-leak] OK — retirementSchedule appears only in its two owner files (Equoria-sg79g)\n`
  );
  process.exit(0);
}

process.stderr.write(
  `[no-retirement-schedule-leak] FAIL — ${violations.length} retirementSchedule include/select key(s) outside the two owner files (Equoria-sg79g).\n` +
    `  Only groomRetirementScheduleService.mjs and groomRetirementService.mjs may query the\n` +
    `  GroomRetirementSchedule relation. Move the read into one of those two files, or expose\n` +
    `  a safe accessor from them, instead of including/selecting it elsewhere. See CLAUDE.md.\n\n`
);
for (const v of violations) {
  process.stderr.write(`  ${v.file}:${v.line}  ${v.snippet}\n`);
}
process.exit(1);
