#!/usr/bin/env node
/**
 * Equoria-e7l2 (21R-CI-3): blocking npm audit with expiry-tracked allowlist.
 *
 * Replaces the previous raw `npm audit --audit-level=moderate` CI calls.
 * That command had two failure modes for our workflow:
 *
 *   1. No allowlist mechanism. A new high-severity GHSA in any transitive
 *      dependency instantly blocked deployment with no escape valve, so
 *      CI status would flip from green to red on every advisory database
 *      update — even when the vuln didn't apply to our code path.
 *
 *   2. No expiry tracking. Even with an allowlist, entries left to rot
 *      become permanent silent suppression. We need every allowlist
 *      decision to come with a forced re-evaluation date.
 *
 * This script enforces both:
 *
 *   - Reads `scripts/audit-allowlist.json` (or the path passed as the
 *     third CLI arg) and validates every entry has a future `expires`
 *     date. CI fails (exit 3) if any entry is past expiry, with the
 *     entry details printed so the maintainer knows what to renew or
 *     remove.
 *
 *   - Runs `npm audit --json` in the working directory passed as the
 *     first CLI arg. Walks the vulnerability tree, extracts every
 *     advisory GHSA, and fails (exit 1) if any advisory at or above the
 *     severity threshold is NOT in the active (non-expired) allowlist.
 *
 * Usage:
 *   node scripts/audit-with-allowlist.mjs <workingDir> [severity] [allowlistPath]
 *
 *   workingDir      Directory containing the package-lock.json to audit
 *                   (e.g. ./backend, ./frontend, .).
 *   severity        Threshold: low | moderate | high | critical.
 *                   Default: high. Vulns below the threshold are not
 *                   blocking.
 *   allowlistPath   Override path to allowlist JSON. Default:
 *                   scripts/audit-allowlist.json relative to repo root.
 *
 * Exit codes:
 *   0  no blocking vulnerabilities; allowlist clean
 *   1  one or more vulnerabilities at or above severity NOT in allowlist
 *   2  malformed allowlist (invalid JSON, missing fields, bad date)
 *   3  one or more allowlist entries are past expiry
 *   4  could not read allowlist file or could not parse npm audit output
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';
import { argv, exit, cwd } from 'node:process';

const SEVERITY_RANK = { info: 0, low: 1, moderate: 2, high: 3, critical: 4 };

function parseArgs() {
  const args = argv.slice(2);
  const workingDir = args[0] || '.';
  const severity = args[1] || 'high';
  const allowlistPath = args[2] || resolve(cwd(), 'scripts', 'audit-allowlist.json');
  if (!(severity in SEVERITY_RANK)) {
    console.error(
      `FAIL: unknown severity "${severity}". Allowed: ${Object.keys(SEVERITY_RANK).join(', ')}.`
    );
    exit(2);
  }
  return { workingDir, severity, allowlistPath };
}

function loadAllowlist(path) {
  let raw;
  try {
    raw = readFileSync(path, 'utf8');
  } catch (e) {
    console.error(`FAIL: could not read allowlist at ${path}: ${e.message}`);
    exit(4);
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    console.error(`FAIL: allowlist at ${path} is not valid JSON: ${e.message}`);
    exit(2);
  }
  if (!Array.isArray(parsed.allowlist)) {
    console.error(`FAIL: allowlist file must have an "allowlist" array at the root.`);
    exit(2);
  }
  return parsed.allowlist;
}

function partitionByExpiry(entries, now) {
  const expired = [];
  const active = new Map();
  const malformed = [];
  for (const entry of entries) {
    if (!entry || typeof entry.id !== 'string' || !entry.id.startsWith('GHSA-')) {
      malformed.push({ entry, reason: 'missing or non-GHSA id' });
      continue;
    }
    if (typeof entry.justification !== 'string' || entry.justification.length < 10) {
      malformed.push({ entry, reason: 'missing or too-short justification' });
      continue;
    }
    if (typeof entry.expires !== 'string') {
      malformed.push({ entry, reason: 'missing expires (ISO date string)' });
      continue;
    }
    const expDate = new Date(entry.expires);
    if (Number.isNaN(expDate.getTime())) {
      malformed.push({ entry, reason: `invalid expires "${entry.expires}"` });
      continue;
    }
    if (expDate < now) {
      expired.push({ ...entry, expDate });
    } else {
      active.set(entry.id, { ...entry, expDate });
    }
  }
  return { expired, active, malformed };
}

function runNpmAudit(workingDir) {
  let stdout;
  try {
    stdout = execSync('npm audit --json', {
      cwd: workingDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (e) {
    // npm audit exits non-zero when vulnerabilities are found; the JSON
    // is still on stdout. Capture it.
    stdout = e.stdout || '';
    if (!stdout) {
      console.error(`FAIL: npm audit failed with no JSON output: ${e.message}`);
      exit(4);
    }
  }
  try {
    return JSON.parse(stdout);
  } catch (e) {
    console.error(`FAIL: could not parse npm audit JSON: ${e.message}`);
    exit(4);
  }
}

function extractGhsasFromVia(via) {
  const out = new Set();
  for (const v of via) {
    if (typeof v !== 'object' || !v) continue;
    const url = String(v.url || '');
    const m = url.match(/GHSA-[\w-]+/);
    if (m) out.add(m[0]);
  }
  return [...out];
}

function findBlockers(audit, threshold, active) {
  const thresholdRank = SEVERITY_RANK[threshold];
  const blockers = [];
  const vulns = audit?.vulnerabilities || {};
  for (const [pkgName, info] of Object.entries(vulns)) {
    const sevRank = SEVERITY_RANK[info.severity] ?? 0;
    if (sevRank < thresholdRank) continue;
    const ghsas = extractGhsasFromVia(info.via || []);
    if (ghsas.length === 0) {
      // No GHSA we can pin this against — block by default; cannot
      // allowlist a non-identifiable advisory.
      blockers.push({ pkg: pkgName, severity: info.severity, ghsas: ['(unidentified)'] });
      continue;
    }
    const allAllowed = ghsas.every((g) => active.has(g));
    if (!allAllowed) {
      const unmatched = ghsas.filter((g) => !active.has(g));
      blockers.push({ pkg: pkgName, severity: info.severity, ghsas: unmatched });
    }
  }
  return blockers;
}

function main() {
  const { workingDir, severity, allowlistPath } = parseArgs();
  const now = new Date();
  const entries = loadAllowlist(allowlistPath);
  const { expired, active, malformed } = partitionByExpiry(entries, now);

  if (malformed.length) {
    console.error('FAIL: malformed allowlist entries:');
    for (const m of malformed) {
      console.error(`  ${m.reason}: ${JSON.stringify(m.entry)}`);
    }
    exit(2);
  }

  if (expired.length) {
    console.error('FAIL: the following allowlist entries are past expiry:');
    for (const e of expired) {
      console.error(`  ${e.id}  expired ${e.expires}  (${e.justification.slice(0, 80)})`);
    }
    console.error(
      'Either remove the entry (vulnerability fixed?) or refresh `expires` after re-justifying the risk.'
    );
    exit(3);
  }

  const audit = runNpmAudit(workingDir);
  const blockers = findBlockers(audit, severity, active);

  if (blockers.length) {
    console.error(
      `FAIL: ${blockers.length} unallowlisted vulnerabilit${blockers.length === 1 ? 'y' : 'ies'} at >= ${severity} severity in ${workingDir}:`
    );
    for (const b of blockers) {
      console.error(`  ${b.pkg}  (${b.severity})  advisories: ${b.ghsas.join(', ')}`);
    }
    console.error(
      'Either upgrade the dependency to fix the advisory, or add the GHSA(s) to scripts/audit-allowlist.json with justification + expires.'
    );
    exit(1);
  }

  console.log(
    `OK: 0 unallowlisted vulnerabilities at >=${severity} severity in ${workingDir} ` +
      `(allowlist: ${active.size} active entr${active.size === 1 ? 'y' : 'ies'}).`
  );
  exit(0);
}

main();
