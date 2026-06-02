/**
 * Security sentinel: username search — prefix-only match + no PII in response
 * (Equoria-o7c0x L3, CWE-200/CWE-359)
 *
 * Failing-first design: run BEFORE the fix to confirm the current code
 * exposes firstName/lastName and matches substring queries.
 *
 * After the fix these assertions must all pass:
 *   (a) firstName and lastName are ABSENT from every search result
 *   (b) A query that matches only the MIDDLE of a username returns zero results
 *       (prefix-only match; substring is closed off)
 *   (c) A query that matches the START of a username returns that user
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const ORIGIN = 'http://localhost:3000';

// Unique, unambiguous suffix so our fixture user won't collide with prod data.
// The username is: TestFixture-search-XXXX<suffix>
// We choose a suffix that sits firmly in the MIDDLE of the name so that a
// "middle" query (2 chars from the centre) cannot accidentally be a prefix too.
const SUFFIX = randomBytes(4).toString('hex'); // e.g. "a1b2c3d4"
// Full username: e.g. "TestFixture-search-a1b2c3d4"
const TEST_USERNAME = `TestFixture-search-${SUFFIX}`;

// A 2-char substring that appears ONLY in the middle of the username (never at
// the start).  We take chars from position 14 onward (after "TestFixture-sea")
// to ensure it is never also a prefix.
const MIDDLE_QUERY = TEST_USERNAME.slice(14, 16); // e.g. "rc" from "search-…"

// A prefix query: the first 11 chars ("TestFixture").  Must match from position 0.
const PREFIX_QUERY = TEST_USERNAME.slice(0, 11); // "TestFixture"

let fixtureUser;
let token;
const cleanup = createCleanupTracker();

beforeAll(async () => {
  fixtureUser = await prisma.user.create({
    data: {
      email: `TestFixture-search-${SUFFIX}@sentinel.test`,
      username: TEST_USERNAME,
      password: 'irrelevant-hash',
      firstName: 'SentinelFirst',
      lastName: 'SentinelLast',
      money: 0,
      settings: {},
    },
  });
  token = generateTestToken({ id: fixtureUser.id, email: fixtureUser.email, role: 'user' });
  // Scoped, fail-loud cleanup (Equoria-cu3t5) — only the user created above;
  // replaces a swallowed cleanup catch.
  cleanup.add(() => prisma.user.delete({ where: { id: fixtureUser.id } }), 'user');
}, 30000);

afterAll(() => cleanup.run(), 30000);

describe('GET /api/v1/users/search — security sentinel (Equoria-o7c0x L3)', () => {
  // ──────────────────────────────────────────────────────────────────────────
  // (a) PII fields must NOT appear in search results
  // ──────────────────────────────────────────────────────────────────────────
  it('(a) result objects must NOT contain firstName or lastName', async () => {
    const res = await request(app)
      .get(`/api/v1/users/search?username=${encodeURIComponent(PREFIX_QUERY)}`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const users = res.body.data.users;
    expect(Array.isArray(users)).toBe(true);

    for (const u of users) {
      expect(u).not.toHaveProperty('firstName');
      expect(u).not.toHaveProperty('lastName');
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // (b) Substring-only queries must return ZERO matches (prefix-only semantics)
  // ──────────────────────────────────────────────────────────────────────────
  it('(b) a query matching only the MIDDLE of a username returns no results', async () => {
    // MIDDLE_QUERY is chars 14-15 of TEST_USERNAME — they appear in the
    // middle, never at position 0, so startsWith must return nothing for our
    // fixture user.  We verify our fixture user is NOT in the result set.
    const res = await request(app)
      .get(`/api/v1/users/search?username=${encodeURIComponent(MIDDLE_QUERY)}`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const users = res.body.data.users;
    const found = users.some(u => u.username === TEST_USERNAME);
    expect(found).toBe(false);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // (c) A proper prefix query MUST find the fixture user
  // ──────────────────────────────────────────────────────────────────────────
  it('(c) a query matching the START of the username finds the user', async () => {
    const res = await request(app)
      .get(`/api/v1/users/search?username=${encodeURIComponent(PREFIX_QUERY)}`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const users = res.body.data.users;
    const found = users.some(u => u.username === TEST_USERNAME);
    expect(found).toBe(true);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Existing guards must still hold
  // ──────────────────────────────────────────────────────────────────────────
  it('returns 400 for query shorter than 2 chars', async () => {
    const res = await request(app)
      .get('/api/v1/users/search?username=a')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app)
      .get(`/api/v1/users/search?username=${encodeURIComponent(PREFIX_QUERY)}`)
      .set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});
