/**
 * Sentinel: forgot-password answers no sooner than a fixed floor on BOTH
 * branches (Equoria-jeci6, owner ruling J-1 2026-10-19).
 *
 * Why this exists
 * The bcrypt anchor (Equoria-54sk7) adds the same cost to both branches, but
 * the registered branch still does more work (an UPDATE + INSERT transaction
 * and the email template build). That additive difference is a timing oracle
 * for "is this email registered?". The fix makes the handler wait until
 * `startedAt + FORGOT_PASSWORD_MIN_RESPONSE_MS` before it answers, on both
 * branches, so response time no longer depends on the work done.
 *
 * What it asserts
 * - The floor constant is the owner-approved value: at least 1000 ms. A floor
 *   of 0 would make the duration check below pass vacuously.
 * - Every request, registered or unknown, takes at least the floor. Without
 *   the floor each answers in roughly 200-600 ms, so removing the floor, or
 *   applying it to only one branch, fails this deterministically.
 *
 * Why a lower bound cannot flake under load
 * Load only adds time, so it can never push a duration below the floor.
 * The 1 ms allowance (`floor - 1`) covers rounding between Node's millisecond
 * timers and this hrtime measurement. It is not a widened tolerance: it
 * loosens a lower bound by 1 ms against a 1000 ms floor.
 *
 * Real app, real DB, scoped fixture user, scoped cleanup by userId.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import request from 'supertest';

import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import * as passwordController from '../controllers/passwordController.mjs';

// Namespace import: if the export is ever removed this reads undefined and the
// assertions below fail with the measured durations, not a module load error.
const FORGOT_PASSWORD_MIN_RESPONSE_MS = passwordController.FORGOT_PASSWORD_MIN_RESPONSE_MS;

// The route validator lowercases the email, so the fixture email is lowercase.
const EMAIL_PREFIX = 'testfixture-jeci6floor';
const SAMPLES_PER_BRANCH = 4;
const OWNER_APPROVED_MIN_FLOOR_MS = 1000;

const createdUserIds = [];
let knownEmail;

beforeAll(async () => {
  const tag = randomBytes(6).toString('hex');
  knownEmail = `${EMAIL_PREFIX}-${tag}@example.com`;
  const user = await prisma.user.create({
    data: {
      username: `TestFixture-jeci6floor-${tag}`,
      email: knownEmail,
      password: await bcrypt.hash('FloorPass123!', 1),
      firstName: 'Floor',
      lastName: 'Sentinel',
      money: 0,
    },
  });
  createdUserIds.push(user.id);
}, 60000);

afterAll(async () => {
  if (createdUserIds.length) {
    await prisma.$executeRaw`DELETE FROM password_reset_tokens WHERE "userId" = ANY(${createdUserIds}::text[])`;
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  }
}, 30000);

async function timedForgot(email) {
  const start = process.hrtime.bigint();
  const res = await request(app)
    .post('/api/v1/auth/forgot-password')
    .set('Origin', 'http://localhost:3000')
    .send({ email });
  const ms = Number(process.hrtime.bigint() - start) / 1e6;
  return { ms, status: res.status };
}

describe('Sentinel: forgot-password response floor (Equoria-jeci6)', () => {
  it('the floor is the owner-approved value (at least 1000 ms)', () => {
    expect(typeof FORGOT_PASSWORD_MIN_RESPONSE_MS).toBe('number');
    expect(FORGOT_PASSWORD_MIN_RESPONSE_MS).toBeGreaterThanOrEqual(OWNER_APPROVED_MIN_FLOOR_MS);
  });

  it('registered and unknown emails both wait at least the floor before answering', async () => {
    const samples = [];
    for (let i = 0; i < SAMPLES_PER_BRANCH; i++) {
      samples.push({ branch: 'registered', ...(await timedForgot(knownEmail)) });
      samples.push({
        branch: 'unknown',
        ...(await timedForgot(`${EMAIL_PREFIX}-nobody-${randomBytes(6).toString('hex')}@example.com`)),
      });
    }

    expect(samples.map(s => s.status)).toEqual(Array(SAMPLES_PER_BRANCH * 2).fill(200));
    // Lists every sample that answered early, so a failure shows which branch
    // lost the floor and by how much.
    const early = samples
      .filter(s => !(s.ms >= FORGOT_PASSWORD_MIN_RESPONSE_MS - 1))
      .map(s => ({ branch: s.branch, ms: Math.round(s.ms) }));
    expect(early).toEqual([]);
  }, 60000);
});
