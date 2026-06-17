/**
 * Integration test — direct-branch foal-now atomic-claim guard (Equoria-wgw5k, real DB).
 *
 * The defect class (adjacent path missed by Equoria-9gsxg's "runFoalingJob
 * already guarded" audit):
 *   `createFoalFromPregnancy({ damId })` (backend/modules/horses/services/
 *   foalingService.mjs) has two branches. The SNAPSHOT branch (foaling-cron,
 *   options.damSnapshot) is correctly guarded — runFoalingJob does an atomic
 *   `updateMany` claim BEFORE invoking the service. The DIRECT branch (no
 *   snapshot — used by POST /api/v1/horses/:id/foal-now) READS the dam,
 *   validates `inFoalSinceDate`, then creates a foal UNCONDITIONALLY and clears
 *   the pregnancy only at the very END. Under READ COMMITTED, N concurrent
 *   /foal-now callers each read the same still-pregnant row, each pass
 *   validation, each create a foal: ONE pregnancy → N foals. The CI "Load
 *   Contention (advisory)" k6 harness surfaced exactly this — three concurrent
 *   POSTs all returned 201 and materialised three distinct foals from one dam.
 *
 * The fix mirrors runFoalingJob's idempotency claim: the direct branch performs
 * an atomic `updateMany` guarded by the pregnancy columns STILL being set, just
 * before the foal insert. Exactly one concurrent caller matches (count=1) and
 * proceeds; the losers match 0 and throw "mare … is not in foal", which the
 * route (horseBreedingRoutes.mjs:250) maps to HTTP 400.
 *
 * Proof (real DB, real prisma, no mocks):
 *   1. CONCURRENT (the AC, directly): fire N concurrent createFoalFromPregnancy
 *      on one in-foal mare; assert EXACTLY ONE fulfils, the rest reject with
 *      "not in foal", and exactly ONE foal row exists for the dam. Pre-fix this
 *      yields N foals (the foaling window — clear-at-end — makes the race wide
 *      and reliably reproducible, unlike the breeding-START race in 9gsxg).
 *   2. PRIMITIVE: after one foaling, replay the guarded WHERE precondition
 *      (id = ? AND inFoalSinceDate IS NOT NULL AND pregnancySireId IS NOT NULL)
 *      as a raw UPDATE → affects 0 rows. An UNCONDITIONAL update affects 1 —
 *      proving the WHERE precondition is the race-closing element.
 *   3. E2E sanity: a mare materialised once through POST /:id/foal-now yields a
 *      201 then a 400 on the second attempt, with exactly one foal.
 *   4. SOURCE SENTINEL: the direct branch contains the guarded `updateMany`
 *      (`inFoalSinceDate: { not: null }`) + `claim.count === 0` rejection — both
 *      unique to the new code (runFoalingJob uses `{ lte: cutoff }` / `claimed
 *      === 0`), so a revert to the unconditional create fails this test.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createFoalFromPregnancy } from '../services/foalingService.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const FOALING_SERVICE_SRC = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../services/foalingService.mjs'),
  'utf8',
);

describe('createFoalFromPregnancy — direct-branch atomic claim (Equoria-wgw5k, real DB)', () => {
  let csrf;
  let user;
  let token;
  let breed;
  let damId;

  async function makeInFoalMare() {
    const ts = `${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}`;
    const fiveYearsAgo = new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000);
    const sire = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-WgwSire_${ts}`,
        sex: 'Stallion',
        dateOfBirth: fiveYearsAgo,
        age: 5,
        breedId: breed.id,
        userId: user.id,
        healthStatus: 'Good',
      },
    });
    const dam = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-WgwDam_${ts}`,
        sex: 'Mare',
        dateOfBirth: fiveYearsAgo,
        age: 5,
        breedId: breed.id,
        userId: user.id,
        healthStatus: 'Good',
        // In foal: a past date + a real sire. The direct branch checks only
        // that these two are set (it does not gate on gestation elapsing).
        inFoalSinceDate: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
        pregnancySireId: sire.id,
        pendingFoalName: `TestFixture-WgwFoal_${ts}`,
      },
    });
    return { damId: dam.id };
  }

  beforeEach(async () => {
    const ts = `${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}`;
    const hashed = await bcrypt.hash('TestPassword123!', 1);
    user = await prisma.user.create({
      data: {
        username: `wgw_${ts}`,
        email: `wgw_${ts}@test.com`,
        password: hashed,
        firstName: 'Foal',
        lastName: 'Racer',
        money: 10000,
      },
    });
    token = generateTestToken({ id: user.id, email: user.email, role: 'user' });
    csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });

    breed = await prisma.breed.upsert({
      where: { name: 'Thoroughbred' },
      update: {},
      create: { name: 'Thoroughbred', description: 'Shared test breed' },
    });

    ({ damId } = await makeInFoalMare());
  });

  afterEach(async () => {
    if (!user) {
      return;
    }
    const cleanup = createCleanupTracker();
    // Delete every horse this suite created for the user (sires, dams, and any
    // foals materialised by the tests) — scoped to the user id.
    cleanup.add(() => prisma.horse.deleteMany({ where: { userId: user.id } }), 'wgwHorses');
    cleanup.add(() => prisma.user.deleteMany({ where: { id: user.id } }), 'wgwUser');
    await cleanup.run();
  });

  it('N concurrent direct foalings on ONE in-foal mare yield EXACTLY ONE foal; losers reject with "not in foal"', async () => {
    const N = 3;
    const results = await Promise.allSettled(Array.from({ length: N }, () => createFoalFromPregnancy({ damId })));

    const fulfilled = results.filter(r => r.status === 'fulfilled');
    const rejected = results.filter(r => r.status === 'rejected');

    // Exactly one caller wins the atomic claim and materialises the foal.
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(N - 1);

    // Every loser fails with the "not in foal" message the route maps → 400.
    for (const r of rejected) {
      expect(String(r.reason?.message || '').toLowerCase()).toContain('not in foal');
    }

    // The hard invariant: ONE pregnancy → ONE foal row, never N.
    const foalCount = await prisma.horse.count({ where: { damId } });
    expect(foalCount).toBe(1);

    // The mare's pregnancy is consumed exactly once.
    const damAfter = await prisma.horse.findUnique({ where: { id: damId } });
    expect(damAfter.inFoalSinceDate).toBeNull();
    expect(damAfter.pregnancySireId).toBeNull();
  });

  it('guarded UPDATE precondition affects 1 row before foaling, 0 rows after (the race-closing primitive)', async () => {
    // Before foaling: the mare is in foal, so the guarded precondition matches.
    const before = await prisma.$executeRawUnsafe(
      'UPDATE "horses" SET "pregnancySireId" = "pregnancySireId" WHERE "id" = $1 AND "inFoalSinceDate" IS NOT NULL AND "pregnancySireId" IS NOT NULL',
      damId,
    );
    expect(before).toBe(1);

    // Materialise the foal once through the direct branch.
    const { foal } = await createFoalFromPregnancy({ damId });
    expect(foal?.id).toBeTruthy();

    // After foaling the pregnancy columns are cleared, so the SAME guarded
    // precondition now affects 0 rows — which is exactly what makes a concurrent
    // loser a no-op. An UNCONDITIONAL update still affects 1, proving the WHERE
    // is the race-closing element, not some incidental property of the row.
    const guardedAfter = await prisma.$executeRawUnsafe(
      'UPDATE "horses" SET "pregnancySireId" = "pregnancySireId" WHERE "id" = $1 AND "inFoalSinceDate" IS NOT NULL AND "pregnancySireId" IS NOT NULL',
      damId,
    );
    expect(guardedAfter).toBe(0);

    const unconditional = await prisma.$executeRawUnsafe(
      'UPDATE "horses" SET "speed" = "speed" WHERE "id" = $1',
      damId,
    );
    expect(unconditional).toBe(1);
  });

  it('POST /:id/foal-now materialises exactly one foal and rejects the second attempt (end-to-end)', async () => {
    const first = await request(app)
      .post(`/api/v1/horses/${damId}/foal-now`)
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({});
    expect(first.status).toBe(201);
    expect(first.body.success).toBe(true);

    const second = await request(app)
      .post(`/api/v1/horses/${damId}/foal-now`)
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({});
    expect(second.status).toBe(400);
    expect(second.body.success).toBe(false);
    expect(String(second.body.message || '').toLowerCase()).toContain('foal');

    const foalCount = await prisma.horse.count({ where: { damId } });
    expect(foalCount).toBe(1);
  });

  it('compensates (restores the pregnancy) when the foal insert fails AFTER the atomic claim', async () => {
    const damBefore = await prisma.horse.findUnique({ where: { id: damId } });
    expect(damBefore.inFoalSinceDate).toBeTruthy();
    const sireBefore = damBefore.pregnancySireId;
    const pendingNameBefore = damBefore.pendingFoalName;

    // Force createHorse to throw AFTER the claim by handing it a userId that
    // FK-violates horses_userId_fkey (a well-formed uuid no User owns). The
    // claim clears the pregnancy first; the compensation must restore it so the
    // pregnancy is never silently consumed with no foal.
    await expect(
      createFoalFromPregnancy({
        damId,
        options: { userId: '00000000-0000-0000-0000-000000000000' },
      }),
    ).rejects.toThrow();

    // Pregnancy restored to its pre-claim state — NOT consumed.
    const damAfter = await prisma.horse.findUnique({ where: { id: damId } });
    expect(damAfter.inFoalSinceDate).toBeTruthy();
    expect(damAfter.pregnancySireId).toBe(sireBefore);
    expect(damAfter.pendingFoalName).toBe(pendingNameBefore);

    // No foal materialised.
    const foalCount = await prisma.horse.count({ where: { damId } });
    expect(foalCount).toBe(0);

    // And the restored pregnancy is still foalable — a subsequent claim succeeds.
    const { foal } = await createFoalFromPregnancy({ damId });
    expect(foal?.id).toBeTruthy();
  });

  // ── Source sentinel: the direct branch must atomically claim, not create
  //    unconditionally. These two markers are unique to the wgw5k fix —
  //    runFoalingJob's claim uses `inFoalSinceDate: { lte: cutoff }` and
  //    `claimed === 0`, so neither matches its code. A revert to the old
  //    read-then-create-then-clear-at-end shape fails here.
  describe('source sentinel — direct branch uses a guarded atomic claim (Equoria-wgw5k)', () => {
    it('contains an updateMany claim guarded by inFoalSinceDate: { not: null }', () => {
      expect(FOALING_SERVICE_SRC).toMatch(/prisma\.horse\.updateMany\(/);
      expect(FOALING_SERVICE_SRC).toMatch(/inFoalSinceDate:\s*\{\s*not:\s*null\s*\}/);
    });

    it('rejects the concurrent loser on claim.count === 0', () => {
      expect(FOALING_SERVICE_SRC).toMatch(/claim\.count\s*===\s*0/);
    });
  });
});
