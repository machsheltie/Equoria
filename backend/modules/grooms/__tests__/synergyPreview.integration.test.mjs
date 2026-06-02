/**
 * Integration test: GET /api/grooms/:groomId/horses/:horseId/synergy
 *
 * 31D-4 (Equoria-ictn): preview endpoint surfaces the temperament-groom synergy
 * for the UI BEFORE the player assigns the groom or starts an interaction.
 *
 * Real DB, real auth — no mocks, no bypass headers.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
// Equoria-1ohys: fail-loud scoped cleanup. A cleanup delete that fails must
// fail the suite (not be swallowed by a silent no-op catch arm) so a leaked
// fixture surfaces at the source instead of tripping a canonical sentinel later.
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const ORIGIN = 'http://localhost:3000';
const TAG = `ictn-${randomBytes(4).toString('hex')}-${randomBytes(4).toString('hex')}`;

describe('31D-4 (Equoria-ictn): GET /api/grooms/:groomId/horses/:horseId/synergy', () => {
  let user;
  let token;
  let nervousHorse;
  let patientGroom;
  let strictGroom;
  const cleanup = createCleanupTracker();

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
        ...fixtureColor(),
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

    // Equoria-1ohys: fail-loud scoped cleanup. FK order — horse + grooms
    // (children of user; Horse.userId is Restrict) before the user. Groom*
    // child rows (interaction/synergy/assignmentLog) cascade-delete with the
    // groom/horse, so no separate child delete is needed for this read-only
    // preview suite. Scoped by id / userId; never a bare deleteMany.
    cleanup.add(() => prisma.horse.delete({ where: { id: nervousHorse?.id } }), 'horse');
    cleanup.add(() => prisma.groom.deleteMany({ where: { userId: user?.id } }), 'grooms');
    cleanup.add(() => prisma.user.delete({ where: { id: user?.id } }), 'user');
  }, 60000);

  afterAll(() => cleanup.run(), 60000);

  it('returns +0.25 modifier for Nervous + patient', async () => {
    const res = await request(app)
      .get(`/api/v1/grooms/${patientGroom.id}/horses/${nervousHorse.id}/synergy`)
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
      .get(`/api/v1/grooms/${strictGroom.id}/horses/${nervousHorse.id}/synergy`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.synergyModifier).toBe(-0.15);
    expect(res.body.data.message).toContain('-15%');
  }, 15000);

  it('returns 404 when groom does not exist', async () => {
    const res = await request(app)
      .get(`/api/v1/grooms/999999999/horses/${nervousHorse.id}/synergy`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  }, 15000);

  it('returns 401 without auth token', async () => {
    const res = await request(app)
      .get(`/api/v1/grooms/${patientGroom.id}/horses/${nervousHorse.id}/synergy`)
      .set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  }, 15000);
});
