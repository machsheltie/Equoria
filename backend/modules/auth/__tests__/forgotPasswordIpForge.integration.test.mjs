/**
 * forgotPassword X-Forwarded-For audit-IP forge sentinel (Equoria-n62tl).
 *
 * Before fix: `ipAddress = req.ip || req.headers['x-forwarded-for'] ||
 * req.connection.remoteAddress` inside forgotPassword. If
 * `app.set('trust proxy')` is misconfigured / disabled, req.ip becomes
 * undefined and the USER-CONTROLLED X-Forwarded-For header is persisted
 * into password_reset_tokens.ipAddress, letting an attacker frame another
 * IP in the audit trail.
 *
 * Fix: drop the XFF fallback. req.ip already honors trust-proxy correctly
 * (the upstream-IP resolution lives there, not in this controller). If
 * req.ip is undefined the fallback is now `req.connection?.remoteAddress
 * || null` — null is honest, a forged header is a stealth-frame primitive.
 *
 * The live-HTTP sentinel that would WANT to test this — POST forgot-password
 * with X-Forwarded-For: 9.9.9.9 and assert the persisted column is not
 * 9.9.9.9 — cannot run in a test environment that has trust-proxy ENABLED:
 * Express auto-assigns req.ip = 9.9.9.9 in that case, so the fix's branch
 * is never exercised. Re-disabling trust-proxy mid-test would corrupt
 * other tests in the same module-cache.
 *
 * Instead this sentinel does a STRUCTURAL grep over the source. Future
 * contributors who reintroduce the XFF fallback fail this assertion and
 * the bd note explains why.
 */

import { describe, it, expect } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CONTROLLER = path.resolve(HERE, '..', 'controllers', 'authController.mjs');

describe('forgotPassword XFF audit-IP forge sentinel (Equoria-n62tl)', () => {
  it('SENTINEL: forgotPassword block does NOT read req.headers[x-forwarded-for] for ipAddress', () => {
    const src = fs.readFileSync(CONTROLLER, 'utf8');

    // Pull out the forgotPassword function body — everything from
    // `export const forgotPassword = async` to the closing `};` that
    // matches at column 0.
    const startMatch = src.match(/export const forgotPassword = async[\s\S]*?\n\};/);
    expect(startMatch).not.toBeNull();
    const body = startMatch[0];

    // The forgotPassword body MUST NOT contain the legacy XFF fallback
    // in an ipAddress assignment. We allow doc-comments that MENTION the
    // header name (the rw2yo-style explanatory comment) by matching the
    // ACTIVE expression shape, not raw substring.
    expect(body).not.toMatch(/ipAddress\s*=\s*[^;]*req\.headers\[\s*['"]x-forwarded-for['"]\s*\]/);

    // Positive assertion: the fix landed — ipAddress uses req.ip with a
    // null-safe connection.remoteAddress fallback, NOT the forgeable
    // header.
    expect(body).toMatch(/ipAddress\s*=\s*req\.ip\s*\|\|\s*req\.connection\?\.remoteAddress\s*\|\|\s*null/);
  });
});
