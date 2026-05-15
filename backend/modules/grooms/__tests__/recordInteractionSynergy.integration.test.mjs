/**
 * Integration test: POST /api/grooms/interact applies temperament-groom synergy.
 *
 * 31D-4 (Equoria-ng1i): the production endpoint reads horse.temperament and
 * multiplies the resulting bondingChange by (1 + synergyModifier).
 *
 * Pairings asserted:
 *   - Nervous + patient → synergyModifier = +0.25 (boost bonding)
 *   - Nervous + strict  → synergyModifier = -0.15 (reduce bonding)
 *
 * Real DB, real auth, real CSRF — no mocks, no bypass headers.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';

const ORIGIN = 'http://localhost:3000';
const TAG = `ng1i-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

describe('31D-4 (Equoria-ng1i): POST /api/grooms/interact applies temperament-groom synergy', () => {
  let user;
  let token;
  let nervousFoal;
  let patientGroom;
  let strictGroom;
  let csrfToken;
  let cookieHeader;

  beforeAll(async () => {
    user = await prisma.user.create({
      data: {
        email: `${TAG}@test.com`,
        username: TAG,
        password: 'irrelevant',
        firstName: 'Test',
        lastName: 'NG1I',
        money: 5000,
      },
    });
    token = generateTestToken({ id: user.id, email: user.email, role: 'user' });

    const dob = new Date();
    dob.setFullYear(dob.getFullYear() - 1);
    nervousFoal = await prisma.horse.create({
      data: {
        name: `${TAG}-NervousFoal`,
        sex: 'colt',
        dateOfBirth: dob,
        age: 21,
        bondScore: 50,
        stressLevel: 0,
        temperament: 'Nervous',
        userId: user.id,
      },
    });

    patientGroom = await prisma.groom.create({
      data: {
        name: `${TAG}-Patient`,
        speciality: 'foal_care',
        skillLevel: 'intermediate',
        personality: 'patient',
        experience: 5,
        sessionRate: 20,
        userId: user.id,
        isActive: true,
      },
    });

    strictGroom = await prisma.groom.create({
      data: {
        name: `${TAG}-Strict`,
        speciality: 'foal_care',
        skillLevel: 'intermediate',
        personality: 'strict',
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
    await prisma.groomInteraction
      .deleteMany({ where: { foalId: nervousFoal?.id } })
      .catch(() => {});
    await prisma.horse.delete({ where: { id: nervousFoal?.id } }).catch(() => {});
    await prisma.groom.deleteMany({ where: { userId: user?.id } }).catch(() => {});
    await prisma.user.delete({ where: { id: user?.id } }).catch(() => {});
  }, 30000);

  it('persists synergyModifier=0.25 on Nervous + patient interaction', async () => {
    const res = await request(app)
      .post('/api/grooms/interact')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('X-CSRF-Token', csrfToken)
      .set('Cookie', cookieHeader)
      .send({
        foalId: nervousFoal.id,
        groomId: patientGroom.id,
        interactionType: 'brushing',
        duration: 30,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.effects.synergyModifier).toBe(0.25);

    const persisted = await prisma.groomInteraction.findUnique({
      where: { id: res.body.data.interaction.id },
    });
    expect(persisted.synergyModifier).toBe(0.25);
  }, 30000);

  it('persists synergyModifier=-0.15 on Nervous + strict interaction (negative synergy)', async () => {
    const dob = new Date();
    dob.setFullYear(dob.getFullYear() - 1);
    const strictFoal = await prisma.horse.create({
      data: {
        name: `${TAG}-NervousFoalStrict`,
        sex: 'colt',
        dateOfBirth: dob,
        age: 21,
        bondScore: 50,
        stressLevel: 0,
        temperament: 'Nervous',
        userId: user.id,
      },
    });

    try {
      const res = await request(app)
        .post('/api/grooms/interact')
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${token}`)
        .set('X-CSRF-Token', csrfToken)
        .set('Cookie', cookieHeader)
        .send({
          foalId: strictFoal.id,
          groomId: strictGroom.id,
          interactionType: 'brushing',
          duration: 30,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.effects.synergyModifier).toBe(-0.15);

      const persisted = await prisma.groomInteraction.findUnique({
        where: { id: res.body.data.interaction.id },
      });
      expect(persisted.synergyModifier).toBe(-0.15);
    } finally {
      await prisma.groomInteraction.deleteMany({ where: { foalId: strictFoal.id } }).catch(() => {});
      await prisma.horse.delete({ where: { id: strictFoal.id } }).catch(() => {});
    }
  }, 30000);
});
