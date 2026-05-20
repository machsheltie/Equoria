/**
 * run-bulk-foaling-cron.mjs (Equoria-fx5cb — k8t5 follow-up)
 *
 * CI driver that exercises the BULK foaling cron path under concurrency.
 *
 * The k6 harness `concurrent-feed-breed-foal.test.js` drives the
 * owner-scoped `POST /horses/:id/foal-now` mutation, which materialises a
 * foal via `createFoalFromPregnancy`. That covers the mutation-vs-mutation
 * double-create window. It does NOT drive the BULK foaling job itself
 * (`runFoalingJob` — the function the nightly cron `runFoalingJobScheduled`
 * calls), which sweeps EVERY due mare in one pass. The admin HTTP trigger
 * (`POST /api/v1/admin/foaling/trigger`) requires role=admin (+ optional
 * MFA), so an unauthenticated k6 VU cannot reach it without inventing a
 * bypass — which project policy (CLAUDE.md / 21R doctrine) forbids.
 *
 * This script instead drives the real `runFoalingJob({ now })` server-side
 * (the exact entrypoint the scheduled cron uses — see
 * backend/services/cronJobService.mjs#runFoalingJobScheduled), with the
 * clock advanced past gestation, and fires it CONCURRENTLY against a set of
 * scoped throwaway in-foal mares. Two parallel sweeps that both pass the
 * `inFoalSinceDate <= cutoff` candidate filter for the same mare must NOT
 * both materialise a foal. The invariant:
 *
 *     foals_materialised_per_mare  <=  1     (no cron double-create)
 *
 * REAL DB (CLAUDE.md Rule 2): runs against the canonical Equoria DB. It
 * self-provisions a uniquely-named throwaway user (`LoadFixture-cron-…`)
 * and only ever touches rows it created. Cleanup is id-scoped — never a
 * bare deleteMany.
 *
 * Exit code:
 *   0  invariant held (no double-create) — advisory job stays green
 *   1  invariant violated (cron double-create race live) OR setup failure
 *
 * Artifact: writes a JSON summary to
 *   backend/load-results/bulk-foaling-cron-summary.json
 *
 * Usage:
 *   node backend/tests/load/run-bulk-foaling-cron.mjs
 *   MARE_COUNT=8 PARALLEL_SWEEPS=4 node backend/tests/load/run-bulk-foaling-cron.mjs
 *
 * @module tests/load/run-bulk-foaling-cron
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import prisma from '../../../packages/database/prismaClient.mjs';
import { runFoalingJob } from '../../modules/horses/services/foalingService.mjs';
import { createTestHorse, cleanupTestHorses } from '../../__tests__/helpers/createTestHorse.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

const MARE_COUNT = Number.parseInt(process.env.MARE_COUNT ?? '6', 10);
const PARALLEL_SWEEPS = Number.parseInt(process.env.PARALLEL_SWEEPS ?? '3', 10);
const GESTATION_DAYS = 7; // mirrors foalingService GESTATION_DAYS
const ADVANCE_DAYS = GESTATION_DAYS + 2; // push every mare past the cutoff

const stamp = randomBytes(8).toString('hex');

async function main() {
  const summary = {
    suite: 'bulk-foaling-cron-concurrency',
    issue: 'Equoria-fx5cb',
    startedAt: new Date().toISOString(),
    config: { MARE_COUNT, PARALLEL_SWEEPS, ADVANCE_DAYS },
    mares: [],
    invariant: 'foals_materialised_per_mare <= 1',
    violations: [],
    passed: false,
  };

  const createdHorseIds = [];
  let user;
  let breed;

  try {
    // createFoalFromPregnancy requires the dam's breed to have a
    // breedProfiles.json entry (name must match a JSON key exactly).
    // A bare findFirst() can grab a junk "Test Breed …" row with no
    // profile, which makes runFoalingJob error out and the sweep a
    // no-op. Select a breed whose name IS a profile key.
    const profileNames = Object.keys(
      JSON.parse(await readFile(join(__dirname, '..', '..', 'data', 'breedProfiles.json'), 'utf8')),
    );
    breed = await prisma.breed.findFirst({
      where: { name: { in: profileNames } },
      select: { id: true, name: true },
    });
    if (!breed) {
      throw new Error(
        'No DB breed with a breedProfiles.json entry — run `npm run seed` before this driver (CI seeds canonical breeds).',
      );
    }
    summary.config.breed = breed.name;

    user = await prisma.user.create({
      data: {
        username: `LoadFixture-cron-${stamp}`,
        email: `loadfixture-cron-${stamp}@example.test`,
        password: 'x'.repeat(60), // bcrypt-length placeholder; never logged in
        firstName: 'LoadFixture',
        lastName: `Cron-${stamp}`,
        money: 100000,
      },
      select: { id: true },
    });

    // Provision N in-foal mares already past gestation cutoff so a single
    // runFoalingJob() sweep treats every one as due.
    const inFoalSince = new Date(Date.now() - (GESTATION_DAYS + 1) * 24 * 60 * 60 * 1000);
    const sire = await createTestHorse(
      prisma,
      {
        name: `LoadFixture-cron-sire-${stamp}`,
        sex: 'Stallion',
        dateOfBirth: new Date(Date.now() - 6 * 365 * 24 * 60 * 60 * 1000),
        userId: user.id,
        breedId: breed.id,
      },
      createdHorseIds,
    );

    const mares = [];
    for (let i = 0; i < MARE_COUNT; i += 1) {
      const mare = await createTestHorse(
        prisma,
        {
          name: `LoadFixture-cron-mare-${stamp}-${i}`,
          sex: 'Mare',
          dateOfBirth: new Date(Date.now() - 6 * 365 * 24 * 60 * 60 * 1000),
          userId: user.id,
          breedId: breed.id,
          inFoalSinceDate: inFoalSince,
          pregnancySireId: sire.id,
          pendingFoalBreedId: breed.id,
        },
        createdHorseIds,
      );
      mares.push(mare);
    }

    // Fire PARALLEL_SWEEPS concurrent runFoalingJob() invocations with the
    // clock advanced past gestation. This is the genuine bulk cron path —
    // identical entrypoint to runFoalingJobScheduled(). If candidate
    // selection + materialisation is not atomic per mare, two sweeps both
    // create a foal for the same mare.
    const advancedNow = new Date(Date.now() + ADVANCE_DAYS * 24 * 60 * 60 * 1000);
    const sweepResults = await Promise.all(
      Array.from({ length: PARALLEL_SWEEPS }, () =>
        runFoalingJob({ now: advancedNow }).catch(err => ({
          foalsBorn: 0,
          errors: [{ damId: null, error: err.message }],
        })),
      ),
    );
    summary.sweepResults = sweepResults.map(r => ({
      foalsBorn: r.foalsBorn,
      errorCount: r.errors?.length ?? 0,
      errors: (r.errors ?? []).slice(0, 5).map(e => ({ damId: e.damId, error: e.error })),
    }));
    summary.totalFoalsBorn = sweepResults.reduce((s, r) => s + (r.foalsBorn ?? 0), 0);

    // Ground-truth: count materialised foal rows per fixture mare.
    for (const mare of mares) {
      const foalRows = await prisma.horse.findMany({
        where: { damId: mare.id, name: { startsWith: 'LoadFixture-cron-' } },
        select: { id: true },
      });
      // Also count any foal created from this mare regardless of name
      // (createFoalFromPregnancy names the foal from pendingFoalName/default).
      const allFoals = await prisma.horse.findMany({
        where: { damId: mare.id },
        select: { id: true, createdAt: true },
      });
      const recent = allFoals.filter(
        f => Date.now() - new Date(f.createdAt).getTime() < 10 * 60 * 1000,
      );
      // record recent foal ids for scoped cleanup
      for (const f of recent) {
        if (!createdHorseIds.includes(f.id)) {
          createdHorseIds.push(f.id);
        }
      }
      const foalCount = recent.length;
      summary.mares.push({ mareId: mare.id, foalsMaterialised: foalCount });
      if (foalCount > 1) {
        summary.violations.push({
          mareId: mare.id,
          foalsMaterialised: foalCount,
          detail: 'BULK CRON DOUBLE-CREATE: >1 foal from one pregnancy across concurrent sweeps',
        });
      }
      void foalRows;
    }

    summary.passed = summary.violations.length === 0;
  } catch (err) {
    summary.error = err.message;
    summary.passed = false;
  } finally {
    // Scoped cleanup — only rows this run created. Never bare deleteMany
    // (CLAUDE.md Rule 2). Cascade order: foals/horses first, then user.
    try {
      await cleanupTestHorses(prisma, createdHorseIds);
    } catch (e) {
      summary.cleanupHorsesError = e.message;
    }
    try {
      if (user) {
        await prisma.horse.deleteMany({ where: { userId: user.id } });
        await prisma.user.delete({ where: { id: user.id } });
      }
    } catch (e) {
      summary.cleanupUserError = e.message;
    }
    await prisma.$disconnect().catch(() => {});
  }

  summary.finishedAt = new Date().toISOString();

  const outDir = join(__dirname, '..', '..', 'load-results');
  await mkdir(outDir, { recursive: true });
  const outPath = join(outDir, 'bulk-foaling-cron-summary.json');
  await writeFile(outPath, JSON.stringify(summary, null, 2));

  console.log(`[bulk-foaling-cron] summary -> ${outPath}`);

  console.log(JSON.stringify(summary, null, 2));

  if (!summary.passed) {
    console.error(
      summary.error
        ? `[bulk-foaling-cron] SETUP/RUN ERROR: ${summary.error}`
        : `[bulk-foaling-cron] INVARIANT VIOLATED: ${summary.violations.length} mare(s) double-foaled`,
    );
    process.exitCode = 1;
  }
}

await main();
