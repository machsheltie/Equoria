/**
 * Integration Test: POST /api/v1/horses/foals minimal breeding payload
 * (Equoria-6w3ur — "the breeding surface cannot start a pregnancy")
 *
 * THE DEFECT THIS GUARDS
 *   `BreedingPairSelection` posts only the pair the player picked. The route's
 *   express-validator chain (`validateFoalCreation`) still demanded the
 *   PRE-pregnancy fields `name` and `breedId`, so every real browser breed
 *   returned 400 "Breed ID must be a positive integer" and no player could
 *   breed at all. The controller (`createFoal`) has treated both as OPTIONAL
 *   pending intent since the Phase-B delayed-foaling redesign, and
 *   `foalingService.createFoalFromPregnancy` already derives the missing values
 *   (name -> `${dam.name} Foal`, breed -> dam.breedId). The validator was the
 *   only thing rejecting the honest player request.
 *
 *   RED before the fix: every test in the "minimal payload" block gets 400
 *   "Validation failed" instead of the pregnancy/ownership/eligibility result
 *   it asserts.
 *
 * SECOND FINDING GUARDED HERE
 *   The route accepted a client-supplied `userId` in the body. It is now
 *   stripped before anything can read it, and these tests prove a forged
 *   owner id changes neither the ownership check nor the pregnancy's owner.
 *
 * THIRD FINDING GUARDED HERE — the one that made this fix dangerous
 *   Relaxing `breedId` made the DERIVED breed the only value on this route that
 *   nothing validated. `Horse.breedId` is NULLABLE and breedless mares really
 *   exist (backend/seed/backfillStarterHorseBreedId.mjs is dry-run unless
 *   --apply; onboardingService proceeds with a NULL breedId when the default
 *   breed row cannot be resolved). A breedless dam would be claimed pregnant
 *   with a 200, then `runFoalingJob` would throw seven days later and its
 *   compensation block would restore the pregnancy for the next run — forever.
 *   Permanently in foal, permanently unbreedable, no foal, no recovery path.
 *   `createFoal` now validates the breed the foal will ACTUALLY be born with
 *   (supplied ?? dam.breedId), including that its name has a usable breed
 *   profile, and refuses BEFORE the guarded claim stamps anything.
 *
 * Real DB, real app, real HTTP. No mocks.
 */

import { describe, beforeAll, afterAll, beforeEach, expect, it } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const app = (await import('../../../app.mjs')).default;
const rand = () => randomBytes(4).toString('hex');

/** Date-only UTC birthday N game-years back (1 game year = 7 real days). */
function dobForAgeYears(ageYears) {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - ageYears * 7);
  return d;
}

describe('POST /horses/foals — minimal breeding-surface payload (Equoria-6w3ur)', () => {
  const cleanup = createCleanupTracker();
  const ts = `${rand()}_${rand()}`;

  let player, playerToken, playerCsrf;
  let otherPlayer;
  let breedThoroughbred, breedAbaga;
  let stallion, mare, secondMare, crossBredStallion;
  let otherStallion, otherMare;
  let breedlessMare, profilelessMare, breedWithoutProfile;
  const createdFoalIds = [];

  beforeAll(async () => {
    const hashedPassword = await bcrypt.hash('TestPw123!', 1);

    player = await prisma.user.create({
      data: {
        username: `sixw3ur_player_${ts}`,
        email: `sixw3ur_player_${ts}@example.com`,
        password: hashedPassword,
        firstName: 'Sixw3ur',
        lastName: 'Player',
        money: 50000,
      },
    });
    otherPlayer = await prisma.user.create({
      data: {
        username: `sixw3ur_other_${ts}`,
        email: `sixw3ur_other_${ts}@example.com`,
        password: hashedPassword,
        firstName: 'Sixw3ur',
        lastName: 'Other',
        money: 50000,
      },
    });

    playerToken = generateTestToken({ id: player.id, role: 'user' });
    playerCsrf = await fetchCsrf(app, { extraCookies: [`accessToken=${playerToken}`] });

    // Canonical breeds — both names have a real profile in
    // backend/data/breedProfiles.json, which foaling requires.
    breedThoroughbred = await prisma.breed.upsert({
      where: { name: 'Thoroughbred' },
      update: {},
      create: { name: 'Thoroughbred', description: 'Shared integration-test breed' },
    });
    breedAbaga = await prisma.breed.upsert({
      where: { name: 'Abaga' },
      update: {},
      create: { name: 'Abaga', description: 'Shared integration-test breed' },
    });

    const adult = (name, sex, userId, breedId) => ({
      ...fixtureColor(),
      name,
      sex,
      dateOfBirth: dobForAgeYears(5),
      age: 5,
      breedId,
      userId,
      lastFedDate: new Date(),
      lastBredDate: null,
    });

    stallion = await prisma.horse.create({
      data: adult(`TestFixture-6w3ur-Sire_${ts}`, 'Stallion', player.id, breedThoroughbred.id),
    });
    mare = await prisma.horse.create({
      data: adult(`TestFixture-6w3ur-Dam_${ts}`, 'Mare', player.id, breedThoroughbred.id),
    });
    secondMare = await prisma.horse.create({
      data: adult(`TestFixture-6w3ur-Dam2_${ts}`, 'Mare', player.id, breedThoroughbred.id),
    });
    crossBredStallion = await prisma.horse.create({
      data: adult(`TestFixture-6w3ur-CrossSire_${ts}`, 'Stallion', player.id, breedAbaga.id),
    });
    otherStallion = await prisma.horse.create({
      data: adult(`TestFixture-6w3ur-OtherSire_${ts}`, 'Stallion', otherPlayer.id, breedThoroughbred.id),
    });
    otherMare = await prisma.horse.create({
      data: adult(`TestFixture-6w3ur-OtherDam_${ts}`, 'Mare', otherPlayer.id, breedThoroughbred.id),
    });

    // A BREEDLESS mare. `Horse.breedId` is nullable and this is not a synthetic
    // edge case: `backend/seed/backfillStarterHorseBreedId.mjs` exists because
    // ~3334 registration starter horses were created with a NULL breedId (and
    // it is dry-run unless `--apply`), and `onboardingService.mjs` still logs an
    // error and PROCEEDS when the default breed row cannot be resolved. With no
    // supplied breedId there is nothing for the foaling job to derive from.
    breedlessMare = await prisma.horse.create({
      data: adult(`TestFixture-6w3ur-BreedlessDam_${ts}`, 'Mare', player.id, null),
    });

    // A breed row whose NAME has no entry in backend/data/breedProfiles.json.
    // The foaling path resolves the breed id to a name and then asks the profile
    // loader for that name; a missing profile throws inside conformation
    // generation, which is the same stuck-pregnancy outcome as a null breed.
    breedWithoutProfile = await prisma.breed.create({
      data: {
        name: `TestFixture-6w3ur-NoProfileBreed_${ts}`,
        description: 'Deliberately absent from breedProfiles.json',
      },
    });
    profilelessMare = await prisma.horse.create({
      data: adult(`TestFixture-6w3ur-ProfilelessDam_${ts}`, 'Mare', player.id, breedWithoutProfile.id),
    });

    // Scoped, fail-loud cleanup in dependency order. Foal-dependent rows first,
    // then every horse owned by the two fixture users in ONE id-scoped
    // deleteMany (a single multi-row DELETE removes lineage-referencing rows
    // together, so Horse.sireId/damId/pregnancySireId onDelete:Restrict does
    // not fire among them), then the users. The shared breeds are NOT deleted.
    cleanup.add(
      () => prisma.foalTrainingHistory.deleteMany({ where: { horseId: { in: createdFoalIds } } }),
      'foalTrainingHistory(foals)',
    );
    cleanup.add(
      () => prisma.foalDevelopment.deleteMany({ where: { foalId: { in: createdFoalIds } } }),
      'foalDevelopment(foals)',
    );
    cleanup.add(
      () => prisma.foalActivity.deleteMany({ where: { foalId: { in: createdFoalIds } } }),
      'foalActivity(foals)',
    );
    cleanup.add(
      () => prisma.groomAssignment.deleteMany({ where: { foalId: { in: createdFoalIds } } }),
      'groomAssignment(foals)',
    );
    const userIds = () => [player?.id, otherPlayer?.id].filter(Boolean);
    cleanup.add(() => prisma.horse.deleteMany({ where: { userId: { in: userIds() } } }), 'fixtureHorses');
    cleanup.add(() => prisma.groom.deleteMany({ where: { userId: { in: userIds() } } }), 'grooms');
    // This suite's OWN breed row only (the shared canonical breeds are never
    // deleted). Must follow the horses that reference it.
    cleanup.add(
      () =>
        prisma.breed.deleteMany({
          where: { id: { in: [breedWithoutProfile?.id].filter(Boolean) } },
        }),
      'noProfileBreed',
    );
    cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: userIds() } } }), 'users');
  }, 120000);

  afterAll(() => cleanup.run(), 120000);

  beforeEach(async () => {
    // Clear pregnancy + cooldown state so each test starts from a breedable mare.
    await prisma.horse.updateMany({
      where: {
        id: {
          in: [mare?.id, secondMare?.id, otherMare?.id, breedlessMare?.id, profilelessMare?.id].filter(Boolean),
        },
      },
      data: {
        inFoalSinceDate: null,
        pregnancySireId: null,
        pregnancyFeedingsByTier: {},
        lastBredDate: null,
        pendingFoalName: null,
        pendingFoalBreedId: null,
      },
    });
  });

  function postFoals(body) {
    return request(app)
      .post('/api/v1/horses/foals')
      .set('Authorization', `Bearer ${playerToken}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', playerCsrf.cookieHeader)
      .set('X-CSRF-Token', playerCsrf.csrfToken)
      .send(body);
  }

  function postFoalNow(damId) {
    return request(app)
      .post(`/api/v1/horses/${damId}/foal-now`)
      .set('Authorization', `Bearer ${playerToken}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', playerCsrf.cookieHeader)
      .set('X-CSRF-Token', playerCsrf.csrfToken)
      .send({});
  }

  describe('the payload the breeding surface actually sends', () => {
    it('starts a pregnancy from { sireId, damId } alone — no name, no breedId', async () => {
      const res = await postFoals({ sireId: stallion.id, damId: mare.id });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.pregnancyStarted).toBe(true);
      expect(res.body.data.damId).toBe(mare.id);
      expect(res.body.data.sireId).toBe(stallion.id);
      expect(typeof res.body.data.foalDueDate).toBe('string');

      const dbDam = await prisma.horse.findUnique({ where: { id: mare.id } });
      expect(dbDam.inFoalSinceDate).toBeTruthy();
      expect(dbDam.pregnancySireId).toBe(stallion.id);
      expect(dbDam.lastBredDate).toBeTruthy();
      // No pending NAME was sent, so none is stored — the foaling job derives it.
      expect(dbDam.pendingFoalName).toBeNull();
      // The BREED is different, and deliberately so as of Equoria-m9lz1 fix
      // round 3 (finding 7): the controller now stores the VALIDATED EFFECTIVE
      // breed it just checked, which with no breedId supplied is the dam's own.
      // Previously it stored null here and the foaling job re-derived the breed
      // from `dam.breedId` as it read SEVEN DAYS LATER — so conception-time and
      // birth-time agreement rested on `breedId` not being in the
      // PUT /horses/:id allowlist. Pinning it at conception is the point; a null
      // here is now the regression, not the expectation.
      expect(dbDam.pendingFoalBreedId).toBe(mare.breedId);
    });

    it('names the foal `unnamed` and takes the breed from the dam when the player sent neither', async () => {
      const bred = await postFoals({ sireId: stallion.id, damId: mare.id });
      expect(bred.status).toBe(200);

      const foaled = await postFoalNow(mare.id);
      expect(foaled.status).toBe(201);
      const foalId = foaled.body.data.foalId;
      expect(foalId).toBeTruthy();
      createdFoalIds.push(foalId);

      const foal = await prisma.horse.findUnique({ where: { id: foalId } });
      // Equoria-4fnro (OWNER RULING 2026-09-14): a foal nobody named is born
      // 'unnamed'. This asserted `<Dam> Foal` before the ruling.
      expect(foal.name).toBe('unnamed');
      expect(foal.breedId).toBe(mare.breedId);
      expect(foal.userId).toBe(player.id);
    });

    it('still honours an explicit name and breedId when one is supplied', async () => {
      const explicitName = `6w3ur-Named_${ts}`;
      const res = await postFoals({
        sireId: stallion.id,
        damId: secondMare.id,
        name: explicitName,
        breedId: breedAbaga.id,
      });

      expect(res.status).toBe(200);
      const dbDam = await prisma.horse.findUnique({ where: { id: secondMare.id } });
      expect(dbDam.pendingFoalName).toBe(explicitName);
      expect(dbDam.pendingFoalBreedId).toBe(breedAbaga.id);
    });
  });

  describe('a client-supplied userId is never trusted', () => {
    it("cannot breed another player's pair by naming that player as the owner", async () => {
      const res = await postFoals({
        sireId: otherStallion.id,
        damId: otherMare.id,
        userId: otherPlayer.id,
      });

      expect(res.status).toBe(404);
      expect(res.body.message).toBe('Sire not found');

      const victimDam = await prisma.horse.findUnique({ where: { id: otherMare.id } });
      expect(victimDam.inFoalSinceDate).toBeNull();
      expect(victimDam.pregnancySireId).toBeNull();
      expect(victimDam.lastBredDate).toBeNull();
    });

    it('ignores a forged userId on an otherwise legitimate breed', async () => {
      const res = await postFoals({
        sireId: stallion.id,
        damId: mare.id,
        userId: otherPlayer.id,
      });

      expect(res.status).toBe(200);
      const dbDam = await prisma.horse.findUnique({ where: { id: mare.id } });
      // Ownership is unchanged: the authenticated player still owns the mare.
      expect(dbDam.userId).toBe(player.id);
      expect(dbDam.inFoalSinceDate).toBeTruthy();
      expect(dbDam.pregnancySireId).toBe(stallion.id);
    });
  });

  describe('rejections survive the relaxed payload', () => {
    it('rejects a sire the player does not own with an indistinguishable 404', async () => {
      const res = await postFoals({ sireId: otherStallion.id, damId: mare.id });
      expect(res.status).toBe(404);
      expect(res.body.message).toBe('Sire not found');
    });

    it('rejects a dam the player does not own with an indistinguishable 404', async () => {
      const res = await postFoals({ sireId: stallion.id, damId: otherMare.id });
      expect(res.status).toBe(404);
      expect(res.body.message).toBe('Dam not found');
    });

    it('rejects a nonexistent sire with the same 404 as an unowned one', async () => {
      const res = await postFoals({ sireId: 2147483600, damId: mare.id });
      expect(res.status).toBe(404);
      expect(res.body.message).toBe('Sire not found');
    });

    it('rejects a self-cross on the minimal payload', async () => {
      const res = await postFoals({ sireId: mare.id, damId: mare.id });
      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Sire and dam cannot be the same horse');
    });

    it('rejects a mare used as the sire on the minimal payload', async () => {
      const res = await postFoals({ sireId: secondMare.id, damId: mare.id });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/must be a Stallion/);
    });

    it('rejects a second breed on a mare who is already in foal', async () => {
      const first = await postFoals({ sireId: stallion.id, damId: mare.id });
      expect(first.status).toBe(200);
      const afterFirst = await prisma.horse.findUnique({ where: { id: mare.id } });

      const second = await postFoals({ sireId: crossBredStallion.id, damId: mare.id });
      expect(second.status).toBe(400);
      // The dam cooldown guard runs before the in-foal guard (the first breed
      // stamped lastBredDate), so either message is a correct refusal.
      expect(second.body.message).toMatch(/already in foal|breeding cooldown/);

      // What actually matters: the second request changed nothing — the first
      // pregnancy's sire and conception stamp are intact.
      const afterSecond = await prisma.horse.findUnique({ where: { id: mare.id } });
      expect(afterSecond.pregnancySireId).toBe(stallion.id);
      expect(afterSecond.inFoalSinceDate?.toISOString()).toBe(afterFirst.inFoalSinceDate?.toISOString());
      expect(afterSecond.lastBredDate?.toISOString()).toBe(afterFirst.lastBredDate?.toISOString());
    });

    it('rejects a name longer than 40 characters', async () => {
      // Equoria-zalyb (OWNER RULING 2026-09-14): the cap is 40, not 100.
      const res = await postFoals({
        sireId: stallion.id,
        damId: mare.id,
        name: 'x'.repeat(41),
      });
      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Validation failed');

      const dbDam = await prisma.horse.findUnique({ where: { id: mare.id } });
      expect(dbDam.inFoalSinceDate).toBeNull();
    });

    it('rejects a non-positive breedId', async () => {
      const res = await postFoals({ sireId: stallion.id, damId: mare.id, breedId: 0 });
      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Validation failed');

      const dbDam = await prisma.horse.findUnique({ where: { id: mare.id } });
      expect(dbDam.inFoalSinceDate).toBeNull();
    });

    it('rejects a breedId that does not exist', async () => {
      const res = await postFoals({ sireId: stallion.id, damId: mare.id, breedId: 2147483600 });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/No breed found for id/);

      const dbDam = await prisma.horse.findUnique({ where: { id: mare.id } });
      expect(dbDam.inFoalSinceDate).toBeNull();
    });
  });

  // The derived breed must be validated as strictly as a supplied one, because
  // an unusable derived breed does NOT fail at breeding time — it fails 7 days
  // later inside runFoalingJob, whose compensation block restores the dam's
  // pregnancy so the job retries forever. The mare would be permanently in foal,
  // permanently unbreedable, with no foal and no player recovery path. Fail
  // closed at conception, synchronously, where the player can see it.
  describe('the derived breed is validated before the pregnancy is claimed', () => {
    it('refuses a dam with no breed on record and claims no pregnancy', async () => {
      const res = await postFoals({ sireId: stallion.id, damId: breedlessMare.id });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      // Pinned to THIS arm's message. A loose /breed/i matched every arm, so a
      // future change that routed a breedless dam into the "No breed found for
      // id" or the missing-profile arm would still have passed.
      expect(res.body.message).toBe(
        `${breedlessMare.name} has no breed on record, so there is no telling what her foal would be. Her breed needs to be on her record before she can be bred.`,
      );
      // The old wording told the player to "Choose a breed for the foal to breed
      // her" — a control BreedingPairSelection.tsx does not have, and a garden
      // path whose last clause parses as the foal breeding the mare. Pinning its
      // ABSENCE keeps a future reword from quietly reintroducing an instruction
      // no surface can carry out (Equoria-m9lz1 fix round 3, finding 5).
      expect(res.body.message).not.toMatch(/choose a breed/i);

      // Nothing was claimed: no pregnancy, no sire, and critically no cooldown
      // stamp — a rejected breed must not cost the player seven days.
      const dbDam = await prisma.horse.findUnique({ where: { id: breedlessMare.id } });
      expect(dbDam.inFoalSinceDate).toBeNull();
      expect(dbDam.pregnancySireId).toBeNull();
      expect(dbDam.lastBredDate).toBeNull();
      expect(dbDam.pendingFoalBreedId).toBeNull();
    });

    it('lets a breedless dam breed when the player supplies a real breedId', async () => {
      // The check is on the breed that will actually be USED, not on the dam's
      // own column — so supplying one must still work. This keeps the fix from
      // being over-broad.
      const res = await postFoals({
        sireId: stallion.id,
        damId: breedlessMare.id,
        breedId: breedThoroughbred.id,
      });

      expect(res.status).toBe(200);
      const dbDam = await prisma.horse.findUnique({ where: { id: breedlessMare.id } });
      expect(dbDam.inFoalSinceDate).toBeTruthy();
      expect(dbDam.pendingFoalBreedId).toBe(breedThoroughbred.id);
    });

    it('refuses a dam whose breed has no breed profile and claims no pregnancy', async () => {
      const res = await postFoals({ sireId: stallion.id, damId: profilelessMare.id });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      // This arm's own message — names the BREED, not the mare's missing column.
      expect(res.body.message).toBe(
        `${breedWithoutProfile.name} has no breed profile on file, so a foal of that breed cannot be born yet.`,
      );

      const dbDam = await prisma.horse.findUnique({ where: { id: profilelessMare.id } });
      expect(dbDam.inFoalSinceDate).toBeNull();
      expect(dbDam.pregnancySireId).toBeNull();
      expect(dbDam.lastBredDate).toBeNull();
    });

    it('refuses a supplied breedId whose breed has no breed profile', async () => {
      const res = await postFoals({
        sireId: stallion.id,
        damId: mare.id,
        breedId: breedWithoutProfile.id,
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe(
        `${breedWithoutProfile.name} has no breed profile on file, so a foal of that breed cannot be born yet.`,
      );
      const dbDam = await prisma.horse.findUnique({ where: { id: mare.id } });
      expect(dbDam.inFoalSinceDate).toBeNull();
      expect(dbDam.lastBredDate).toBeNull();
    });

    // The controller separates "this breed has no profile" (400, the player's
    // breed really is missing) from "the profile SOURCE is broken" (500, a server
    // data outage) by branching on `profileError.cause`. If breedProfiles.json
    // fails to load and the DB cache is empty, EVERY breed fails the check, so a
    // 400 blaming the player's mare would be a total outage rendered as a
    // per-breed refusal.
    //
    // This sentinel pins the loader contract that branch depends on: a
    // GENUINE-ABSENCE throw must carry NO `cause`, so it classifies as 400. If
    // someone later attached a cause to breedProfileLoader's absence arms, every
    // missing-profile breeding would silently start returning 500 "breed data is
    // unavailable" — and this test is what notices.
    it('a genuine missing-profile error carries no cause, so it classifies as a 400', async () => {
      const { getBreedProfile } = await import('../data/breedProfileLoader.mjs');
      let thrown = null;
      try {
        getBreedProfile(breedWithoutProfile.name);
      } catch (err) {
        thrown = err;
      }
      // getBreedProfile must throw for a breed with no profile.
      expect(thrown).toBeTruthy();
      expect(thrown.cause).toBeUndefined();
      expect(thrown.message).toMatch(/no breedprofiles\.json entry|absent from both/i);
    });
  });

  describe('crossbreeding', () => {
    // There is no crossbreed-permission rule anywhere in the backend today (no
    // isCrossbreedAllowed, no breed-compatibility gate). A mixed-breed pair is
    // therefore ACCEPTED and the foal resolves to the DAM's breed. This test
    // documents that as the live contract so a future silent change is caught;
    // it is not an endorsement of unrestricted crossbreeding.
    it('accepts a mixed-breed pair and resolves the foal to the dam breed', async () => {
      expect(crossBredStallion.breedId).not.toBe(mare.breedId);

      const res = await postFoals({ sireId: crossBredStallion.id, damId: mare.id });
      expect(res.status).toBe(200);

      const foaled = await postFoalNow(mare.id);
      expect(foaled.status).toBe(201);
      const foalId = foaled.body.data.foalId;
      createdFoalIds.push(foalId);

      const foal = await prisma.horse.findUnique({ where: { id: foalId } });
      expect(foal.breedId).toBe(mare.breedId);
      expect(foal.sireId).toBe(crossBredStallion.id);
      expect(foal.damId).toBe(mare.id);
    });
  });
});
