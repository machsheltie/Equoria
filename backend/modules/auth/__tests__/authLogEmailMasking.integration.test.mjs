/**
 * Server logs on the register and login paths never carry a raw email address
 * (Equoria-5vyuh; owner ruling 2026-10-19: mask it or use the user id).
 *
 * Drives the real app through supertest against the real database. The logger
 * is observed with call-through spies (its behaviour is unchanged); every
 * argument logged during the request is serialised and searched for the raw
 * address. The masked form (`m***@example.com` via maskEmailAddress) must
 * appear on register, which proves the shared helper is the one in use.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach, jest } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import supertest from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import { maskEmailAddress, maskEmailsInText } from '../../../utils/emailIdentityPolicy.mjs';
import { sendPasswordResetEmail, sendVerificationEmail } from '../../../utils/emailService.mjs';
import { fetchCsrf, attachCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const ORIGIN = 'http://localhost:3000';
// Hyphen-free: the register username validator is /^[a-zA-Z0-9_]+$/.
const TAG = `m5vyuh${randomBytes(5).toString('hex')}`;
const EMAIL = `${TAG}@example.com`;
const PASSWORD = 'TestPassword123!';
const logMethods = ['error', 'warn', 'info', 'http', 'verbose', 'debug'];

const createdUserIds = new Set();

/** Spy (call-through) on every logger level; return a reader of all logged text. */
function captureLogs() {
  const spies = logMethods.filter(m => typeof logger[m] === 'function').map(m => jest.spyOn(logger, m));
  return () =>
    spies
      .flatMap(spy => spy.mock.calls)
      .map(args =>
        args
          .map(arg => {
            if (arg instanceof Error) {
              return `${arg.message}\n${arg.stack}`;
            }
            try {
              return typeof arg === 'string' ? arg : JSON.stringify(arg);
            } catch {
              return String(arg);
            }
          })
          .join(' '),
      )
      .join('\n');
}

describe('auth server logs mask email addresses (Equoria-5vyuh)', () => {
  const cleanup = createCleanupTracker();

  beforeAll(() => {
    cleanup.add(
      () => prisma.auditLog.deleteMany({ where: { metadata: { path: ['body', 'email'], equals: EMAIL } } }),
      'auditLogs(emailTag)',
    );
    cleanup.add(
      () => prisma.auditLog.deleteMany({ where: { metadata: { path: ['username'], equals: TAG } } }),
      'auditLogs(usernameTag)',
    );
    cleanup.add(async () => {
      if (createdUserIds.size > 0) {
        await prisma.auditLog.deleteMany({ where: { userId: { in: [...createdUserIds] } } });
      }
    }, 'auditLogs(userIds)');
    cleanup.add(async () => {
      if (createdUserIds.size > 0) {
        await prisma.horse.deleteMany({ where: { userId: { in: [...createdUserIds] } } });
      }
    }, 'horses(starter)');
    cleanup.add(async () => {
      if (createdUserIds.size > 0) {
        await prisma.user.deleteMany({ where: { id: { in: [...createdUserIds] } } });
      }
    }, 'users');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(() => cleanup.run(), 120000);

  it('register logs the masked address and never the raw one', async () => {
    const readLogs = captureLogs();
    const csrf = await fetchCsrf(app, { origin: ORIGIN });
    const res = await attachCsrf(supertest(app).post('/api/v1/auth/register').set('Origin', ORIGIN), csrf).send({
      email: EMAIL,
      username: TAG,
      password: PASSWORD,
      firstName: 'Mask',
      lastName: 'Check',
      dateOfBirth: '1990-01-01',
    });

    const userId = res.body?.data?.user?.id ?? res.body?.user?.id;
    if (userId) {
      createdUserIds.add(userId);
    }
    expect([200, 201]).toContain(res.status);

    const logs = readLogs().toLowerCase();
    expect(logs).not.toContain(EMAIL.toLowerCase());
    expect(logs).toContain(maskEmailAddress(EMAIL));
  });

  it('a failed login never logs the raw address', async () => {
    const readLogs = captureLogs();
    const csrf = await fetchCsrf(app, { origin: ORIGIN });
    const res = await attachCsrf(supertest(app).post('/api/v1/auth/login').set('Origin', ORIGIN), csrf).send({
      email: EMAIL,
      password: 'WrongPassword999!',
    });

    expect(res.status).toBe(401);
    expect(readLogs().toLowerCase()).not.toContain(EMAIL.toLowerCase());
  });
});

describe('token-bearing email links stay out of logs outside development/test (Equoria-5vyuh note a)', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    jest.restoreAllMocks();
  });

  it.each([['beta'], ['beta-readiness'], ['staging']])(
    'NODE_ENV=%s: the reset and verification links (with their tokens) are not logged',
    async env => {
      const readLogs = captureLogs();
      process.env.NODE_ENV = env;
      // Non-production envs take the not-sent branch, so no provider is called.
      await sendPasswordResetEmail('jasmine@example.com', 'resettok5vyuh');
      await sendVerificationEmail('jasmine@example.com', 'verifytok5vyuh');
      process.env.NODE_ENV = originalEnv;

      const logs = readLogs();
      expect(logs).not.toContain('resettok5vyuh');
      expect(logs).not.toContain('verifytok5vyuh');
      expect(logs).not.toContain('jasmine@example.com');
    },
  );
});

describe('maskEmailsInText — percent-encoded addresses (Equoria-5vyuh note b)', () => {
  it('masks an address whose @ is %40-encoded, as in a logged URL', () => {
    const masked = maskEmailsInText('/api/v1/auth/check?email=jasmine%40example.com&x=1');
    expect(masked).not.toMatch(/jasmine/i);
    expect(masked).toContain('j***@example.com');
  });
});
