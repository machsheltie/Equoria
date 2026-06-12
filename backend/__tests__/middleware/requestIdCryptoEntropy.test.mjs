/**
 * Sentinel-positive coverage for security-critical request/correlation-ID
 * entropy (Equoria-dew6i).
 *
 * Two security-critical sites generated request/correlation IDs with
 * `Math.random()` (V8 Xorshift128+), which is NOT a CSPRNG and is
 * predictable/forgeable:
 *   1) `backend/middleware/auth.mjs` — the per-request auth-log correlation
 *      ID (`Math.random().toString(36).substring(7)`).
 *   2) `backend/middleware/resourceManagement.mjs` — the `x-request-id`
 *      fallback (`req_${Date.now()}_${Math.random().toString(36).substr(2,9)}`).
 *
 * The fix replaces both with `crypto.randomBytes(8).toString('hex')`.
 *
 * These tests lock in:
 *   1) `generateRequestId()` returns a fixed-length 16-char lowercase hex
 *      string — Math.random().toString(36).substring(7) produces variable
 *      length and includes letters g-z, so this assertion fails before the fix.
 *   2) No collisions across 10,000 generated IDs.
 *   3) First-byte distribution passes a chi-square uniformity check — a weak
 *      base36 PRNG cannot produce byte-level uniformity.
 *   4) The resourceManagement middleware populates `req.resources.id` with a
 *      `req_<ts>_<32hex... actually 16hex>` shape whose random tail is
 *      fixed-length hex (the Math.random tail was [0-9a-z]{1,9}).
 *   5) Source sentinel: neither security-critical generator line uses
 *      `Math.random` any more. This is the planted-violation guard — if a
 *      future edit reintroduces Math.random into these request-ID paths, the
 *      sentinel fails. (Game-RNG sites elsewhere are out of scope and NOT
 *      asserted on.)
 *
 * Per the Equoria Testing Philosophy: no mocks, no skips, no bypasses.
 *
 * @module __tests__/middleware/requestIdCryptoEntropy
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { describe, it, expect } from '@jest/globals';
import request from 'supertest';
import express from 'express';

import { generateRequestId } from '../../middleware/auth.mjs';
import { createResourceManagementMiddleware } from '../../middleware/resourceManagement.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AUTH_SRC = resolve(__dirname, '../../middleware/auth.mjs');
const RESOURCE_SRC = resolve(__dirname, '../../middleware/resourceManagement.mjs');

describe('generateRequestId — crypto entropy (Equoria-dew6i)', () => {
  it('emits a fixed-length 16-character lowercase hex string', () => {
    const id = generateRequestId();
    expect(typeof id).toBe('string');
    // 8 bytes → 16 hex chars. Math.random().toString(36).substring(7) is
    // variable length (often 4-5 chars) and uses [0-9a-z].
    expect(id).toMatch(/^[0-9a-f]{16}$/);
  });

  it('produces no collisions across 10,000 generated IDs', () => {
    const seen = new Set();
    for (let i = 0; i < 10_000; i++) {
      seen.add(generateRequestId());
    }
    expect(seen.size).toBe(10_000);
  });

  it('first-byte distribution passes a chi-square uniformity check', () => {
    // 4,000 samples across 256 bins → expected ~15.625 per bin.
    // Critical chi-square at df=255, p=0.001 is ≈ 343. A CSPRNG lands well
    // below; Math.random base36 cannot produce byte-level uniformity.
    const N = 4000;
    const counts = new Array(256).fill(0);
    for (let i = 0; i < N; i++) {
      const firstByte = parseInt(generateRequestId().slice(0, 2), 16);
      counts[firstByte] += 1;
    }
    const expected = N / 256;
    let chi = 0;
    for (let i = 0; i < 256; i++) {
      const diff = counts[i] - expected;
      chi += (diff * diff) / expected;
    }
    expect(chi).toBeLessThan(343);
  });
});

describe('resourceManagement requestId fallback — crypto entropy (Equoria-dew6i)', () => {
  it('generates a req_<ts>_<hex> id with a fixed-length hex random tail', async () => {
    const app = express();
    let capturedId;
    app.use(createResourceManagementMiddleware());
    app.get('/test', (req, res) => {
      capturedId = req.resources.id;
      res.json({ success: true });
    });

    // No x-request-id header → forces the generated fallback path.
    await request(app).get('/test').expect(200);

    expect(typeof capturedId).toBe('string');
    // Shape: req_<digits>_<16 lowercase hex>. The Math.random tail was
    // [0-9a-z]{1,9} (variable length, includes g-z), which this rejects.
    expect(capturedId).toMatch(/^req_\d+_[0-9a-f]{16}$/);
  });

  it('produces unique fallback ids across many requests', async () => {
    const app = express();
    const ids = [];
    app.use(createResourceManagementMiddleware());
    app.get('/test', (req, res) => {
      ids.push(req.resources.id);
      res.json({ success: true });
    });

    for (let i = 0; i < 50; i++) {
      // eslint-disable-next-line no-await-in-loop -- sequential supertest calls
      await request(app).get('/test').expect(200);
    }
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('source sentinel — no Math.random in security request-ID paths (Equoria-dew6i)', () => {
  it('auth.mjs generateRequestId does not use Math.random', () => {
    const src = readFileSync(AUTH_SRC, 'utf8');
    const helper = src.slice(src.indexOf('export const generateRequestId'));
    const line = helper.slice(0, helper.indexOf('\n', helper.indexOf('=>')));
    expect(line).not.toMatch(/Math\.random/);
    expect(line).toMatch(/randomBytes/);
  });

  it('resourceManagement.mjs request-id fallback does not use Math.random', () => {
    const src = readFileSync(RESOURCE_SRC, 'utf8');
    // The fallback assignment line.
    const idx = src.indexOf("req.headers['x-request-id'] ||");
    expect(idx).toBeGreaterThan(-1);
    const fallbackLine = src.slice(idx, src.indexOf('\n', idx) + 80);
    expect(fallbackLine).not.toMatch(/Math\.random/);
    expect(fallbackLine).toMatch(/randomBytes/);
  });
});
