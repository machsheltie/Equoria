/**
 * Equoria-bvddn.9 — password reset read the token then marked it used
 * unconditionally, so two concurrent submissions of the same valid token
 * both succeeded.
 *
 * Failure scenario (pre-fix): fire two parallel POST /reset-password with
 * the SAME valid token and two different candidate passwords. Both read the
 * still-unused row (the SELECT ... WHERE usedAt IS NULL check, which sits
 * OUTSIDE the transaction), both then run the unconditional
 * UPDATE ... SET usedAt = NOW() WHERE id = $id inside their own
 * transaction, and both commit — whichever write lands last silently
 * overrides the other's intended new password, and the token was "used"
 * twice.
 *
 * Honesty note (per the issue's verification instructions): a plain
 * `Promise.all([reset(A), reset(B)])` against the real HTTP stack was tried
 * first and does NOT reproduce the race reliably in this environment — 6/6
 * manual runs against the UNFIXED controller returned exactly one 200 and
 * one 400, because Node's event loop + the bcrypt.hash cost + Postgres round
 * trips happen to serialize the two requests before either commits, so the
 * second request's outer SELECT already sees the first request's completed
 * write. That is NOT the fixed code closing the race — it is the harness
 * failing to open the race window at all, on EITHER version of the
 * controller. The `EXPLICIT_LOCK` test below forces the actual TOCTOU
 * window open — both real HTTP requests pass the "is it unused" read, then
 * are made to block on the SAME row lock so their writes are forced to
 * interleave exactly the way the bug report describes — instead of relying
 * on incidental scheduling.
 *
 * Real DB, real HTTP, real email-capture token, real controller — no mocked
 * Prisma/controller. The only test-only apparatus is a THIRD raw `pg`
 * connection used purely to hold a row lock open for a controlled window
 * (not a production code change, not a bypass of any security control).
 */

import { describe, it, expect, afterEach } from '@jest/globals';
import { randomBytes, createHash } from 'node:crypto';
import { readFileSync, existsSync, unlinkSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import pg from 'pg';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';

const ORIGIN = 'http://localhost:3000';
const EMAIL_PREFIX = 'bvddn9_reset_';

const sha256 = value => createHash('sha256').update(value).digest('hex');

let captureFile = null;

afterEach(async () => {
  delete process.env.EMAIL_CAPTURE_FILE;
  if (captureFile && existsSync(captureFile)) {
    unlinkSync(captureFile);
  }
  captureFile = null;

  const users = await prisma.user.findMany({
    where: { email: { startsWith: EMAIL_PREFIX } },
    select: { id: true },
  });
  const ids = users.map(u => u.id);
  if (ids.length > 0) {
    await prisma.refreshToken.deleteMany({ where: { userId: { in: ids } } });
    await prisma.$executeRawUnsafe('DELETE FROM password_reset_tokens WHERE "userId" = ANY($1::text[])', ids);
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }
});

function readCapturedResetToken() {
  const lines = readFileSync(captureFile, 'utf-8').trim().split('\n').filter(Boolean);
  const entries = lines.map(l => JSON.parse(l)).filter(e => e.kind === 'password-reset');
  const entry = entries[entries.length - 1];
  if (!entry) {
    throw new Error(`No password-reset email captured in ${captureFile}`);
  }
  return new URL(entry.preview).searchParams.get('token');
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

describe('Equoria-bvddn.9 — reset-password token cannot be consumed by two concurrent submissions', () => {
  it('EXPLICIT_LOCK sentinel: two real reset-password requests forced to race the same token — exactly one succeeds', async () => {
    const timestamp = Date.now();
    const email = `${EMAIL_PREFIX}lock_${timestamp}@example.com`;
    const originalPassword = 'OriginalPass1!Bat';
    const candidateA = 'ConcurrentA1!Batt';
    const candidateB = 'ConcurrentB2!Batt';

    captureFile = path.join(os.tmpdir(), `bvddn9-${randomBytes(8).toString('hex')}.jsonl`);
    process.env.EMAIL_CAPTURE_FILE = captureFile;

    const hashedOriginal = await bcrypt.hash(originalPassword, 1);
    await prisma.user.create({
      data: {
        username: `${EMAIL_PREFIX}lock_${timestamp}`,
        email,
        password: hashedOriginal,
        firstName: 'Concurrent',
        lastName: 'Reset',
      },
    });

    await request(app).post('/api/v1/auth/forgot-password').set('Origin', ORIGIN).send({ email });
    const rawToken = readCapturedResetToken();
    expect(rawToken).not.toBeNull();
    const tokenHash = sha256(rawToken);

    // Third connection: hold an exclusive row lock on the token row for a
    // controlled window. Neither reset-password call needs this lock to
    // pass its outer "SELECT ... WHERE usedAt IS NULL" read (a plain
    // SELECT isn't blocked by a FOR UPDATE lock under Read Committed), but
    // BOTH need it to run their UPDATE inside the transaction. Holding it
    // open forces both real requests to reach that UPDATE and queue up
    // behind the SAME lock — the exact interleaving the bug report
    // describes — instead of hoping the scheduler produces it by accident.
    const lockClient = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await lockClient.connect();
    await lockClient.query('BEGIN');
    const locked = await lockClient.query('SELECT id FROM password_reset_tokens WHERE "tokenHash" = $1 FOR UPDATE', [
      tokenHash,
    ]);
    expect(locked.rows.length).toBe(1);

    // Fire both real HTTP requests. Both will complete their outer SELECT
    // (unblocked) and then block inside prisma.$transaction trying to
    // UPDATE the locked row.
    const resultsPromise = Promise.all([
      request(app)
        .post('/api/v1/auth/reset-password')
        .set('Origin', ORIGIN)
        .send({ token: rawToken, newPassword: candidateA }),
      request(app)
        .post('/api/v1/auth/reset-password')
        .set('Origin', ORIGIN)
        .send({ token: rawToken, newPassword: candidateB }),
    ]);

    // Give both requests time to clear bcrypt + the outer SELECT and reach
    // the blocked UPDATE before we let go of the lock.
    await sleep(1500);
    await lockClient.query('COMMIT');
    await lockClient.end();

    const [resA, resB] = await resultsPromise;
    const statuses = [resA.status, resB.status].sort();

    // Exactly one of the two forced-concurrent submissions may succeed.
    // Pre-fix, the unconditional UPDATE lets BOTH transactions proceed
    // once the lock is released (both see the row as available for write
    // the instant they acquire the lock, because the WHERE clause has no
    // usedAt predicate) -> statuses would be [200, 200].
    expect(statuses).toEqual([200, 400]);

    // Whichever candidate "won" must be the ONE new working password — the
    // loser's candidate must NOT also work (that would mean both writes
    // landed, i.e. the race was not actually closed).
    const winningCandidate = resA.status === 200 ? candidateA : candidateB;
    const losingCandidate = resA.status === 200 ? candidateB : candidateA;

    const loginWinner = await request(app)
      .post('/api/v1/auth/login')
      .set('Origin', ORIGIN)
      .send({ email, password: winningCandidate });
    expect(loginWinner.status).toBe(200);

    const loginLoser = await request(app)
      .post('/api/v1/auth/login')
      .set('Origin', ORIGIN)
      .send({ email, password: losingCandidate });
    expect(loginLoser.status).toBe(401);
  }, 20_000);
});
