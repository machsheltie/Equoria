/**
 * Shared real-HTTP fixtures for staff integration suites (Equoria-puj1e.1).
 *
 * Staff users are real rows; check-in goes through the real routes, with the
 * code read back from the email service's own non-production sink
 * (EMAIL_CAPTURE_FILE). Nothing is mocked.
 */

import crypto from 'node:crypto';
import { readFileSync, existsSync, unlinkSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { expect } from '@jest/globals';
import app from '../../../../app.mjs';
import prisma from '../../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../../tests/helpers/csrfHelper.mjs';

export const ORIGIN = 'http://localhost:3000';
export const STAFF_API = '/api/v1/staff';

export const uid = () => crypto.randomBytes(5).toString('hex');
export const sha256 = value => crypto.createHash('sha256').update(value, 'utf8').digest('hex');

let captureFile = null;

/** Point the email sink at a fresh file. Call from beforeEach. */
export function startEmailCapture() {
  captureFile = path.join(
    os.tmpdir(),
    `staff-checkin-${crypto.randomBytes(8).toString('hex')}.jsonl`,
  );
  process.env.EMAIL_CAPTURE_FILE = captureFile;
}

/** Remove the sink file. Call from afterEach. */
export function stopEmailCapture() {
  delete process.env.EMAIL_CAPTURE_FILE;
  if (captureFile && existsSync(captureFile)) {
    unlinkSync(captureFile);
  }
  captureFile = null;
}

/**
 * Fixture-user factory. `createdUserIds` is the array to scope cleanup by.
 * @param {string} prefix e.g. 'staffmfa'
 */
export function createUserFactory(prefix) {
  const createdUserIds = [];
  async function makeUser(role, extra = {}) {
    const suffix = `${uid()}${uid()}`;
    const row = await prisma.user.create({
      data: {
        email: `${prefix}-${suffix}@test.com`,
        username: `${prefix}${suffix}`,
        password: 'not-a-real-hash',
        firstName: 'Staff',
        lastName: 'Fixture',
        role,
        settings: {},
        emailVerified: true,
        emailVerifiedAt: new Date(),
        ...extra,
      },
    });
    createdUserIds.push(row.id);
    return { ...row, token: generateTestToken({ id: row.id, email: row.email, role }) };
  }
  return { makeUser, createdUserIds };
}

export const cookiesFor = (user, device) =>
  device ? [`accessToken=${user.token}`, `staff_device=${device}`] : [`accessToken=${user.token}`];

export const get = (url, user, device) =>
  request(app).get(url).set('Origin', ORIGIN).set('Cookie', cookiesFor(user, device));

export async function post(url, user, body = {}, device) {
  const csrf = await fetchCsrf(app, { origin: ORIGIN, extraCookies: cookiesFor(user, device) });
  return request(app)
    .post(url)
    .set('Origin', ORIGIN)
    .set('Cookie', csrf.cookieHeader)
    .set('X-CSRF-Token', csrf.csrfToken)
    .send(body);
}

export function capturedFor(email) {
  if (!captureFile || !existsSync(captureFile)) {
    return [];
  }
  return readFileSync(captureFile, 'utf-8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map(line => JSON.parse(line))
    .filter(entry => entry.kind === 'staff-checkin' && entry.to === email);
}

export function latestCode(email) {
  const entry = capturedFor(email).at(-1);
  if (!entry) {
    throw new Error(`No staff-checkin email captured for ${email}`);
  }
  return entry.preview.match(/\b(\d{6})\b/)[1];
}

export const wrongCodeFor = code => String((Number(code) + 1) % 1_000_000).padStart(6, '0');

export function deviceCookieFrom(res) {
  const raw = (res.headers['set-cookie'] || []).find(c => c.startsWith('staff_device='));
  return raw ?? null;
}

/** Full real check-in for a user; returns the raw device token. */
export async function checkIn(user) {
  expect((await post(`${STAFF_API}/checkin/request`, user)).status).toBe(202);
  const res = await post(`${STAFF_API}/checkin/verify`, user, { code: latestCode(user.email) });
  expect(res.status).toBe(200);
  const cookie = deviceCookieFrom(res);
  expect(cookie).not.toBeNull();
  return cookie.split(';')[0].slice('staff_device='.length);
}
