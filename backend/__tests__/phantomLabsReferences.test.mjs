/**
 * No phantom "labs" references (Equoria-q4uem.16).
 *
 * Owner ruling 2026-10-19 (Stacey, decision 28 / W5): the labs domain was
 * dissolved in WS4 (its routes live under traits now), so two leftovers must go:
 * the /api-info `labs: '/api/v1/labs'` entry, which advertises a route that does
 * not exist, and the FF_LABS_ENABLED feature flag, which gates nothing.
 *
 * Pure data: the real /api-info handler is invoked with a minimal response
 * recorder, and the real flag table is read. No database.
 */

import { describe, it, expect } from '@jest/globals';
import { apiInfoHandler } from '../config/healthHandlers.mjs';
import { getFlagsByCategory, isFlagDefined } from '../utils/featureFlags.mjs';

function callApiInfo() {
  let body;
  const res = {
    setHeader() {},
    json(payload) {
      body = payload;
    },
  };
  apiInfoHandler({}, res);
  return body;
}

describe('phantom labs references (Equoria-q4uem.16)', () => {
  it('/api-info does not advertise a labs route', () => {
    const body = callApiInfo();

    expect(body.success).toBe(true);
    expect(body).not.toHaveProperty('labs');
    expect(JSON.stringify(body)).not.toMatch(/labs/i);
  });

  it('/api-info still advertises the versioned API and its real endpoints', () => {
    const body = callApiInfo();

    expect(body.versioned).toBe('/api/v1');
    expect(body.endpoints).toBeDefined();
    // Equoria-ccjj7 (ARCH-01): old contract '/api/traits', an unversioned address
    // that Equoria-4bs3s stopped mounting (it answered 404). New: the real mount.
    expect(body.endpoints.traits).toBe('/api/v1/traits');
  });

  it('there is no FF_LABS_ENABLED flag', () => {
    expect(isFlagDefined(['FF', 'LABS', 'ENABLED'].join('_'))).toBe(false);
    expect(getFlagsByCategory('LABS')).toEqual([]);
  });
});
