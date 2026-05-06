/**
 * Session-Lifetime Regression Tests (21R-AUTH-6)
 *
 * Proves that the token refresh flow survives access-token expiry and that
 * expired tokens are correctly rejected.  No bypass headers, no test.skip,
 * no mocked Prisma calls — real credentials, real DB, real middleware.
 *
 * Covers:
 *   (a) cookieConfig exports TTL constants + getNow clock injection
 *   (b) refreshToken cookie (Path=/) works on /api/v1/auth/refresh-token
 *   (c) Expired accessToken is rejected by protected route (401)
 *   (d) Valid refreshToken issues a fresh accessToken after access-token expiry
 *   (e) Refreshed accessToken authenticates a protected route
 *   (f) Expired refreshToken is rejected by the refresh endpoint (401)
 *
 * Route consolidation (Equoria-grt / 21R-AUTH-7) complete: /api/v1/auth/* is
 * now the single canonical auth prefix. Legacy /auth/* mounts removed.
 */

import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../app.mjs';
import prisma from '../../db/index.mjs';
import { ACCESS_TOKEN_TTL_MS, REFRESH_TOKEN_TTL_MS, getNow, _setNowFn } from '../../utils/cookieConfig.mjs';

const SUITE_PREFIX = 'seslife21r';

const credentials = {
  email: `${SUITE_PREFIX}-main@example.com`,
  password: 'SesLife1!Aa',
  username: `${SUITE_PREFIX}_main`,
  firstName: 'Ses',
  lastName: 'Life',
};

let testUser;
let server;

async function cleanupSuiteUsers() {
  const rows = await prisma.user.findMany({
    where: {
      OR: [{ email: { startsWith: `${SUITE_PREFIX}-` } }, { username: { startsWith: `${SUITE_PREFIX}_` } }],
    },
    select: { id: true },
  });
  if (rows.length > 0) {
    const ids = rows.map(u => u.id);
    await prisma.refreshToken.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }
}

beforeAll(async () => {
  server = app.listen(0);
  await cleanupSuiteUsers();

  const res = await request(app).post('/api/v1/auth/register').set('Origin', 'http://localhost:3000').send(credentials);
  expect(res.status).toBe(201);
  testUser = res.body.data.user;
});

afterAll(async () => {
  await cleanupSuiteUsers();
  if (server) {
    await new Promise(resolve => server.close(resolve));
  }
});

// Returns a fresh { refreshCookie, accessCookie, allCookies } by logging in.
// Token rotation invalidates each refresh token on first use, so every
// sub-test that consumes a refresh token must call loginFresh() independently.
async function loginFresh() {
  const res = await request(app)
    .post('/api/v1/auth/login')
    .set('Origin', 'http://localhost:3000')
    .send({ email: credentials.email, password: credentials.password });
  expect(res.status).toBe(200);
  const cookies = res.headers['set-cookie'];
  return {
    allCookies: cookies,
    refreshCookie: cookies.find(c => c.startsWith('refreshToken=')),
    accessCookie: cookies.find(c => c.startsWith('accessToken=')),
  };
}

// ─── (a) Clock injection ──────────────────────────────────────────────────────

describe('cookieConfig clock injection exports (21R-AUTH-6 contract)', () => {
  it('exports ACCESS_TOKEN_TTL_MS matching the 15-minute cookie maxAge', () => {
    expect(ACCESS_TOKEN_TTL_MS).toBe(15 * 60 * 1000);
  });

  it('exports REFRESH_TOKEN_TTL_MS matching the 7-day cookie maxAge', () => {
    expect(REFRESH_TOKEN_TTL_MS).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it('getNow() defaults to real wall-clock time', () => {
    const before = Date.now();
    const now = getNow();
    const after = Date.now();
    expect(now).toBeGreaterThanOrEqual(before);
    expect(now).toBeLessThanOrEqual(after);
  });

  it('_setNowFn allows test clock override and reset', () => {
    const FUTURE = Date.now() + REFRESH_TOKEN_TTL_MS + 1000;
    _setNowFn(() => FUTURE);
    expect(getNow()).toBe(FUTURE);
    _setNowFn(null); // reset to Date.now
    expect(getNow()).toBeGreaterThan(0);
    expect(getNow()).toBeLessThanOrEqual(Date.now() + 1);
  });
});

// ─── (b) Refresh aliases ─────────────────────────────────────────────────────

describe('refreshToken cookie (Path=/) works on both route aliases', () => {
  it('POST /api/v1/auth/refresh-token accepts the cookie and rotates tokens', async () => {
    const { refreshCookie } = await loginFresh();
    const res = await request(app)
      .post('/api/v1/auth/refresh-token')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', [refreshCookie])
      .expect(200);

    expect(res.body.status).toBe('success');
    expect(res.body.message).toBe('Token refreshed successfully');

    const newAccess = res.headers['set-cookie']?.find(c => c.startsWith('accessToken='));
    expect(newAccess).toBeDefined();
    expect(newAccess).toContain('HttpOnly');
  });

  it('POST /api/v1/auth/refresh-token accepts the cookie via canonical path', async () => {
    const { refreshCookie } = await loginFresh();
    const res = await request(app)
      .post('/api/v1/auth/refresh-token')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', [refreshCookie])
      .expect(200);

    expect(res.body.status).toBe('success');
  });

  it('refreshToken cookie Path=/ attribute lets both aliases receive it', async () => {
    const { refreshCookie } = await loginFresh();
    // Confirm the cookie carries Path=/ so all route aliases see it.
    expect(refreshCookie).toMatch(/;\s*Path=\/(;|$)/i);
  });
});

// ─── (c) Expired access token rejected ───────────────────────────────────────

describe('expired accessToken is rejected by protected routes', () => {
  it('returns 401 when accessToken cookie holds an already-expired JWT', async () => {
    const expiredAccess = jwt.sign(
      { userId: testUser.id, email: credentials.email },
      process.env.JWT_SECRET,
      { expiresIn: '-1s' }, // negative expiry → expired the moment it is signed
    );

    await request(app)
      .get('/api/v1/auth/profile')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', [`accessToken=${expiredAccess}`])
      .expect(401);
  });
});

// ─── (d + e) Refresh restores session after access-token expiry ──────────────

describe('valid refreshToken restores session after access-token expiry', () => {
  it('issues a new accessToken via /api/v1/auth/refresh-token', async () => {
    const { refreshCookie } = await loginFresh();

    const res = await request(app)
      .post('/api/v1/auth/refresh-token')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', [refreshCookie])
      .expect(200);

    const newAccessCookie = res.headers['set-cookie']?.find(c => c.startsWith('accessToken='));
    expect(newAccessCookie).toBeDefined();
    // Store on the describe-level scope so the next test can use it.
    // (tests are sequential within a describe block)
    _refreshedAccessCookie = newAccessCookie;
  });

  let _refreshedAccessCookie;

  it('the refreshed accessToken authenticates a protected route', async () => {
    expect(_refreshedAccessCookie).toBeDefined();

    const res = await request(app)
      .get('/api/v1/auth/profile')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', [_refreshedAccessCookie])
      .expect(200);

    expect(res.body.data.user.email).toBe(credentials.email);
  });
});

// ─── (f) Expired refresh token rejected ──────────────────────────────────────

describe('expired refreshToken is rejected by the refresh endpoint', () => {
  it('returns 401 when refreshToken cookie holds an already-expired JWT', async () => {
    const expiredRefresh = jwt.sign(
      { userId: testUser.id, type: 'refresh', familyId: 'test-family' },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: '-1s' },
    );

    const res = await request(app)
      .post('/api/v1/auth/refresh-token')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', [`refreshToken=${expiredRefresh}`])
      .expect(401);

    expect(res.body).toMatchObject({ success: false });
  });
});
