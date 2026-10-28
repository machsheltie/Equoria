/**
 * competitionDisciplineSet.integration.test.mjs (Equoria-576c0 B3)
 *
 * Owner ruling R8 (2026-10-15): the competition disciplines are the bible's table (23, now 24 with Pleasure Driving).
 * 'Obedience Training' is not one of them. It leaves every competition-facing
 * list: GET /competition/disciplines, the /competition/eligibility check and the
 * competition leaderboard's discipline filter. It stays a training discipline:
 * training reads its own list, untouched by this slice.
 *
 * Real app + real DB.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { getAllDisciplines } from '../../../utils/competitionLogic.mjs';

const ORIGIN = 'http://localhost:3000';
const uid = () => randomBytes(5).toString('hex');
const cleanup = createCleanupTracker();
let owner;
let token;
let horse;

beforeAll(async () => {
  owner = await prisma.user.create({
    data: {
      emailVerified: true,
      email: `b3set-${uid()}@test.local`,
      username: `b3set${uid()}`,
      password: 'irrelevant-hash',
      firstName: 'Discipline',
      lastName: 'Set',
      money: 0,
    },
  });
  token = generateTestToken({ id: owner.id, email: owner.email, role: 'user' });
  horse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `TestFixture-b3set-${uid()}`,
      sex: 'Mare',
      dateOfBirth: new Date('2019-01-01'),
      age: 7,
      userId: owner.id,
    },
  });
  cleanup.add(() => prisma.horse.deleteMany({ where: { id: horse.id } }), 'horse');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: owner.id } }), 'user');
});

afterAll(() => cleanup.run(), 60000);

const get = path => request(app).get(path).set('Origin', ORIGIN).set('Authorization', `Bearer ${token}`);

describe('Obedience Training is not a competition discipline (R8)', () => {
  // Owner ruling 2026-10-21: Pleasure Driving is the 24th discipline. Old contract: 23.
  it('GET /competition/disciplines lists the 24 bible disciplines and not Obedience Training', async () => {
    const res = await get('/api/v1/competition/disciplines');

    expect(res.status).toBe(200);
    expect(res.body.data.disciplines).toHaveLength(24);
    expect(res.body.data.disciplines).toContain('Pleasure Driving');
    expect(res.body.data.disciplines).not.toContain('Obedience Training');
    expect(res.body.data.disciplines).toContain('Racing');
  });

  it('the eligibility check rejects Obedience Training as a discipline', async () => {
    const res = await get(`/api/v1/competition/eligibility/${horse.id}/${encodeURIComponent('Obedience Training')}`);

    expect(res.status).toBe(400);
  });

  // Equoria-a7f1p (q151): old contract read GET /leaderboards/competition, a duplicate
  // list removed; the discipline board is the leaderboard that takes a discipline now.
  it('the discipline leaderboard rejects an Obedience Training filter', async () => {
    const res = await get(
      `/api/v1/leaderboards/boards/discipline?discipline=${encodeURIComponent('Obedience Training')}`,
    );

    expect(res.status).toBe(400);
  });

  it('training still knows Obedience Training (its list is not the competition set)', () => {
    expect(getAllDisciplines()).toContain('Obedience Training');
  });
});
