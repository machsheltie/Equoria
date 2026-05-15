#!/usr/bin/env node
/**
 * Codebase auditor — cross-platform.
 *
 * Scans a directory tree for hygiene/process/security signals:
 *   - console.log (hygiene)
 *   - TODO comments (process)
 *   - API_KEY="..." / PASSWORD="..." hardcoded literals (security heuristic)
 *
 * Usage:
 *   node utils/agent-skills/auditor.mjs [directory]
 *
 * Defaults to '.' if no directory provided.
 *
 * Equoria-nxmb: rebuilt to be platform-agnostic. The prior version had:
 *   (a) raw newlines inside single-quoted string literals → syntax error
 *       on every node invocation,
 *   (b) execSync('grep -r ...') → Unix-only,
 *   (c) no IGNORED_DIRS, so it would scan node_modules/.git/_bmad-output etc.
 *
 * This rewrite prefers `rg` (ripgrep, faster) when available, otherwise
 * falls back to a Node-native recursive scan using `fs.readdirSync`. No
 * runtime dependencies; ASCII-only output.
 */

import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

const searchDir = process.argv[2] || '.';

// Directories never scanned. Mirrors .gitignore expectations + repo conventions.
const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'coverage',
  'logs',
  '.claude',
  '.backups',
  '_bmad-output',
  '.beads',
  '.next',
  '.cache',
  '.vite',
  'out',
]);

const INCLUDE_EXTS = new Set(['.js', '.mjs', '.ts', '.tsx']);

const SKIP_FILE_PATTERNS = [/\.log$/, /\.lock$/, /\.json$/];

const MAX_LINES_SHOWN = 10;

console.log('');
console.log(`CODEBASE AUDITOR REPORT: ${searchDir}`);
console.log('==================================================');

// ── ripgrep detection (fast path) ──────────────────────────────────────

function hasRipgrep() {
  try {
    execFileSync('rg', ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function runRipgrep(pattern) {
  // -n line numbers, -H file names, --no-heading flat output.
  // Whitelist file types via -g globs; blacklist ignored dirs via -g !.
  const args = ['-nH', '--no-heading', pattern, searchDir];
  for (const ext of INCLUDE_EXTS) {
    args.push('-g', `*${ext}`);
  }
  for (const dir of IGNORED_DIRS) {
    args.push('-g', `!${dir}/**`);
  }
  try {
    const out = execFileSync('rg', args, { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
    return out
      .split('\n')
      .filter(line => line.trim().length > 0);
  } catch (e) {
    // ripgrep exits 1 when no matches — return empty rather than throw.
    if (e.status === 1) {
      return [];
    }
    throw e;
  }
}

// ── Node-native fallback (cross-platform) ──────────────────────────────

function* walkFiles(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name)) {
        continue;
      }
      yield* walkFiles(path.join(dir, entry.name));
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }
    const name = entry.name;
    if (SKIP_FILE_PATTERNS.some(rx => rx.test(name))) {
      continue;
    }
    const ext = path.extname(name);
    if (!INCLUDE_EXTS.has(ext)) {
      continue;
    }
    yield path.join(dir, name);
  }
}

function nodeNativeScan(pattern) {
  const regex = new RegExp(pattern);
  const hits = [];
  for (const filePath of walkFiles(searchDir)) {
    let contents;
    try {
      contents = fs.readFileSync(filePath, 'utf8');
    } catch {
      continue;
    }
    const lines = contents.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (regex.test(lines[i])) {
        hits.push(`${filePath}:${i + 1}:${lines[i]}`);
      }
    }
  }
  return hits;
}

// ── Reporter ──────────────────────────────────────────────────────────

const RG_AVAILABLE = hasRipgrep();

function search(pattern, label) {
  let lines;
  try {
    lines = RG_AVAILABLE ? runRipgrep(pattern) : nodeNativeScan(pattern);
  } catch (e) {
    console.log('');
    console.log(`Error scanning for ${label}: ${e.message}`);
    return;
  }
  console.log('');
  if (lines.length === 0) {
    console.log(`Clean: No instances of ${label} found.`);
    return;
  }
  console.log(`Found ${lines.length} instances of ${label}:`);
  for (const line of lines.slice(0, MAX_LINES_SHOWN)) {
    const trimmed = line.trim();
    console.log(`  ${trimmed.length > 120 ? `${trimmed.substring(0, 117)}...` : trimmed}`);
  }
  if (lines.length > MAX_LINES_SHOWN) {
    console.log(`  ...and ${lines.length - MAX_LINES_SHOWN} more.`);
  }
}

console.log('');
console.log(`Scanner backend: ${RG_AVAILABLE ? 'ripgrep (rg)' : 'Node-native fallback'}`);

// 1. Hygiene: stray console.log
search('console\\.log', 'console.log');

// 2. Process: untracked TODO comments
search('TODO', 'TODO comments');

// 3. Security: hardcoded secret heuristics
search('API_KEY\\s*=\\s*["\'][a-zA-Z0-9]', 'Potential hardcoded API Keys');
search('PASSWORD\\s*=\\s*["\'][a-zA-Z0-9]', 'Potential hardcoded Passwords');

console.log('');
console.log('==================================================');
console.log('');
