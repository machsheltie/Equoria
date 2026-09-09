#!/usr/bin/env node
// Doctrine: a groom's retirement age must stay undiscoverable to the player
// until the week it takes effect (owner ruling 2026-09-08, Equoria-sg79g).
// The age lives on the 1:1 `GroomRetirementSchedule` table, so Prisma only
// emits it when a query explicitly `include`s or `select`s the relation.
// The two files below are the only legitimate callers of that relation;
// anywhere else, `retirementSchedule` as a Prisma include/select key is the
// exact moment a player-facing read could start leaking the hidden age.
//
// TWO PATTERNS, because there are two ways the age reaches a non-owner file.
//
// PATTERN 1 — the Prisma include/select KEY. A textual match on the object-key
// form `retirementSchedule:`, bare OR quoted (`retirementSchedule:`,
// `'retirementSchedule':`, `"retirementSchedule":`) — colon on the SAME LINE as
// the identifier. In this codebase that token has no meaning other than a
// Prisma include/select key on `Groom` — there is no other field, variable, or
// type named `retirementSchedule` — so the key form alone is sufficient without
// parsing brace nesting.
//
// PATTERN 2 — the schedule module's own FUNCTION NAMES
// (`ensureRetirementSchedule`, `drawRetirementAge`, `readRetirementAge`). Added
// Equoria-m9lz1 fix round 3 after a whole-branch pass found that pattern 1 alone
// was blind to the real leak that existed:
// `modules/grooms/services/groomRetirementService.mjs` re-exported
// `{ drawRetirementAge, ensureRetirementSchedule }`, and
// `modules/grooms/index.mjs` star-exports that module, so
// `ensureRetirementSchedule` — which RETURNS the age — was published to the
// entire backend. A player-facing controller could then write
// `const age = await ensureRetirementSchedule(prisma, groom.id)` and hand the
// hidden number straight to a response WITHOUT the token `retirementSchedule:`
// appearing anywhere. Pattern 1 passed that silently.
//
//   Exemption tiers for pattern 2 (pattern 1 uses OWNER_FILES only):
//     - OWNER_FILES: unrestricted. These two files ARE the age's home.
//     - DRAW_TRIGGER_FILES (the two hire controllers): allowed to IMPORT
//       `ensureRetirementSchedule` from the schedule module by path and to CALL
//       it as a value-DISCARDING statement (`await ensureRetirementSchedule(
//       …);`), which is all a hire needs — it draws the age so the groom has one
//       and never looks at it. Capturing the return value there
//       (`const age = await ensureRetirementSchedule(…)`), or naming
//       `drawRetirementAge` / `readRetirementAge` at all, is a violation just as
//       it is anywhere else. So the exemption permits the side effect without
//       permitting the value.
//
// PATTERN 3 — RE-PUBLICATION of the schedule API from any file except the
// schedule module itself: `export { … ensureRetirementSchedule … }` or
// `export * from '…/groomRetirementScheduleService.mjs'`. Added in the same
// round, after probing pattern 2 against the defect it was written for: patterns
// 1 and 2 do not apply inside an OWNER file, so restoring the offending
// `export { drawRetirementAge, ensureRetirementSchedule }` to
// groomRetirementService.mjs left the check green even though that one line was
// the whole leak. Pattern 2 would still have caught every CONSUMER of the
// barrel, so the age could not actually have escaped — but the check should be
// able to name the line that publishes it, not only the lines that use it.
// Pattern 3 applies to owner files and draw-trigger files as well; only
// groomRetirementScheduleService.mjs, which declares and default-exports these
// functions, is outside it.
//
// WHAT THIS DOES NOT CATCH (read this before trusting it as a guarantee):
//   1. A DYNAMICALLY COMPUTED include/select — e.g. a key built from a
//      variable, a spread object, or `JSON.parse`'d shape — never appears in
//      source as the literal token `retirementSchedule:` and is invisible to
//      this scan. The same applies to a dynamically resolved function name
//      (`svc['ensure' + 'RetirementSchedule']`, or a property access on an
//      imported namespace/default object such as `svc.ensureRetirementSchedule`
//      where `svc` is the module's default export — which is why the schedule
//      functions are no longer on any default export or barrel).
//   2. Someone COPYING the age value into a different column or response field
//      once it has already been read INSIDE A FILE THAT IS ALLOWED TO READ IT
//      (e.g. stashing it on `groom.debugRetirementAge` in one of the two owner
//      files, or leaking the value a DRAW_TRIGGER_FILE captured in a way this
//      check's line-level regex does not recognise as a capture — a multi-line
//      assignment, say). The patterns guard how the age is OBTAINED and how it
//      is PUBLISHED, not what a file entitled to obtain it does afterward.
//   2b. A re-publication that is not a static export statement: attaching a
//      schedule function to an object an owner file already exports
//      (`export default { …, ensureRetirementSchedule }` — which is why the
//      default export of groomRetirementService.mjs no longer carries them),
//      or assigning it onto some other exported value at runtime. Pattern 3
//      reads `export { … }` / `export * from …` lines only.
//   3. A key whose colon sits on a FOLLOWING line (e.g. `retirementSchedule\n
//      : true`). Detection is per line (so violation reports can cite a line
//      number, matching the convention of the sibling checks this mirrors);
//      a colon separated from the identifier by a line break is invisible to
//      this scan. Likewise a pattern-2 identifier whose call parenthesis or
//      assignment sits on another line is classified by the line it appears on.
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

// The only two files allowed to include/select the relation (verified against
// current source, Equoria-sg79g / Task 19-21).
export const OWNER_FILES = new Set([
  'backend/modules/grooms/services/groomRetirementScheduleService.mjs',
  'backend/modules/grooms/services/groomRetirementService.mjs',
]);

// Pattern 2's narrower exemption: the two hire controllers must TRIGGER the draw
// (a groom hired today needs a schedule row) but must never see the number.
// Verified against current source 2026-09-09: each contains exactly one import
// of `ensureRetirementSchedule` from the schedule module and exactly one
// value-discarding `await ensureRetirementSchedule(<tx>, groom.id);` statement.
export const DRAW_TRIGGER_FILES = new Set([
  'backend/modules/grooms/controllers/groomRosterController.mjs',
  'backend/modules/grooms/controllers/groomMarketplaceController.mjs',
]);

export const KEY_RX = /\b['"]?retirementSchedule['"]?\s*:/;

// Pattern 2: any mention of a schedule-module function name.
export const IDENT_RX = /\b(ensureRetirementSchedule|drawRetirementAge|readRetirementAge)\b/;

// The two forms a DRAW_TRIGGER_FILE may use. Anything else that mentions a
// schedule identifier in those files is still a violation — in particular an
// assignment/return/interpolation that CAPTURES the age.
//   (a) the by-path named import of ensureRetirementSchedule alone;
//   (b) a statement whose entire content is `await ensureRetirementSchedule(...)`
//       — the value is discarded, so no age can escape through it.
export const DRAW_TRIGGER_IMPORT_RX =
  /^\s*import\s*\{\s*ensureRetirementSchedule\s*\}\s*from\s*['"][^'"]*groomRetirementScheduleService\.mjs['"]\s*;?\s*$/;
export const DRAW_TRIGGER_DISCARDED_CALL_RX =
  /^\s*await\s+ensureRetirementSchedule\s*\([^;]*\)\s*;\s*$/;

// PATTERN 3 — RE-PUBLICATION from a file that is itself exempt from pattern 2.
//
// Found by probing pattern 2 against the defect it was written for: restoring
// `export { drawRetirementAge, ensureRetirementSchedule }` to
// groomRetirementService.mjs left the check GREEN, because that file is an owner
// file and owner files are exempt from pattern 2 outright. Pattern 2 does still
// close the leak in effect — every CONSUMER of the barrel would be caught — but
// the check should name the line that publishes the age API, not only the line
// that consumes it. So the exempt files (owner + draw-trigger) are additionally
// forbidden from RE-EXPORTING a schedule function or star-exporting the schedule
// module.
//
// The schedule module itself is not subject to this: `export function
// drawRetirementAge()` and its own default export are how the API exists at all.
export const SCHEDULE_MODULE_FILE =
  'backend/modules/grooms/services/groomRetirementScheduleService.mjs';
export const RE_EXPORT_LIST_RX =
  /^\s*export\s*\{[^}]*\b(?:ensureRetirementSchedule|drawRetirementAge|readRetirementAge)\b/;
export const RE_EXPORT_STAR_RX =
  /^\s*export\s+\*\s+(?:as\s+\w+\s+)?from\s*['"][^'"]*groomRetirementScheduleService\.mjs['"]/;

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

// CONTRIBUTING.md "CLI scripts and destructive side effects": the scan runs only
// when this file is the process entry point, so the sentinel
// (backend/__tests__/noRetirementScheduleLeakDoctrine.sentinel.test.mjs) can
// IMPORT the exemption contract above and assert its narrowness directly,
// without writing to a tracked source file to find out. run-all.sh invokes this
// as `node <script>`, so the guard is satisfied there.
function main() {
  if (!fs.existsSync(BACKEND_ROOT)) {
    process.exit(0);
  }

  const files = [];
  walkDir(BACKEND_ROOT, files);

  const violations = [];

  for (const file of files) {
    const rel = path.relative(REPO_ROOT, file).replace(/\\/g, '/');
    const isOwner = OWNER_FILES.has(rel);
    const isDrawTrigger = DRAW_TRIGGER_FILES.has(rel);
    // Files exempt from pattern 2 are still forbidden to RE-PUBLISH the API
    // (pattern 3) — except the schedule module, which owns the declarations.
    // So an owner file is no longer skipped outright: patterns 1 and 2 do not
    // apply to it, pattern 3 does.
    const checkReExport = rel !== SCHEDULE_MODULE_FILE;
    if (isOwner && !checkReExport) continue;

    const source = readScannedFileSyncTolerant(file, 'no-retirement-schedule-leak');
    if (source === null) continue; // vanished mid-scan (ENOENT) — skip, noticed
    const lines = source
      .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')) // strip block comments
      .split(/\r?\n/);

    for (let i = 0; i < lines.length; i++) {
      const code = lines[i].replace(/\/\/.*$/, ''); // strip trailing line comment

      if (checkReExport && (RE_EXPORT_LIST_RX.test(code) || RE_EXPORT_STAR_RX.test(code))) {
        violations.push({
          kind: 're-export',
          file: rel,
          line: i + 1,
          snippet: lines[i].trim().slice(0, 120),
        });
        // Already reported as the more specific defect; do not also report the
        // same line as a bare identifier reference.
        continue;
      }
      if (isOwner) continue; // patterns 1 and 2 do not apply inside an owner file

      if (KEY_RX.test(code)) {
        violations.push({
          kind: 'include-key',
          file: rel,
          line: i + 1,
          snippet: lines[i].trim().slice(0, 120),
        });
      }
      if (IDENT_RX.test(code)) {
        const allowedHere =
          isDrawTrigger &&
          (DRAW_TRIGGER_IMPORT_RX.test(code) || DRAW_TRIGGER_DISCARDED_CALL_RX.test(code));
        if (!allowedHere) {
          violations.push({
            kind: 'schedule-api',
            file: rel,
            line: i + 1,
            snippet: lines[i].trim().slice(0, 120),
          });
        }
      }
    }
  }

  if (violations.length === 0) {
    process.stdout.write(
      `[no-retirement-schedule-leak] OK — retirementSchedule and the schedule-module functions appear only where they are owned (Equoria-sg79g)\n`
    );
    process.exit(0);
  }

  const keyCount = violations.filter((v) => v.kind === 'include-key').length;
  const apiCount = violations.filter((v) => v.kind === 'schedule-api').length;
  const reExportCount = violations.filter((v) => v.kind === 're-export').length;

  process.stderr.write(
    `[no-retirement-schedule-leak] FAIL — ${keyCount} retirementSchedule include/select key(s), ` +
      `${apiCount} schedule-module function reference(s) outside the files that own them, and ` +
      `${reExportCount} re-publication(s) of the schedule API (Equoria-sg79g).\n` +
      `  Only groomRetirementScheduleService.mjs and groomRetirementService.mjs may query the\n` +
      `  GroomRetirementSchedule relation or handle the retirement age. Move the read into one of\n` +
      `  those two files, or expose a safe accessor from them, instead of including/selecting the\n` +
      `  relation or calling ensureRetirementSchedule / drawRetirementAge / readRetirementAge\n` +
      `  elsewhere. The two hire controllers may trigger the draw only as a value-discarding\n` +
      `  \`await ensureRetirementSchedule(tx, groom.id);\` statement. NO file outside\n` +
      `  groomRetirementScheduleService.mjs may re-export the schedule API or star-export that\n` +
      `  module — that is how the age reached the whole backend through the grooms barrel.\n` +
      `  See CLAUDE.md.\n\n`
  );
  for (const v of violations) {
    process.stderr.write(`  [${v.kind}] ${v.file}:${v.line}  ${v.snippet}\n`);
  }
  process.exit(1);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
