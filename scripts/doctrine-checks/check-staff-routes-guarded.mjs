#!/usr/bin/env node
// Doctrine: every staff route carries a capability guard (Equoria-puj1e.1).
//
// Scans backend/modules/staff/routes/*.mjs. Every `router.<method>(...)` call
// must name `requireStaffCapability(` or `requireAnyStaffCapability(` in its
// argument list. `requireStaffRole` alone is accepted ONLY for the check-in
// request/verify paths and GET /me (a staff member who is not yet checked in
// has no capabilities to check). `router.use(` that is not itself a capability
// guard, and `router.route(` (chained registration), are reported as
// unsupported so nobody mounts an unguarded sub-router or hides a route from
// this scan.
//
// Comments and string contents are masked before matching, so a guard name that
// appears only in a comment or a string does not satisfy the check.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..', '..');
const STAFF_ROUTES_DIR = path.join(REPO_ROOT, 'backend', 'modules', 'staff', 'routes');

// requireStaffRole is enough for exactly these registrations.
const ROLE_ONLY_ALLOWED = new Set(['POST /checkin/request', 'POST /checkin/verify', 'GET /me']);

const CAPABILITY_GUARD_RE = /\b(?:requireStaffCapability|requireAnyStaffCapability)\s*\(/;
const ROLE_GUARD_RE = /\brequireStaffRole\b/;
const ROUTER_CALL_RE = /\brouter\s*\.\s*([A-Za-z]+)\s*\(/g;
const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'all', 'head', 'options']);

/**
 * Blank comments and string/template contents with spaces (newlines kept so
 * offsets and line numbers stay aligned with the original source).
 */
export function maskSource(src) {
  const out = src.split('');
  const blank = (from, to) => {
    for (let k = from; k < to; k++) if (out[k] !== '\n' && out[k] !== '\r') out[k] = ' ';
  };
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    const n = src[i + 1];
    if (c === '/' && n === '/') {
      let j = i;
      while (j < src.length && src[j] !== '\n') j++;
      blank(i, j);
      i = j;
    } else if (c === '/' && n === '*') {
      const end = src.indexOf('*/', i + 2);
      const j = end === -1 ? src.length : end + 2;
      blank(i, j);
      i = j;
    } else if (c === "'" || c === '"' || c === '`') {
      let j = i + 1;
      while (j < src.length && src[j] !== c) {
        if (src[j] === '\\') j++;
        else if (c !== '`' && src[j] === '\n') break;
        j++;
      }
      blank(i + 1, j);
      i = j + 1;
    } else {
      i++;
    }
  }
  return out.join('');
}

function closeOfCall(masked, openIdx) {
  let depth = 0;
  for (let k = openIdx; k < masked.length; k++) {
    if (masked[k] === '(') depth++;
    else if (masked[k] === ')' && --depth === 0) return k;
  }
  return -1;
}

function firstStringLiteral(src, masked, from, to) {
  for (let k = from; k < to; k++) {
    const q = masked[k];
    if (q === "'" || q === '"' || q === '`') {
      const close = masked.indexOf(q, k + 1);
      return close === -1 ? null : src.slice(k + 1, close);
    }
    if (!/\s/.test(q)) return null;
  }
  return null;
}

const lineOf = (src, idx) => src.slice(0, idx).split(/\r?\n/).length;

export function scanSource(src, file) {
  const masked = maskSource(src);
  const failures = [];
  ROUTER_CALL_RE.lastIndex = 0;
  let m;
  while ((m = ROUTER_CALL_RE.exec(masked)) !== null) {
    const method = m[1].toLowerCase();
    const openIdx = m.index + m[0].length - 1;
    const line = lineOf(src, m.index);
    const closeIdx = closeOfCall(masked, openIdx);
    if (closeIdx === -1) {
      failures.push({ file, line, reason: `unbalanced router.${m[1]}( call` });
      continue;
    }
    const args = masked.slice(openIdx + 1, closeIdx);
    if (method === 'route') {
      failures.push({ file, line, reason: 'router.route( is unsupported in staff routes' });
    } else if (method === 'use') {
      if (!CAPABILITY_GUARD_RE.test(args)) {
        failures.push({ file, line, reason: 'router.use( that is not a capability guard' });
      }
    } else if (HTTP_METHODS.has(method)) {
      if (CAPABILITY_GUARD_RE.test(args)) continue;
      const routePath = firstStringLiteral(src, masked, openIdx + 1, closeIdx);
      const key = `${method.toUpperCase()} ${routePath}`;
      if (ROLE_GUARD_RE.test(args) && ROLE_ONLY_ALLOWED.has(key)) continue;
      failures.push({
        file,
        line,
        reason: `${key} has no requireStaffCapability/requireAnyStaffCapability guard`,
      });
    }
  }
  return failures;
}

/** Scan every .mjs file under routesDir. Returns [{file, line, reason}]. */
export function scanStaffRoutes(routesDir = STAFF_ROUTES_DIR) {
  if (!fs.existsSync(routesDir)) {
    return [{ file: routesDir, line: 0, reason: 'staff routes directory not found' }];
  }
  const failures = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.mjs$/.test(entry.name)) {
        failures.push(...scanSource(fs.readFileSync(full, 'utf8'), full));
      }
    }
  };
  walk(routesDir);
  return failures;
}

function main() {
  const failures = scanStaffRoutes();
  if (failures.length > 0) {
    console.error('\nStaff routes without a capability guard:');
    for (const f of failures) {
      console.error(`  ${path.relative(REPO_ROOT, f.file)}:${f.line}  ${f.reason}`);
    }
    console.error(
      '\nEvery staff route must pass through requireStaffCapability(...) or ' +
        'requireAnyStaffCapability(...). requireStaffRole alone is allowed only ' +
        'for POST /checkin/request, POST /checkin/verify and GET /me.'
    );
    process.exit(1);
  }
  process.exit(0);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
