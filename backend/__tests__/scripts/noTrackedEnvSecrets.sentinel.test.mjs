/**
 * Sentinel — no real env file may be tracked, and no tracked env-ish file may
 * contain a non-placeholder secret (Equoria-07so3).
 *
 * The P0 finding: the canonical localhost Postgres password was committed in
 * plaintext across tracked .env files (since untracked + .gitignore'd +
 * .env.example added). Rotation is a user action; THIS gate is the durable
 * prevention the AC requires — "secret scanner/gate prevents tracked env
 * secrets" — so a force-add (`git add -f .env`) or a real secret pasted into a
 * tracked template re-introduces the regression and fails CI before it lands.
 *
 * Two layers, both high-signal:
 *   1. FILENAME gate — `git ls-files` must contain NO real env file. A real env
 *      file is one git is meant to ignore (.env, .env.<x>, env.<x>), EXCLUDING
 *      *.example (tracked placeholder templates are legitimate).
 *   2. CONTENT gate — every tracked env-ish file (incl. *.example) is scanned;
 *      a Postgres URL with an embedded non-placeholder password, or a
 *      PASSWORD- / SECRET- / TOKEN-bearing assignment with a non-placeholder value,
 *      is a leak.
 *
 * This sentinel pins BOTH directions (EDGE_CASE_FIX_DISCIPLINE.md §1,
 * OPTIMAL_FIX_DISCIPLINE.md §2): the gate FIRES on the exact 07so3 leak shape
 * and on force-added env files, and does NOT false-positive on the current
 * tracked .example placeholders (verified against the real repo).
 *
 * The authoritative gate is the doctrine check
 * (scripts/doctrine-checks/check-no-tracked-env-secrets.mjs), run in the
 * pre-push + doctrine-gate workflow. This sentinel mirrors its pure logic and
 * carries the planted-violation proof.
 */
import { describe, it, expect } from '@jest/globals';
import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  isRealEnvFile,
  isEnvIshFile,
  isPlaceholderValue,
  findSecretLeaks,
  findTrackedEnvFiles,
} from '../../../scripts/doctrine-checks/check-no-tracked-env-secrets.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

describe('no-tracked-env-secrets gate — filename layer (Equoria-07so3)', () => {
  it('classifies real env files as real (must never be tracked)', () => {
    for (const f of [
      '.env',
      'backend/.env.test',
      'backend/env.beta',
      'backend/env.beta-readiness',
      'packages/database/.env',
      '.env.local',
      '.env.production',
    ]) {
      expect(isRealEnvFile(f)).toBe(true);
    }
  });

  it('treats *.example templates as NOT-real (they are meant to be tracked)', () => {
    for (const f of [
      '.env.example',
      'backend/.env.example',
      'backend/.env.test.example',
      'frontend/.env.example',
      'packages/database/.env.example',
    ]) {
      expect(isRealEnvFile(f)).toBe(false);
    }
  });

  it('does not misclassify ordinary files as env files', () => {
    for (const f of ['README.md', 'backend/server.mjs', 'src/environment.ts', '.mcp.json', 'env-utils.js']) {
      expect(isRealEnvFile(f)).toBe(false);
    }
  });

  it('SENTINEL-POSITIVE: findTrackedEnvFiles flags a force-added real env among a mixed list', () => {
    const mixed = ['README.md', 'backend/.env', 'backend/.env.example', 'env.test', 'src/app.ts'];
    expect(findTrackedEnvFiles(mixed).sort()).toEqual(['backend/.env', 'env.test']);
  });
});

describe('no-tracked-env-secrets gate — content layer (Equoria-07so3)', () => {
  it('recognises the current tracked placeholders as placeholders (no false positives)', () => {
    for (const v of [
      '__SET_LOCALLY__',
      'REPLACE_WITH_STRONG_PASSWORD',
      'your-redis-password',
      'changeme',
      '<your-password>',
      '${DB_PASSWORD}',
      '',
    ]) {
      expect(isPlaceholderValue(v)).toBe(true);
    }
  });

  it('recognises a real high-entropy secret as NON-placeholder', () => {
    for (const v of ['JimpkpNnVF2o%23DaX1Qx0', 's3cretP@ssw0rd-9f3a2b', 'AKIA1234567890ABCDEF']) {
      expect(isPlaceholderValue(v)).toBe(false);
    }
  });

  it('SENTINEL-POSITIVE: findSecretLeaks fires on the exact 07so3 leak shape (db URL password)', () => {
    const content = [
      '# local env',
      'DATABASE_URL="postgresql://postgres:JimpkpNnVF2o%23DaX1Qx0@localhost:5432/equoria"',
      'PORT=3001',
    ].join('\n');
    const leaks = findSecretLeaks('backend/.env', content);
    expect(leaks.length).toBeGreaterThan(0);
    expect(leaks[0].kind).toBe('db-url-password');
    expect(leaks[0].line).toBe(2);
  });

  it('SENTINEL-POSITIVE: findSecretLeaks fires on a non-placeholder *_SECRET assignment', () => {
    const content = 'JWT_SECRET=a9f83bc1e07d4a2f9c6b1e8d2740aa31\nNODE_ENV=test';
    const leaks = findSecretLeaks('.env', content);
    expect(leaks.some(l => l.kind === 'secret:JWT_SECRET')).toBe(true);
  });

  it('does NOT fire on placeholder values or commented lines', () => {
    const content = [
      'DATABASE_URL="postgresql://postgres:REPLACE_WITH_STRONG_PASSWORD@localhost:5432/equoria"',
      'DATABASE_URL=__SET_LOCALLY__',
      'REDIS_PASSWORD=',
      '# REDIS_PASSWORD=your-redis-password',
      'JWT_SECRET=__SET_LOCALLY__',
    ].join('\n');
    expect(findSecretLeaks('backend/.env.example', content)).toEqual([]);
  });

  it('isEnvIshFile covers env files AND their .example templates (content-scan scope)', () => {
    expect(isEnvIshFile('backend/.env.example')).toBe(true);
    expect(isEnvIshFile('backend/.env')).toBe(true);
    expect(isEnvIshFile('env.test')).toBe(true);
    expect(isEnvIshFile('README.md')).toBe(false);
  });
});

describe('no-tracked-env-secrets gate — REAL REPO is currently clean (Equoria-07so3)', () => {
  const tracked = execSync('git ls-files', { cwd: REPO_ROOT, encoding: 'utf8' })
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean);

  it('no real env file is tracked', () => {
    expect(findTrackedEnvFiles(tracked)).toEqual([]);
  });

  it('no tracked env-ish file (the .example templates) leaks a non-placeholder secret', () => {
    const leaks = [];
    for (const f of tracked.filter(isEnvIshFile)) {
      const abs = path.join(REPO_ROOT, f);
      if (!existsSync(abs)) {
        continue;
      }
      leaks.push(...findSecretLeaks(f, readFileSync(abs, 'utf8')));
    }
    expect(leaks).toEqual([]);
  });
});
