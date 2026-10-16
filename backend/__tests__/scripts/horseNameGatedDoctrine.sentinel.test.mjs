/**
 * check-horse-name-gated.mjs sentinel (Equoria-qkgfh.1 gate; arms added in Equoria-q4uem.4
 * WS4 S5 review M5 and fix round 2 minor 10).
 *
 * Proves the horse-name gate fires on a planted request-reachable writer of `horses.name`,
 * and that its "imports the shared policy" test reads IDENTIFIERS in real import statements:
 *   - an ungated writer FAILS with file and line;
 *   - a writer whose only link to the policy is a comment inside the import braces
 *     (`import { getHorseById /* horseName *\/ } from '../horses/index.mjs'`) FAILS;
 *   - a writer whose only "import" of the policy sits inside a string literal FAILS;
 *   - a writer importing an unrelated horses export from the barrel FAILS;
 *   - a writer importing an exact policy name from the horses barrel (plain or aliased) PASSES;
 *   - the same for horses/routes/_validators.mjs: a comment-only mention FAILS, the exact
 *     validator-chain name PASSES;
 *   - a writer importing the policy module directly PASSES (unchanged contract).
 *
 * Plant hygiene: unique per-run names, every created path recorded and removed deepest-first
 * in afterEach, and the suite asserts no plant remains.
 */

import { describe, it, expect, beforeAll, afterEach, afterAll } from '@jest/globals';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readdirSyncTolerant } from '../../../scripts/lib/doctrine-scan-patterns.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..', '..');
const CHECK = path.join(REPO_ROOT, 'scripts/doctrine-checks/check-horse-name-gated.mjs');
const MODULES = path.join(REPO_ROOT, 'backend/modules');
const RUN_ID = `${process.pid}-${randomBytes(4).toString('hex')}`;
const PLANT_TOKEN = '_ws4hnplant_';
const relPosix = abs => path.relative(REPO_ROOT, abs).split(path.sep).join('/');

const planted = [];

function plantFile(relFromModules, content) {
  const abs = path.join(MODULES, relFromModules);
  const missing = [];
  for (let dir = path.dirname(abs); !fs.existsSync(dir); dir = path.dirname(dir)) {
    missing.unshift(dir);
  }
  for (const dir of missing) {
    fs.mkdirSync(dir);
    planted.push(dir);
  }
  fs.writeFileSync(abs, content);
  planted.push(abs);
  return abs;
}

function cleanupPlants() {
  for (const p of [...planted].reverse()) {
    fs.rmSync(p, { recursive: true, force: true });
  }
  for (const p of planted) {
    expect(fs.existsSync(p)).toBe(false);
  }
  planted.length = 0;
}

// Equoria-rfv9j (gate equoria-shard-7QaJDm): another suite's plant directory under
// backend/modules (e.g. adminMfaCoverage's _e4a2y_doctrine_sentinel) can vanish between
// this scan's readdir and its stat. A vanished entry is not one of OUR strays — ours are
// removed synchronously in cleanupPlants() before every scan, so a leftover of ours still
// exists — so ENOENT alone is ignored (readdirSyncTolerant / throwIfNoEntry:false) and
// every other error still throws, as in the WS4 module-graph gate.
function strayPlants() {
  const found = [];
  const scan = (dir, depth) => {
    for (const name of readdirSyncTolerant(dir, undefined, 'horse-name-gated-sentinel')) {
      const abs = path.join(dir, name);
      if (name.includes(PLANT_TOKEN)) {
        found.push(relPosix(abs));
      }
      if (depth > 0 && name !== 'node_modules' && fs.statSync(abs, { throwIfNoEntry: false })?.isDirectory()) {
        scan(abs, depth - 1);
      }
    }
  };
  scan(MODULES, 2);
  return found;
}

function runCheck() {
  const res = spawnSync('node', [CHECK], { cwd: REPO_ROOT, encoding: 'utf8' });
  return { status: res.status, out: `${res.stdout}\n${res.stderr}` };
}

// A request-reachable writer of horses.name (signal A: prisma.horse.update with a `name` key).
const WRITER =
  'export async function renamePlant(req, res) {\n  await prisma.horse.update({ where: { id: 1 }, data: { name: req.body.name } });\n  res.json({ ok: true });\n}\n';
const PRISMA_FROM_ECONOMY = "import prisma from '../../../packages/database/prismaClient.mjs';\n";
const PRISMA_FROM_HORSE_ROUTES = "import prisma from '../../../../packages/database/prismaClient.mjs';\n";

beforeAll(() => {
  expect(fs.existsSync(CHECK)).toBe(true);
  expect(strayPlants()).toEqual([]);
});

afterEach(() => {
  cleanupPlants();
  expect(strayPlants()).toEqual([]);
});

afterAll(() => {
  expect(planted).toEqual([]);
  expect(strayPlants()).toEqual([]);
});

describe('check-horse-name-gated.mjs (Equoria-qkgfh.1; WS4 S5 review M5 arms)', () => {
  it('passes on the current tree', () => {
    const res = runCheck();
    expect(res.status).toBe(0);
    expect(res.out).toMatch(/\[horse-name-gated\] OK — \d+ horse-name writer\(s\)/);
  });

  it('FAILS on a planted ungated writer, naming the file and line', () => {
    const plant = plantFile(`economy/${PLANT_TOKEN}ungated_${RUN_ID}.mjs`, `${PRISMA_FROM_ECONOMY}${WRITER}`);
    const res = runCheck();
    expect(res.status).toBe(1);
    expect(res.out).toContain(relPosix(plant));
    expect(res.out).toMatch(/prisma\.horse\.update writing name \(line 3\)/);
  });

  it('M5: a policy name that appears only in a COMMENT inside the import braces does not gate (barrel path)', () => {
    const plant = plantFile(
      `economy/${PLANT_TOKEN}commentbarrel_${RUN_ID}.mjs`,
      `${PRISMA_FROM_ECONOMY}import { getHorseById /* horseNameRejectionReason */ } from '../horses/index.mjs';\n${WRITER}`,
    );
    const res = runCheck();
    expect(res.status).toBe(1);
    expect(res.out).toContain(relPosix(plant));
  });

  it('minor 10: an import statement that exists only inside a STRING literal does not gate', () => {
    const plant = plantFile(
      `economy/${PLANT_TOKEN}stringimport_${RUN_ID}.mjs`,
      `${PRISMA_FROM_ECONOMY}const doc = \`\n import { horseNameRejectionReason } from '../horses/index.mjs';\n\`;\nexport const note = "import { horseNameRejectionReason } from '../horses/index.mjs';";\n${WRITER}`,
    );
    const res = runCheck();
    expect(res.status).toBe(1);
    expect(res.out).toContain(relPosix(plant));
  });

  it('M5: importing an unrelated horses export from the barrel does not gate', () => {
    const plant = plantFile(
      `economy/${PLANT_TOKEN}unrelated_${RUN_ID}.mjs`,
      `${PRISMA_FROM_ECONOMY}import { getHorseById } from '../horses/index.mjs';\n${WRITER}`,
    );
    const res = runCheck();
    expect(res.status).toBe(1);
    expect(res.out).toContain(relPosix(plant));
  });

  it('M5: importing an exact policy name from the horses barrel gates the writer', () => {
    plantFile(
      `economy/${PLANT_TOKEN}gatedbarrel_${RUN_ID}.mjs`,
      `${PRISMA_FROM_ECONOMY}import { horseNameRejectionReason } from '../horses/index.mjs';\n${WRITER}`,
    );
    const res = runCheck();
    expect(res.status).toBe(0);
  });

  it('M5: an ALIASED exact policy name from the horses barrel gates the writer (the original name counts)', () => {
    plantFile(
      `economy/${PLANT_TOKEN}alias_${RUN_ID}.mjs`,
      `${PRISMA_FROM_ECONOMY}import {\n  getHorseById, // unrelated\n  firstHorseNameRejectionMessage as firstMessage,\n} from '../horses/index.mjs';\n${WRITER}`,
    );
    const res = runCheck();
    expect(res.status).toBe(0);
  });

  it('M5: a comment-only mention on the _validators path does not gate (horses-internal route file)', () => {
    const plant = plantFile(
      `horses/routes/${PLANT_TOKEN}commentvalidators_${RUN_ID}.mjs`,
      `${PRISMA_FROM_HORSE_ROUTES}import { validateHorseId /* horseNameBodyRule */ } from './_validators.mjs';\n${WRITER}`,
    );
    const res = runCheck();
    expect(res.status).toBe(1);
    expect(res.out).toContain(relPosix(plant));
  });

  it('M5: the exact validator-chain name from _validators gates a horses route file', () => {
    plantFile(
      `horses/routes/${PLANT_TOKEN}gatedvalidators_${RUN_ID}.mjs`,
      `${PRISMA_FROM_HORSE_ROUTES}import { horseNameBodyRule } from './_validators.mjs';\n${WRITER}`,
    );
    const res = runCheck();
    expect(res.status).toBe(0);
  });

  it('importing the policy module directly still gates (unchanged contract)', () => {
    plantFile(
      `horses/routes/${PLANT_TOKEN}direct_${RUN_ID}.mjs`,
      `${PRISMA_FROM_HORSE_ROUTES}import { UNNAMED_HORSE_NAME } from '../services/horseNamePolicy.mjs';\n${WRITER}`,
    );
    const res = runCheck();
    expect(res.status).toBe(0);
  });
});
