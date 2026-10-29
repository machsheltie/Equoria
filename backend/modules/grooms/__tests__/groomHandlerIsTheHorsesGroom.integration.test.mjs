/**
 * The show handler is the horse's groom (Equoria-4fa7s, owner ruling 2026-10-28
 * q154).
 *
 * Conformation shows and parades need a groom; every other discipline uses a
 * rider. Any groom may handle in any class: the only check is that the horse
 * has a groom. Groom handler bonuses come later.
 *
 * Old contract: /groom-handlers also judged a groom per conformation class
 * (GET /eligibility/:horseId/:className) and advertised per-discipline handler
 * bonuses by groom skill, personality and specialty for ridden disciplines
 * (GET /config, GET /disciplines). Those contradict the ruling and are gone; the
 * horse's handler is simply its groom, whatever the groom's specialty.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { testHorseData } from '../../../__tests__/helpers/createTestHorse.mjs';

const ORIGIN = 'http://localhost:3000';
const tag = randomBytes(4).toString('hex');
const cleanup = createCleanupTracker();

let user;
let token;
let horse;
let groom;

const get = path =>
  request(app).get(`/api/v1/groom-handlers${path}`).set('Origin', ORIGIN).set('Authorization', `Bearer ${token}`);

beforeAll(async () => {
  // The tracker runs in order: children before parents (Horse.userId and
  // Groom.userId are onDelete:Restrict).
  cleanup.add(() => prisma.groomAssignment.delete({ where: { id: assignment.id } }), 'groom assignment');
  cleanup.add(() => prisma.groom.delete({ where: { id: groom.id } }), 'groom');
  cleanup.add(() => prisma.horse.delete({ where: { id: horse.id } }), 'horse');
  cleanup.add(() => prisma.user.delete({ where: { id: user.id } }), 'user');
  user = await prisma.user.create({
    data: {
      emailVerified: true,
      email: `handlergroom-${tag}@test.com`,
      username: `handlergroom${tag}`,
      password: 'irrelevant-hash',
      firstName: 'Handler',
      lastName: 'Groom',
      money: 0,
    },
  });
  token = generateTestToken({ id: user.id, email: user.email, role: 'user' });

  horse = await prisma.horse.create({
    data: await testHorseData(prisma, {
      ...fixtureColor(),
      name: `TestFixture-HandlerGroomHorse-${tag}`,
      sex: 'Mare',
      dateOfBirth: new Date('2020-01-01'),
      age: 6,
      userId: user.id,
    }),
  });

  // A foal-care groom, not a show-handling specialist: still the horse's handler.
  groom = await prisma.groom.create({
    data: {
      name: `TestFixture-HandlerGroom-${tag}`,
      speciality: 'foalCare',
      personality: 'gentle',
      skillLevel: 'novice',
      userId: user.id,
    },
  });

  const assignment = await prisma.groomAssignment.create({
    data: { groomId: groom.id, foalId: horse.id, userId: user.id, isActive: true },
  });
}, 30000);

afterAll(() => cleanup.run(), 30000);

describe('the show handler is the horse groom (Equoria-4fa7s)', () => {
  it('names the horse groom as its handler, whatever the groom specialty', async () => {
    const res = await get(`/horse/${horse.id}`);

    expect(res.status).toBe(200);
    expect(res.body.data.hasHandler).toBe(true);
    expect(res.body.data.handler.id).toBe(groom.id);
  });

  it('no longer judges a groom per conformation class', async () => {
    const res = await get(`/eligibility/${horse.id}/Mares`);

    expect(res.status).toBe(404);
  });

  it('no longer advertises handler bonuses for ridden disciplines', async () => {
    const res = await get('/disciplines');

    expect(res.status).toBe(404);
  });

  it('no longer advertises handler skill, personality or specialty bonuses', async () => {
    const res = await get('/config');

    expect(res.status).toBe(404);
  });
});
