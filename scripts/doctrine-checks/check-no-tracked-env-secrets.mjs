#!/usr/bin/env node
// Doctrine (Equoria-07so3): no real env file may be tracked, and no tracked
// env-ish file may contain a non-placeholder secret.
//
// The P0 finding: the canonical localhost Postgres password was committed in
// plaintext across tracked .env files. Those were untracked + .gitignore'd and
// .env.example templates added; the password rotation + (optional) history
// scrub are user actions. THIS gate is the durable prevention the issue's AC
// requires — "secret scanner/gate prevents tracked env secrets" — catching the
// regression (`git add -f .env`, or a real secret pasted into a tracked
// template) BEFORE it lands, since .gitignore alone does not stop a force-add
// or a pre-existing tracked file.
//
// Two layers:
//   1. FILENAME — `git ls-files` must contain NO real env file (.env, .env.<x>,
//      env.<x>), EXCLUDING *.example (tracked placeholder templates are fine).
//   2. CONTENT — every tracked env-ish file (incl. *.example) is scanned; a
//      Postgres URL with a non-placeholder embedded password, or a
//      *PASSWORD*/ *SECRET* / *TOKEN* / *API_KEY* / *PRIVATE_KEY* assignment
//      whose value is a real secret (not a placeholder and not an obvious
//      config value: boolean / number / duration / URL / short), is a leak.
//
// Sentinel: backend/__tests__/scripts/noTrackedEnvSecrets.sentinel.test.mjs
// (pure-function coverage + planted-violation proof + real-repo-clean check).

import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * A "real" env file is one git is meant to ignore — basename `.env`,
 * `.env.<anything>`, or `env.<anything>` — EXCLUDING `*.example` templates,
 * which are intentionally tracked and hold only placeholders.
 */
export function isRealEnvFile(filePath) {
  const base = String(filePath).split(/[\\/]/).pop();
  if (base.endsWith('.example')) return false;
  if (/^\.env(\..+)?$/.test(base)) return true;
  if (/^env\.[A-Za-z0-9._-]+$/.test(base)) return true;
  return false;
}

/**
 * env-ish = env files AND their `.example` templates. This is the CONTENT-scan
 * scope: a real secret pasted into a tracked `.env.example` is still a leak.
 */
export function isEnvIshFile(filePath) {
  const base = String(filePath).split(/[\\/]/).pop();
  return /^\.env(\..+)?$/.test(base) || /^env\.[A-Za-z0-9._-]+$/.test(base);
}

// Obvious placeholder / template tokens (case-insensitive, after stripping
// surrounding quotes/whitespace). Empty is a placeholder too.
const PLACEHOLDER_RE =
  /^(?:__[a-z0-9_]*__|replace[_-]?with[_a-z0-9-]*|your[-_][a-z0-9_-]*|[a-z0-9_-]*_(?:here|goes_here|placeholder)|change[-_]?me|change[_-]?this|placeholder|example|sample|dummy|xxx+|todo|password|passwd|pass|pwd|secret|<[^>]+>|\$\{[^}]+\}|\$[a-z_][a-z0-9_]*)$/i;

/** True if `value` is a placeholder / template token, not a real secret. */
export function isPlaceholderValue(value) {
  const val = String(value ?? '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .trim();
  if (val === '') return true;
  return PLACEHOLDER_RE.test(val);
}

// Values that match a secret-bearing KEY but are clearly config, not secrets:
// booleans, numbers, durations (24h / 7d / 3.5s), URLs, and very short values.
function isObviousNonSecretValue(val) {
  if (val.length < 8) return true;
  return /^(?:true|false|none|null|\d+(?:\.\d+)?(?:[smhdwy])?|https?:\/\/\S+)$/i.test(val);
}

const DB_URL_RE = /postgres(?:ql)?:\/\/[^:@\s/]+:([^@\s/]+)@/i;
const SECRET_KV_RE =
  /^([A-Z0-9_]*(?:PASSWORD|SECRET|TOKEN|API_KEY|PRIVATE_KEY)[A-Z0-9_]*)\s*=\s*(.+)$/;

/**
 * Return one leak record per line of `content` that exposes a non-placeholder
 * secret. Each leak = { file, line, kind }.
 */
export function findSecretLeaks(filePath, content) {
  const leaks = [];
  const lines = String(content).split(/\r?\n/);
  lines.forEach((rawLine, idx) => {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) return;

    // 1) Postgres connection string with an embedded password.
    const url = line.match(DB_URL_RE);
    if (url && !isPlaceholderValue(url[1])) {
      leaks.push({ file: filePath, line: idx + 1, kind: 'db-url-password' });
      return; // one leak per line is enough signal
    }

    // 2) KEY=value where KEY names a secret and value is a real secret.
    const kv = line.match(SECRET_KV_RE);
    if (kv) {
      const key = kv[1];
      const val = kv[2]
        .trim()
        .replace(/\s+#.*$/, '') // strip trailing inline comment
        .replace(/^["']|["']$/g, '')
        .trim();
      if (!isPlaceholderValue(val) && !isObviousNonSecretValue(val)) {
        leaks.push({ file: filePath, line: idx + 1, kind: `secret:${key}` });
      }
    }
  });
  return leaks;
}

/** Filter a list of tracked paths down to the real (non-.example) env files. */
export function findTrackedEnvFiles(trackedFilePaths) {
  return trackedFilePaths.filter(isRealEnvFile);
}

function main() {
  const tracked = execSync('git ls-files', { cwd: REPO_ROOT, encoding: 'utf8' })
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);

  const trackedEnvFiles = findTrackedEnvFiles(tracked);

  const leaks = [];
  for (const f of tracked.filter(isEnvIshFile)) {
    const abs = path.join(REPO_ROOT, f);
    if (!existsSync(abs)) continue; // tolerant: a file can vanish (concurrent plant/delete)
    leaks.push(...findSecretLeaks(f, readFileSync(abs, 'utf8')));
  }

  if (trackedEnvFiles.length > 0 || leaks.length > 0) {
    console.error('[no-tracked-env-secrets] FAIL (Equoria-07so3):');
    if (trackedEnvFiles.length > 0) {
      console.error(
        `  ${trackedEnvFiles.length} real env file(s) tracked (must be git-ignored, never committed):`
      );
      for (const f of trackedEnvFiles) console.error(`    - ${f}`);
      console.error('  Fix: git rm --cached <file> (keep on disk), confirm .gitignore covers it.');
    }
    if (leaks.length > 0) {
      console.error(`  ${leaks.length} non-placeholder secret(s) in tracked env-ish file(s):`);
      for (const l of leaks.slice(0, 20)) console.error(`    - ${l.file}:${l.line} [${l.kind}]`);
      if (leaks.length > 20) console.error(`    … and ${leaks.length - 20} more`);
      console.error(
        '  Fix: replace the real value with a placeholder (e.g. __SET_LOCALLY__); rotate the leaked credential.'
      );
    }
    process.exit(1);
  }

  console.log(
    `[no-tracked-env-secrets] OK — 0 real env files tracked, 0 leaked secrets across ${tracked.filter(isEnvIshFile).length} tracked env template(s)`
  );
}

// ESM main-module guard (CONTRIBUTING.md): the scan runs only as the direct
// entrypoint; a bare import (the sentinel test) gets the pure exports with no
// side effects.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
