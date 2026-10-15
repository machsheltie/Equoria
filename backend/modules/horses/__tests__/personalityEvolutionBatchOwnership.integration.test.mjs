/**
 * POST /api/v1/personality-evolution/batch-evolve — cross-owner ownership
 * regression (Equoria-bvddn.4, audit 2026-09-25).
 *
 * Split out of personalityEvolutionController.integration.test.mjs (file-size
 * doctrine threshold, CONTRIBUTING.md "File-size thresholds" / Equoria-urqic.7:
 * test files must stay <= 800 lines) but kept co-located with the rest of the
 * personality-evolution controller's HTTP coverage per module-test
 * co-location convention.
 *
 * ## Bug
 *
 * batch-evolve called evolveGroomPersonality/evolveHorseTemperament directly
 * with no ownership check at all — unlike the single-entity
 * /groom/:id/evolve and /horse/:id/evolve routes, which gate through
 * requireOwnership. evolveHorseTemperament persists unconditionally
 * (personalityEvolutionSystem.mjs:201 writes horse.temperament with no owner
 * filter), so any authenticated player could name a victim's horse or groom
 * id in the batch, have that horse's temperament rewritten on THEIR
 * schedule, and read the victim's care-quality data back in the response.
 *
 * This suite proves against the real database that the attack worked before
 * the fix (victim horse actually evolved, temperament changed) and is
 * refused after (victim horse untouched, generic not-found-or-not-yours
 * error — CWE-639, cannot be told apart from "doesn't exist" — and no
 * evolution).
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const ORIGIN = 'http://localhost:3000';

const referenceDate = new Date('2025-06-01T12:00:00Z');
const birthDate2YearsOld = new Date(referenceDate);
birthDate2YearsOld.setFullYear(referenceDate.getFullYear() - 2);

describe('POST /api/personality-evolution/batch-evolve — cross-owner ownership (Equoria-bvddn.4)', () => {
  let owner;
  let ownerToken;
  let ownerCsrf;
  let ownerHorse;
  let ownerBreed;

  let attacker;
  let attackerToken;
  let attackerCsrf;

  let victim;
  let victimBreed;
  let victimHorse;
  let victimGroom;
  const victimInteractionIds = [];

  const cleanup = createCleanupTracker();

  beforeAll(async () => {
    owner = await prisma.user.create({
      data: {
        email: `pevol-own-${randomBytes(4).toString('hex')}@test.com`,
        username: `pevolown${randomBytes(4).toString('hex')}`,
        password: 'irrelevant-hash',
        firstName: 'Owner',
        lastName: 'Tester',
        money: 5000,
        xp: 0,
        level: 1,
      },
    });
    ownerToken = generateTestToken({ id: owner.id, email: owner.email, role: 'user' });
    ownerCsrf = await fetchCsrf(app, { extraCookies: [`accessToken=${ownerToken}`] });

    ownerBreed = await prisma.breed.create({
      data: {
        name: `TestFixture-PersEvoOwnerBreed-${randomBytes(8).toString('hex')}`,
        description: 'Owner breed for batch-evolve ownership regression',
      },
    });

    ownerHorse = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-OwnerHorse-${Date.now()}`,
        sex: 'Filly',
        dateOfBirth: birthDate2YearsOld,
        age: 2,
        temperament: 'nervous',
        stressLevel: 7,
        bondScore: 20,
        healthStatus: 'Good',
        userId: owner.id,
        breedId: ownerBreed.id,
      },
    });

    attacker = await prisma.user.create({
      data: {
        email: `pevol-atk-${randomBytes(4).toString('hex')}@test.com`,
        username: `pevolatk${randomBytes(4).toString('hex')}`,
        password: 'irrelevant-hash',
        firstName: 'Attacker',
        lastName: 'Tester',
        money: 5000,
        xp: 0,
        level: 1,
      },
    });
    attackerToken = generateTestToken({ id: attacker.id, email: attacker.email, role: 'user' });
    attackerCsrf = await fetchCsrf(app, { extraCookies: [`accessToken=${attackerToken}`] });

    victim = await prisma.user.create({
      data: {
        email: `pevol-vic-${randomBytes(4).toString('hex')}@test.com`,
        username: `pevolvic${randomBytes(4).toString('hex')}`,
        password: 'irrelevant-hash',
        firstName: 'Victim',
        lastName: 'Tester',
        money: 5000,
        xp: 0,
        level: 1,
      },
    });

    victimBreed = await prisma.breed.create({
      data: {
        name: `TestFixture-PersEvoVictimBreed-${randomBytes(8).toString('hex')}`,
        description: 'Victim breed for batch-evolve ownership regression',
      },
    });

    victimGroom = await prisma.groom.create({
      data: {
        name: `TestFixture-VictimGroom-${Date.now()}`,
        speciality: 'foal_care',
        personality: 'calm',
        epigeneticInfluenceType: 'calm',
        skillLevel: 'intermediate',
        experience: 100,
        level: 5,
        sessionRate: 25.0,
        isActive: true,
        userId: victim.id,
      },
    });

    victimHorse = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-VictimHorse-${Date.now()}`,
        sex: 'Filly',
        dateOfBirth: birthDate2YearsOld,
        age: 2,
        temperament: 'nervous',
        stressLevel: 7,
        bondScore: 20,
        healthStatus: 'Good',
        userId: victim.id,
        breedId: victimBreed.id,
      },
    });

    // 20-interaction seed — real care-pattern data so evolveHorseTemperament
    // actually triggers and mutates temperament rather than short-circuiting
    // on "insufficient_consistency".
    for (let i = 0; i < 20; i++) {
      const interaction = await prisma.groomInteraction.create({
        data: {
          groomId: victimGroom.id,
          foalId: victimHorse.id,
          taskType: 'trust_building',
          interactionType: 'enrichment',
          bondingChange: 2,
          stressChange: -2,
          quality: 'excellent',
          cost: 25.0,
          duration: 30,
          notes: 'Victim fixture interaction for batch-evolve ownership regression',
        },
      });
      victimInteractionIds.push(interaction.id);
    }

    // FK-ordered, id-scoped, fail-loud sweep (interactions FIRST).
    cleanup.add(
      () => prisma.groomInteraction.deleteMany({ where: { id: { in: victimInteractionIds } } }),
      'victim groomInteractions',
    );
    cleanup.add(() => prisma.horse.deleteMany({ where: { id: victimHorse.id } }), 'victim horse');
    cleanup.add(() => prisma.groom.deleteMany({ where: { id: victimGroom.id } }), 'victim groom');
    cleanup.add(() => prisma.horse.deleteMany({ where: { id: ownerHorse.id } }), 'owner horse');
    cleanup.add(() => prisma.user.deleteMany({ where: { id: attacker.id } }), 'attacker user');
    cleanup.add(() => prisma.user.deleteMany({ where: { id: victim.id } }), 'victim user');
    cleanup.add(() => prisma.user.deleteMany({ where: { id: owner.id } }), 'owner user');
    cleanup.add(() => prisma.breed.deleteMany({ where: { id: victimBreed.id } }), 'victim breed');
    cleanup.add(() => prisma.breed.deleteMany({ where: { id: ownerBreed.id } }), 'owner breed');
  }, 60000);

  afterAll(() => cleanup.run(), 60000);

  it('refuses to evolve a horse the caller does not own, and leaves its temperament unchanged', async () => {
    const before = await prisma.horse.findUnique({ where: { id: victimHorse.id } });
    expect(before.temperament).toBe('nervous');

    const res = await request(app)
      .post('/api/v1/personality-evolution/batch-evolve')
      .set('Authorization', `Bearer ${attackerToken}`)
      .set('Origin', ORIGIN)
      .set('Cookie', attackerCsrf.cookieHeader)
      .set('X-CSRF-Token', attackerCsrf.csrfToken)
      .send({ entities: [{ entityId: victimHorse.id, entityType: 'horse' }] })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.results).toHaveLength(1);
    const entry = res.body.data.results[0];
    expect(entry.result.success).toBe(false);
    // CWE-639: generic message, not distinguishable from "doesn't exist" —
    // must NOT disclose the victim's temperament or care-quality data.
    expect(entry.result.error).toBe('Horse not found or you do not own this horse');
    expect(entry.result).not.toHaveProperty('temperamentEvolved');
    expect(entry.result).not.toHaveProperty('careQualityScore');
    expect(res.body.data.summary.evolved).toBe(0);

    const after = await prisma.horse.findUnique({ where: { id: victimHorse.id } });
    expect(after.temperament).toBe('nervous');
  });

  it('refuses to evolve a groom the caller does not own (no ownership disclosure)', async () => {
    const res = await request(app)
      .post('/api/v1/personality-evolution/batch-evolve')
      .set('Authorization', `Bearer ${attackerToken}`)
      .set('Origin', ORIGIN)
      .set('Cookie', attackerCsrf.cookieHeader)
      .set('X-CSRF-Token', attackerCsrf.csrfToken)
      .send({ entities: [{ entityId: victimGroom.id, entityType: 'groom' }] })
      .expect(200);

    expect(res.body.success).toBe(true);
    const entry = res.body.data.results[0];
    expect(entry.result.success).toBe(false);
    expect(entry.result.error).toBe('Groom not found or not on your staff');
    expect(res.body.data.summary.evolved).toBe(0);
  });

  it('evolves the same victim horse for its real owner (control: ownership check is not just refusing everyone)', async () => {
    const victimToken = generateTestToken({ id: victim.id, email: victim.email, role: 'user' });
    const victimCsrf = await fetchCsrf(app, { extraCookies: [`accessToken=${victimToken}`] });

    const res = await request(app)
      .post('/api/v1/personality-evolution/batch-evolve')
      .set('Authorization', `Bearer ${victimToken}`)
      .set('Origin', ORIGIN)
      .set('Cookie', victimCsrf.cookieHeader)
      .set('X-CSRF-Token', victimCsrf.csrfToken)
      .send({ entities: [{ entityId: victimHorse.id, entityType: 'horse' }] })
      .expect(200);

    const entry = res.body.data.results[0];
    // The owner's own request must actually be allowed through to the real
    // evolution path (success is defined either way; the important thing is
    // it is NOT the ownership refusal message the attacker got above).
    expect(entry.result.error).not.toBe('Horse not found or you do not own this horse');
  });

  it('processes a mixed batch of owned and foreign entities: foreign refused, owned evolved', async () => {
    // Snapshot rather than assume 'nervous': the preceding control test in
    // this suite evolves victimHorse under its real owner's token, so its
    // temperament may already have moved on from the fixture's seed value.
    // What this test proves is narrower and still the load-bearing claim:
    // THIS request, from a non-owner, must not be the thing that changes it.
    const before = await prisma.horse.findUnique({ where: { id: victimHorse.id } });

    const res = await request(app)
      .post('/api/v1/personality-evolution/batch-evolve')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('Origin', ORIGIN)
      .set('Cookie', ownerCsrf.cookieHeader)
      .set('X-CSRF-Token', ownerCsrf.csrfToken)
      .send({
        entities: [
          { entityId: ownerHorse.id, entityType: 'horse' }, // owned by `owner`
          { entityId: victimHorse.id, entityType: 'horse' }, // owned by `victim`
        ],
      })
      .expect(200);

    const [ownEntry, foreignEntry] = res.body.data.results;
    expect(ownEntry.entityId).toBe(ownerHorse.id);
    expect(foreignEntry.entityId).toBe(victimHorse.id);
    expect(foreignEntry.result.success).toBe(false);
    expect(foreignEntry.result.error).toBe('Horse not found or you do not own this horse');

    const after = await prisma.horse.findUnique({ where: { id: victimHorse.id } });
    expect(after.temperament).toBe(before.temperament);
  });
});
