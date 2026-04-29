// One-off depth audit helper for 21R-SEC-3 (Equoria-expn).
// Scans backend source/test trees for bracket-nesting deeper than 32.
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const exts = ['.mjs', '.js', '.json'];
let maxFound = 0;
const offenders = [];

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.git' || entry === 'dist' || entry === 'coverage')
      continue;
    const full = join(dir, entry);
    let s;
    try {
      s = statSync(full);
    } catch {
      continue;
    }
    if (s.isDirectory()) yield* walk(full);
    else if (exts.some(e => entry.endsWith(e))) yield full;
  }
}

function maxDepth(text) {
  let depth = 0;
  let cur = 0;
  let inStr = false;
  let esc = false;
  for (const ch of text) {
    if (esc) {
      esc = false;
      continue;
    }
    if (inStr) {
      if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === '{' || ch === '[') {
      cur++;
      if (cur > depth) depth = cur;
    } else if (ch === '}' || ch === ']') {
      cur--;
    }
  }
  return depth;
}

const dirs = [
  'backend/__tests__',
  'backend/modules',
  'backend/controllers',
  'backend/routes',
  'backend/middleware',
];
for (const d of dirs) {
  try {
    for (const f of walk(d)) {
      try {
        const text = readFileSync(f, 'utf8');
        const dep = maxDepth(text);
        if (dep > maxFound) maxFound = dep;
        if (dep > 32) offenders.push({ f, d: dep });
      } catch {
        // Skip files that can't be read (binaries, broken symlinks).
      }
    }
  } catch {
    // Skip dirs that can't be walked (permission errors, missing).
  }
}

console.log(`Scanned dirs: ${dirs.join(', ')}`);
console.log(`Max bracket-nesting found anywhere: ${maxFound}`);
console.log(`Files with depth > 32: ${offenders.length}`);
for (const o of offenders.slice(0, 30)) console.log(`  ${o.f}: depth=${o.d}`);
