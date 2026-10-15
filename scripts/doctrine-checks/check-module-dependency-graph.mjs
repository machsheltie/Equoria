#!/usr/bin/env node
/**
 * Doctrine check: the backend module dependency graph stays a DAG of named service
 * contracts (Equoria-q4uem.4, WS4 S5).
 *
 * Scope: production files under backend/modules/** (tests excluded). One parse pass,
 * zero dependencies, no DB, no network; ~0.3 s on the development laptop.
 *
 * Rules (each violation prints `R<n> <repo-relative file>:<line> <message>`):
 *   R1  No cross-module cycle. The module graph (edges = one module's file importing
 *       another module's file) must have no strongly connected component of size > 1.
 *       Every elementary cycle is printed as `a -> b -> a` with one file:line per edge.
 *   R2  Cross-module imports go through the barrel modules/<n>/index.mjs. A deep import
 *       (any other file of another module, a module-root specifier, or a dynamic
 *       import() of one) fails, UNLESS the line before it carries the existing marker
 *       `eslint-disable-next-line no-restricted-imports -- Equoria-hk739` (the TDZ
 *       carve-outs). Marked sites are a shrink-only baseline (R2_MARKED_BASELINE);
 *       WS4 S6 removes them and makes R2 strict.
 *   R3  No `export *` in any barrel.
 *   R4  No HTTP layer in barrels. A barrel may not import or re-export a route module
 *       (path contains /routes/ or file name ends in Routes.mjs) in any block. A barrel
 *       may not re-export a controller (path contains /controllers/ OR file name ends in
 *       Controller.mjs) except inside a labelled test-only block, recognised by the
 *       label line `// Test-consumed only (… Equoria-7t1tn …`, never by path. The
 *       controller NAMES in test blocks are a shrink-only baseline
 *       (R4_TEST_BLOCK_CONTROLLER_NAMES_BASELINE). A `// Sentinel-asserted` label
 *       switches back to production rules (no exemption).
 *   R5  No upward import: a module file may not import backend/app/**.
 *   WARN (no exit-code effect, no baseline; controller ruling Q9a): shared-layer round
 *       trips — a backend/{utils,services,…} file that modules import and that itself
 *       imports a module — are listed so the grooms self-loops stay visible.
 *
 * Sanity: fewer than 10 modules or 50 production files parsed => exit 2 (a gate that
 * passes because it parsed nothing is not a gate).
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
const TAG = '[module-dependency-graph]';

// Shrink-only baselines (observed <= baseline passes; lower them when the count drops).
// R2: the nine Equoria-hk739 TDZ carve-outs — auth/controllers/onboardingController.mjs
// (4), auth/services/onboardingService.mjs (4), competition/services/conformationShowScoring.mjs (1).
const R2_MARKED_BASELINE = 9;
// R4: controller names re-exported inside labelled test-only blocks (Equoria-7t1tn):
// auth login, register; bank getCurrentWeekStart; community sendMessage; competition
// createShow, enterShow; crafting craftItem, getMaterials_endpoint, getRecipes;
// economy purchaseTackItem, unequipDecoration.
const R4_TEST_BLOCK_CONTROLLER_NAMES_BASELINE = 11;

const R2_MARKER_RE = /eslint-disable-next-line no-restricted-imports -- Equoria-hk739/;
const TEST_BLOCK_LABEL_RE = /^\/\/ Test-consumed only \(.*Equoria-7t1tn/;
const SENTINEL_BLOCK_LABEL_RE = /^\/\/ Sentinel-asserted/;
const ROUTE_PATH_RE = /\/routes\/|Routes\.mjs$/;
const CONTROLLER_PATH_RE = /\/controllers\/|Controller\.mjs$/;
const MIN_MODULES = 10;
const MIN_FILES = 50;

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

/** Blank comment-only lines (keeps line numbers) so commentary never reads as an import. */
function codeOnly(src) {
  return src
    .split('\n')
    .map((l) => (/^\s*(\/\/|\/\*|\*)/.test(l) ? '' : l))
    .join('\n');
}

function lineOf(src, idx) {
  let n = 1;
  for (let i = 0; i < idx; i++) if (src.charCodeAt(i) === 10) n++;
  return n;
}

// static import/export-from, side-effect import, dynamic import('...') (also join(__dirname, '...')).
const IMPORT_RE =
  /(?:^|\n)[ \t]*(?:import|export)\s[^;'"]*?from\s*['"]([^'"]+)['"]|(?:^|\n)[ \t]*import\s*['"]([^'"]+)['"]|import\(\s*(?:(?:path\.)?join\(\s*__dirname\s*,\s*)?['"]([^'"]+)['"]/g;

function resolveSpec(fromFile, spec) {
  if (!spec.startsWith('.')) return null; // bare package import
  let target = path.resolve(path.dirname(fromFile), spec);
  if (fs.existsSync(target) && fs.statSync(target).isDirectory())
    target = path.join(target, 'index.mjs');
  if (!fs.existsSync(target))
    for (const ext of ['.mjs', '.js']) if (fs.existsSync(target + ext)) return target + ext;
  return target; // may not exist; still classified by path
}

/** All import sites of one file: { spec, target, line, dynamic }. */
function importSites(file) {
  const raw = fs.readFileSync(file, 'utf8');
  const src = codeOnly(raw);
  const sites = [];
  IMPORT_RE.lastIndex = 0;
  let m;
  while ((m = IMPORT_RE.exec(src))) {
    const spec = m[1] || m[2] || m[3];
    const target = resolveSpec(file, spec);
    if (!target) continue;
    const line = lineOf(src, m.index + (m[0].startsWith('\n') ? 1 : 0));
    sites.push({ spec, target, line, dynamic: Boolean(m[3]) });
  }
  return { sites, rawLines: raw.split('\n') };
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
    for (const s of importSites(f).sites) stack.push(s.target);
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
const adjacency = new Map(modules.map((m) => [m, new Map()])); // from -> (to -> [{file,line}])
let crossEdges = 0;
let dynamicEdges = 0;
const markedDeep = [];
const sharedHops = new Map(); // shared file -> Set(importing modules)

for (const file of files) {
  const fromModule = moduleOf(file);
  const { sites, rawLines } = importSites(file);
  for (const s of sites) {
    const r = rel(s.target);
    const toModule = moduleOf(s.target);
    const where = `${rel(file)}:${s.line}`;
    if (r.startsWith('backend/app/')) {
      violations.push(
        `R5 ${where} module file imports the application layer (${s.spec}); backend/app depends on modules, never the reverse`
      );
      continue;
    }
    if (toModule && toModule !== fromModule) {
      crossEdges++;
      if (s.dynamic) dynamicEdges++;
      if (!adjacency.has(fromModule)) adjacency.set(fromModule, new Map());
      const targets = adjacency.get(fromModule);
      if (!targets.has(toModule)) targets.set(toModule, []);
      targets.get(toModule).push({ where, spec: s.spec });
      const isBarrel =
        r === `backend/modules/${toModule}/index.mjs` && /\/index\.mjs$/.test(s.spec);
      if (!isBarrel) {
        const prev = rawLines[s.line - 2] || '';
        if (R2_MARKER_RE.test(prev)) markedDeep.push(`${where} -> ${r}`);
        else
          violations.push(
            `R2 ${where} cross-module deep import of ${r}; import modules/${toModule}/index.mjs (the barrel) instead`
          );
      }
      continue;
    }
    if (!toModule && r.startsWith('backend/')) {
      if (!sharedHops.has(s.target)) sharedHops.set(s.target, new Set());
      sharedHops.get(s.target).add(fromModule);
    }
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
    index++;
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

for (const comp of sccs()) {
  const cycles = elementaryCycles(comp);
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

if (markedDeep.length > R2_MARKED_BASELINE) {
  violations.push(
    `R2-baseline marked deep imports ${markedDeep.length} > ${R2_MARKED_BASELINE} (shrink-only; Equoria-hk739 carve-outs may only disappear): ${markedDeep.join(', ')}`
  );
}

// R3 / R4 on barrels.
let starExports = 0;
let httpInBarrel = 0;
const testBlockControllerNames = [];
const BARREL_STMT_RE =
  /(?:^|\n)[ \t]*export\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]|(?:^|\n)[ \t]*import\s[^;'"]*?from\s*['"]([^'"]+)['"]|(?:^|\n)[ \t]*import\s*['"]([^'"]+)['"]/g;
for (const mod of modules) {
  const barrel = path.join(MODULES_DIR, mod, 'index.mjs');
  if (!fs.existsSync(barrel)) continue;
  const raw = fs.readFileSync(barrel, 'utf8');
  const rawLines = raw.split('\n');
  const src = codeOnly(raw);
  // block mode per line: production until a test label; a sentinel label returns to production
  const modeAt = [];
  let mode = 'production';
  rawLines.forEach((l, i) => {
    if (TEST_BLOCK_LABEL_RE.test(l)) mode = 'test';
    else if (SENTINEL_BLOCK_LABEL_RE.test(l)) mode = 'production';
    modeAt[i + 1] = mode;
  });
  src.split('\n').forEach((l, i) => {
    if (/^\s*export\s*\*/.test(l)) {
      starExports++;
      violations.push(
        `R3 ${rel(barrel)}:${i + 1} \`export *\` in a barrel; list the names the consumers need`
      );
    }
  });
  BARREL_STMT_RE.lastIndex = 0;
  let m;
  while ((m = BARREL_STMT_RE.exec(src))) {
    const spec = m[2] || m[3] || m[4];
    const line = lineOf(src, m.index + (m[0].startsWith('\n') ? 1 : 0));
    const target = rel(resolveSpec(barrel, spec) || path.join(MODULES_DIR, mod, spec));
    const names = m[1]
      ? m[1]
          .split(',')
          .map((n) => n.trim())
          .filter(Boolean)
          .map((n) =>
            n
              .split(/\s+as\s+/)
              .pop()
              .trim()
          )
      : [];
    const where = `${rel(barrel)}:${line}`;
    if (ROUTE_PATH_RE.test(target)) {
      httpInBarrel++;
      violations.push(
        `R4 ${where} barrel ${m[1] ? 're-exports' : 'imports'} a route module (${spec}); backend/app/routers.mjs wires routes directly`
      );
    } else if (CONTROLLER_PATH_RE.test(target)) {
      if (m[1] && modeAt[line] === 'test')
        testBlockControllerNames.push(...names.map((n) => `${mod}.${n}`));
      else {
        httpInBarrel++;
        violations.push(
          `R4 ${where} barrel ${m[1] ? `re-exports controller name(s) ${names.join(', ')}` : 'imports a controller file'} from ${spec} outside a labelled test-only block; controllers are not domain capabilities`
        );
      }
    }
  }
}
if (testBlockControllerNames.length > R4_TEST_BLOCK_CONTROLLER_NAMES_BASELINE) {
  violations.push(
    `R4-baseline test-block controller names ${testBlockControllerNames.length} > ${R4_TEST_BLOCK_CONTROLLER_NAMES_BASELINE} (shrink-only; Equoria-7t1tn moves those tests): ${testBlockControllerNames.join(', ')}`
  );
}

// WARN: shared-layer round trips (Q9a).
for (const [shared, importers] of [...sharedHops.entries()].sort((a, b) =>
  rel(a[0]).localeCompare(rel(b[0]))
)) {
  if (!fs.existsSync(shared)) continue;
  for (const s of importSites(shared).sites) {
    const toModule = moduleOf(s.target);
    if (!toModule) continue;
    const deep = rel(s.target) !== `backend/modules/${toModule}/index.mjs` ? ' (deep)' : '';
    const self = importers.has(toModule) ? ' — self-loop via the shared layer' : '';
    warns.push(
      `WARN shared round trip ${rel(shared)}:${s.line} -> ${toModule}${deep}; imported by modules: ${[...importers].sort().join(', ')}${self}`
    );
  }
}

const summary = `modules=${modules.length} files=${files.length} edges=${crossEdges} (dynamic ${dynamicEdges}) cycles=${violations.filter((v) => v.startsWith('R1 cycle:')).length} deep-imports=${violations.filter((v) => v.startsWith('R2 ')).length} (marked ${markedDeep.length}/${R2_MARKED_BASELINE}) star-exports=${starExports} http-in-barrel=${httpInBarrel} (test-block controller names ${testBlockControllerNames.length}/${R4_TEST_BLOCK_CONTROLLER_NAMES_BASELINE}) upward=${violations.filter((v) => v.startsWith('R5 ')).length} warn=${warns.length}`;

for (const w of warns) console.log(`${TAG} ${w}`);
if (violations.length) {
  for (const v of violations) console.error(`${TAG} ${v}`);
  console.error(`${TAG} FAIL — ${violations.length} violation line(s); ${summary}`);
  process.exit(1);
}
console.log(`${TAG} modules: ${modules.join(', ')}`);
console.log(`${TAG} OK — ${summary}`);
process.exit(0);
