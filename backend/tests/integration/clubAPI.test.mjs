/**
 * Club API Integration Tests (19B-3)
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { createTestUser, cleanupTestData } from '../helpers/testAuth.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';
import app from '../../app.mjs';

import { fetchCsrf } from '../helpers/csrfHelper.mjs';
describe('🏇 INTEGRATION: Club API', () => {
  let __csrf__;
  beforeAll(async () => {
    __csrf__ = await fetchCsrf(app);
  });

  let leader, leaderToken, member, memberToken;
  let createdClubId, createdElectionId;

  beforeAll(async () => {
    const ts = Date.now();
    const l = await createTestUser({ username: `leader_${ts}`, email: `leader_${ts}@test.com` });
    const m = await createTestUser({ username: `member_${ts}`, email: `member_${ts}@test.com` });
    leader = l.user;
    leaderToken = l.token;
    member = m.user;
    memberToken = m.token;
  });

  afterAll(async () => {
    try {
      const clubs = await prisma.club.findMany({ where: { leaderId: leader?.id } });
      for (const club of clubs) {
        await prisma.clubBallot.deleteMany({
          where: { candidate: { election: { clubId: club.id } } },
        });
        await prisma.clubCandidate.deleteMany({ where: { election: { clubId: club.id } } });
        await prisma.clubElection.deleteMany({ where: { clubId: club.id } });
        await prisma.clubMembership.deleteMany({ where: { clubId: club.id } });
      }
      await prisma.club.deleteMany({ where: { leaderId: leader?.id } });
    } catch {
      /* ignore */
    }
    await cleanupTestData();
  });

  describe('POST /api/clubs', () => {
    it('should create a club and auto-add leader as president', async () => {
      const res = await request(app)
        .post('/api/clubs')
        .set('Authorization', `Bearer ${leaderToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({
          name: `Test Club ${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          type: 'discipline',
          category: 'Dressage',
          description: 'For dressage lovers',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.club.leaderId).toBe(leader.id);
      createdClubId = res.body.data.club.id;

      const membership = await prisma.clubMembership.findFirst({
        where: { clubId: createdClubId, userId: leader.id },
      });
      expect(membership.role).toBe('president');
    });

    it('should reject duplicate club name', async () => {
      const clubName = `Dup Club ${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      await request(app)
        .post('/api/clubs')
        .set('Authorization', `Bearer ${leaderToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({ name: clubName, type: 'breed', category: 'Thoroughbred', description: 'Test' });
      const res = await request(app)
        .post('/api/clubs')
        .set('Authorization', `Bearer ${leaderToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({ name: clubName, type: 'breed', category: 'Thoroughbred', description: 'Test' });
      expect(res.status).toBe(409);
    });
  });

  describe('GET /api/clubs', () => {
    it('should list all clubs', async () => {
      const res = await request(app)
        .get('/api/clubs')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${memberToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.clubs)).toBe(true);
    });

    it('should filter by type', async () => {
      const res = await request(app)
        .get('/api/clubs?type=discipline')
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${memberToken}`);
      const clubs = res.body.data.clubs;
      expect(clubs.every(c => c.type === 'discipline')).toBe(true);
    });
  });

  describe('POST /api/clubs/:id/join + DELETE /api/clubs/:id/leave', () => {
    it('should join a club as member', async () => {
      const res = await request(app)
        .post(`/api/clubs/${createdClubId}/join`)
        .set('Authorization', `Bearer ${memberToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken);
      expect(res.status).toBe(201);
      expect(res.body.data.membership.role).toBe('member');
    });

    it('should reject joining twice', async () => {
      const res = await request(app)
        .post(`/api/clubs/${createdClubId}/join`)
        .set('Authorization', `Bearer ${memberToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken);
      expect(res.status).toBe(409);
    });

    it('should leave a club', async () => {
      const res = await request(app)
        .delete(`/api/clubs/${createdClubId}/leave`)
        .set('Authorization', `Bearer ${memberToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken);
      expect(res.status).toBe(200);
    });
  });

  describe('Club Elections', () => {
    beforeAll(async () => {
      // re-join member so they can participate in election
      await request(app)
        .post(`/api/clubs/${createdClubId}/join`)
        .set('Authorization', `Bearer ${memberToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken);
    });

    it('should create an election (president only)', async () => {
      const res = await request(app)
        .post(`/api/clubs/${createdClubId}/elections`)
        .set('Authorization', `Bearer ${leaderToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({
          position: 'Club Secretary',
          startsAt: new Date(Date.now() - 1000).toISOString(),
          endsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        });
      expect(res.status).toBe(201);
      createdElectionId = res.body.data.election.id;
    });

    it('should block election creation by regular member', async () => {
      const res = await request(app)
        .post(`/api/clubs/${createdClubId}/elections`)
        .set('Authorization', `Bearer ${memberToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({
          position: 'Fake Officer',
          startsAt: new Date().toISOString(),
          endsAt: new Date().toISOString(),
        });
      expect(res.status).toBe(403);
    });

    it('should self-nominate for election', async () => {
      const res = await request(app)
        .post(`/api/clubs/elections/${createdElectionId}/nominate`)
        .set('Authorization', `Bearer ${memberToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({ statement: 'I will work hard!' });
      expect(res.status).toBe(201);
    });

    it('should cast a vote', async () => {
      const candidateRes = await prisma.clubCandidate.findFirst({
        where: { electionId: createdElectionId, userId: member.id },
      });
      const res = await request(app)
        .post(`/api/clubs/elections/${createdElectionId}/vote`)
        .set('Authorization', `Bearer ${leaderToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({ candidateId: candidateRes.id });
      expect(res.status).toBe(201);
    });

    it('should enforce one vote per election', async () => {
      const candidateRes = await prisma.clubCandidate.findFirst({
        where: { electionId: createdElectionId },
      });
      const res = await request(app)
        .post(`/api/clubs/elections/${createdElectionId}/vote`)
        .set('Authorization', `Bearer ${leaderToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({ candidateId: candidateRes.id });
      expect(res.status).toBe(409);
    });

    it('should return election results', async () => {
      const res = await request(app)
        .get(`/api/clubs/elections/${createdElectionId}/results`)
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${leaderToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.candidates)).toBe(true);
      expect(res.body.data.candidates[0].voteCount).toBeDefined();
    });
  });
});
