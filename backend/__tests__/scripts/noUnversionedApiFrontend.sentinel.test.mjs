/**
 * Sentinel — frontend unversioned-/api doctrine detector (Equoria-9ysza / 4bs3s).
 *
 * check-no-unversioned-api.mjs enforces "no unversioned /api in frontend SOURCE".
 * Its regex previously only matched a quote/backtick immediately before /api/,
 * missing the common `${base}/api/...` template-literal form (the qv8n8 gap).
 * This sentinel proves the broadened detector FIRES on both the bare-quoted and
 * the `${VAR}/api/...` forms and PASSES on the versioned canonical — i.e. it is
 * not a vacuous always-green check.
 *
 * Lives under backend/__tests__/ (jest) and imports the root doctrine script via
 * its main-module guard, so importing findViolations does not run the scan.
 */
import { describe, it, expect } from '@jest/globals';
import { findViolations } from '../../../scripts/doctrine-checks/check-no-unversioned-api.mjs';

describe('no-unversioned-api (frontend) detector (Equoria-9ysza)', () => {
  it('SENTINEL-POSITIVE: fires on an unversioned /api in a ${VAR} template literal', () => {
    const v = findViolations('x.ts', 'fetch(`${API_BASE}/api/horses`);');
    expect(v).toHaveLength(1);
    expect(v[0].path).toBe('/api/horses');
  });

  it('SENTINEL-POSITIVE: fires on a bare-quoted unversioned /api literal', () => {
    const v = findViolations('x.ts', "axios.get('/api/training/train');");
    expect(v).toHaveLength(1);
    expect(v[0].path).toBe('/api/training/train');
  });

  it('passes the versioned canonical /api/v1/... (bare and template)', () => {
    expect(findViolations('x.ts', "axios.get('/api/v1/horses');")).toEqual([]);
    expect(findViolations('x.ts', 'fetch(`${API_BASE}/api/v1/horses`);')).toEqual([]);
  });

  it('passes the allow-listed /api/internal/... prefix', () => {
    expect(findViolations('x.ts', "fetch('/api/internal/metrics');")).toEqual([]);
  });

  it('respects the // 4bs3s-allow escape hatch', () => {
    expect(findViolations('x.ts', "fetch('/api/legacy'); // 4bs3s-allow")).toEqual([]);
  });
});
