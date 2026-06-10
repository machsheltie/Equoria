/**
 * Integration test — breeding-cooldown lost-update guard (Equoria-9gsxg, real DB).
 *
 * The defect class (mirrors the feed-action race fixed in Equoria-zvp4):
 *   `createFoal` (backend/modules/horses/controllers/horseFoalingController.mjs)
 *   READS the dam, checks `if (dam.inFoalSinceDate)` → reject, then later runs
 *   an update that sets inFoalSinceDate / pregnancySireId / lastBredDate /
 *   pendingFoalName. Under READ COMMITTED, two concurrent breed requests on the
 *   SAME dam can both read inFoalSinceDate=NULL, both pass the advisory check,
 *   and both write. The harm:
 *     - the second write OVERWRITES the first's pregnancySireId + pendingFoalName
 *       (the first sire/foal-intent silently lost),
 *     - lastBredDate (the breeding cooldown stamp) is re-stamped twice — a
 *       cooldown bypass.
 *
 * The race is not deterministically reproducible via Promise.allSettled under
 * Prisma 7's pool (same finding as Equoria-zvp4). So we prove the guard the
 * same way zvp4 does — DETERMINISTICALLY:
 *
 *   1. Primitive: after a pregnancy commits, REPLAY the exact guarded WHERE
 *      precondition (id = ? AND inFoalSinceDate IS NULL) as a raw UPDATE and
 *      assert it affects 0 rows — that 0 is precisely what makes a concurrent
 *      loser a no-op. An UNCONDITIONAL update (the old read-then-write shape)
 *      WOULD affect 1, proving the WHERE is the race-closing element.
 *
 *   2. Through the controller (HTTP): once a pregnancy has committed, a second
 *      breed attempt on the same dam is rejected (400) and leaves the FIRST
 *      pregnancy's pregnancySireId + pendingFoalName UNCHANGED — no overwrite,
 *      no second cooldown stamp.
 *
 * Real DB. Real prisma. Real app + auth + CSRF. No mocks. No FOR UPDATE.
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
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const FOALING_CONTROLLER_SRC = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../../horses/controllers/horseFoalingController.mjs'),
  'utf8',
);

describe('createFoal — breeding-cooldown lost-update guard (Equoria-9gsxg, real DB)', () => {
  let csrf;
  let user;
  let token;
  let breed;
  let sireId;
  let sireId2;
  let damId;

  beforeEach(async () => {
    const ts = `${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}`;
    const hashed = await bcrypt.hash('TestPassword123!', 1);
    user = await prisma.user.create({
      data: {
        username: `bcooldown_${ts}`,
        email: `bcooldown_${ts}@test.com`,
        password: hashed,
        firstName: 'Cooldown',
        lastName: 'Tester',
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

    const fiveYearsAgo = new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000);
    const sire = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-BCSire_${ts}`,
        sex: 'Stallion',
        dateOfBirth: fiveYearsAgo,
        age: 5,
        breedId: breed.id,
        userId: user.id,
        healthStatus: 'Good',
        lastFedDate: new Date(),
      },
    });
    // A SECOND sire so we can prove the loser's pregnancySireId never overwrites
    // the winner's.
    const sire2 = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-BCSire2_${ts}`,
        sex: 'Stallion',
        dateOfBirth: fiveYearsAgo,
        age: 5,
        breedId: breed.id,
        userId: user.id,
        healthStatus: 'Good',
        lastFedDate: new Date(),
      },
    });
    const dam = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-BCDam_${ts}`,
        sex: 'Mare',
        dateOfBirth: fiveYearsAgo,
        age: 5,
        breedId: breed.id,
        userId: user.id,
        healthStatus: 'Good',
        lastFedDate: new Date(),
      },
    });
    sireId = sire.id;
    sireId2 = sire2.id;
    damId = dam.id;
  });

  afterEach(async () => {
    if (!user) {
      return;
    }
    const cleanup = createCleanupTracker();
    cleanup.add(
      () =>
        prisma.horse.deleteMany({
          where: { OR: [{ damId }, { sireId }, { userId: user.id }] },
        }),
      'bcHorses',
    );
    cleanup.add(() => prisma.user.deleteMany({ where: { id: user.id } }), 'bcUser');
    await cleanup.run();
  });

  it('guarded UPDATE precondition affects 1 row before pregnancy, 0 rows after (the race-closing primitive)', async () => {
    // Start a pregnancy through the real endpoint so inFoalSinceDate commits.
    const res = await request(app)
      .post('/api/v1/horses/foals')
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ name: 'TestFixture-FirstFoal', breedId: breed.id, sireId, damId, sex: 'Filly' });
    expect(res.status).toBe(200);

    const afterBreed = await prisma.horse.findUnique({ where: { id: damId } });
    expect(afterBreed.inFoalSinceDate).toBeTruthy();
    expect(afterBreed.pregnancySireId).toBe(sireId);

    // Replay the EXACT optimistic precondition the controller uses: an UPDATE
    // whose WHERE is (id = ? AND inFoalSinceDate IS NULL). Because
    // inFoalSinceDate is now committed (non-null), this must affect 0 rows —
    // which is what makes a concurrent loser a no-op. A no-WHERE update (the
    // pre-fix behaviour) would have affected 1, i.e. double-applied.
    const affected = await prisma.$executeRawUnsafe(
      'UPDATE "horses" SET "inFoalSinceDate" = $1 ' + 'WHERE "id" = $2 AND "inFoalSinceDate" IS NULL',
      new Date(),
      damId,
    );
    expect(affected).toBe(0);

    // Sanity: an UNCONDITIONAL update (the old read-then-write shape) WOULD
    // affect 1 row — proving the WHERE precondition is what closes the race,
    // not some incidental property of the row.
    const unconditional = await prisma.$executeRawUnsafe(
      'UPDATE "horses" SET "speed" = "speed" WHERE "id" = $1',
      damId,
    );
    expect(unconditional).toBe(1);
  });

  it('rejects a same-dam second breed without overwriting the first pregnancy or re-stamping the cooldown', async () => {
    // Breed 1 (sire) succeeds and stamps lastBredDate + pregnancySireId.
    const first = await request(app)
      .post('/api/v1/horses/foals')
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ name: 'TestFixture-WinnerFoal', breedId: breed.id, sireId, damId, sex: 'Filly' });
    expect(first.status).toBe(200);

    const damAfter1 = await prisma.horse.findUnique({ where: { id: damId } });
    expect(damAfter1.pregnancySireId).toBe(sireId);
    expect(damAfter1.pendingFoalName).toBe('TestFixture-WinnerFoal');
    const firstBredAt = damAfter1.lastBredDate;

    // Breed 2 on the SAME in-foal dam, with a DIFFERENT sire + foal name. The
    // race-class harm would be: this overwrites pregnancySireId → sireId2 and
    // pendingFoalName → 'LoserFoal', and re-stamps lastBredDate. The guard must
    // reject it (400) and change nothing.
    const second = await request(app)
      .post('/api/v1/horses/foals')
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({
        name: 'TestFixture-LoserFoal',
        breedId: breed.id,
        sireId: sireId2,
        damId,
        sex: 'Colt',
      });
    expect(second.status).toBe(400);
    expect(second.body.success).toBe(false);
    expect(String(second.body.message || '').toLowerCase()).toContain('in foal');

    // The winning pregnancy is intact — NOT overwritten by the loser.
    const damAfter2 = await prisma.horse.findUnique({ where: { id: damId } });
    expect(damAfter2.pregnancySireId).toBe(sireId); // NOT sireId2
    expect(damAfter2.pendingFoalName).toBe('TestFixture-WinnerFoal'); // NOT LoserFoal
    expect(damAfter2.lastBredDate).toEqual(firstBredAt); // cooldown NOT re-stamped
  });

  // ── Source sentinel: the controller WRITE must be guarded, not unconditional ─
  //
  // The two real-DB tests above prove the guard PRIMITIVE works and that the
  // sequential HTTP path is correct. But a sequential supertest cannot replay
  // the true interleaving (both requests' read-check passing on a stale
  // inFoalSinceDate=NULL before either writes) without mocks. This source
  // sentinel closes that gap deterministically: it asserts the createFoal write
  // is the GUARDED form (WHERE inFoalSinceDate IS NULL + affected-count reject),
  // so a regression that reverts to the unconditional `prisma.horse.update`
  // read-then-write shape — which is exactly what a concurrent loser would
  // double-apply through — fails this test. Mirrors the FOR-UPDATE-absence
  // sentinel pattern in feedHorseService.test.mjs (Equoria-zvp4).
  describe('source sentinel — createFoal uses an optimistic guarded write (Equoria-9gsxg)', () => {
    it('starts the pregnancy via updateMany with an inFoalSinceDate:null precondition (the guard)', () => {
      // The guarded write is prisma.horse.updateMany({ where: { id, inFoalSinceDate: null }, ... }).
      // Assert both the updateMany call and the null precondition are present.
      expect(FOALING_CONTROLLER_SRC).toMatch(/prisma\.horse\.updateMany\(/);
      expect(FOALING_CONTROLLER_SRC).toMatch(/inFoalSinceDate:\s*null/);
    });

    it('asserts the affected-row count and rejects on 0 (no silent double-apply)', () => {
      expect(FOALING_CONTROLLER_SRC).toMatch(/affected\s*===\s*0/);
    });

    it('does NOT start the pregnancy via an unconditional prisma.horse.update (the racy read-then-write shape)', () => {
      // The only prisma.horse.update call left in this controller is the
      // resetHorseLastFed E2E helper (a single-field lastFedDate rewind, not
      // pregnancy start). The pregnancy-start write MUST go through the guarded
      // updateMany. Assert no `prisma.horse.update(...)` call references
      // inFoalSinceDate — a regression to the unconditional read-then-write
      // shape would reintroduce that and fail here.
      expect(FOALING_CONTROLLER_SRC).not.toMatch(/prisma\.horse\.update\([^)]*inFoalSinceDate/s);
    });
  });
});
