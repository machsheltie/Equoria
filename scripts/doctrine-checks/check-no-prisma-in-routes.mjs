#!/usr/bin/env node
// Doctrine: backend routes layer must not import the Prisma client.
// Source: Equoria-becrm (routes own validation + response formatting;
// data access lives in services).
//
// Scans `backend/modules/**/routes/*.mjs` AND `backend/routes/*.mjs`
// for either:
//   - an `import prisma from '<path-with-prismaClient.mjs-or-db/index.mjs>'`
//     statement (static or dynamic),
//   - any literal call expression `prisma.X(...)` in the route source.
//
// Mirrors the ESLint `no-restricted-imports` block in
// `backend/eslint.config.mjs` (Equoria-becrm), but runs in the same
// doctrine-check pipeline as the rest of the gates so CI fails on
// drift even if eslint is bypassed locally.
//
// Per-line exemption marker (none currently expected — any new use
// MUST be justified in the commit message AND added with the marker):
//   // doctrine-allow: prisma-in-routes

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Equoria-7avnu: route enumerated-file reads through the shared tolerant reader
// so a file that vanishes mid-scan (concurrent jest sentinel plant+delete, the
// q7lqz race) is skipped loudly (ENOENT-only) instead of crashing the check.
import { readScannedFileSyncTolerant } from '../lib/doctrine-scan-patterns.mjs';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..', '..');
const BACKEND_ROOT = path.join(REPO_ROOT, 'backend');

if (!fs.existsSync(BACKEND_ROOT)) {
  process.exit(0);
}

const EXEMPTION_MARKER = '// doctrine-allow: prisma-in-routes';

// Match an import (static OR dynamic) whose source ends in prismaClient.mjs
// or db/index.mjs. The deleted `db/index.mjs` shim is also banned globally
// by another rule, but covering both here makes this gate self-contained.
const IMPORT_RX =
  /(^|\s)(import\s+[^;]+from\s+['"][^'"]*?(?:prismaClient\.mjs|db\/index\.mjs)['"])|(\bimport\s*\(\s*['"][^'"]*?(?:prismaClient\.mjs|db\/index\.mjs)['"]\s*\))/;

// Match a `prisma.<identifier>` token at any line position. Catches both
// real call expressions (`await prisma.horse.findMany(...)`) and the
// `prisma.X.Y` member-access form that legitimately appears nowhere in
// routes anymore.
const PRISMA_CALL_RX = /\bprisma\.[A-Za-z_$]/;

function walkRoutesFiles() {
  const results = [];

  // Walk modules/<x>/routes/*.mjs
  const modulesRoot = path.join(BACKEND_ROOT, 'modules');
  if (fs.existsSync(modulesRoot)) {
    for (const moduleEntry of fs.readdirSync(modulesRoot, { withFileTypes: true })) {
      if (!moduleEntry.isDirectory()) continue;
      const routesDir = path.join(modulesRoot, moduleEntry.name, 'routes');
      if (!fs.existsSync(routesDir)) continue;
      walkDir(routesDir, results);
    }
  }

  // Walk backend/routes/*.mjs (shims + legacy entries)
  const topRoutes = path.join(BACKEND_ROOT, 'routes');
  if (fs.existsSync(topRoutes)) {
    walkDir(topRoutes, results);
  }
  return results;
}

function walkDir(dir, results) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(full, results);
    } else if (entry.isFile() && entry.name.endsWith('.mjs')) {
      results.push(full);
    }
  }
}

const violations = [];

for (const file of walkRoutesFiles()) {
  const source = readScannedFileSyncTolerant(file, 'no-prisma-in-routes');
  if (source === null) continue; // vanished mid-scan (ENOENT) — skip, noticed
  const lines = source.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip exempted lines AND single-line comments / block-comment lines
    // — comments describing past migrations or test-only contexts should
    // not trip the gate.
    if (line.includes(EXEMPTION_MARKER)) continue;
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue;

    if (IMPORT_RX.test(line) || PRISMA_CALL_RX.test(line)) {
      violations.push({
        file: path.relative(REPO_ROOT, file),
        line: i + 1,
        snippet: line.trim().slice(0, 120),
      });
    }
  }
}

if (violations.length === 0) {
  process.stdout.write(
    `[no-prisma-in-routes] OK — 0 prisma-client imports or call sites in backend/routes or backend/modules/**/routes (Equoria-becrm)\n`
  );
  process.exit(0);
}

process.stderr.write(
  `[no-prisma-in-routes] FAIL — ${violations.length} prisma usage(s) in routes files (Equoria-becrm).\n` +
    `  Move the data access into a service (modules/<x>/services/<y>.mjs)\n` +
    `  and call it from the route. See CLAUDE.md + Equoria-becrm.\n\n`
);
for (const v of violations) {
  process.stderr.write(`  ${v.file}:${v.line}  ${v.snippet}\n`);
}
process.exit(1);
