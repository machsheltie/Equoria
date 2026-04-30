/**
 * 🔒 INTEGRATION TESTS: urlencoded duplicate-key rejection (21R-SEC-5, Equoria-lf3z)
 *
 * Background. `verifyJsonBody` (from 21R-SEC-3 / 21R-SEC-1) blocks the
 * duplicate-key parameter-pollution class on `application/json` bodies.
 * The companion parser `express.urlencoded` had NO equivalent verify hook
 * — `name=Valid&name=Hacked` with Content-Type
 * `application/x-www-form-urlencoded` would reach the controller as
 * `{ name: ['Valid', 'Hacked'] }` (qs-extended) or `'Hacked'`
 * (last-value-wins, plain). Either form reopens the same pollution
 * attack vector through the urlencoded parser.
 *
 * AC (Equoria-lf3z):
 *   - urlencoded body parsing rejects duplicate keys with 400
 *   - PUT/POST with `Content-Type: application/x-www-form-urlencoded`
 *     and body `name=Valid&name=Hacked` returns 400
 *   - Existing legitimate single-key urlencoded usage continues to work
 *
 * RED-first per EDGE_CASE_FIX_DISCIPLINE Rule 1: tests in this file
 * MUST fail before the `verifyUrlEncodedBody` hook is wired into
 * app.mjs and pass after. Pre-fix the duplicate-key body reaches the
 * route, gets parsed (last-value-wins / array), and the response is
 * NOT a 400 from the body-security middleware.
 *
 * @module __tests__/integration/security/request-body-urlencoded-duplicate-key
 */

import { describe, it, expect } from '@jest/globals';
import request from 'supertest';
import app from '../../../app.mjs';

const ENDPOINT = '/api/v1/auth/login';
const URLENCODED = 'application/x-www-form-urlencoded';

describe('urlencoded duplicate-key rejection (21R-SEC-5)', () => {
  it('should reject duplicate keys in urlencoded body', async () => {
    // Canonical AC payload from the bd issue Description.
    const response = await request(app).post(ENDPOINT).set('Content-Type', URLENCODED).send('name=Valid&name=Hacked');

    expect(response.status).toBe(400);
    expect(response.body).toEqual(
      expect.objectContaining({
        success: false,
        message: expect.stringMatching(/duplicate.*urlencoded.*key/i),
      }),
    );
  });

  it('rejects percent-encoded duplicate keys (obfuscation attempt)', async () => {
    // `%6e%61%6d%65` decodes to `name`. Without percent-decoding before
    // comparison, the scanner would see two distinct keys and let the
    // pollution through.
    const response = await request(app)
      .post(ENDPOINT)
      .set('Content-Type', URLENCODED)
      .send('name=Valid&%6e%61%6d%65=Hacked');

    expect(response.status).toBe(400);
    expect(response.body).toEqual(
      expect.objectContaining({
        success: false,
        message: expect.stringMatching(/duplicate.*urlencoded.*key/i),
      }),
    );
  });

  it('rejects plus-sign-encoded space duplicates', async () => {
    // `+` decodes to space in urlencoded; `user+name` and `user name`
    // must collapse to the same key for duplicate-detection. Two
    // identical-after-decoding keys → 400.
    const response = await request(app)
      .post(ENDPOINT)
      .set('Content-Type', URLENCODED)
      .send('user+name=Valid&user+name=Hacked');

    expect(response.status).toBe(400);
    expect(response.body).toEqual(
      expect.objectContaining({
        success: false,
        message: expect.stringMatching(/duplicate.*urlencoded.*key/i),
      }),
    );
  });

  it('lets a single-key urlencoded body pass through to the controller', async () => {
    // Single key — no duplicate. The login controller will reject the
    // payload as invalid credentials (typically 400 validation or 401),
    // but the duplicate-key message MUST NOT appear; that confirms the
    // verify hook passed through and didn't false-positive.
    const response = await request(app).post(ENDPOINT).set('Content-Type', URLENCODED).send('email=alice@example.com');

    if (response.body && typeof response.body.message === 'string') {
      expect(response.body.message).not.toMatch(/duplicate.*urlencoded.*key/i);
    }
  });

  it('lets distinct keys pass through (no false-positive on different names)', async () => {
    const response = await request(app)
      .post(ENDPOINT)
      .set('Content-Type', URLENCODED)
      .send('email=a@b.c&password=secret');

    if (response.body && typeof response.body.message === 'string') {
      expect(response.body.message).not.toMatch(/duplicate.*urlencoded.*key/i);
    }
  });

  it('respects content-type with charset parameter (matches application/x-www-form-urlencoded; charset=utf-8)', async () => {
    const response = await request(app)
      .post(ENDPOINT)
      .set('Content-Type', `${URLENCODED}; charset=utf-8`)
      .send('name=Valid&name=Hacked');

    expect(response.status).toBe(400);
    expect(response.body).toEqual(
      expect.objectContaining({
        success: false,
        message: expect.stringMatching(/duplicate.*urlencoded.*key/i),
      }),
    );
  });

  it('does not trigger on JSON bodies (verifyJsonBody owns that path)', async () => {
    // Content-Type application/json — urlencoded scanner must NOT run.
    // (The JSON scanner has its own duplicate-key check; this test only
    // confirms the urlencoded scanner doesn't double-fire on JSON.)
    const response = await request(app)
      .post(ENDPOINT)
      .set('Content-Type', 'application/json')
      .send({ email: 'a@b.c', password: 'secret' });

    if (response.body && typeof response.body.message === 'string') {
      expect(response.body.message).not.toMatch(/duplicate.*urlencoded.*key/i);
    }
  });

  it('does not trigger on empty urlencoded body', async () => {
    const response = await request(app).post(ENDPOINT).set('Content-Type', URLENCODED).send('');

    if (response.body && typeof response.body.message === 'string') {
      expect(response.body.message).not.toMatch(/duplicate.*urlencoded.*key/i);
    }
  });

  // Sentinel: deliberate behavior. Codebase audit (Equoria-lf3z) found no
  // legitimate caller using qs's bracketed-array urlencoded syntax. The
  // scanner therefore treats `name[]=a&name[]=b` as a duplicate of the
  // literal key `name[]` and rejects with 400 — same as plain duplicates.
  // If a future controller needs array-of-string urlencoded input, that
  // controller should switch to JSON or an explicit per-route opt-out
  // mechanism (not yet implemented). This test pins the current behavior
  // so a future "make it permissive" change breaks this assertion and
  // forces a deliberate review.
  it('rejects bracketed-array duplicate keys (deliberate; audit-driven)', async () => {
    const response = await request(app)
      .post(ENDPOINT)
      .set('Content-Type', URLENCODED)
      .send('name[]=Valid&name[]=Hacked');

    expect(response.status).toBe(400);
    expect(response.body).toEqual(
      expect.objectContaining({
        success: false,
        message: expect.stringMatching(/duplicate.*urlencoded.*key/i),
      }),
    );
  });
});
