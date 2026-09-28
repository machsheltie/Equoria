/**
 * Equoria-bvddn.25 — Election date validation
 *
 * Validates that createElection correctly rejects elections where
 * endsAt <= startsAt, and accepts elections where endsAt > startsAt.
 *
 * Real DB. No mocks of Prisma. Fixtures are scoped by random IDs
 * for cleanup safety.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../app.mjs';
import prisma from '../../packages/database/prismaClient.mjs';
import { createMockToken } from '../__tests__/factories/index.mjs';
import { fetchCsrf, attachCsrf } from '../tests/helpers/csrfHelper.mjs';
import { createCleanupTracker } from './helpers/failLoudCleanup.mjs';

const TAG = `bvddn25${randomBytes(5).toString('hex')}`;
const DEFAULT_ORIGIN = 'http://localhost:3000';

const cleanup = createCleanupTracker();

describe('Equoria-bvddn.25: Election date validation', () => {
  let testUser;
  let testClub;
  let validToken;

  beforeAll(async () => {
    // Create a test user
    testUser = await prisma.user.create({
      data: {
        email: `${TAG}@example.com`,
        username: `${TAG}_user`,
        password: 'hashedPassword123',
        firstName: 'Test',
        lastName: 'User',
        emailVerified: true,
      },
    });

    cleanup.add(async () => {
      await prisma.clubElection.deleteMany({ where: { club: { name: { contains: TAG } } } });
    }, 'clubElections(byClubTag)');

    cleanup.add(async () => {
      await prisma.clubMembership.deleteMany({
        where: { club: { name: { contains: TAG } } },
      });
    }, 'clubMemberships(byClubTag)');

    cleanup.add(async () => {
      await prisma.club.deleteMany({ where: { name: { contains: TAG } } });
    }, 'clubs(byTag)');

    cleanup.add(async () => {
      await prisma.user.deleteMany({ where: { username: `${TAG}_user` } });
    }, 'users(byTag)');

    // Create a test club
    testClub = await prisma.club.create({
      data: {
        name: `${TAG}_Club`,
        type: 'discipline',
        category: 'test',
        description: 'Test club for election validation',
        leaderId: testUser.id,
      },
    });

    // Make the user an officer
    await prisma.clubMembership.create({
      data: {
        clubId: testClub.id,
        userId: testUser.id,
        role: 'officer',
      },
    });

    // Generate valid token
    validToken = createMockToken(testUser.id);
  });

  afterAll(() => cleanup.run(), 120000);

  it('rejects election where endsAt is before startsAt (400)', async () => {
    const now = new Date();
    const startsAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // tomorrow
    const endsAt = new Date(now.getTime() + 12 * 60 * 60 * 1000); // today (before startsAt)

    const csrf = await fetchCsrf(app, { origin: DEFAULT_ORIGIN });
    const res = await attachCsrf(
      request(app)
        .post(`/api/v1/clubs/${testClub.id}/elections`)
        .set('Origin', DEFAULT_ORIGIN)
        .set('Authorization', `Bearer ${validToken}`),
      csrf,
    ).send({
      position: 'President',
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/endDate|endsAt|after|before|after.*start/i);
  });

  it('rejects election where endsAt equals startsAt (400)', async () => {
    const now = new Date();
    const sameTime = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const csrf = await fetchCsrf(app, { origin: DEFAULT_ORIGIN });
    const res = await attachCsrf(
      request(app)
        .post(`/api/v1/clubs/${testClub.id}/elections`)
        .set('Origin', DEFAULT_ORIGIN)
        .set('Authorization', `Bearer ${validToken}`),
      csrf,
    ).send({
      position: 'Treasurer',
      startsAt: sameTime.toISOString(),
      endsAt: sameTime.toISOString(),
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('accepts election where endsAt is after startsAt (201)', async () => {
    const now = new Date();
    const startsAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // tomorrow
    const endsAt = new Date(now.getTime() + 48 * 60 * 60 * 1000); // day after tomorrow

    const csrf = await fetchCsrf(app, { origin: DEFAULT_ORIGIN });
    const res = await attachCsrf(
      request(app)
        .post(`/api/v1/clubs/${testClub.id}/elections`)
        .set('Origin', DEFAULT_ORIGIN)
        .set('Authorization', `Bearer ${validToken}`),
      csrf,
    ).send({
      position: 'Vice President',
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data?.election?.id).toBeDefined();

    // Clean up this election (capture ID to avoid stale closure reference)
    if (res.body.data?.election?.id) {
      const electionId = res.body.data.election.id;
      cleanup.add(() => prisma.clubElection.delete({ where: { id: electionId } }), `election(${electionId})`);
    }
  });
});
