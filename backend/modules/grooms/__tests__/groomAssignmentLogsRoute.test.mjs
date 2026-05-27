/**
 * Integration Test: GET /api/grooms/:id/assignment-logs (Equoria-wb7z)
 *
 * Real DB + real HTTP. Verifies the new endpoint that surfaces
 * GroomAssignmentLog rows for a groom (data was previously written but
 * never rendered to any frontend).
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import prisma from '../../../../packages/database/prismaClient.mjs';
import app from '../../../app.mjs';
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';

const UNIQUE = randomBytes(6).toString('hex');
const PREFIX = `TestFixture-GroomAssLog-${UNIQUE}-`;

let testUser;
let testGroom;
let testHorse;
let authToken;

beforeAll(async () => {
  testUser = await prisma.user.create({
    data: {
      id: `${PREFIX}user`,
      email: `${PREFIX}user@test.local`,
      username: `${PREFIX}user`,
      password: 'irrelevant-for-this-test',
      firstName: 'Test',
      lastName: 'GroomAssLog',
    },
  });

  const breed =
    (await prisma.breed.findFirst({ where: { name: 'Thoroughbred' } })) ||
    (await prisma.breed.create({ data: { name: 'Thoroughbred', description: 'Test breed' } }));

  testHorse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `${PREFIX}Horse`,
      sex: 'Mare',
      age: 1,
      dateOfBirth: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
      breed: { connect: { id: breed.id } },
      user: { connect: { id: testUser.id } },
    },
  });

  testGroom = await prisma.groom.create({
    data: {
      name: `${PREFIX}Groom`,
      speciality: 'foalCare',
      skillLevel: 'novice',
      personality: 'gentle',
      experience: 1,
      sessionRate: 10,
      bio: 'Test groom',
      isActive: true,
      user: { connect: { id: testUser.id } },
    },
  });

  await prisma.groomAssignmentLog.create({
    data: {
      groomId: testGroom.id,
      horseId: testHorse.id,
      assignedAt: new Date('2026-04-01T00:00:00Z'),
      unassignedAt: new Date('2026-04-15T00:00:00Z'),
      milestonesCompleted: 3,
      traitsShaped: ['calm', 'confident'],
      xpGained: 50,
    },
  });
  await prisma.groomAssignmentLog.create({
    data: {
      groomId: testGroom.id,
      horseId: testHorse.id,
      assignedAt: new Date('2026-05-01T00:00:00Z'),
      unassignedAt: null,
      milestonesCompleted: 1,
      traitsShaped: ['curious'],
      xpGained: 20,
    },
  });

  authToken = jwt.sign(
    { id: testUser.id, email: testUser.email, username: testUser.username, role: 'user' },
    process.env.JWT_SECRET || 'test-jwt-secret-key-for-testing-only-32chars',
    { expiresIn: '1h' },
  );
});

afterAll(async () => {
  await prisma.groomAssignmentLog.deleteMany({ where: { groomId: testGroom.id } });
  await prisma.groom.deleteMany({ where: { id: testGroom.id } });
  await prisma.horse.deleteMany({ where: { id: testHorse.id } });
  await prisma.user.deleteMany({ where: { id: testUser.id } });
});

describe('GET /api/grooms/:id/assignment-logs (Equoria-wb7z)', () => {
  it('returns assignment-log history for the groom owner', async () => {
    const res = await request(app)
      .get(`/api/grooms/${testGroom.id}/assignment-logs`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.logs)).toBe(true);
    expect(res.body.logs.length).toBeGreaterThanOrEqual(2);

    // Logs are ordered by assignedAt desc, so the most-recent (May) comes first.
    const first = res.body.logs[0];
    expect(first.milestonesCompleted).toBe(1);
    expect(first.traitsShaped).toEqual(['curious']);
    expect(first.xpGained).toBe(20);
    expect(first.horse).toHaveProperty('id', testHorse.id);
    expect(first.horse).toHaveProperty('name');
  });

  it('rejects unauthenticated requests', async () => {
    const res = await request(app).get(`/api/grooms/${testGroom.id}/assignment-logs`);
    expect([401, 403]).toContain(res.status);
  });

  it('rejects invalid groom IDs', async () => {
    const res = await request(app)
      .get('/api/grooms/not-a-number/assignment-logs')
      .set('Authorization', `Bearer ${authToken}`);
    expect([400, 404]).toContain(res.status);
  });
});
