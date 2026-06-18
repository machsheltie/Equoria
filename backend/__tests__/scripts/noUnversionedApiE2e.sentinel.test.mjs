/**
 * Sentinel — E2E unversioned-/api doctrine detector (Equoria-sqrpa).
 *
 * check-no-unversioned-api-e2e.mjs enforces "no unversioned /api in
 * tests/e2e/** specs+helpers" (which the frontend-source check deliberately
 * skips because it ignores *.spec.ts). This sentinel proves the detector
 * FIRES on the exact forms the specs used (`session.request.get('/api/horses')`,
 * `csrfMutate(..., '/api/breeds', ...)`, the `.includes('/api/auth/profile')`
 * predicate, and the `${base}/api/...` template form) and PASSES on the
 * versioned canonical + unquoted doc-comment prose — i.e. it is not a vacuous
 * always-green check.
 *
 * Lives under backend/__tests__/ (jest) and imports the root doctrine script
 * via its main-module guard, so importing findViolations does not run the scan.
 */
import { describe, it, expect } from '@jest/globals';
import { findViolations } from '../../../scripts/doctrine-checks/check-no-unversioned-api-e2e.mjs';

describe('no-unversioned-api-e2e detector (Equoria-sqrpa)', () => {
  it('SENTINEL-POSITIVE: fires on a bare-quoted unversioned /api/horses (the csrfMutate form)', () => {
    const v = findViolations('x.spec.ts', "csrfMutate(session, 'POST', '/api/horses', {});");
    expect(v).toHaveLength(1);
    expect(v[0].path).toBe('/api/horses');
  });

  it("SENTINEL-POSITIVE: fires on session.request.get('/api/breeds')", () => {
    const v = findViolations('x.spec.ts', "const r = await session.request.get('/api/breeds');");
    expect(v).toHaveLength(1);
    expect(v[0].path).toBe('/api/breeds');
  });

  it("SENTINEL-POSITIVE: fires on the .includes('/api/auth/profile') predicate form", () => {
    const v = findViolations('x.spec.ts', "(r) => r.url().includes('/api/auth/profile')");
    expect(v).toHaveLength(1);
    expect(v[0].path).toBe('/api/auth/profile');
  });

  it('SENTINEL-POSITIVE: fires on a ${base}/api/... template literal', () => {
    const v = findViolations('x.spec.ts', 'page.request.get(`${baseURL}/api/horses`);');
    expect(v).toHaveLength(1);
    expect(v[0].path).toBe('/api/horses');
  });

  it('passes the versioned canonical /api/v1/... (bare, template, and .includes predicate)', () => {
    expect(findViolations('x.spec.ts', "session.request.get('/api/v1/breeds');")).toEqual([]);
    expect(findViolations('x.spec.ts', 'page.request.get(`${baseURL}/api/v1/horses`);')).toEqual([]);
    expect(findViolations('x.spec.ts', "(r) => r.url().includes('/api/v1/auth/profile')")).toEqual([]);
  });

  it('does NOT fire on unquoted doc-comment prose referencing the old path', () => {
    // The detector requires a quote/backtick/} immediately before /api/, so a
    // comment like the one below does not trip the gate.
    expect(findViolations('x.spec.ts', '    // AC4: GET /api/horses asserts the starter horse exists')).toEqual([]);
  });

  it('respects the // sqrpa-allow escape hatch', () => {
    expect(findViolations('x.spec.ts', "session.request.get('/api/legacy'); // sqrpa-allow")).toEqual([]);
  });
});
