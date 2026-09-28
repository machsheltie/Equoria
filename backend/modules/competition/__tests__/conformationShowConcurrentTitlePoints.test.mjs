/**
 * conformationShowConcurrentTitlePoints.test.mjs — Equoria-bvddn.21 regression.
 *
 * Split out of conformationShowService.test.mjs (which sits at the 800-line
 * test-file threshold, .claude/rules/CONTRIBUTING.md "File-size ratchet") so
 * this scenario has its own owned file rather than pushing that suite over
 * the limit.
 *
 * Two conformation shows, each with exactly one entry for the SAME horse,
 * executed genuinely concurrently — in two SEPARATE OS processes (see
 * helpers/runConformationShowChild.mjs for why: a single shared PrismaClient
 * serializes a second call's pre-transaction read behind a first call's open
 * interactive transaction, which would mask this defect behind an
 * accidentally-safe scheduling order). Each is a solo entry, so each awards
 * 1st-place (10 title points) per resolveReward. Before the fix,
 * horse.titlePoints is read once before either transaction starts, so two
 * genuinely concurrent executions can both compute
 * `newTitlePoints = 0 + 10` from the same stale pre-read and both write a
 * blind 10 — one write clobbers the other and one show's points are lost
 * (final total 10, not 20). After the fix (DB-side increment inside the
 * transaction) both increments apply and the final total is 20.
 *
 * NO MOCKS — real DB, real service, real child processes, per CLAUDE.md test
 * integrity and .claude/rules/CONTRIBUTING.md.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import prisma from '../../../../packages/database/prismaClient.mjs';
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHILD_SCRIPT = path.join(__dirname, 'helpers', 'runConformationShowChild.mjs');

function runConformationShowInChildProcess(showId) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [CHILD_SCRIPT, String(showId)], {
      env: { ...process.env, NODE_ENV: 'test' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', chunk => {
      stdout += chunk;
    });
    child.stderr.on('data', chunk => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', () => {
      try {
        resolve(JSON.parse(stdout.trim().split('\n').pop()));
      } catch (parseError) {
        reject(
          new Error(
            `child process for show ${showId} produced no parseable JSON. stdout=${stdout} stderr=${stderr} (${parseError.message})`,
          ),
        );
      }
    });
  });
}

describe('executeConformationShow — concurrent results for the same horse (Equoria-bvddn.21)', () => {
  let tpUser;
  let tpHorse;
  let tpGroom;
  let tpShowA;
  let tpShowB;
  const cleanup = createCleanupTracker();

  beforeAll(async () => {
    const ts = Date.now();
    const rand = () => Math.random().toString(36).slice(2, 8);

    tpUser = await prisma.user.create({
      data: {
        email: `cftp-${ts}-${rand()}@test.com`,
        username: `cftp${ts}${rand()}`,
        password: 'irrelevant-hash',
        firstName: 'CFTP',
        lastName: 'Tester',
        money: 1000,
      },
    });

    tpHorse = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-CFTP-Horse-${ts}`,
        sex: 'Filly',
        dateOfBirth: new Date(),
        age: 2,
        userId: tpUser.id,
        healthStatus: 'Good',
        titlePoints: 0,
      },
    });

    tpGroom = await prisma.groom.create({
      data: {
        name: `TestFixture-CFTP-Groom-${ts}`,
        speciality: 'general',
        personality: 'gentle',
        userId: tpUser.id,
      },
    });

    await prisma.groomAssignment.create({
      data: {
        groomId: tpGroom.id,
        foalId: tpHorse.id,
        userId: tpUser.id,
        isActive: true,
        priority: 1,
      },
    });

    tpShowA = await prisma.show.create({
      data: {
        name: `TestFixture-CFTP-ShowA-${ts}`,
        discipline: 'conformation',
        levelMin: 0,
        levelMax: 10,
        entryFee: 0,
        prize: 0,
        runDate: new Date(),
        showType: 'conformation',
      },
    });

    tpShowB = await prisma.show.create({
      data: {
        name: `TestFixture-CFTP-ShowB-${ts}`,
        discipline: 'conformation',
        levelMin: 0,
        levelMax: 10,
        entryFee: 0,
        prize: 0,
        runDate: new Date(),
        showType: 'conformation',
      },
    });

    await prisma.showEntry.create({
      data: { showId: tpShowA.id, horseId: tpHorse.id, userId: tpUser.id },
    });
    await prisma.showEntry.create({
      data: { showId: tpShowB.id, horseId: tpHorse.id, userId: tpUser.id },
    });

    cleanup.add(() => prisma.show.deleteMany({ where: { name: { startsWith: 'TestFixture-CFTP-' } } }), 'show');
    cleanup.add(() => prisma.groom.deleteMany({ where: { name: { startsWith: 'TestFixture-CFTP-' } } }), 'groom');
    cleanup.add(() => prisma.horse.deleteMany({ where: { name: { startsWith: 'TestFixture-CFTP-' } } }), 'horse');
    cleanup.add(() => (tpUser ? prisma.user.delete({ where: { id: tpUser.id } }) : undefined), 'user');
  }, 60000);

  afterAll(() => cleanup.run(), 30000);

  it('sums title points from two genuinely concurrent solo-entry shows instead of losing one write', async () => {
    const [outA, outB] = await Promise.all([
      runConformationShowInChildProcess(tpShowA.id),
      runConformationShowInChildProcess(tpShowB.id),
    ]);

    expect(outA.ok).toBe(true);
    expect(outB.ok).toBe(true);
    expect(outA.result).toHaveLength(1);
    expect(outB.result).toHaveLength(1);
    expect(outA.result[0].titlePoints).toBe(10);
    expect(outB.result[0].titlePoints).toBe(10);

    const finalHorse = await prisma.horse.findUnique({ where: { id: tpHorse.id } });
    // Both concurrent 10-point awards must be reflected — not just the last
    // writer's stale-read total.
    expect(finalHorse.titlePoints).toBe(20);
  }, 30000);
});
