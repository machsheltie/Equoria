#!/usr/bin/env node
// Doctrine: every `requireRole('admin')`-gated HTTP route must also carry
// `requireAdminMfa` in the SAME route/mount call expression, so the optional
// ADMIN_MFA_REQUIRED policy (Equoria-te21j) covers every admin-gated surface.
//
// Source: Equoria-e4a2y (structural guard). The Equoria-l432a incident found
// POST /shows/execute was `requireRole('admin')` on the authRouter (NOT the
// adminRouter), so the global `requireAdminMfa` mounted on the adminRouter did
// not apply — it had to be added per-route. Any future admin-gated route added
// to the authRouter (or app level, or any sub-router) would silently miss the
// MFA gate the same way. This check fails CI the moment a `requireRole('admin')`
// route ships without `requireAdminMfa` in the same call expression.
//
// Why "same call expression" rather than "anywhere in the file": a route's
// middleware chain is exactly the arguments to its own router.METHOD(...) /
// app.METHOD(...) / .use(...) call. A `requireAdminMfa` somewhere else in the
// file (a different route) does NOT protect this route. Co-location in the same
// call is the only thing that proves coverage by construction — independent of
// which router (auth / admin / app) the file is mounted on. The adminRouter base
// mount carries BOTH in one `.use(authenticateToken, requireRole('admin'),
// requireAdminMfa)` statement (Equoria-e4a2y), so it satisfies the same rule
// rather than needing a mount-relationship exception the scanner can't see.
//
// Scope: production route composition + route files only —
//   - backend/app.mjs
//   - backend/app/routers.mjs
//   - backend/modules/**/routes/*.mjs
//   - backend/routes/*.mjs
// Tests are NOT scanned (they exercise requireRole directly as a unit).
//
// Per-line exemption marker (none currently expected — any new admin route that
// legitimately must NOT carry requireAdminMfa MUST justify it in the commit
// message AND add the marker on the requireRole line):
//   // doctrine-allow: admin-mfa-coverage

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { readScannedFileSyncTolerant } from '../lib/doctrine-scan-patterns.mjs';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..', '..');
const BACKEND_ROOT = path.join(REPO_ROOT, 'backend');

if (!fs.existsSync(BACKEND_ROOT)) {
  process.exit(0);
}

const EXEMPTION_MARKER = '// doctrine-allow: admin-mfa-coverage';
const ADMIN_ROLE_RX = /requireRole\(\s*['"]admin['"]\s*\)/;

// Collect the production files that compose / define HTTP routes.
function collectRouteFiles() {
  const files = [];

  const appMjs = path.join(BACKEND_ROOT, 'app.mjs');
  if (fs.existsSync(appMjs)) {
    files.push(appMjs);
  }

  const routersMjs = path.join(BACKEND_ROOT, 'app', 'routers.mjs');
  if (fs.existsSync(routersMjs)) {
    files.push(routersMjs);
  }

  // backend/routes/*.mjs (shims + legacy entries)
  const topRoutes = path.join(BACKEND_ROOT, 'routes');
  if (fs.existsSync(topRoutes)) {
    walkMjs(topRoutes, files);
  }

  // backend/modules/<x>/routes/*.mjs
  const modulesRoot = path.join(BACKEND_ROOT, 'modules');
  if (fs.existsSync(modulesRoot)) {
    for (const moduleEntry of fs.readdirSync(modulesRoot, { withFileTypes: true })) {
      if (!moduleEntry.isDirectory()) {
        continue;
      }
      const routesDir = path.join(modulesRoot, moduleEntry.name, 'routes');
      if (!fs.existsSync(routesDir)) {
        continue;
      }
      walkMjs(routesDir, files);
    }
  }

  return files;
}

function walkMjs(dir, results) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkMjs(full, results);
    } else if (entry.isFile() && entry.name.endsWith('.mjs')) {
      results.push(full);
    }
  }
}

// Strip line + block comments and string/template literals, replacing each
// removed character with a space so byte offsets (and therefore line numbers)
// are preserved. This stops a `requireRole('admin')` mentioned in a doc-comment
// or a string literal from being read as a real route gate, and stops the
// EXEMPTION_MARKER from being matched inside a string. requireRole('admin') is
// matched on the ORIGINAL source line (so the role string survives), but the
// "is it inside a comment" decision uses this blanked view.
function blankCommentsAndStrings(src) {
  const out = new Array(src.length).fill('');
  let i = 0;
  const n = src.length;
  let state = 'code'; // code | line | block | sq | dq | tpl
  while (i < n) {
    const ch = src[i];
    const next = i + 1 < n ? src[i + 1] : '';
    if (state === 'code') {
      if (ch === '/' && next === '/') {
        state = 'line';
        out[i] = ' ';
        out[i + 1] = ' ';
        i += 2;
        continue;
      }
      if (ch === '/' && next === '*') {
        state = 'block';
        out[i] = ' ';
        out[i + 1] = ' ';
        i += 2;
        continue;
      }
      if (ch === "'") {
        state = 'sq';
        out[i] = ' ';
        i += 1;
        continue;
      }
      if (ch === '"') {
        state = 'dq';
        out[i] = ' ';
        i += 1;
        continue;
      }
      if (ch === '`') {
        state = 'tpl';
        out[i] = ' ';
        i += 1;
        continue;
      }
      out[i] = ch;
      i += 1;
      continue;
    }
    if (state === 'line') {
      if (ch === '\n') {
        state = 'code';
        out[i] = '\n';
      } else {
        out[i] = ' ';
      }
      i += 1;
      continue;
    }
    if (state === 'block') {
      if (ch === '*' && next === '/') {
        state = 'code';
        out[i] = ' ';
        out[i + 1] = ' ';
        i += 2;
        continue;
      }
      out[i] = ch === '\n' ? '\n' : ' ';
      i += 1;
      continue;
    }
    // string/template states
    if (ch === '\\') {
      out[i] = ' ';
      out[i + 1] = ' ';
      i += 2;
      continue;
    }
    if (
      (state === 'sq' && ch === "'") ||
      (state === 'dq' && ch === '"') ||
      (state === 'tpl' && ch === '`')
    ) {
      state = 'code';
      out[i] = ' ';
      i += 1;
      continue;
    }
    out[i] = ch === '\n' ? '\n' : ' ';
    i += 1;
  }
  return out.join('');
}

// Given the blanked source and an offset that falls inside a route/mount call
// expression, return [startOffset, endOffset] of the full balanced call. We
// scan LEFT to the nearest `(` whose matching `)` is to the RIGHT of the offset,
// then expand to that matching `)`. This captures the entire argument list even
// when the call spans many lines.
function enclosingCallRange(blanked, offset) {
  // Walk left, tracking paren depth, until we find the `(` that opens the call
  // containing `offset`.
  let depth = 0;
  let openIdx = -1;
  for (let i = offset; i >= 0; i--) {
    const c = blanked[i];
    if (c === ')') {
      depth += 1;
    } else if (c === '(') {
      if (depth === 0) {
        openIdx = i;
        break;
      }
      depth -= 1;
    }
  }
  if (openIdx === -1) {
    return null;
  }
  // Expand right to the matching close paren.
  let d = 0;
  for (let i = openIdx; i < blanked.length; i++) {
    const c = blanked[i];
    if (c === '(') {
      d += 1;
    } else if (c === ')') {
      d -= 1;
      if (d === 0) {
        return [openIdx, i];
      }
    }
  }
  return null;
}

function lineOf(src, offset) {
  let line = 1;
  for (let i = 0; i < offset && i < src.length; i++) {
    if (src[i] === '\n') {
      line += 1;
    }
  }
  return line;
}

const violations = [];

for (const file of collectRouteFiles()) {
  const source = readScannedFileSyncTolerant(file, 'admin-mfa-coverage');
  if (source === null) {
    continue; // vanished mid-scan (ENOENT) — skip, noticed
  }
  const blanked = blankCommentsAndStrings(source);

  // Find every real (non-comment, non-string) requireRole('admin') by scanning
  // the BLANKED view for `requireRole(` then confirming the ORIGINAL slice is an
  // admin gate. The role string lives in a literal, so we match it on `source`
  // at the same offset range.
  const callRx = /requireRole\s*\(/g;
  let m;
  while ((m = callRx.exec(blanked)) !== null) {
    const start = m.index;
    // Re-test the admin-role shape against the ORIGINAL source from this offset
    // (the literal 'admin' was blanked out, so we read it back from source).
    const window = source.slice(start, start + 40);
    if (!ADMIN_ROLE_RX.test(window)) {
      continue; // requireRole('moderator') or similar — not an admin gate
    }

    const line = lineOf(source, start);
    const sourceLine = source.split(/\r?\n/)[line - 1] || '';
    if (sourceLine.includes(EXEMPTION_MARKER)) {
      continue;
    }

    const range = enclosingCallRange(blanked, start);
    if (range === null) {
      // Could not find an enclosing call — treat as a violation so a malformed
      // / unusual construct is surfaced rather than silently skipped.
      violations.push({
        file: path.relative(REPO_ROOT, file),
        line,
        snippet: sourceLine.trim().slice(0, 120),
        reason: 'no enclosing route/mount call expression found',
      });
      continue;
    }
    const [callStart, callEnd] = range;
    const callText = blanked.slice(callStart, callEnd + 1);
    if (!callText.includes('requireAdminMfa')) {
      violations.push({
        file: path.relative(REPO_ROOT, file),
        line,
        snippet: sourceLine.trim().slice(0, 120),
        reason: 'requireRole(admin) route is missing requireAdminMfa in the same call',
      });
    }
  }
}

if (violations.length === 0) {
  process.stdout.write(
    '[admin-mfa-coverage] OK — every requireRole(admin) route carries requireAdminMfa ' +
      'in the same call expression (Equoria-e4a2y)\n',
  );
  process.exit(0);
}

process.stderr.write(
  `[admin-mfa-coverage] FAIL — ${violations.length} admin-gated route(s) missing requireAdminMfa ` +
    '(Equoria-e4a2y).\n' +
    "  Add `requireAdminMfa` directly AFTER `requireRole('admin')` in the route/mount\n" +
    '  call so the optional ADMIN_MFA_REQUIRED policy covers it. See showRoutes.mjs\n' +
    '  (Equoria-l432a) for the pattern.\n\n',
);
for (const v of violations) {
  process.stderr.write(`  ${v.file}:${v.line}  ${v.snippet}\n      → ${v.reason}\n`);
}
process.exit(1);
