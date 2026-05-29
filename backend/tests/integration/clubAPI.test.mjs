/**
 * Club API Integration Tests (19B-3)
 *
 * SHARED-STATE NOTE (Equoria-4kp53):
 * - `createdClubId` is provisioned in a top-level beforeAll so all
 *   describes (join/leave, elections) work in any order. The
 *   `POST /api/clubs` describe creates and asserts its OWN club rather
 *   than mutating the shared id.
 * - The `Club Elections` describe is INTENTIONALLY SEQUENTIAL — it
 *   models the create-election → nominate → vote → results workflow,
 *   each step depending on the prior. It is consolidated below into a
 *   single `it()` block so the sequencing is explicit and no shared
 *   mutable state leaks across `it()` boundaries.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
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
  let createdClubId;

  beforeAll(async () => {
    const ts = Date.now();
    const l = await createTestUser({ username: `leader_${ts}`, email: `leader_${ts}@test.com` });
    const m = await createTestUser({ username: `member_${ts}`, email: `member_${ts}@test.com` });
    leader = l.user;
    leaderToken = l.token;
    member = m.user;
    memberToken = m.token;
  });

  // Equoria-4kp53: provision shared club fixture at top level so the
  // join/leave + elections describes are order-independent w.r.t. the
  // 'POST /api/clubs' describe.
  beforeAll(async () => {
    const res = await request(app)
      .post('/api/clubs')
      .set('Authorization', `Bearer ${leaderToken}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', __csrf__.cookieHeader)
      .set('X-CSRF-Token', __csrf__.csrfToken)
      .send({
        name: `Shared Fixture Club ${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}`,
        type: 'discipline',
        category: 'Dressage',
        description: 'Shared fixture for cross-describe reads (Equoria-4kp53)',
      });
    createdClubId = res.body?.data?.club?.id;
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
      // Equoria-4kp53: this test creates and asserts its OWN club; the
      // shared `createdClubId` is provisioned in the top-level beforeAll.
      const res = await request(app)
        .post('/api/clubs')
        .set('Authorization', `Bearer ${leaderToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({
          name: `Test Club ${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}`,
          type: 'discipline',
          category: 'Dressage',
          description: 'For dressage lovers',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.club.leaderId).toBe(leader.id);
      const ownClubId = res.body.data.club.id;

      const membership = await prisma.clubMembership.findFirst({
        where: { clubId: ownClubId, userId: leader.id },
      });
      expect(membership.role).toBe('president');
    });

    it('should reject duplicate club name', async () => {
      const clubName = `Dup Club ${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}`;
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

  // Equoria-4kp53: end-to-end election workflow consolidated into a
  // single `it()`. The create → nominate → vote → results sequence is
  // intentionally ordered (each step depends on the prior), so spreading
  // it across 6 `it()` blocks with a shared `createdElectionId` produced
  // exactly the order-dependent failure mode this fix targets.
  // The negative case (member-blocked) and one-vote enforcement are
  // included inline.
  describe('Club Elections (sequential workflow)', () => {
    it('creates → blocks-member-create → nominates → votes → blocks-duplicate-vote → returns results', async () => {
      // Re-join member so they can participate in election
      await request(app)
        .post(`/api/clubs/${createdClubId}/join`)
        .set('Authorization', `Bearer ${memberToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken);

      // Create election
      const createRes = await request(app)
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
      expect(createRes.status).toBe(201);
      const createdElectionId = createRes.body.data.election.id;

      // Block member-create
      const blockRes = await request(app)
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
      expect(blockRes.status).toBe(403);

      // Self-nominate
      const nominateRes = await request(app)
        .post(`/api/clubs/elections/${createdElectionId}/nominate`)
        .set('Authorization', `Bearer ${memberToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({ statement: 'I will work hard!' });
      expect(nominateRes.status).toBe(201);

      // Vote
      const candidate = await prisma.clubCandidate.findFirst({
        where: { electionId: createdElectionId, userId: member.id },
      });
      const voteRes = await request(app)
        .post(`/api/clubs/elections/${createdElectionId}/vote`)
        .set('Authorization', `Bearer ${leaderToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({ candidateId: candidate.id });
      expect(voteRes.status).toBe(201);

      // Reject duplicate vote
      const dupVoteRes = await request(app)
        .post(`/api/clubs/elections/${createdElectionId}/vote`)
        .set('Authorization', `Bearer ${leaderToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({ candidateId: candidate.id });
      expect(dupVoteRes.status).toBe(409);

      // Results
      const resultsRes = await request(app)
        .get(`/api/clubs/elections/${createdElectionId}/results`)
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', `Bearer ${leaderToken}`);
      expect(resultsRes.status).toBe(200);
      expect(Array.isArray(resultsRes.body.data.candidates)).toBe(true);
      expect(resultsRes.body.data.candidates[0].voteCount).toBeDefined();
    });
  });
});
