/**
 * Equoria-cfg6q: standalone seed and script entry points that reach the
 * profile-backed generators must load the breed profile cache themselves.
 *
 * The cache (breedProfileCache.mjs) is filled only by preloadBreedProfiles()
 * and is process-local. The server fills it at boot; a script run with
 * `node backend/seed/x.mjs` does not, so generateGaitScores /
 * generateTemperamentWithDefault threw after the script had already written
 * some rows. This sentinel statically scans every non-test .mjs under
 * backend/seed and backend/scripts: a file that imports one of the
 * profile-backed generators from the horses module must also import
 * preloadBreedProfiles, call it, and assert the count.
 *
 * A planted violation proves the detector fires. Pure static analysis; no DB,
 * and the scripts are never imported (several write to the canonical DB).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, test, expect } from '@jest/globals';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// Public exports of modules/horses that end in getBreedProfile().
const profileBackedGenerators = [
  'generateGaitScores',
  'generateTemperament',
  'generateTemperamentWithDefault',
  'calculateOverallConformation',
  'createHorseFromRequest',
  'createHorse',
  'createFoalFromPregnancy',
  'runFoalingJob',
];

function importsFromHorsesModule(source) {
  const names = new Set();
  const re = /import\s*\{([^}]*)\}\s*from\s*'[^']*modules\/horses\/[^']*'/g;
  for (const match of source.matchAll(re)) {
    for (const part of match[1].split(',')) {
      const name = part.trim().split(/\s+as\s+/)[0];
      if (name) {
        names.add(name);
      }
    }
  }
  return names;
}

// Returns a problem description, or null when the file is fine.
export function findMissingPreload(source) {
  const imported = importsFromHorsesModule(source);
  const needs = profileBackedGenerators.filter(name => imported.has(name));
  if (needs.length === 0) {
    return null;
  }
  if (!imported.has('preloadBreedProfiles')) {
    return `imports ${needs.join(', ')} but not preloadBreedProfiles`;
  }
  if (!/await\s+preloadBreedProfiles\(/.test(source)) {
    return 'imports preloadBreedProfiles but never awaits it';
  }
  if (!/assertBreedProfilesLoaded\(/.test(source)) {
    return 'preloads but never asserts the count (a zero-profile database would still write rows)';
  }
  return null;
}

function listEntryPoints() {
  const files = [];
  for (const dir of ['seed', 'scripts']) {
    const full = path.join(backendRoot, dir);
    for (const name of fs.readdirSync(full)) {
      if (name.endsWith('.mjs') && !/\.test\.mjs$/.test(name)) {
        files.push(path.join(full, name));
      }
    }
  }
  return files;
}

describe('seed and script entry points load the breed profile cache (Equoria-cfg6q)', () => {
  test('detector fires on a planted violation and accepts a compliant script', () => {
    const planted =
      "import { generateGaitScores } from '../modules/horses/index.mjs';\nconst g = generateGaitScores('Thoroughbred');\n";
    expect(findMissingPreload(planted)).toMatch(/not preloadBreedProfiles/);

    const noAssert =
      "import { generateGaitScores, preloadBreedProfiles } from '../modules/horses/index.mjs';\nawait preloadBreedProfiles(prisma);\n";
    expect(findMissingPreload(noAssert)).toMatch(/never asserts/);

    const ok =
      "import {\n  assertBreedProfilesLoaded,\n  generateGaitScores,\n  preloadBreedProfiles,\n} from '../modules/horses/index.mjs';\nassertBreedProfilesLoaded(await preloadBreedProfiles(prisma));\n";
    expect(findMissingPreload(ok)).toBeNull();
    expect(findMissingPreload("import { x } from '../utils/y.mjs';")).toBeNull();
  });

  test('every profile-backed entry point preloads once and asserts the count', () => {
    const entryPoints = listEntryPoints();
    expect(entryPoints.length).toBeGreaterThan(10);
    const problems = [];
    let checked = 0;
    for (const file of entryPoints) {
      const source = fs.readFileSync(file, 'utf8');
      if (importsFromHorsesModule(source).size > 0) {
        checked += 1;
      }
      const problem = findMissingPreload(source);
      if (problem) {
        problems.push(`${path.relative(backendRoot, file)}: ${problem}`);
      }
    }
    expect(checked).toBeGreaterThan(0);
    expect(problems).toEqual([]);
  });
});
