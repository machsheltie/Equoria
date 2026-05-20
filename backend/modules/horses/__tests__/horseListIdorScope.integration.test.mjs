/**
 * GET /api/v1/horses — IDOR scope enforcement (Equoria-tzyv8, CWE-639)
 *
 * Asserts:
 *  1. IDOR-NEGATIVE: a non-admin attacker supplying ?userId=<victimId>
 *     does NOT receive the victim's horses — only their own (or empty list).
 *  2. SELF-SCOPE: a normal user with no ?userId param gets only their own horses.
 *  3. SELF-SCOPE with own id: a normal user passing their OWN userId gets
 *     only their own horses (no crash, no data leakage).
 *  4. ADMIN-OVERRIDE: an admin user supplying ?userId=<targetId> does receive
 *     the target's horses (legitimate admin tooling).
 *
 * Setup:
 *  - attackerUser  owns attackerHorse
 *  - victimUser    owns victimHorse
 *  - adminUser     owns no horses in this fixture (admin querying victim's horses)
 *
 * No mocks. Real DB. Real JWT tokens. No bypass headers.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createTestHorse, cleanupTestHorses } from '../../../__tests__/helpers/createTestHorse.mjs';
import config from '../../../config/config.mjs';

const FIXTURE_PREFIX = 'TestFixture-idor-scope';

// Fixture state
let attackerUser;
let attackerToken;
let victimUser;
let victimToken;
let adminUser;
let adminToken;

let attackerHorse;
let victimHorse;

const createdHorseIds = [];
const createdUserIds = [];

// Helper: create a real DB user and a real JWT for that user
async function makeUser(suffix, role = 'user') {
  const tag = randomBytes(4).toString('hex');
  const pw = await bcrypt.hash('TestPassword123!', 1); // low rounds for test speed
  const user = await prisma.user.create({
    data: {
      username: `${FIXTURE_PREFIX}-${suffix}-${tag}`,
      email: `${FIXTURE_PREFIX}-${suffix}-${tag}@example.com`,
      password: pw,
      firstName: 'IDORTest',
      lastName: suffix,
      role,
    },
  });
  createdUserIds.push(user.id);

  // Real JWT signed with the app's secret — same as production auth flow
  const token = jwt.sign({ id: user.id, role: user.role }, config.jwtSecret, {
    expiresIn: '1h',
  });
  return { user, token };
}

beforeAll(async () => {
  // Create three users: attacker, victim, admin
  ({ user: attackerUser, token: attackerToken } = await makeUser('attacker'));
  ({ user: victimUser, token: victimToken } = await makeUser('victim'));
  ({ user: adminUser, token: adminToken } = await makeUser('admin', 'admin'));

  // Create one horse per user (attacker + victim); admin has none
  attackerHorse = await createTestHorse(
    prisma,
    {
      name: `${FIXTURE_PREFIX}-attacker-horse`,
      sex: 'Mare',
      dateOfBirth: new Date('2020-01-01'),
      userId: attackerUser.id,
    },
    createdHorseIds,
  );

  victimHorse = await createTestHorse(
    prisma,
    {
      name: `${FIXTURE_PREFIX}-victim-horse`,
      sex: 'Stallion',
      dateOfBirth: new Date('2019-06-15'),
      userId: victimUser.id,
    },
    createdHorseIds,
  );
}, 120000);

afterAll(async () => {
  // Scoped cleanup — only the rows this suite created
  await cleanupTestHorses(prisma, createdHorseIds);
  if (createdUserIds.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    createdUserIds.length = 0;
  }
});

describe('GET /api/v1/horses — IDOR scope enforcement (Equoria-tzyv8)', () => {
  // ─── Test 1: IDOR exploit attempt ────────────────────────────────────────
  it('IDOR-NEGATIVE: attacker cannot see victim horses via ?userId=<victimId>', async () => {
    const res = await request(app)
      .get(`/api/v1/horses?userId=${victimUser.id}`)
      .set('Authorization', `Bearer ${attackerToken}`)
      .set('Origin', 'http://localhost:3000');

    expect(res.status).toBe(200);

    // The victim's horse must NOT appear in the attacker's response
    const returnedIds = (res.body.data || []).map((h) => h.id);
    expect(returnedIds).not.toContain(victimHorse.id);

    // The attacker's OWN horse MUST appear — silent self-scope guarantees it.
    // This prevents the test from vacuously passing on an empty or error response.
    expect(returnedIds).toContain(attackerHorse.id);
  });

  // ─── Test 2: normal user — no userId param — sees own horses ─────────────
  it('SELF-SCOPE: normal user with no ?userId sees only their own horses', async () => {
    const res = await request(app)
      .get('/api/v1/horses')
      .set('Authorization', `Bearer ${attackerToken}`)
      .set('Origin', 'http://localhost:3000');

    expect(res.status).toBe(200);

    const returnedIds = (res.body.data || []).map((h) => h.id);
    // Own horse is present
    expect(returnedIds).toContain(attackerHorse.id);
    // Victim's horse is absent
    expect(returnedIds).not.toContain(victimHorse.id);
  });

  // ─── Test 3: normal user passes their OWN userId — still only sees self ──
  it('SELF-SCOPE-WITH-OWN-ID: non-admin passing own userId gets their own horses only', async () => {
    const res = await request(app)
      .get(`/api/v1/horses?userId=${attackerUser.id}`)
      .set('Authorization', `Bearer ${attackerToken}`)
      .set('Origin', 'http://localhost:3000');

    expect(res.status).toBe(200);

    const returnedIds = (res.body.data || []).map((h) => h.id);
    expect(returnedIds).toContain(attackerHorse.id);
    expect(returnedIds).not.toContain(victimHorse.id);
  });

  // ─── Test 4: victim's own request is also only victim's horses ───────────
  it('SELF-SCOPE: victim with no ?userId param sees only their own horses', async () => {
    const res = await request(app)
      .get('/api/v1/horses')
      .set('Authorization', `Bearer ${victimToken}`)
      .set('Origin', 'http://localhost:3000');

    expect(res.status).toBe(200);

    const returnedIds = (res.body.data || []).map((h) => h.id);
    expect(returnedIds).toContain(victimHorse.id);
    expect(returnedIds).not.toContain(attackerHorse.id);
  });

  // ─── Test 5: admin CAN use ?userId to see another user's horses ──────────
  it('ADMIN-OVERRIDE: admin with ?userId=<victimId> receives the victim horse', async () => {
    const res = await request(app)
      .get(`/api/v1/horses?userId=${victimUser.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Origin', 'http://localhost:3000');

    expect(res.status).toBe(200);

    const returnedIds = (res.body.data || []).map((h) => h.id);
    expect(returnedIds).toContain(victimHorse.id);
  });

  // ─── Test 6: unauthenticated request is rejected ─────────────────────────
  it('UNAUTH: request without token is rejected with 401 or 403', async () => {
    const res = await request(app)
      .get('/api/v1/horses')
      .set('Origin', 'http://localhost:3000');

    expect([401, 403]).toContain(res.status);
  });
});
