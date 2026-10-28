/**
 * Equoria-ov8ny (ACC-02) — one MFA recovery code yields one session, even
 * when several sign-ins present it at the same moment.
 *
 * Old behaviour: /mfa/challenge read the stored recovery codes, spent tens of
 * milliseconds on bcrypt compares, then wrote the "used" list back with an
 * unconditional update. Two challenges that read the codes before either
 * wrote both matched the same unused code, both wrote, and both were issued a
 * full session — the single-use code was spent twice.
 *
 * The code under test sits last in a list of six so every request spends the
 * full compare time between its read and its write; that is the window the
 * concurrent challenges overlap in.
 *
 * Real database, real HTTP, real login → challenge flow. No mocks.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import request from 'supertest';

import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createTestUser, cleanupTestUser } from '../../../__tests__/config/test-helpers.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { encryptField } from '../../../utils/fieldEncryption.mjs';
import { generateSecret } from '../services/mfaService.mjs';
import { _resetMfaLockoutsForTest } from '../services/mfaLockoutService.mjs';

const CONTENDERS = 3;
const CODE = `race-${randomBytes(4).toString('hex')}`;

let csrf;
let user;

beforeAll(async () => {
  csrf = await fetchCsrf(app);
  user = await createTestUser({
    email: `mfarace-${Date.now()}-${randomBytes(4).toString('hex')}@example.com`,
  });

  const decoys = await Promise.all(
    [0, 1, 2, 3, 4].map(async i => ({
      codeHash: await bcrypt.hash(`decoy-${i}-${randomBytes(4).toString('hex')}`, 10),
      usedAt: null,
    })),
  );
  const target = { codeHash: await bcrypt.hash(CODE, 10), usedAt: null };
  await prisma.user.update({
    where: { id: user.id },
    data: {
      mfaEnabled: true,
      mfaSecret: encryptField(generateSecret(user.email).secret),
      mfaRecoveryCodes: [...decoys, target],
    },
  });
}, 60_000);

afterAll(async () => {
  await cleanupTestUser(user?.id);
}, 30_000);

async function startChallenge() {
  const res = await request(app)
    .post('/api/v1/auth/login')
    .set('Cookie', csrf.cookieHeader)
    .set('X-CSRF-Token', csrf.csrfToken)
    .send({ email: user.email, password: user.plainPassword });
  expect(res.status).toBe(200);
  expect(res.body.data.mfaRequired).toBe(true);
  return res.body.data.mfaChallengeToken;
}

describe('Equoria-ov8ny — a recovery code is single-use under concurrent sign-ins', () => {
  it('exactly one of several simultaneous challenges with the same code gets a session', async () => {
    await _resetMfaLockoutsForTest();
    const tokens = [];
    for (let i = 0; i < CONTENDERS; i += 1) {
      tokens.push(await startChallenge());
    }

    const results = await Promise.all(
      tokens.map(mfaChallengeToken =>
        request(app)
          .post('/api/v1/auth/mfa/challenge')
          .set('Cookie', csrf.cookieHeader)
          .set('X-CSRF-Token', csrf.csrfToken)
          .send({ mfaChallengeToken, recoveryCode: CODE }),
      ),
    );

    const statuses = results.map(r => r.status).sort();
    expect(statuses.filter(s => s === 200)).toHaveLength(1);
    expect(statuses.filter(s => s === 401)).toHaveLength(CONTENDERS - 1);

    const sessions = results.filter(r => (r.headers['set-cookie'] || []).some(c => c.startsWith('accessToken=')));
    expect(sessions).toHaveLength(1);

    const stored = await prisma.user.findUnique({
      where: { id: user.id },
      select: { mfaRecoveryCodes: true },
    });
    const used = stored.mfaRecoveryCodes.filter(c => c.usedAt);
    expect(used).toHaveLength(1);
    // The decoys are untouched: only the presented code was spent.
    expect(stored.mfaRecoveryCodes.slice(0, 5).every(c => c.usedAt === null)).toBe(true);
  }, 60_000);
});
