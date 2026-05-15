/**
 * Integration test: GET /api/grooms/:groomId/horses/:horseId/synergy
 *
 * 31D-4 (Equoria-ictn): preview endpoint surfaces the temperament-groom synergy
 * for the UI BEFORE the player assigns the groom or starts an interaction.
 *
 * Real DB, real auth — no mocks, no bypass headers.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';

const ORIGIN = 'http://localhost:3000';
const TAG = `ictn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

describe('31D-4 (Equoria-ictn): GET /api/grooms/:groomId/horses/:horseId/synergy', () => {
  let user;
  let token;
  let nervousHorse;
  let patientGroom;
  let strictGroom;

  beforeAll(async () => {
    user = await prisma.user.create({
      data: {
        email: `${TAG}@test.com`,
        username: TAG,
        password: 'irrelevant',
        firstName: 'Synergy',
        lastName: 'Preview',
        money: 1000,
      },
    });
    token = generateTestToken({ id: user.id, email: user.email, role: 'user' });

    const dob = new Date();
    dob.setFullYear(dob.getFullYear() - 1);
    nervousHorse = await prisma.horse.create({
      data: {
        name: `${TAG}-Nervous`,
        sex: 'mare',
        dateOfBirth: dob,
        age: 21,
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
  }, 30000);

  afterAll(async () => {
    await prisma.horse.delete({ where: { id: nervousHorse?.id } }).catch(() => {});
    await prisma.groom.deleteMany({ where: { userId: user?.id } }).catch(() => {});
    await prisma.user.delete({ where: { id: user?.id } }).catch(() => {});
  }, 15000);

  it('returns +0.25 modifier for Nervous + patient', async () => {
    const res = await request(app)
      .get(`/api/grooms/${patientGroom.id}/horses/${nervousHorse.id}/synergy`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.synergyModifier).toBe(0.25);
    expect(res.body.data.temperament).toBe('Nervous');
    expect(res.body.data.personality).toBe('patient');
    expect(res.body.data.message).toContain('+25%');
  }, 15000);

  it('returns -0.15 modifier for Nervous + strict', async () => {
    const res = await request(app)
      .get(`/api/grooms/${strictGroom.id}/horses/${nervousHorse.id}/synergy`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.synergyModifier).toBe(-0.15);
    expect(res.body.data.message).toContain('-15%');
  }, 15000);

  it('returns 404 when groom does not exist', async () => {
    const res = await request(app)
      .get(`/api/grooms/999999999/horses/${nervousHorse.id}/synergy`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  }, 15000);

  it('returns 401 without auth token', async () => {
    const res = await request(app)
      .get(`/api/grooms/${patientGroom.id}/horses/${nervousHorse.id}/synergy`)
      .set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  }, 15000);
});
