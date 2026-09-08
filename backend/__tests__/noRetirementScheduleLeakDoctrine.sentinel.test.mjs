/**
 * Equoria-sg79g doctrine-check sentinel.
 *
 * Proves that `scripts/doctrine-checks/check-no-retirement-schedule-leak.mjs`
 * actually fires when a `retirementSchedule` Prisma include/select key is
 * planted outside its two owner files, in both its bare and quoted forms, and
 * that removing the plant returns the check to green. Without this sentinel,
 * a future regex narrowing could silently let a real leak of the groom's
 * hidden retirement age slip past (owner ruling 2026-09-08,
 * task-19-report.md §5).
 *
 * The plant directory name carries the repo's `_sentinel_plant` reserved
 * scratch marker (see RESERVED_SCRATCH_PLANT_TOKENS in
 * scripts/lib/doctrine-scan-patterns.mjs) so that sibling tree-walking
 * sentinels which check `isReservedScratchPlantPathSegment` recognize this
 * plant as a foreign transient and skip it, instead of possibly racing its
 * creation/deletion mid-scan. The check under test does not itself filter
 * that marker, so it still sees the plant when spawned directly below.
 */

import { describe, it, expect, afterEach } from '@jest/globals';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const CHECK = path.join(REPO_ROOT, 'scripts/doctrine-checks/check-no-retirement-schedule-leak.mjs');
const PLANT_DIR = path.join(REPO_ROOT, 'backend/modules/_sg79g_sentinel_plant/services');
const PLANT_FILE = path.join(PLANT_DIR, 'plantedGroomRead.mjs');

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

describe('check-no-retirement-schedule-leak.mjs (Equoria-sg79g)', () => {
  it('passes against the current tree (retirementSchedule only in its owner files)', () => {
    const res = runCheck();
    expect(res.status).toBe(0);
    expect(res.stdout).toMatch(/no-retirement-schedule-leak.*OK/);
  });

  it('SENTINEL: fails when a bare retirementSchedule key is planted outside the owner files', () => {
    writePlantedService('retirementSchedule:');

    const res = runCheck();
    expect(res.status).toBe(1);
    expect(res.stderr).toMatch(/no-retirement-schedule-leak.*FAIL/);
    expect(res.stderr).toMatch(/plantedGroomRead\.mjs/);
  });

  it('SENTINEL: fails when a single-quoted retirementSchedule key is planted', () => {
    writePlantedService("'retirementSchedule':");

    const res = runCheck();
    expect(res.status).toBe(1);
    expect(res.stderr).toMatch(/no-retirement-schedule-leak.*FAIL/);
    expect(res.stderr).toMatch(/plantedGroomRead\.mjs/);
  });

  it('SENTINEL: fails when a double-quoted retirementSchedule key is planted', () => {
    writePlantedService('"retirementSchedule":');

    const res = runCheck();
    expect(res.status).toBe(1);
    expect(res.stderr).toMatch(/no-retirement-schedule-leak.*FAIL/);
    expect(res.stderr).toMatch(/plantedGroomRead\.mjs/);
  });

  it('returns to green once the planted violation is removed', () => {
    fs.mkdirSync(PLANT_DIR, { recursive: true });
    fs.writeFileSync(PLANT_FILE, 'export async function plantedGetGroomForPlayer() {\n  return null;\n}\n');
    // Confirm the un-violating plant is itself green before removing it,
    // isolating "check returns to 0" from "file no longer exists".
    const withPlant = runCheck();
    expect(withPlant.status).toBe(0);

    fs.rmSync(path.dirname(PLANT_DIR), { recursive: true, force: true });
    const afterRemoval = runCheck();
    expect(afterRemoval.status).toBe(0);
    expect(afterRemoval.stdout).toMatch(/no-retirement-schedule-leak.*OK/);
  });
});
