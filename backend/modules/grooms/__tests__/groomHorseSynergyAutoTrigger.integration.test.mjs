/**
 * Integration test (Equoria-5v6g): POST /api/grooms/interact auto-updates
 * GroomHorseSynergy on EVERY interaction, not just milestone events.
 *
 * Pre-fix behavior: synergy row stays absent (or unchanged) after generic
 * brushing/grooming sessions. Only updateGroomSynergy callers tied to
 * milestone_completed / trait_shaped / rare_trait_influenced events touch it.
 *
 * Post-fix behavior: each interaction increments sessionsTogether by 1; the
 * synergyScore gains +1 every 4th session crossed (small relative to
 * milestones, but cumulative).
 *
 * Real DB, real auth, real CSRF.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
// Equoria-1ohys: fail-loud scoped cleanup. A cleanup delete that fails must
// fail the suite (not be swallowed by a silent no-op catch arm) so a leaked
// fixture surfaces at the source instead of tripping a canonical sentinel later.
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const ORIGIN = 'http://localhost:3000';
const TAG = `5v6g-${randomBytes(4).toString('hex')}-${randomBytes(4).toString('hex')}`;

describe('Equoria-5v6g: POST /api/grooms/interact auto-updates GroomHorseSynergy', () => {
  let user;
  let token;
  let foal;
  let groom;
  let csrfToken;
  let cookieHeader;
  // Suite-level fixtures (beforeAll) — drained in afterAll.
  const cleanup = createCleanupTracker();
  // Per-test fixtures created inside an `it` — drained in afterEach so a
  // per-test horse is deleted before the suite-level user it belongs to.
  const perTestCleanup = createCleanupTracker();

  beforeAll(async () => {
    user = await prisma.user.create({
      data: {
        email: `${TAG}@test.com`,
        username: TAG,
        password: 'irrelevant',
        firstName: 'Test',
        lastName: '5V6G',
        money: 5000,
      },
    });
    token = generateTestToken({ id: user.id, email: user.email, role: 'user' });

    const dob = new Date();
    dob.setFullYear(dob.getFullYear() - 1);
    foal = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `${TAG}-Foal`,
        sex: 'colt',
        dateOfBirth: dob,
        age: 21,
        bondScore: 50,
        stressLevel: 0,
        userId: user.id,
      },
    });

    groom = await prisma.groom.create({
      data: {
        name: `${TAG}-Groom`,
        speciality: 'foal_care',
        skillLevel: 'intermediate',
        personality: 'patient',
        experience: 5,
        sessionRate: 20,
        userId: user.id,
        isActive: true,
      },
    });

    // Equoria-obufp: bind CSRF to the authenticated user (per-user CSRF
    // binding, Equoria-plw0h). Anonymous issuance => 403 on the Bearer mutation.
    const csrf = await fetchCsrf(app, { origin: ORIGIN, extraCookies: [`accessToken=${token}`] });
    csrfToken = csrf.csrfToken;
    cookieHeader = csrf.cookieHeader;

    // Equoria-1ohys: fail-loud scoped cleanup. FK order — GroomHorseSynergy +
    // GroomInteraction (Cascade children of groom/foal) before the foal; foal +
    // grooms (children of user; Horse.userId is Restrict) before the user.
    // Scoped by groomId / foalId / id / userId; never a bare deleteMany. (The
    // explicit synergy/interaction deletes are belt-and-braces — they would also
    // cascade with the horse/groom deletes.)
    cleanup.add(() => prisma.groomHorseSynergy.deleteMany({ where: { groomId: groom?.id } }), 'groomHorseSynergy');
    cleanup.add(() => prisma.groomInteraction.deleteMany({ where: { foalId: foal?.id } }), 'groomInteraction');
    cleanup.add(() => prisma.horse.delete({ where: { id: foal?.id } }), 'horse');
    cleanup.add(() => prisma.groom.deleteMany({ where: { userId: user?.id } }), 'grooms');
    cleanup.add(() => prisma.user.delete({ where: { id: user?.id } }), 'user');
  }, 60000);

  // Drain per-test fixtures every cycle (fail-loud). Runs before afterAll, so a
  // per-test horse is removed before its owning suite-level user is deleted.
  afterEach(() => perTestCleanup.run());
  afterAll(() => cleanup.run(), 30000);

  it('creates a GroomHorseSynergy row with sessionsTogether=1 after the first interaction', async () => {
    // Sanity: no synergy row exists before the interaction.
    const pre = await prisma.groomHorseSynergy.findFirst({
      where: { groomId: groom.id, horseId: foal.id },
    });
    expect(pre).toBeNull();

    const res = await request(app)
      .post('/api/v1/grooms/interact')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('X-CSRF-Token', csrfToken)
      .set('Cookie', cookieHeader)
      .send({
        foalId: foal.id,
        groomId: groom.id,
        interactionType: 'brushing',
        duration: 30,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const post = await prisma.groomHorseSynergy.findFirst({
      where: { groomId: groom.id, horseId: foal.id },
    });
    expect(post).not.toBeNull();
    expect(post.sessionsTogether).toBe(1);
    // First session — no synergyScore increment yet (only on every 4th session).
    expect(post.synergyScore).toBe(0);
  }, 30000);

  it('increments sessionsTogether on each subsequent interaction and grants +1 synergyScore on the 4th session', async () => {
    // Create a fresh foal so the daily-limit + mutual-exclusivity rules from the
    // first test don't block additional interactions today.
    const dob = new Date();
    dob.setFullYear(dob.getFullYear() - 1);
    const freshFoal = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `${TAG}-FreshFoal`,
        sex: 'colt',
        dateOfBirth: dob,
        age: 21,
        bondScore: 50,
        stressLevel: 0,
        userId: user.id,
      },
    });
    // Equoria-1ohys: register fail-loud scoped cleanup for this per-test foal
    // (drained in afterEach, before the suite user delete). FK order —
    // GroomHorseSynergy + GroomInteraction (Cascade children of foal) before the
    // foal. Replaces the prior swallowed finally-block delete so a cleanup
    // failure fails the test.
    perTestCleanup.add(
      () => prisma.groomHorseSynergy.deleteMany({ where: { horseId: freshFoal.id } }),
      'freshFoal-groomHorseSynergy',
    );
    perTestCleanup.add(
      () => prisma.groomInteraction.deleteMany({ where: { foalId: freshFoal.id } }),
      'freshFoal-groomInteraction',
    );
    perTestCleanup.add(() => prisma.horse.delete({ where: { id: freshFoal.id } }), 'freshFoal-horse');

    // Seed a synergy row at sessionsTogether=3 directly. The next interaction
    // should bump it to 4 and trigger the modulo-4 +1 synergyScore reward.
    await prisma.groomHorseSynergy.create({
      data: {
        groomId: groom.id,
        horseId: freshFoal.id,
        synergyScore: 0,
        sessionsTogether: 3,
        lastAssignedAt: new Date(),
      },
    });

    const res = await request(app)
      .post('/api/v1/grooms/interact')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('X-CSRF-Token', csrfToken)
      .set('Cookie', cookieHeader)
      .send({
        foalId: freshFoal.id,
        groomId: groom.id,
        interactionType: 'brushing',
        duration: 30,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const updated = await prisma.groomHorseSynergy.findFirst({
      where: { groomId: groom.id, horseId: freshFoal.id },
    });
    expect(updated.sessionsTogether).toBe(4);
    expect(updated.synergyScore).toBe(1);
  }, 30000);
});
