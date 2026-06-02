/**
 * CWE-639 Wave-6 Sweep — sentinel tests for the post-wave-5 audit findings.
 *
 * After wave 5 closed the message + competition triplet, an adjacent-locations
 * audit (OPTIMAL_FIX_DISCIPLINE.md §3) of every other 403 in backend/modules
 * found two more cross-user existence-disclosure leaks in clubController:
 *
 *   - Equoria-w386 — clubController.nominate (POST /api/v1/clubs/elections/:id/nominate)
 *   - Equoria-c1cv — clubController.vote     (POST /api/v1/clubs/elections/:id/vote)
 *
 * Both endpoints did "find election by id, then check membership" so a
 * non-member of the election's club received 403 while a non-existent
 * electionId received 404 — letting an attacker enumerate live election IDs.
 *
 * Each test asserts cross-user (non-member) access returns 404 (not 403) AND
 * that the response body is byte-identical to the not-exists case. Closed-
 * election (400) leaks via member-only paths are also implicitly closed: the
 * status check now lives BEHIND the membership-scoped lookup, so closed-but-
 * exists is invisible to non-members.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import { randomBytes } from 'node:crypto';
import app from '../app.mjs';
import prisma from '../../packages/database/prismaClient.mjs';
import { createMockToken } from '../__tests__/factories/index.mjs';
import { fetchCsrf } from '../tests/helpers/csrfHelper.mjs';
// Equoria-1ohys: fail-loud scoped cleanup. A cleanup delete that fails must
// FAIL the suite (not be swallowed by a silent no-op catch arm), so a leaked
// club/election/membership IDOR fixture surfaces at the source instead of
// accumulating silently in the canonical DB.
import { createCleanupTracker } from './helpers/failLoudCleanup.mjs';

describe('CWE-639 wave-6 sweep (Equoria-9ov8 post-wave-5 audit)', () => {
  // Equoria-0ys7m / Equoria-plw0h per-user CSRF binding: the attacker
  // (stranger) and strangerToken are minted per-test in beforeEach, so the
  // CSRF token must be (re-)issued under stranger inside beforeEach too. An
  // anonymous beforeAll fetch (CSRF_SESSION_SALT identifier) would
  // HMAC-mismatch strangerToken's req.user.id and 403 the nominate/vote
  // mutations before the membership-scoped lookup runs, masking the real
  // CWE-639 404-not-403 / byte-identical assertions.
  let __csrf__;
  let leader; // president of the club — member
  let stranger; // not a member
  let strangerToken;
  let club;
  let openElection;
  const cleanup = createCleanupTracker();

  const NONEXISTENT_ELECTION_ID = 999999999;

  beforeEach(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-for-testing-only-32chars';

    leader = await prisma.user.create({
      data: {
        email: `cwe639w6lead-${randomBytes(8).toString('hex')}@example.com`,
        username: `cwe639w6lead-${randomBytes(8).toString('hex')}`,
        password: 'hashedPassword123',
        firstName: 'Cwe',
        lastName: 'W6L',
        emailVerified: true,
      },
    });
    stranger = await prisma.user.create({
      data: {
        email: `cwe639w6str-${randomBytes(8).toString('hex')}@example.com`,
        username: `cwe639w6str-${randomBytes(8).toString('hex')}`,
        password: 'hashedPassword123',
        firstName: 'Cwe',
        lastName: 'W6S',
        emailVerified: true,
      },
    });

    strangerToken = createMockToken(stranger.id, {
      payload: { email: stranger.email, role: stranger.role || 'user' },
    });

    // Equoria-plw0h: issue the CSRF token under the stranger by forwarding the
    // access token cookie on the GET /csrf-token call. getCsrfToken decodes it
    // best-effort and binds the token's sessionIdentifier to stranger.id — the
    // same identifier authenticateToken resolves for the nominate/vote Bearer
    // mutations below, so csrfProtection validates instead of 403ing.
    __csrf__ = await fetchCsrf(app, { extraCookies: [`accessToken=${strangerToken}`] });

    club = await prisma.club.create({
      data: {
        name: `cwe639w6-${randomBytes(8).toString('hex')}`,
        type: 'discipline',
        category: 'racing',
        description: 'CWE-639 wave-6 sweep test club',
        leader: { connect: { id: leader.id } },
        members: { create: { user: { connect: { id: leader.id } }, role: 'president' } },
      },
    });

    openElection = await prisma.clubElection.create({
      data: {
        club: { connect: { id: club.id } },
        position: 'vice-president',
        status: 'open',
        startsAt: new Date(Date.now() - 1000),
        endsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    // Equoria-1ohys: register scoped, fail-loud cleanup in FK-delete order
    // (ballot → candidate → election → membership → club → refreshToken →
    // user; children before parents). Replaces the swallowed no-op catch arms
    // on the club-graph deletes — a cleanup failure now fails the suite.
    // Scoped by electionId / clubId / user id — never a bare deleteMany
    // (CLAUDE.md §2).
    cleanup.add(
      () => prisma.clubBallot.deleteMany({ where: { electionId: openElection?.id ?? -1 } }),
      'clubBallot',
    );
    cleanup.add(
      () => prisma.clubCandidate.deleteMany({ where: { electionId: openElection?.id ?? -1 } }),
      'clubCandidate',
    );
    cleanup.add(
      () => (club?.id ? prisma.clubElection.deleteMany({ where: { clubId: club.id } }) : undefined),
      'clubElection',
    );
    cleanup.add(
      () => (club?.id ? prisma.clubMembership.deleteMany({ where: { clubId: club.id } }) : undefined),
      'clubMembership',
    );
    cleanup.add(
      () => (club?.id ? prisma.club.delete({ where: { id: club.id } }) : undefined),
      'club',
    );
    cleanup.add(() => {
      const ids = [leader?.id, stranger?.id].filter(Boolean);
      return ids.length > 0
        ? prisma.refreshToken.deleteMany({ where: { userId: { in: ids } } })
        : undefined;
    }, 'refreshToken');
    cleanup.add(() => {
      const ids = [leader?.id, stranger?.id].filter(Boolean);
      return ids.length > 0
        ? prisma.user.deleteMany({ where: { id: { in: ids } } })
        : undefined;
    }, 'user');
  });

  afterEach(() => cleanup.run());

  // ─── Equoria-w386 ────────────────────────────────────────────────────────
  describe('clubController.nominate POST /api/v1/clubs/elections/:id/nominate', () => {
    it('returns 404 for non-member with byte-identical response to not-exists', async () => {
      // Cross-user (non-member) case: stranger nominating in leader's club's election
      const resCrossUser = await request(app)
        .post(`/api/v1/clubs/elections/${openElection.id}/nominate`)
        .set('Authorization', `Bearer ${strangerToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({ statement: 'I should not see this election' });

      expect(resCrossUser.status).toBe(404);
      expect(resCrossUser.body).toMatchObject({ success: false, message: 'Election not found' });

      // Not-exists case
      const resMissing = await request(app)
        .post(`/api/v1/clubs/elections/${NONEXISTENT_ELECTION_ID}/nominate`)
        .set('Authorization', `Bearer ${strangerToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({ statement: 'No such election' });

      expect(resMissing.status).toBe(404);
      // Byte-identical sentinel — divergence enables election ID enumeration.
      expect(resMissing.body).toEqual(resCrossUser.body);

      // Confirm no candidate row was created for the stranger.
      const candidate = await prisma.clubCandidate.findFirst({
        where: { electionId: openElection.id, userId: stranger.id },
      });
      expect(candidate).toBeNull();
    });
  });

  // ─── Equoria-c1cv ────────────────────────────────────────────────────────
  describe('clubController.vote POST /api/v1/clubs/elections/:id/vote', () => {
    it('returns 404 for non-member with byte-identical response to not-exists', async () => {
      // Set up a real candidate so the vote handler has something to find if
      // membership scoping were broken.
      const candidate = await prisma.clubCandidate.create({
        data: {
          election: { connect: { id: openElection.id } },
          user: { connect: { id: leader.id } },
          statement: 'leader candidacy',
        },
      });

      // Cross-user (non-member) case: stranger voting in leader's club's election
      const resCrossUser = await request(app)
        .post(`/api/v1/clubs/elections/${openElection.id}/vote`)
        .set('Authorization', `Bearer ${strangerToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({ candidateId: candidate.id });

      expect(resCrossUser.status).toBe(404);
      expect(resCrossUser.body).toMatchObject({ success: false, message: 'Election not found' });

      // Not-exists case
      const resMissing = await request(app)
        .post(`/api/v1/clubs/elections/${NONEXISTENT_ELECTION_ID}/vote`)
        .set('Authorization', `Bearer ${strangerToken}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({ candidateId: candidate.id });

      expect(resMissing.status).toBe(404);
      // Byte-identical sentinel
      expect(resMissing.body).toEqual(resCrossUser.body);

      // Confirm no ballot row was created for the stranger.
      const ballot = await prisma.clubBallot.findFirst({
        where: { electionId: openElection.id, voterId: stranger.id },
      });
      expect(ballot).toBeNull();
    });
  });
});
