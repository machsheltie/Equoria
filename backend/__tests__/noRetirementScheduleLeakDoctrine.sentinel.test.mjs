/**
 * Equoria-sg79g doctrine-check sentinel.
 *
 * Proves that `scripts/doctrine-checks/check-no-retirement-schedule-leak.mjs`
 * actually fires when the hidden retirement age is reached for outside its owner
 * files, and that removing the plant returns the check to green. Without this
 * sentinel, a future regex narrowing could silently let a real leak of the
 * groom's hidden retirement age slip past (owner ruling 2026-09-08,
 * task-19-report.md §5).
 *
 * TWO PATTERNS ARE COVERED, matching the check's two:
 *   1. A `retirementSchedule` Prisma include/select key, in its bare,
 *      single-quoted and double-quoted forms.
 *   2. A reference to a schedule-module FUNCTION (`ensureRetirementSchedule`,
 *      `drawRetirementAge`, `readRetirementAge`) outside the owner files. This
 *      arm exists because pattern 1 alone was blind to the leak that actually
 *      existed on this branch: groomRetirementService.mjs re-exported
 *      `ensureRetirementSchedule` and modules/grooms/index.mjs star-exported
 *      that module, so `const age = await ensureRetirementSchedule(...)` in a
 *      player-facing controller published the hidden age with the token
 *      `retirementSchedule:` nowhere in sight (Equoria-m9lz1 fix round 3).
 *      A planted VALUE CAPTURE inside one of the two exempt hire controllers is
 *      covered too, so the "may trigger the draw, may not read the number"
 *      exemption cannot quietly widen into "may do anything".
 *
 * WHY THE CLEAN-BASELINE ARMS DO NOT ASSERT AN EXIT CODE ALONE
 *   Equoria-d2wbw root-caused a sibling sentinel that read exit 0 as proof its
 *   own plant was ignored. An exit code is a property of the WHOLE scanned tree:
 *   any unrelated violation anywhere (including a foreign transient another
 *   suite planted mid-scan) flips it, and a green run does not say the verdict
 *   was about this plant. Every clean-baseline arm below therefore attributes
 *   its verdict to the PLANT'S OWN PATH — the check's own output must not name
 *   the plant file — in addition to the exit code.
 *
 * The plant directory name carries the repo's `_sentinel_plant` reserved
 * scratch marker (see RESERVED_SCRATCH_PLANT_TOKENS in
 * scripts/lib/doctrine-scan-patterns.mjs) and the plant FILE's basename carries
 * the uppercase `PLANTED` marker, so that (a) sibling tree-walking sentinels
 * which check `isReservedScratchPlantPathSegment` recognize this plant as a
 * foreign transient and skip it, and (b) every consumer of the shared
 * `walkFiles()` mechanism excludes it by default via
 * `isPlantArtifactBasename` (Equoria-70pb9) instead of possibly racing its
 * creation/deletion mid-scan. The check under test uses its OWN local walk,
 * which does not filter either marker, so it still sees the plant.
 */

import { describe, it, expect, afterEach } from '@jest/globals';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// The check is import-safe (its scan runs only when it is the process entry
// point), so the exemption contract can be asserted directly instead of by
// mutating a tracked source file to see what the scan says about it.
import {
  OWNER_FILES,
  DRAW_TRIGGER_FILES,
  SCHEDULE_MODULE_FILE,
  IDENT_RX,
  DRAW_TRIGGER_IMPORT_RX,
  DRAW_TRIGGER_DISCARDED_CALL_RX,
  RE_EXPORT_LIST_RX,
  RE_EXPORT_STAR_RX,
} from '../../scripts/doctrine-checks/check-no-retirement-schedule-leak.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const CHECK = path.join(REPO_ROOT, 'scripts/doctrine-checks/check-no-retirement-schedule-leak.mjs');
const PLANT_DIR = path.join(REPO_ROOT, 'backend/modules/_sg79g_sentinel_plant/services');
// Uppercase PLANTED marker: excluded from every shared-walk consumer by default
// (isPlantArtifactBasename), still visible to the check's own local walk.
const PLANT_BASENAME = 'PLANTED_groomRead.mjs';
const PLANT_FILE = path.join(PLANT_DIR, PLANT_BASENAME);
const PLANT_BASENAME_RX = new RegExp(PLANT_BASENAME.replace(/\./g, '\\.'));

afterEach(() => {
  try {
    fs.rmSync(path.dirname(PLANT_DIR), { recursive: true, force: true });
  } catch {
    // intentional: cleanup is best-effort
  }
});

function runCheck() {
  return spawnSync('node', [CHECK], { cwd: REPO_ROOT, encoding: 'utf8' });
}

/**
 * Asserts the check passed AND that its verdict is attributable to this plant's
 * own path rather than to the exit code alone (see the banner). `plantRx` is the
 * path fragment that must be absent from the check's output.
 */
function expectCleanForPlant(res, plantRx) {
  expect(res.stderr).not.toMatch(plantRx);
  expect(res.stdout).toMatch(/no-retirement-schedule-leak.*OK/);
  expect(res.status).toBe(0);
}

// Builds a planted service source around whatever include/select key
// fragment is passed in (bare, single-, or double-quoted). Passing the
// literal key form as a plain argument is safe here — unlike the CHECK
// itself, this TEST FILE lives under backend/__tests__/, a directory the
// check's own walk always skips, so the literal never has a chance to
// self-trip the "baseline clean" assertion above.
function writePlantedService(includeKeyFragment) {
  fs.mkdirSync(PLANT_DIR, { recursive: true });
  const plantedSource =
    "import prisma from '../../../../packages/database/prismaClient.mjs';\n" +
    'export async function plantedGetGroomForPlayer(groomId) {\n' +
    '  return prisma.groom.findUnique({\n' +
    '    where: { id: groomId },\n' +
    `    include: { ${includeKeyFragment} true },\n` +
    '  });\n' +
    '}\n';
  fs.writeFileSync(PLANT_FILE, plantedSource);
}

/**
 * Plants a file that never mentions `retirementSchedule` as a key at all — it
 * only CALLS a schedule-module function and keeps the returned age. This is the
 * exact shape the barrel re-export made possible, and the shape pattern 1 could
 * not see. `statement` is the offending line.
 */
function writePlantedScheduleApiUse(statement) {
  fs.mkdirSync(PLANT_DIR, { recursive: true });
  const plantedSource =
    "import prisma from '../../../../packages/database/prismaClient.mjs';\n" +
    "import { ensureRetirementSchedule } from '../../grooms/index.mjs';\n" +
    'export async function plantedLeakAge(groomId) {\n' +
    `  ${statement}\n` +
    '  return groomId;\n' +
    '}\n';
  fs.writeFileSync(PLANT_FILE, plantedSource);
}

describe('check-no-retirement-schedule-leak.mjs (Equoria-sg79g)', () => {
  it('passes against the current tree (no plant of this suite is named in its output)', () => {
    expectCleanForPlant(runCheck(), PLANT_BASENAME_RX);
  });

  it('SENTINEL: fails when a bare retirementSchedule key is planted outside the owner files', () => {
    writePlantedService('retirementSchedule:');

    const res = runCheck();
    expect(res.status).toBe(1);
    expect(res.stderr).toMatch(/no-retirement-schedule-leak.*FAIL/);
    expect(res.stderr).toMatch(PLANT_BASENAME_RX);
    expect(res.stderr).toMatch(/\[include-key\]/);
  });

  it('SENTINEL: fails when a single-quoted retirementSchedule key is planted', () => {
    writePlantedService("'retirementSchedule':");

    const res = runCheck();
    expect(res.status).toBe(1);
    expect(res.stderr).toMatch(/no-retirement-schedule-leak.*FAIL/);
    expect(res.stderr).toMatch(PLANT_BASENAME_RX);
  });

  it('SENTINEL: fails when a double-quoted retirementSchedule key is planted', () => {
    writePlantedService('"retirementSchedule":');

    const res = runCheck();
    expect(res.status).toBe(1);
    expect(res.stderr).toMatch(/no-retirement-schedule-leak.*FAIL/);
    expect(res.stderr).toMatch(PLANT_BASENAME_RX);
  });

  // ── Pattern 2: the schedule-module function names (Equoria-m9lz1 round 3) ──

  it('SENTINEL: fails on a captured ensureRetirementSchedule call with NO include key present', () => {
    writePlantedScheduleApiUse('const age = await ensureRetirementSchedule(prisma, groomId);');

    const res = runCheck();
    expect(res.status).toBe(1);
    expect(res.stderr).toMatch(/no-retirement-schedule-leak.*FAIL/);
    expect(res.stderr).toMatch(PLANT_BASENAME_RX);
    // The reason must be the FUNCTION reference, not an include key — this plant
    // contains no `retirementSchedule:` key anywhere, which is precisely the
    // blind spot pattern 2 was added to close.
    expect(res.stderr).toMatch(/\[schedule-api\]/);
    expect(res.stderr).not.toMatch(new RegExp(`\\[include-key\\].*${PLANT_BASENAME.replace(/\./g, '\\.')}`));
  });

  it('SENTINEL: fails on readRetirementAge outside the owner files', () => {
    writePlantedScheduleApiUse('const age = await readRetirementAge(prisma, groomId);');

    const res = runCheck();
    expect(res.status).toBe(1);
    expect(res.stderr).toMatch(PLANT_BASENAME_RX);
    expect(res.stderr).toMatch(/\[schedule-api\]/);
  });

  it('SENTINEL: fails on drawRetirementAge outside the owner files', () => {
    writePlantedScheduleApiUse('const age = drawRetirementAge();');

    const res = runCheck();
    expect(res.status).toBe(1);
    expect(res.stderr).toMatch(PLANT_BASENAME_RX);
    expect(res.stderr).toMatch(/\[schedule-api\]/);
  });

  it('SENTINEL: the value-discarding call form is not globally allowed — only in the exempt files', () => {
    // Byte-identical to the statement the two hire controllers use. Planted at a
    // NON-exempt path it must still FAIL, which is what makes the exemption
    // path-scoped rather than form-scoped: a leaky controller cannot adopt the
    // hire controllers' spelling to get past the check.
    writePlantedScheduleApiUse('await ensureRetirementSchedule(prisma, groomId);');

    const res = runCheck();
    expect(res.status).toBe(1);
    expect(res.stderr).toMatch(PLANT_BASENAME_RX);
    expect(res.stderr).toMatch(/\[schedule-api\]/);
  });

  // ── The exempt hire controllers: side effect yes, value no ────────────────
  //
  // Proven by importing the check's own exemption contract rather than by
  // rewriting a tracked controller on disk and re-running the scan. Mutating
  // shared tracked source inside a test is the very hazard finding 4 of this
  // wave is about (a concurrent suite reads the mutated bytes; a hard kill
  // leaves them committed-adjacent), so this suite does not do it.
  describe('the DRAW_TRIGGER exemption is narrow', () => {
    it('covers exactly the two hire controllers, and no owner file twice', () => {
      expect([...DRAW_TRIGGER_FILES].sort()).toEqual([
        'backend/modules/grooms/controllers/groomMarketplaceController.mjs',
        'backend/modules/grooms/controllers/groomRosterController.mjs',
      ]);
      // The two tiers are disjoint: an owner file is exempt outright and must
      // not also be listed as a draw trigger, or a widening of one list would
      // silently widen the other.
      for (const f of DRAW_TRIGGER_FILES) {
        expect(OWNER_FILES.has(f)).toBe(false);
      }
    });

    it('allows the value-DISCARDING call and the by-path import, and nothing else', () => {
      const allowed = line => DRAW_TRIGGER_IMPORT_RX.test(line) || DRAW_TRIGGER_DISCARDED_CALL_RX.test(line);

      // What the real hire controllers contain today.
      expect(
        allowed("import { ensureRetirementSchedule } from '../services/groomRetirementScheduleService.mjs';"),
      ).toBe(true);
      expect(allowed('          await ensureRetirementSchedule(prismaTx, groom.id);')).toBe(true);
      expect(allowed('          await ensureRetirementSchedule(tx, groom.id);')).toBe(true);

      // Every way of KEEPING the number is still a violation inside those files.
      const captures = [
        '  const age = await ensureRetirementSchedule(tx, groom.id);',
        '  let age; age = await ensureRetirementSchedule(tx, groom.id);',
        '  return await ensureRetirementSchedule(tx, groom.id);',
        '  res.json({ age: await ensureRetirementSchedule(tx, groom.id) });',
        '  const age = await readRetirementAge(tx, groom.id);',
        '  const age = drawRetirementAge();',
        // An import that would pull the other two names in alongside.
        "import { ensureRetirementSchedule, readRetirementAge } from '../services/groomRetirementScheduleService.mjs';",
        // An import of the same name through the module BARREL — the exact path
        // this fix round closed. The allow-list pins the schedule module's own
        // filename, so the barrel spelling is not exempt anywhere.
        "import { ensureRetirementSchedule } from '../index.mjs';",
      ];
      for (const line of captures) {
        expect(IDENT_RX.test(line)).toBe(true); // the check notices the line at all
        expect(allowed(line)).toBe(false); // and the exemption does not cover it
      }
    });
  });

  // ── Pattern 3: re-publication of the schedule API ─────────────────────────
  //
  // THE DEFECT, EXACTLY. `export { drawRetirementAge, ensureRetirementSchedule }`
  // sat in groomRetirementService.mjs, and modules/grooms/index.mjs star-exports
  // that module, so the age-returning function was published to the entire
  // backend. Patterns 1 and 2 do not apply inside an owner file, so neither saw
  // it — probing pattern 2 against that restored line returned exit 0. Pattern 3
  // is the arm that names the publishing line.
  describe('re-publication of the schedule API', () => {
    it('SENTINEL: fails on a planted `export { … } from` of a schedule function', () => {
      fs.mkdirSync(PLANT_DIR, { recursive: true });
      fs.writeFileSync(
        PLANT_FILE,
        "export { ensureRetirementSchedule } from '../../grooms/services/groomRetirementScheduleService.mjs';\n",
      );

      const res = runCheck();
      expect(res.status).toBe(1);
      expect(res.stderr).toMatch(PLANT_BASENAME_RX);
      expect(res.stderr).toMatch(/\[re-export\]/);
    });

    it('SENTINEL: fails on a planted star re-export of the schedule module', () => {
      fs.mkdirSync(PLANT_DIR, { recursive: true });
      fs.writeFileSync(PLANT_FILE, "export * from '../../grooms/services/groomRetirementScheduleService.mjs';\n");

      const res = runCheck();
      expect(res.status).toBe(1);
      expect(res.stderr).toMatch(PLANT_BASENAME_RX);
      expect(res.stderr).toMatch(/\[re-export\]/);
    });

    it('applies INSIDE the owner files too — the exact line this fix removed', () => {
      // The owner exemption covers patterns 1 and 2 only; pattern 3's sole
      // carve-out is the schedule module, which declares these functions.
      // Asserted on the imported contract rather than by rewriting the tracked
      // owner file on disk (that is finding 4's hazard, not a test technique).
      expect(OWNER_FILES.has(SCHEDULE_MODULE_FILE)).toBe(true);
      const otherOwners = [...OWNER_FILES].filter(f => f !== SCHEDULE_MODULE_FILE);
      expect(otherOwners).toEqual(['backend/modules/grooms/services/groomRetirementService.mjs']);

      const removedLine = 'export { drawRetirementAge, ensureRetirementSchedule };';
      expect(RE_EXPORT_LIST_RX.test(removedLine)).toBe(true);
      expect(RE_EXPORT_STAR_RX.test("export * from './services/groomRetirementScheduleService.mjs';")).toBe(true);

      // And it does not fire on the schedule module's own DECLARATIONS, which is
      // why that one file is carved out rather than the regex being narrowed.
      for (const declaration of [
        'export function drawRetirementAge() {',
        'export async function readRetirementAge(client, groomId) {',
        'export async function ensureRetirementSchedule(client, groomId) {',
      ]) {
        expect(RE_EXPORT_LIST_RX.test(declaration)).toBe(false);
        expect(RE_EXPORT_STAR_RX.test(declaration)).toBe(false);
      }
    });
  });

  it('returns to green once the planted violation is removed', () => {
    fs.mkdirSync(PLANT_DIR, { recursive: true });
    fs.writeFileSync(PLANT_FILE, 'export async function plantedGetGroomForPlayer() {\n  return null;\n}\n');
    // Confirm the un-violating plant is itself green — and that the green is
    // about THIS plant's path, not just a zero exit — before removing it. That
    // isolates "check returns to 0" from "file no longer exists".
    expectCleanForPlant(runCheck(), PLANT_BASENAME_RX);

    fs.rmSync(path.dirname(PLANT_DIR), { recursive: true, force: true });
    expectCleanForPlant(runCheck(), PLANT_BASENAME_RX);
  });
});
