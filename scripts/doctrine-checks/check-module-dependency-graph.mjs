#!/usr/bin/env node
/**
 * Doctrine check: the backend module dependency graph stays a DAG of named service
 * contracts (Equoria-q4uem.4, WS4 S5; hardened in the S5 review: I1, M1-M4).
 *
 * Scope: production files under backend/modules/** (tests excluded). One parse pass,
 * zero dependencies, no DB, no network; well under a second on the development laptop.
 *
 * Rules (each violation prints `R<n> <repo-relative file>:<line> <message>`):
 *   R1  No cross-module cycle. The module graph (edges = one module's file importing
 *       another module's file) must have no strongly connected component of size > 1.
 *       Every elementary cycle is printed as `a -> b -> a` with one file:line per edge.
 *   R2  Cross-module imports go through the barrel modules/<n>/index.mjs. A deep import
 *       (any other file of another module, a module-root specifier, or a dynamic
 *       import() of one) fails, UNLESS the line before it carries the existing marker
 *       `eslint-disable-next-line no-restricted-imports -- Equoria-hk739` (the TDZ
 *       carve-outs) AND the `<file> -> <target>` pair is pinned in
 *       module-dependency-graph-allowlist.json (deepImports). A pinned pair that no longer
 *       exists fails too: the list only shrinks. WS4 S6 empties it and makes R2 strict.
 *       Also under R2: a dynamic import() whose first argument is not a plain single- or
 *       double-quoted string literal (template literal, variable, join(__dirname, …)) fails
 *       — the graph cannot see such a target — and an import specifier containing a
 *       backslash fails (Linux CI cannot resolve it).
 *   R3  No `export *` in any barrel.
 *   R4  No HTTP layer in barrels. A barrel may not import or re-export a route module
 *       (path contains /routes/ or file name ends in Routes.mjs) in any block. A barrel
 *       may not re-export a controller (path contains /controllers/ OR file name ends in
 *       Controller.mjs) except inside a labelled test-only block, recognised by the
 *       label line `// Test-consumed only (… Equoria-7t1tn …`, never by path, and only
 *       when `<module>.<name>` is pinned in the allow-list (testBlockControllers; stale
 *       entries fail). Classification follows `export … from` chains through re-export-only
 *       files, so a services/proxy.mjs that re-exports a controller is caught. A
 *       `// Sentinel-asserted` label switches back to production rules (no exemption).
 *   R5  No upward import: a module file may not import backend/app/**.
 *   WARN (no exit-code effect, no baseline; controller ruling Q9a): shared-layer round
 *       trips — a backend/{utils,services,…} file that modules import and that itself
 *       imports a module — are listed so the grooms self-loops stay visible; so is a
 *       directory under modules/ without a barrel (not counted as a module).
 *
 * Comments are stripped as SPANS (strings, template literals and regex literals are left
 * intact), so `/* x *\/ import … from '…'` is seen and commented-out imports are not.
 *
 * Sanity: fewer than 10 modules or 50 production files parsed, or a missing allow-list
 * file => exit 2 (a gate that passes because it parsed nothing is not a gate).
 *
 * Usage:
 *   node scripts/doctrine-checks/check-module-dependency-graph.mjs            # the gate
 *   node scripts/doctrine-checks/check-module-dependency-graph.mjs --closure <file>
 *       prints the transitive import closure of one production file (repo-relative,
 *       sorted); the sentinel asserts a pure service's closure holds no route module
 *       or controller file (WS4 acceptance criterion 3).
 *
 * Exit codes: 0 pass, 1 violation(s), 2 usage or parse-sanity failure.
 * Sentinel: backend/__tests__/scripts/moduleDependencyGraphDoctrine.sentinel.test.mjs.
 * Auto-runs via scripts/doctrine-checks/run-all.sh by file-name pattern (pre-push, CI).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const BACKEND = path.join(REPO_ROOT, 'backend');
const MODULES_DIR = path.join(BACKEND, 'modules');
const ALLOWLIST_PATH = path.join(HERE, 'module-dependency-graph-allowlist.json');
const ALLOWLIST_NAME = path.basename(ALLOWLIST_PATH);
const TAG = '[module-dependency-graph]';

const R2_MARKER_RE = /eslint-disable-next-line no-restricted-imports -- Equoria-hk739/;
const TEST_BLOCK_LABEL_RE = /^\/\/ Test-consumed only \(.*Equoria-7t1tn/;
const SENTINEL_BLOCK_LABEL_RE = /^\/\/ Sentinel-asserted/;
const ROUTE_PATH_RE = /\/routes\/|Routes\.mjs$/;
const CONTROLLER_PATH_RE = /\/controllers\/|Controller\.mjs$/;
const MIN_MODULES = 10;
const MIN_FILES = 50;
const MAX_CHAIN_DEPTH = 6;
// Allow-list entry contract (same bar as horse-name-gate-allowlist.json).
const MIN_REASON_LENGTH = 40;
const ISSUE_REF_RE = /^Equoria-[A-Za-z0-9._-]+$/;

const rel = (p) => path.relative(REPO_ROOT, p).split(path.sep).join('/');
const isTestPath = (p) => /[\\/]__tests__[\\/]/.test(p) || /\.(test|spec)\.(mjs|js)$/.test(p);

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === '__tests__' || ent.name === 'node_modules') continue;
      walk(full, out);
    } else if (/\.(mjs|js)$/.test(ent.name) && !isTestPath(full)) {
      out.push(full);
    }
  }
  return out;
}

function moduleOf(absPath) {
  const m = rel(absPath).match(/^backend\/modules\/([^/]+)\//);
  return m ? m[1] : null;
}

// ── comment stripping (spans, newline-preserving) ─────────────────────────────────────
// Replaces every `//` and `/* */` comment with spaces of the same length (newlines kept)
// so line numbers survive, while strings, template literals and regex literals are copied
// verbatim and never mistaken for comment starts. Returns the code and the [start, end)
// spans of string/template literals so callers can ignore `import(` inside a string.
const REGEX_AFTER_CHAR = /[(,=:[!&|?{};+\-*%<>~^]/;
const REGEX_AFTER_WORD = new Set([
  'return',
  'typeof',
  'case',
  'do',
  'else',
  'in',
  'of',
  'delete',
  'void',
  'throw',
  'new',
  'instanceof',
  'yield',
  'await',
]);

function stripComments(src) {
  let out = '';
  const spans = [];
  let i = 0;
  let prevSig = ''; // last significant character copied
  let prevWord = ''; // last identifier/keyword copied
  let word = '';
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const d = src[i + 1];
    if (c === '/' && d === '/') {
      while (i < n && src[i] !== '\n') {
        out += ' ';
        i += 1;
      }
      continue;
    }
    if (c === '/' && d === '*') {
      out += '  ';
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) {
        out += src[i] === '\n' ? '\n' : ' ';
        i += 1;
      }
      if (i < n) {
        out += '  ';
        i += 2;
      }
      continue;
    }
    if (c === "'" || c === '"') {
      const start = out.length;
      out += c;
      i += 1;
      while (i < n && src[i] !== c && src[i] !== '\n') {
        if (src[i] === '\\' && i + 1 < n) {
          out += src[i];
          i += 1;
        }
        out += src[i];
        i += 1;
      }
      if (i < n && src[i] === c) {
        out += c;
        i += 1;
      }
      spans.push([start, out.length]);
      prevSig = c;
      word = '';
      continue;
    }
    if (c === '`') {
      const start = out.length;
      out += c;
      i += 1;
      let depth = 0;
      while (i < n) {
        const ch = src[i];
        if (ch === '\\' && i + 1 < n) {
          out += ch + src[i + 1];
          i += 2;
          continue;
        }
        if (ch === '$' && src[i + 1] === '{') {
          depth += 1;
          out += '${';
          i += 2;
          continue;
        }
        if (ch === '}' && depth > 0) {
          depth -= 1;
          out += ch;
          i += 1;
          continue;
        }
        out += ch;
        i += 1;
        if (ch === '`' && depth === 0) break;
      }
      spans.push([start, out.length]);
      prevSig = '`';
      word = '';
      continue;
    }
    if (c === '/') {
      const regexContext =
        prevSig === '' || REGEX_AFTER_CHAR.test(prevSig) || REGEX_AFTER_WORD.has(prevWord);
      if (regexContext) {
        out += c;
        i += 1;
        let inClass = false;
        while (i < n && src[i] !== '\n') {
          const ch = src[i];
          if (ch === '\\' && i + 1 < n) {
            out += ch + src[i + 1];
            i += 2;
            continue;
          }
          out += ch;
          i += 1;
          if (ch === '[') inClass = true;
          else if (ch === ']') inClass = false;
          else if (ch === '/' && !inClass) break;
        }
        while (i < n && /[a-z]/i.test(src[i])) {
          out += src[i];
          i += 1;
        }
        prevSig = '/';
        word = '';
        continue;
      }
    }
    out += c;
    i += 1;
    if (/[A-Za-z0-9_$]/.test(c)) {
      word += c;
    } else {
      if (word) prevWord = word;
      word = '';
    }
    if (!/\s/.test(c)) prevSig = c;
  }
  return { code: out, spans };
}

function lineOf(src, idx) {
  let n = 1;
  for (let i = 0; i < idx; i++) if (src.charCodeAt(i) === 10) n++;
  return n;
}

const inSpans = (spans, idx) => spans.some(([a, b]) => idx >= a && idx < b);

// static import/export-from and side-effect import (on comment-stripped code)
const STATIC_RE =
  /(?:^|\n)[ \t]*(?:import|export)\s[^;'"`]*?from\s*(['"])([^'"\n]*)\1|(?:^|\n)[ \t]*import\s*(['"])([^'"\n]*)\3/g;
const DYNAMIC_RE = /\bimport\s*\(/g;

function resolveSpec(fromFile, spec) {
  if (!spec.startsWith('.')) return null; // bare package import
  let target = path.resolve(path.dirname(fromFile), spec);
  if (fs.existsSync(target) && fs.statSync(target).isDirectory())
    target = path.join(target, 'index.mjs');
  if (!fs.existsSync(target))
    for (const ext of ['.mjs', '.js']) if (fs.existsSync(target + ext)) return target + ext;
  return target; // may not exist; still classified by path
}

/**
 * All import sites of one file.
 *   sites:      [{ spec, target, line, dynamic }]   — specifiers that are plain quoted literals
 *   nonliteral: [{ line, snippet }]                 — dynamic import() with anything else
 *   rawLines:   the original lines (for marker look-ups)
 */
function importSites(file) {
  const raw = fs.readFileSync(file, 'utf8');
  const { code, spans } = stripComments(raw);
  const sites = [];
  const nonliteral = [];
  STATIC_RE.lastIndex = 0;
  let m;
  while ((m = STATIC_RE.exec(code))) {
    const spec = m[2] ?? m[4];
    const line = lineOf(code, m.index + (m[0].startsWith('\n') ? 1 : 0));
    sites.push({ spec, target: resolveSpec(file, spec), line, dynamic: false });
  }
  DYNAMIC_RE.lastIndex = 0;
  while ((m = DYNAMIC_RE.exec(code))) {
    if (inSpans(spans, m.index)) continue; // `import(` inside a string
    const line = lineOf(code, m.index);
    let j = m.index + m[0].length;
    while (j < code.length && /\s/.test(code[j])) j += 1;
    const q = code[j];
    let literal = null;
    if (q === "'" || q === '"') {
      const close = code.indexOf(q, j + 1);
      const nl = code.indexOf('\n', j + 1);
      if (close !== -1 && (nl === -1 || close < nl)) {
        let k = close + 1;
        while (k < code.length && /\s/.test(code[k])) k += 1;
        if (code[k] === ')' || code[k] === ',') literal = code.slice(j + 1, close);
      }
    }
    if (literal === null) {
      const end = code.indexOf('\n', m.index);
      nonliteral.push({
        line,
        snippet: code
          .slice(m.index, end === -1 ? m.index + 80 : Math.min(end, m.index + 80))
          .trim(),
      });
      continue;
    }
    sites.push({ spec: literal, target: resolveSpec(file, literal), line, dynamic: true });
  }
  return { sites, nonliteral, rawLines: raw.split('\n') };
}

// ── --closure <file> ───────────────────────────────────────────────────────────────────
function closureOf(startFile) {
  const seen = new Set();
  const stack = [path.resolve(REPO_ROOT, startFile)];
  while (stack.length) {
    const f = stack.pop();
    if (seen.has(f) || !fs.existsSync(f) || !/\.(mjs|js)$/.test(f)) continue;
    if (rel(f).startsWith('..') || /[\\/]node_modules[\\/]/.test(f)) continue;
    seen.add(f);
    for (const s of importSites(f).sites) if (s.target) stack.push(s.target);
  }
  seen.delete(path.resolve(REPO_ROOT, startFile));
  return [...seen].map(rel).sort();
}

const argv = process.argv.slice(2);
if (argv[0] === '--closure') {
  if (!argv[1]) {
    console.error(`${TAG} usage: --closure <repo-relative file>`);
    process.exit(2);
  }
  const start = path.resolve(REPO_ROOT, argv[1]);
  if (!fs.existsSync(start)) {
    console.error(`${TAG} --closure: no such file ${argv[1]}`);
    process.exit(2);
  }
  const files = closureOf(argv[1]);
  console.log(`${TAG} closure of ${rel(start)}: ${files.length} file(s)`);
  for (const f of files) console.log(f);
  process.exit(0);
}

// ── the gate ──────────────────────────────────────────────────────────────────────────
if (!fs.existsSync(MODULES_DIR)) {
  console.error(`${TAG} FAIL — ${rel(MODULES_DIR)} not found`);
  process.exit(2);
}
if (!fs.existsSync(ALLOWLIST_PATH)) {
  console.error(
    `${TAG} FAIL — ${rel(ALLOWLIST_PATH)} missing; the pinned exception lists are part of this gate`
  );
  process.exit(2);
}
const allowlist = JSON.parse(fs.readFileSync(ALLOWLIST_PATH, 'utf8'));
const deepImportsListed =
  allowlist.deepImports && typeof allowlist.deepImports === 'object' ? allowlist.deepImports : {};
const testBlockListed =
  allowlist.testBlockControllers && typeof allowlist.testBlockControllers === 'object'
    ? allowlist.testBlockControllers
    : {};

const moduleDirs = fs
  .readdirSync(MODULES_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory() && d.name !== '__tests__' && d.name !== 'node_modules')
  .map((d) => d.name)
  .sort();
// A module is a directory with a barrel; a barrel-less directory under modules/ is anomalous
// (stray plant directories have appeared before) and is reported, not counted.
const modules = moduleDirs.filter((name) =>
  fs.existsSync(path.join(MODULES_DIR, name, 'index.mjs'))
);
const barrelless = moduleDirs.filter((name) => !modules.includes(name));
const files = walk(MODULES_DIR);
if (modules.length < MIN_MODULES || files.length < MIN_FILES) {
  console.error(
    `${TAG} FAIL — parse sanity: ${modules.length} module(s), ${files.length} production file(s); refusing a vacuous pass`
  );
  process.exit(2);
}

const violations = []; // strings, already prefixed with the rule id
const warns = barrelless.map(
  (name) =>
    `WARN directory without a barrel under backend/modules: ${name}/ (not counted as a module)`
);

// Allow-list entry contract, enforced (a bare {} entry must not silence the gate).
for (const [section, entries] of [
  ['deepImports', deepImportsListed],
  ['testBlockControllers', testBlockListed],
]) {
  for (const [key, entry] of Object.entries(entries)) {
    const reason = entry && typeof entry.reason === 'string' ? entry.reason.trim() : '';
    const issue = entry && typeof entry.issue === 'string' ? entry.issue.trim() : '';
    const missing = [];
    if (reason.length < MIN_REASON_LENGTH)
      missing.push(`a real \`reason\` (>= ${MIN_REASON_LENGTH} chars)`);
    if (!ISSUE_REF_RE.test(issue)) missing.push('a valid `issue` (Equoria-…)');
    if (missing.length)
      violations.push(
        `allowlist-contract ${ALLOWLIST_NAME} ${section} "${key}" — missing ${missing.join(' and ')}`
      );
  }
}

const adjacency = new Map(modules.map((m) => [m, new Map()])); // from -> (to -> [{where, spec}])
let crossEdges = 0;
let dynamicEdges = 0;
let nonliteralCount = 0;
const markedDeep = new Map(); // key "<file> -> <target>" -> where
const sharedHops = new Map(); // shared file -> Set(importing modules)

for (const file of files) {
  const fromModule = moduleOf(file);
  const { sites, nonliteral, rawLines } = importSites(file);
  for (const nl of nonliteral) {
    nonliteralCount += 1;
    violations.push(
      `R2 ${rel(file)}:${nl.line} dynamic import() whose specifier is not a plain quoted string literal (${nl.snippet}); the graph cannot see its target — use a static import or a quoted literal`
    );
  }
  for (const s of sites) {
    const where = `${rel(file)}:${s.line}`;
    if (s.spec.includes('\\')) {
      violations.push(
        `R2 ${where} import specifier contains a backslash (${s.spec}); use forward slashes (Linux CI cannot resolve it)`
      );
      continue;
    }
    if (!s.target) continue; // bare package import
    const r = rel(s.target);
    const toModule = moduleOf(s.target);
    if (r.startsWith('backend/app/')) {
      violations.push(
        `R5 ${where} module file imports the application layer (${s.spec}); backend/app depends on modules, never the reverse`
      );
      continue;
    }
    if (toModule && toModule !== fromModule) {
      crossEdges += 1;
      if (s.dynamic) dynamicEdges += 1;
      if (!adjacency.has(fromModule)) adjacency.set(fromModule, new Map());
      const targets = adjacency.get(fromModule);
      if (!targets.has(toModule)) targets.set(toModule, []);
      targets.get(toModule).push({ where, spec: s.spec });
      const isBarrel =
        r === `backend/modules/${toModule}/index.mjs` && /\/index\.mjs$/.test(s.spec);
      if (!isBarrel) {
        const prev = rawLines[s.line - 2] || '';
        if (R2_MARKER_RE.test(prev)) {
          const key = `${rel(file)} -> ${r}`;
          markedDeep.set(key, where);
          if (!(key in deepImportsListed)) {
            violations.push(
              `R2-allowlist ${where} marked deep import of ${r} is not listed in ${ALLOWLIST_NAME} (deepImports); key "${key}"`
            );
          }
        } else {
          violations.push(
            `R2 ${where} cross-module deep import of ${r}; import modules/${toModule}/index.mjs (the barrel) instead`
          );
        }
      }
      continue;
    }
    if (!toModule && r.startsWith('backend/')) {
      if (!sharedHops.has(s.target)) sharedHops.set(s.target, new Set());
      sharedHops.get(s.target).add(fromModule);
    }
  }
}
for (const key of Object.keys(deepImportsListed)) {
  if (!markedDeep.has(key)) {
    violations.push(
      `R2-allowlist stale entry "${key}" — no such marked deep import on disk; delete it (the list only shrinks)`
    );
  }
}

// R1: strongly connected components (Tarjan), then elementary cycles inside each.
function sccs() {
  let index = 0;
  const idx = new Map();
  const low = new Map();
  const onStack = new Set();
  const stack = [];
  const out = [];
  const strong = (v) => {
    idx.set(v, index);
    low.set(v, index);
    index += 1;
    stack.push(v);
    onStack.add(v);
    for (const w of adjacency.get(v)?.keys() || []) {
      if (!idx.has(w)) {
        strong(w);
        low.set(v, Math.min(low.get(v), low.get(w)));
      } else if (onStack.has(w)) low.set(v, Math.min(low.get(v), idx.get(w)));
    }
    if (low.get(v) === idx.get(v)) {
      const comp = [];
      let w;
      do {
        w = stack.pop();
        onStack.delete(w);
        comp.push(w);
      } while (w !== v);
      out.push(comp.sort());
    }
  };
  for (const m of adjacency.keys()) if (!idx.has(m)) strong(m);
  return out.filter((c) => c.length > 1);
}

function elementaryCycles(comp, maxLen = 6, cap = 50) {
  const inComp = new Set(comp);
  const cycles = [];
  const dfs = (start, node, pathArr) => {
    if (cycles.length >= cap) return;
    for (const next of adjacency.get(node)?.keys() || []) {
      if (!inComp.has(next) || next < start) continue;
      if (next === start) cycles.push([...pathArr, start]);
      else if (!pathArr.includes(next) && pathArr.length < maxLen)
        dfs(start, next, [...pathArr, next]);
    }
  };
  for (const start of comp) dfs(start, start, [start]);
  return cycles;
}

let cycleCount = 0;
for (const comp of sccs()) {
  const cycles = elementaryCycles(comp);
  cycleCount += cycles.length;
  violations.push(
    `R1 cross-module cycle among modules {${comp.join(', ')}} — ${cycles.length} elementary cycle(s)${cycles.length >= 50 ? ' (first 50)' : ''}:`
  );
  for (const cyc of cycles) {
    violations.push(`R1 cycle: ${cyc.join(' -> ')}`);
    for (let i = 0; i < cyc.length - 1; i++) {
      const edges = adjacency.get(cyc[i]).get(cyc[i + 1]) || [];
      const e = edges[0];
      violations.push(
        `R1   ${e ? e.where : '?'} ${cyc[i]} -> ${cyc[i + 1]} (${e ? e.spec : ''}${edges.length > 1 ? `, +${edges.length - 1} more` : ''})`
      );
    }
  }
}

// ── R3 / R4 on barrels ────────────────────────────────────────────────────────────────
/** `export { a as b, c } from 'spec'` and `export * from 'spec'` statements of a stripped source. */
function reExportStatements(code) {
  const out = [];
  const re =
    /(?:^|\n)[ \t]*export\s*(\*|\{([^}]*)\})\s*(?:as\s+[\w$]+\s*)?from\s*(['"])([^'"\n]*)\3/g;
  let m;
  while ((m = re.exec(code))) {
    const names =
      m[1] === '*'
        ? '*'
        : m[2]
            .split(',')
            .map((n) => n.trim())
            .filter(Boolean)
            .map((n) => {
              const [orig, local] = n.split(/\s+as\s+/).map((x) => x.trim());
              return { orig, local: local || orig };
            });
    out.push({ names, spec: m[4], line: lineOf(code, m.index + (m[0].startsWith('\n') ? 1 : 0)) });
  }
  return out;
}

/**
 * Follow `export … from` chains from `absTarget` for the requested names ('*' = all) until a
 * route module or controller file is reached. Returns { kind, chain } or null.
 */
function classifyTarget(absTarget, wanted, depth = 0, visited = new Set()) {
  const r = rel(absTarget);
  if (ROUTE_PATH_RE.test(r)) return { kind: 'route', chain: [r] };
  if (CONTROLLER_PATH_RE.test(r)) return { kind: 'controller', chain: [r] };
  if (
    depth >= MAX_CHAIN_DEPTH ||
    visited.has(absTarget) ||
    !fs.existsSync(absTarget) ||
    fs.statSync(absTarget).isDirectory()
  )
    return null;
  visited.add(absTarget);
  const { code } = stripComments(fs.readFileSync(absTarget, 'utf8'));
  const all = wanted.includes('*');
  for (const st of reExportStatements(code)) {
    let nextWanted;
    if (st.names === '*') nextWanted = wanted;
    else if (all) nextWanted = ['*'];
    else {
      const hit = st.names.filter((nm) => wanted.includes(nm.local));
      if (!hit.length) continue;
      nextWanted = hit.map((nm) => nm.orig);
    }
    const next = resolveSpec(absTarget, st.spec);
    if (!next) continue;
    const res = classifyTarget(next, nextWanted, depth + 1, visited);
    if (res) return { kind: res.kind, chain: [r, ...res.chain] };
  }
  return null;
}

let starExports = 0;
let httpInBarrel = 0;
const testBlockObserved = new Map(); // "<module>.<name>" -> where
const BARREL_STMT_RE =
  /(?:^|\n)[ \t]*export\s*\{([^}]*)\}\s*from\s*(['"])([^'"\n]*)\2|(?:^|\n)[ \t]*import\s([^;'"`]*?)from\s*(['"])([^'"\n]*)\5|(?:^|\n)[ \t]*import\s*(['"])([^'"\n]*)\7/g;
for (const mod of modules) {
  const barrel = path.join(MODULES_DIR, mod, 'index.mjs');
  const raw = fs.readFileSync(barrel, 'utf8');
  const rawLines = raw.split('\n');
  const { code } = stripComments(raw);
  // block mode per line: production until a test label; a sentinel label returns to production
  const modeAt = [];
  let mode = 'production';
  rawLines.forEach((l, i) => {
    if (TEST_BLOCK_LABEL_RE.test(l)) mode = 'test';
    else if (SENTINEL_BLOCK_LABEL_RE.test(l)) mode = 'production';
    modeAt[i + 1] = mode;
  });
  code.split('\n').forEach((l, i) => {
    if (/^\s*export\s*\*/.test(l)) {
      starExports += 1;
      violations.push(
        `R3 ${rel(barrel)}:${i + 1} \`export *\` in a barrel; list the names the consumers need`
      );
    }
  });
  BARREL_STMT_RE.lastIndex = 0;
  let m;
  while ((m = BARREL_STMT_RE.exec(code))) {
    const isReExport = m[1] !== undefined;
    const spec = m[3] ?? m[6] ?? m[8];
    const line = lineOf(code, m.index + (m[0].startsWith('\n') ? 1 : 0));
    const where = `${rel(barrel)}:${line}`;
    if (spec.includes('\\')) {
      violations.push(
        `R2 ${where} import specifier contains a backslash (${spec}); use forward slashes (Linux CI cannot resolve it)`
      );
      continue;
    }
    const target = resolveSpec(barrel, spec) || path.join(MODULES_DIR, mod, spec);
    let names = [];
    let wanted = ['*'];
    if (isReExport) {
      names = m[1]
        .split(',')
        .map((n) => n.trim())
        .filter(Boolean)
        .map((n) => {
          const [orig, local] = n.split(/\s+as\s+/).map((x) => x.trim());
          return { orig, local: local || orig };
        });
      wanted = names.map((nm) => nm.orig);
    } else if (m[4] !== undefined) {
      const clause = m[4];
      const braces = clause.match(/\{([^}]*)\}/);
      if (braces && !/\*\s+as\s+/.test(clause)) {
        wanted = braces[1]
          .split(',')
          .map((n) => n.trim())
          .filter(Boolean)
          .map((n) => n.split(/\s+as\s+/)[0].trim());
        if (/^[\w$]+\s*,/.test(clause.trim())) wanted.push('default');
      } else if (!/\*\s+as\s+/.test(clause)) wanted = ['default'];
    }
    const cls = classifyTarget(target, wanted);
    if (!cls) continue;
    const via = cls.chain.length > 1 ? ` via ${cls.chain.join(' -> ')}` : '';
    const localNames = names.map((nm) => nm.local);
    if (cls.kind === 'route') {
      httpInBarrel += 1;
      violations.push(
        `R4 ${where} barrel ${isReExport ? 're-exports' : 'imports'} a route module (${spec}${via}); backend/app/routers.mjs wires routes directly`
      );
    } else if (isReExport && modeAt[line] === 'test') {
      for (const nm of localNames) {
        const key = `${mod}.${nm}`;
        testBlockObserved.set(key, where);
        if (!(key in testBlockListed)) {
          violations.push(
            `R4-allowlist ${where} test-block controller name "${key}" is not listed in ${ALLOWLIST_NAME} (testBlockControllers)`
          );
        }
      }
    } else {
      httpInBarrel += 1;
      violations.push(
        `R4 ${where} barrel ${isReExport ? `re-exports controller name(s) ${localNames.join(', ')}` : 'imports a controller file'} ${via ? via.trim() : `from ${spec}`} outside a labelled test-only block; controllers are not domain capabilities`
      );
    }
  }
}
for (const key of Object.keys(testBlockListed)) {
  if (!testBlockObserved.has(key)) {
    violations.push(
      `R4-allowlist stale entry "${key}" — no such test-block re-export on disk; delete it (the list only shrinks)`
    );
  }
}

// WARN: shared-layer round trips (Q9a).
for (const [shared, importers] of [...sharedHops.entries()].sort((a, b) =>
  rel(a[0]).localeCompare(rel(b[0]))
)) {
  if (!fs.existsSync(shared) || fs.statSync(shared).isDirectory()) continue;
  for (const s of importSites(shared).sites) {
    if (!s.target) continue;
    const toModule = moduleOf(s.target);
    if (!toModule) continue;
    const deep = rel(s.target) !== `backend/modules/${toModule}/index.mjs` ? ' (deep)' : '';
    const self = importers.has(toModule) ? ' — self-loop via the shared layer' : '';
    warns.push(
      `WARN shared round trip ${rel(shared)}:${s.line} -> ${toModule}${deep}; imported by modules: ${[...importers].sort().join(', ')}${self}`
    );
  }
}

const summary =
  `modules=${modules.length} files=${files.length} edges=${crossEdges} (dynamic ${dynamicEdges}) nonliteral-dynamic=${nonliteralCount} ` +
  `cycles=${cycleCount} deep-imports=${violations.filter((v) => v.startsWith('R2 ')).length} (marked ${markedDeep.size} listed ${Object.keys(deepImportsListed).length}) ` +
  `star-exports=${starExports} http-in-barrel=${httpInBarrel} (test-block controller names ${testBlockObserved.size} listed ${Object.keys(testBlockListed).length}) ` +
  `upward=${violations.filter((v) => v.startsWith('R5 ')).length} warn=${warns.length}`;

for (const w of warns) console.log(`${TAG} ${w}`);
if (violations.length) {
  for (const v of violations) console.error(`${TAG} ${v}`);
  console.error(`${TAG} FAIL — ${violations.length} violation line(s); ${summary}`);
  process.exit(1);
}
console.log(`${TAG} modules: ${modules.join(', ')}`);
console.log(`${TAG} OK — ${summary}`);
process.exit(0);
