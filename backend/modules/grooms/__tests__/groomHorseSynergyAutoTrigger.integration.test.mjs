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

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';

const ORIGIN = 'http://localhost:3000';
const TAG = `5v6g-${randomBytes(4).toString('hex')}-${randomBytes(4).toString('hex')}`;

describe('Equoria-5v6g: POST /api/grooms/interact auto-updates GroomHorseSynergy', () => {
  let user;
  let token;
  let foal;
  let groom;
  let csrfToken;
  let cookieHeader;

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

    const csrf = await fetchCsrf(app, { origin: ORIGIN });
    csrfToken = csrf.csrfToken;
    cookieHeader = csrf.cookieHeader;
  }, 60000);

  afterAll(async () => {
    await prisma.groomHorseSynergy
      .deleteMany({ where: { groomId: groom?.id } })
      .catch(() => {});
    await prisma.groomInteraction
      .deleteMany({ where: { foalId: foal?.id } })
      .catch(() => {});
    await prisma.horse.delete({ where: { id: foal?.id } }).catch(() => {});
    await prisma.groom.deleteMany({ where: { userId: user?.id } }).catch(() => {});
    await prisma.user.delete({ where: { id: user?.id } }).catch(() => {});
  }, 30000);

  it('creates a GroomHorseSynergy row with sessionsTogether=1 after the first interaction', async () => {
    // Sanity: no synergy row exists before the interaction.
    const pre = await prisma.groomHorseSynergy.findFirst({
      where: { groomId: groom.id, horseId: foal.id },
    });
    expect(pre).toBeNull();

    const res = await request(app)
      .post('/api/grooms/interact')
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
        name: `${TAG}-FreshFoal`,
        sex: 'colt',
        dateOfBirth: dob,
        age: 21,
        bondScore: 50,
        stressLevel: 0,
        userId: user.id,
      },
    });

    try {
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
        .post('/api/grooms/interact')
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
    } finally {
      await prisma.groomHorseSynergy
        .deleteMany({ where: { horseId: freshFoal.id } })
        .catch(() => {});
      await prisma.groomInteraction
        .deleteMany({ where: { foalId: freshFoal.id } })
        .catch(() => {});
      await prisma.horse.delete({ where: { id: freshFoal.id } }).catch(() => {});
    }
  }, 30000);
});
