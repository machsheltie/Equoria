/**
 * Equoria-64tby pre-commit gate sentinel.
 *
 * Proves the .husky/pre-commit hook actually invokes the
 * silent-cleanup-catch ratchet. If someone removes the doctrine call
 * from the pre-commit hook (and the rationale comment with it), this
 * sentinel fails. Without it, the gate could silently degrade to "lint
 * only" while CLAUDE.md still claims doctrine is enforced at commit
 * time — exactly the false-green pattern OPTIMAL_FIX_DISCIPLINE §2
 * rejects.
 *
 * This is a static-content sentinel — no subprocess, no git operations,
 * no environment dependencies. It just confirms the hook file contains
 * the canonical invocation. If the hook moves or is renamed, the test
 * must be updated alongside it.
 */

import { describe, it, expect } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const PRE_COMMIT_HOOK = path.join(REPO_ROOT, '.husky/pre-commit');
const DOCTRINE_CHECK_REL = 'scripts/doctrine-checks/check-no-new-silent-cleanup-catch.mjs';

describe('.husky/pre-commit doctrine gate (Equoria-64tby)', () => {
  const src = fs.readFileSync(PRE_COMMIT_HOOK, 'utf8');

  it('exists as a regular file', () => {
    expect(fs.statSync(PRE_COMMIT_HOOK).isFile()).toBe(true);
  });

  it('invokes the silent-cleanup-catch doctrine ratchet', () => {
    expect(src).toContain(DOCTRINE_CHECK_REL);
  });

  it('blocks the commit (non-zero exit) when the ratchet fails', () => {
    // The hook MUST contain a non-zero exit on doctrine failure.
    // Without this, the call would run but its return code would be
    // ignored — a placebo gate. Match either `exit 1` after a doctrine
    // failure branch, or `set -e`-style propagation.
    expect(src).toMatch(/exit\s+1/);
  });

  it('names Equoria-64tby in the rationale so the gate is traceable', () => {
    expect(src).toContain('Equoria-64tby');
  });
});
