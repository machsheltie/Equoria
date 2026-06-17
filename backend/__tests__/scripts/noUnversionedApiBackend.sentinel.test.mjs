/**
 * Sentinel — backend unversioned-/api doctrine detector (Equoria-x8y6i).
 *
 * The doctrine check scripts/doctrine-checks/check-no-unversioned-api-backend.mjs
 * scans backend/scripts + backend/tests/load for `/api/<not-v\d>` string
 * literals (the surfaces that run OUTSIDE jest's real-app signal). This sentinel
 * proves the detector FIRES on a planted unversioned literal and PASSES on the
 * versioned canonical — i.e. it is not a vacuous always-green check.
 *
 * This file lives under backend/__tests__/ which is OUTSIDE the check's scan
 * scope (backend/scripts + backend/tests/load), so its planted '/api/breeds'
 * literal does not trip the real check.
 */
import { describe, it, expect } from '@jest/globals';
import { findUnversionedApiLiterals } from '../../../scripts/doctrine-checks/check-no-unversioned-api-backend.mjs';

describe('no-unversioned-api-backend detector (Equoria-x8y6i)', () => {
  it('SENTINEL-POSITIVE: fires on an unversioned /api literal', () => {
    const planted = "const ep = '/api/breeds';\nawait fetch(`${base}${ep}`);";
    const v = findUnversionedApiLiterals(planted);
    expect(v).toHaveLength(1);
    expect(v[0].path).toBe('/api/breeds');
    expect(v[0].line).toBe(1);
  });

  it('passes the versioned canonical /api/v1/... literal', () => {
    expect(findUnversionedApiLiterals("const ep = '/api/v1/breeds';")).toEqual([]);
  });

  it('passes a future-versioned /api/v2/... literal', () => {
    expect(findUnversionedApiLiterals("fetch('/api/v2/foo');")).toEqual([]);
  });

  it('does NOT flag root-mounted infra routes (/ping, /health are not under /api/)', () => {
    expect(findUnversionedApiLiterals("'/ping'\n'/health'")).toEqual([]);
  });

  it('respects the // 4bs3s-allow escape hatch', () => {
    expect(findUnversionedApiLiterals("const ep = '/api/legacy'; // 4bs3s-allow")).toEqual([]);
  });

  it('catches multiple violations across lines with correct line numbers', () => {
    const src = ["fetch('/api/v1/ok');", "fetch('/api/horses');", "fetch('/api/competition/x');"].join('\n');
    const v = findUnversionedApiLiterals(src);
    expect(v.map(x => x.line)).toEqual([2, 3]);
    expect(v.map(x => x.path)).toEqual(['/api/horses', '/api/competition/x']);
  });
});
