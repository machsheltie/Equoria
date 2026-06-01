/**
 * Integration tests: Key reflection vector (Equoria-byhy, 21R-SEC-3-FOLLOW-1C)
 *
 * scanObject and assertNoPollutingKeys reflected user-controlled JSON keys
 * verbatim into error messages sent to the client. An attacker could inject
 * CRLF, ANSI escape sequences, RTL overrides, or 1MB strings into the HTTP
 * response body via crafted key names.
 *
 * AC: message must NOT contain the user-controlled bytes verbatim.
 */

import { describe, it, expect } from '@jest/globals';
import request from 'supertest';
import app from '../app.mjs';

const ENDPOINT = '/api/v1/auth/login';

describe('Key reflection vector (Equoria-byhy, 21R-SEC-3-FOLLOW-1C)', () => {
  it('does not reflect CRLF from a duplicate JSON key to the client', async () => {
    // U+000D (CR) and U+000A (LF) encoded as JSON \u-escapes.
    // scanString decodes them to literal bytes; pre-fix they were
    // forwarded verbatim into the HTTP response message.
    const body = '{"a\\u000d\\u000ab":"x","a\\u000d\\u000ab":"y"}';

    const response = await request(app).post(ENDPOINT).set('Content-Type', 'application/json').send(body);

    expect(response.status).not.toBe(429); // guard against rate-limiter deflection
    expect(response.status).toBe(400);
    expect(response.body.message).not.toContain('\r');
    expect(response.body.message).not.toContain('\n');
  });

  it('does not reflect ANSI escape (U+001B) from a duplicate JSON key to the client', async () => {
    // ESC byte starts ANSI CSI sequences (e.g. "[31m" = red). Reflected to
    // a terminal log viewer this corrupts or forges terminal output.
    const body = '{"\\u001b[31mred":"x","\\u001b[31mred":"y"}';

    const response = await request(app).post(ENDPOINT).set('Content-Type', 'application/json').send(body);

    expect(response.status).not.toBe(429);
    expect(response.status).toBe(400);
    expect(response.body.message).not.toContain('');
  });

  it('does not reflect RTL override (U+202E) from a duplicate JSON key to the client', async () => {
    // U+202E RIGHT-TO-LEFT OVERRIDE is used for visual log spoofing.
    // Directional rendering makes subsequent text appear reversed in the viewer.
    const body = '{"\\u202ekey":"x","\\u202ekey":"y"}';

    const response = await request(app).post(ENDPOINT).set('Content-Type', 'application/json').send(body);

    expect(response.status).not.toBe(429);
    expect(response.status).toBe(400);
    expect(response.body.message).not.toContain('‮');
  });

  it('does not reflect a 1MB duplicate JSON key to the client', async () => {
    // 1 048 576 'A' characters as the duplicate key. If reflected verbatim
    // the HTTP response body exceeds 1MB (length-amplification DoS).
    // JS objects deduplicate keys so we build raw JSON manually.
    const bigKey = 'A'.repeat(1_048_576);
    const body = `{"${bigKey}":"x","${bigKey}":"y"}`;

    const response = await request(app).post(ENDPOINT).set('Content-Type', 'application/json').send(body);

    expect(response.status).not.toBe(429);
    expect(response.status).toBe(400);
    // After fix the key is truncated to 64 chars; full message stays under 256.
    // Pre-fix: message.length > 1_000_000.
    expect(response.body.message.length).toBeLessThan(256);
  });

  it('does not reflect CRLF from a duplicate urlencoded key to the client', async () => {
    // %0d%0a = URL-encoded CR+LF. detectDuplicateUrlEncodedKeys percent-decodes
    // each key, producing "key\r\nname" with literal bytes. Pre-fix those bytes
    // were forwarded verbatim into the HTTP response message.
    const body = 'key%0d%0aname=x&key%0d%0aname=y';

    const response = await request(app)
      .post(ENDPOINT)
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .send(body);

    expect(response.status).not.toBe(429);
    expect(response.status).toBe(400);
    expect(response.body.message).not.toContain('\r');
    expect(response.body.message).not.toContain('\n');
  });
});
