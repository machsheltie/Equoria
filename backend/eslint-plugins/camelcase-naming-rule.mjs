/**
 * ESLint `camelcase` rule configuration shared by the repo-root
 * eslint.config.js and backend/eslint.config.mjs (Equoria-pjvp8.9).
 *
 * Owner ruling 2026-10-21 (Stacey), q351: every name Equoria controls is
 * camelCase. scripts/doctrine-checks/check-camelcase-naming.mjs stays the
 * guard for strings, data and UPPER_SNAKE names; this rule adds the editor-
 * and lint-time check for snake_case identifiers and property keys.
 *
 * The exemptions are read from the naming check's own allow-list
 * (scripts/doctrine-checks/camelcase-naming-allowlist.json), so the two gates
 * never disagree about which outside names may keep their underscores. Two
 * more are structural, mirroring the check's own rules:
 *   - genetic locus keys (E_Extension, MFSD12_Mushroom): upper-start mixed
 *     case, the gene's nomenclature;
 *   - the __TESTING_ONLY_ export prefix check-no-test-only-imports.mjs enforces.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const allowListPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../scripts/doctrine-checks/camelcase-naming-allowlist.json',
);

const escapeRegExp = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Every exempt name as an anchored pattern (the rule matches `allow` as RegExp). */
export function camelcaseAllowPatterns(
  allowList = JSON.parse(fs.readFileSync(allowListPath, 'utf8')),
) {
  return [
    ...Object.keys(allowList.tokens ?? {}).map(token => `^${escapeRegExp(token)}$`),
    ...(allowList.patterns ?? []).map(p => p.regex),
    '^[A-Z][A-Za-z0-9]*_[A-Z][A-Za-z0-9]*$',
    '^__TESTING_ONLY_',
  ];
}

export const camelcaseRule = [
  'error',
  {
    properties: 'always',
    ignoreDestructuring: false,
    ignoreImports: false,
    ignoreGlobals: false,
    allow: camelcaseAllowPatterns(),
  },
];
