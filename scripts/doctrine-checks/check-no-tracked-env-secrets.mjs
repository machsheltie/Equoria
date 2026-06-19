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
// Three layers:
//   1. FILENAME — `git ls-files` must contain NO real env file (.env, .env.<x>,
//      env.<x>), EXCLUDING *.example (tracked placeholder templates are fine).
//   2. CONTENT (env) — every tracked env-ish file (incl. *.example) is scanned; a
//      Postgres URL with a non-placeholder embedded password, or a
//      *PASSWORD*/ *SECRET* / *TOKEN* / *API_KEY* / *PRIVATE_KEY* assignment
//      whose value is a real secret (not a placeholder and not an obvious
//      config value: boolean / number / duration / URL / short), is a leak.
//   3. CONTENT (curated config, Equoria-9ccyt) — tracked compose / .mcp.json
//      files are scanned for the same secret shapes, with a localhost/dev-default
//      credential allowlist so legitimate dev creds don't false-positive. See
//      the "Curated NON-env config-file scan" block below for the calibration
//      rationale (a naive whole-tree scan is high-false-positive).
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

// ── Curated NON-env config-file scan (Equoria-9ccyt) ──────────────────────────
// kqiyp untracked the concrete leak (.mcp.json with an embedded Postgres URL).
// This is the broader durable gate, scoped to a CURATED set of config-file
// types that commonly embed real credentials. The scope is deliberately tight:
// a calibration pass (2026-06-18) found a naive content scan over the whole
// tree is high-false-positive — CI service creds (.github/workflows), docs
// connection-string examples, and the .archive/.backups trees all carry legit
// localhost/test creds. So we scan only compose / mcp config files AND apply a
// localhost/dev-default credential allowlist, catching a real secret pasted
// into a tracked docker-compose or .mcp.json before it lands. (Build-ahead:
// none of these file types are tracked today — the gate prevents the
// regression, mirroring the upload/SSRF build-ahead guards.)

const CURATED_CONFIG_BASENAME_RE =
  /^(?:docker-compose(?:\.[A-Za-z0-9_-]+)*\.ya?ml|compose(?:\.[A-Za-z0-9_-]+)*\.ya?ml|\.?mcp\.json)$/i;

/** True for the curated set of non-env config files that may embed secrets. */
export function isCuratedConfigFile(filePath) {
  const base = String(filePath).split(/[\\/]/).pop();
  return CURATED_CONFIG_BASENAME_RE.test(base);
}

// Credentials that are legitimately committed in compose/mcp config: a
// well-known dev/test password against a local/dev/docker-service host.
const SAFE_DEV_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  'db',
  'database',
  'postgres',
  'postgresql',
  'mysql',
  'mariadb',
  'mongo',
  'mongodb',
  'redis',
  'host.docker.internal',
]);
const SAFE_DEV_DB_PASSWORDS = new Set([
  'postgres',
  'password',
  'test',
  'root',
  'admin',
  'mysql',
  'mariadb',
  'dev',
  'example',
  'postgrespassword',
]);

// Fuller DB-URL matcher capturing user:password@host so the host can gate the
// allowlist (a dev password is only "safe" against a local/dev host).
const DB_URL_FULL_RE =
  /(?:postgres(?:ql)?|mysql|mariadb|mongodb):\/\/([^:@\s/]+):([^@\s/]+)@([^:/\s"']+)/i;

/** True if the line carries a known dev/test DB credential against a local host. */
export function isAllowlistedDevCredential(line) {
  const m = String(line).match(DB_URL_FULL_RE);
  if (!m) return false;
  const pass = m[2].toLowerCase();
  const host = m[3].toLowerCase();
  const safeHost = SAFE_DEV_HOSTS.has(host) || host.endsWith('.local');
  return safeHost && SAFE_DEV_DB_PASSWORDS.has(pass);
}

// Secret-bearing KV across env/yaml/json separators (`=` and `:`), tolerating a
// quoted key (JSON: "dbPassword": "..."). Case-insensitive so JSON lowercase
// keys are caught.
const CONFIG_SECRET_KV_RE =
  /["']?([A-Za-z0-9_]*(?:PASSWORD|SECRET|TOKEN|API[_-]?KEY|PRIVATE[_-]?KEY|ACCESS[_-]?KEY)[A-Za-z0-9_]*)["']?\s*[:=]\s*(.+)$/i;

/**
 * Like findSecretLeaks, but for curated config files: same DB-URL + secret-KV
 * detection, plus the localhost/dev-default credential allowlist so legitimate
 * compose dev creds don't false-positive. One leak record per offending line.
 */
export function findConfigSecretLeaks(filePath, content) {
  const leaks = [];
  const lines = String(content).split(/\r?\n/);
  lines.forEach((rawLine, idx) => {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#') || line.startsWith('//')) return;
    if (isAllowlistedDevCredential(line)) return;

    // 1) Embedded DB connection string with a non-placeholder password.
    const url = line.match(DB_URL_RE);
    if (url && !isPlaceholderValue(url[1])) {
      leaks.push({ file: filePath, line: idx + 1, kind: 'config-db-url-password' });
      return;
    }

    // 2) secret-bearing KEY: value / KEY=value with a real value.
    const kv = line.match(CONFIG_SECRET_KV_RE);
    if (kv) {
      const key = kv[1];
      const val = kv[2]
        .trim()
        .replace(/,\s*$/, '') // strip JSON trailing comma
        .replace(/\s+#.*$/, '') // strip trailing yaml/sh comment
        .replace(/^["']|["']$/g, '')
        .trim();
      if (
        !isPlaceholderValue(val) &&
        !isObviousNonSecretValue(val) &&
        !SAFE_DEV_DB_PASSWORDS.has(val.toLowerCase())
      ) {
        leaks.push({ file: filePath, line: idx + 1, kind: `config-secret:${key}` });
      }
    }
  });
  return leaks;
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

  // Curated NON-env config files (Equoria-9ccyt): compose / .mcp.json.
  const curatedConfigFiles = tracked.filter(isCuratedConfigFile);
  for (const f of curatedConfigFiles) {
    const abs = path.join(REPO_ROOT, f);
    if (!existsSync(abs)) continue;
    leaks.push(...findConfigSecretLeaks(f, readFileSync(abs, 'utf8')));
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
    `[no-tracked-env-secrets] OK — 0 real env files tracked, 0 leaked secrets across ${tracked.filter(isEnvIshFile).length} tracked env template(s) + ${curatedConfigFiles.length} curated config file(s)`
  );
}

// ESM main-module guard (CONTRIBUTING.md): the scan runs only as the direct
// entrypoint; a bare import (the sentinel test) gets the pure exports with no
// side effects.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
