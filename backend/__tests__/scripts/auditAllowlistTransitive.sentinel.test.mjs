/**
 * Equoria-5hdwr — scripts/audit-with-allowlist.mjs resolves transitive
 * findings to the advisory they inherit.
 *
 * npm audit lists every package on a vulnerable chain. Only the package that
 * owns the advisory carries a GHSA; the packages that depend on it carry the
 * dependency's NAME in `via` instead. Before this fix the gate reported those
 * dependents as "(unidentified)" and blocked them unconditionally, so an
 * allowlisted advisory could never clear its own chain.
 *
 * The fixture mirrors the real 2026-10-15 frontend audit: tailwindcss ->
 * micromatch / fast-glob / chokidar -> braces (GHSA-vfj7-8cjw-p6xm).
 *
 * Both directions are proven: the chain clears when its root advisory is
 * allowlisted, and every link still blocks — naming the root advisory — when
 * it is not. Pure function over npm's real JSON shape; no mocks.
 */

import { describe, test, expect } from '@jest/globals';
import { findBlockers } from '../../../scripts/audit-with-allowlist.mjs';

const BRACES_GHSA = 'GHSA-vfj7-8cjw-p6xm';
const OTHER_GHSA = 'GHSA-aaaa-bbbb-cccc';

const advisory = (ghsa, name) => ({
  source: 1,
  name,
  title: `${name} advisory`,
  url: `https://github.com/advisories/${ghsa}`,
  severity: 'high',
  range: '<=9.9.9',
});

const tailwindChainAudit = () => ({
  vulnerabilities: {
    braces: { name: 'braces', severity: 'high', via: [advisory(BRACES_GHSA, 'braces')] },
    micromatch: { name: 'micromatch', severity: 'high', via: ['braces'] },
    'fast-glob': { name: 'fast-glob', severity: 'high', via: ['micromatch'] },
    chokidar: { name: 'chokidar', severity: 'high', via: ['braces'] },
    tailwindcss: {
      name: 'tailwindcss',
      severity: 'high',
      via: ['chokidar', 'fast-glob', 'micromatch'],
    },
  },
});

const allow = (...ids) => new Map(ids.map(id => [id, { id }]));

// Blockers come back in npm's report order; compare them by package name.
const byPkg = blockers => [...blockers].sort((x, y) => x.pkg.localeCompare(y.pkg));

describe('audit-with-allowlist — transitive findings inherit their root advisory', () => {
  test('an allowlisted root advisory clears every package on its chain', () => {
    expect(findBlockers(tailwindChainAudit(), 'high', allow(BRACES_GHSA))).toEqual([]);
  });

  test('without the allowlist entry, every link blocks and names the root advisory', () => {
    const blockers = findBlockers(tailwindChainAudit(), 'high', allow());

    expect(blockers.map(b => b.pkg).sort()).toEqual(
      ['braces', 'chokidar', 'fast-glob', 'micromatch', 'tailwindcss'].sort(),
    );
    for (const b of blockers) {
      expect(b.ghsas).toEqual([BRACES_GHSA]);
    }
  });

  test('a dependent also reached by an unallowlisted advisory still blocks on that one', () => {
    const audit = tailwindChainAudit();
    audit.vulnerabilities['postcss-nested'] = {
      name: 'postcss-nested',
      severity: 'high',
      via: [advisory(OTHER_GHSA, 'postcss-nested')],
    };
    audit.vulnerabilities.tailwindcss.via.push('postcss-nested');

    const blockers = findBlockers(audit, 'high', allow(BRACES_GHSA));

    expect(byPkg(blockers)).toEqual([
      { pkg: 'postcss-nested', severity: 'high', ghsas: [OTHER_GHSA] },
      { pkg: 'tailwindcss', severity: 'high', ghsas: [OTHER_GHSA] },
    ]);
  });

  test('an inherited advisory below the threshold does not block a high package', () => {
    // Real 2026-10-15 shape: tailwindcss is high only through braces; it also
    // inherits a MODERATE postcss-selector-parser advisory.
    const audit = tailwindChainAudit();
    audit.vulnerabilities['postcss-selector-parser'] = {
      name: 'postcss-selector-parser',
      severity: 'moderate',
      via: [{ ...advisory(OTHER_GHSA, 'postcss-selector-parser'), severity: 'moderate' }],
    };
    audit.vulnerabilities.tailwindcss.via.push('postcss-selector-parser');

    expect(findBlockers(audit, 'high', allow(BRACES_GHSA))).toEqual([]);
    expect(byPkg(findBlockers(audit, 'moderate', allow(BRACES_GHSA)))).toEqual([
      { pkg: 'postcss-selector-parser', severity: 'moderate', ghsas: [OTHER_GHSA] },
      { pkg: 'tailwindcss', severity: 'high', ghsas: [OTHER_GHSA] },
    ]);
  });

  test('a chain that never reaches an advisory stays unidentified and blocks', () => {
    const audit = {
      vulnerabilities: {
        orphan: { name: 'orphan', severity: 'high', via: ['not-in-the-report'] },
      },
    };

    expect(findBlockers(audit, 'high', allow(BRACES_GHSA))).toEqual([
      { pkg: 'orphan', severity: 'high', ghsas: ['(unidentified)'] },
    ]);
  });

  test('a dependency cycle with no advisory terminates and blocks as unidentified', () => {
    const audit = {
      vulnerabilities: {
        a: { name: 'a', severity: 'high', via: ['b'] },
        b: { name: 'b', severity: 'high', via: ['a'] },
      },
    };

    expect(findBlockers(audit, 'high', allow()).map(b => b.ghsas)).toEqual([['(unidentified)'], ['(unidentified)']]);
  });

  test('findings below the threshold never block', () => {
    const audit = tailwindChainAudit();
    for (const v of Object.values(audit.vulnerabilities)) {
      v.severity = 'moderate';
    }

    expect(findBlockers(audit, 'high', allow())).toEqual([]);
  });
});
