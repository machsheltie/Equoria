/**
 * sanitizeLogData applied to req.params + req.query — sentinel (Equoria-wp0ib).
 *
 * Before this fix, auditLog.logOperation stored req.params and req.query
 * verbatim into the audit-log payload. A sensitive value in a path param
 * (/:token) or a query string (?password=...) would persist into audit_logs
 * for the 90-day retention window (SECURITY.md A09 / Equoria-54qq8 cron).
 *
 * Fix: route both through sanitizeLogData() — the same redactor already
 * applied to req.body, with the sensitive-field substring list including
 * password / token / secret / key / auth / credential / ssn / social /
 * credit / card / cvv / pin / birth / dob.
 *
 * This is a pure unit-level test of the sanitizer — no DB required. We
 * import sanitizeLogData directly and assert the shape it returns for
 * representative Express req.params and req.query objects.
 */

import { describe, it, expect } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sanitizeLogData } from '../middleware/auditLog.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const AUDIT_SRC = path.resolve(HERE, '..', 'middleware', 'auditLog.mjs');

describe('sanitizeLogData applied to req.params + req.query (Equoria-wp0ib)', () => {
  it('SENTINEL: ?token=abc123 → requestQuery.token === "[REDACTED]"', () => {
    const reqQuery = { token: 'abc123', sortBy: 'name' };
    const sanitized = sanitizeLogData(reqQuery);
    expect(sanitized.token).toBe('[REDACTED]');
    // Non-sensitive keys pass through unchanged.
    expect(sanitized.sortBy).toBe('name');
  });

  it('SENTINEL: ?password=hunter2 → requestQuery.password === "[REDACTED]"', () => {
    const sanitized = sanitizeLogData({ password: 'hunter2' });
    expect(sanitized.password).toBe('[REDACTED]');
  });

  it('SENTINEL: req.params with :token path param is redacted', () => {
    const reqParams = { token: 'eyJhbGciOi...', userId: 'u-42' };
    const sanitized = sanitizeLogData(reqParams);
    expect(sanitized.token).toBe('[REDACTED]');
    // userId is not in the sensitive-field substring list — keep as-is for
    // forensic value (it identifies who the action was attributed to).
    expect(sanitized.userId).toBe('u-42');
  });

  it('substring matching catches accessToken, refreshToken, resetPasswordKey etc', () => {
    const sanitized = sanitizeLogData({
      accessToken: 'access-...',
      refreshToken: 'refresh-...',
      resetPasswordKey: 'reset-...',
      api_secret: 'secret-...',
      authHeader: 'Bearer xxx',
      irrelevant: 'keep me',
    });
    expect(sanitized.accessToken).toBe('[REDACTED]');
    expect(sanitized.refreshToken).toBe('[REDACTED]');
    expect(sanitized.resetPasswordKey).toBe('[REDACTED]');
    expect(sanitized.api_secret).toBe('[REDACTED]');
    expect(sanitized.authHeader).toBe('[REDACTED]');
    expect(sanitized.irrelevant).toBe('keep me');
  });

  // WIRING SENTINEL: prove the audit-log middleware ACTUALLY runs req.params
  // and req.query through sanitizeLogData(), not just req.body. A unit test
  // of the sanitizer alone would pass even if the middleware never called it
  // for params/query (the original wp0ib defect). A grep over the source is
  // the most direct check that's both simple and immune to refactor noise.
  it('SENTINEL WIRING: middleware passes req.params + req.query through sanitizeLogData (not verbatim)', () => {
    const src = fs.readFileSync(AUDIT_SRC, 'utf8');
    // Every requestParams: assignment must use sanitizeLogData(...).
    const requestParamsLines = src.match(/^\s*requestParams:\s*[^,\n]+/gm) || [];
    const requestQueryLines = src.match(/^\s*requestQuery:\s*[^,\n]+/gm) || [];
    expect(requestParamsLines.length).toBeGreaterThanOrEqual(1);
    expect(requestQueryLines.length).toBeGreaterThanOrEqual(1);
    for (const line of requestParamsLines) {
      expect(line).toMatch(/sanitizeLogData\(\s*req\.params\s*\)/);
    }
    for (const line of requestQueryLines) {
      expect(line).toMatch(/sanitizeLogData\(\s*req\.query\s*\)/);
    }
  });

  it('handles empty / non-object input safely', () => {
    expect(sanitizeLogData({})).toEqual({});
    expect(sanitizeLogData(null)).toBeNull();
    expect(sanitizeLogData(undefined)).toBeUndefined();
    expect(sanitizeLogData('string')).toBe('string');
  });
});
