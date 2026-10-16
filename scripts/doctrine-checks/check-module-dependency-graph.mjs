#!/usr/bin/env node
/**
 * Doctrine check: the backend module dependency graph stays a DAG of named service
 * contracts (Equoria-q4uem.4, WS4 S5; hardened in the S5 review rounds 1-3).
 *
 * Scope: production files under backend/modules/** (tests excluded). One parse pass,
 * zero dependencies, no DB, no network; about a second on the development laptop.
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
 *       Also under R2, because the graph cannot see such a target: a dynamic import()
 *       whose first argument is not a plain single- or double-quoted string literal
 *       (template literal, variable, join(__dirname, …)); any createRequire(…) or
 *       require(…) call (the repo is ESM-only); an import specifier containing a
 *       backslash (Linux CI cannot resolve it); and the lexer fail-safe (below).
 *   R3  No `export *` in any barrel.
 *   R4  No HTTP layer in barrels — CLOSURE-BASED, every block. For every name a barrel
 *       re-exports and for every `import` a barrel makes, the static import closure of
 *       the target file (static imports, `export … from`, dynamic string imports;
 *       recursive, in-repo files only) may reach no route module (path contains
 *       /routes/ or file name ends in Routes.mjs) and no controller (path contains
 *       /controllers/ OR file name ends in Controller.mjs). The path from the target to
 *       the offending file is reported. Re-export chains through proxy files
 *       (`export … from`, `export * from`, `import … from X` + `export { … }` /
 *       `export const X = binding[.member]` / `export default binding`, namespace
 *       imports) are followed only to produce a precise diagnostic naming the
 *       controller. There is no test-block exemption for controllers (WS4 S5-pre: the
 *       former labelled test block was a real runtime coupling — importing a barrel
 *       evaluated the controller); the `// Test-consumed only (… Equoria-7t1tn` label
 *       may still head NON-controller names consumed only by other modules' tests, and
 *       the allow-list's testBlockControllers section is retired and must stay empty.
 *       The barrel's OWN import sites that the statement scanner does not model (a
 *       dynamic import() inside an exported function, a side-effect import) are
 *       closure-checked too, blamed on the barrel's own line; when a bad line in one
 *       barrel cascades into other barrels' closures, that ORIGIN line is reported
 *       first and each cascade cites it (round 4, I).
 *   Scope additions (round 4): .js and .cjs files under backend/modules are scanned, and
 *       any .cjs file there fails outright (the repo is ESM-only; a literal require('…')
 *       is still followed as a closure edge so a bridge cannot hide a controller) (M1);
 *       every shared-layer file (backend/utils, backend/services, …) that a barrel
 *       closure walks through gets the non-literal import() and CommonJS checks (M2).
 *   R5  No upward import: a module file may not import backend/app/**.
 *   WARN (no exit-code effect, no baseline; controller ruling Q9a): shared-layer round
 *       trips — a backend/{utils,services,…} file that modules import and that itself
 *       imports a module — are listed so the grooms self-loops stay visible; so is a
 *       directory under modules/ without a barrel (not counted as a module).
 *
 * Lexing. Statements are matched at statement boundaries (line start, or after `;` / `}`
 * on the same line), not only at line starts. Comments are stripped as SPANS; strings,
 * template literals and regex literals are copied verbatim and import statements found
 * inside a string or template span are ignored. Regex literals are recognised
 * heuristically: a `/` is a regex start after an operator, a `(`, `,`, `[`, `{`, `}`, `;`,
 * `:`, after the keywords return/typeof/case/do/else/in/of/delete/void/throw/new/
 * instanceof/yield/await, and after the `)` that closes an if/while/for/with header;
 * elsewhere it is division. What the lexer therefore CANNOT see: a regex literal in any
 * other position (treated as division, so a quote or backtick inside it would open a
 * string or template). Fail-safe, fail-closed: a template or string span that CONTAINS
 * statement-shaped import/export/`require(`/`import(` text the scanners would otherwise
 * have read, and an unterminated template literal or block comment at end of file, are
 * reported as violations rather than trusted. Comment spans are never failed closed:
 * JSDoc `{import('x').T}` types and `// import …` examples live there, and the only way
 * a comment can hide code — an unterminated `/*` — is covered.
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
const ROUTE_PATH_RE = /\/routes\/|Routes\.mjs$/;
const CONTROLLER_PATH_RE = /\/controllers\/|Controller\.mjs$/;
const MIN_MODULES = 10;
const MIN_FILES = 50;
const MAX_CHAIN_DEPTH = 6;
// Allow-list entry contract (same bar as horse-name-gate-allowlist.json).
const MIN_REASON_LENGTH = 40;
const ISSUE_REF_RE = /^Equoria-[A-Za-z0-9._-]+$/;

const rel = (p) => path.relative(REPO_ROOT, p).split(path.sep).join('/');
const isTestPath = (p) => /[\\/]__tests__[\\/]/.test(p) || /\.(test|spec)\.(mjs|js|cjs)$/.test(p);
const SOURCE_EXT_RE = /\.(mjs|js|cjs)$/;
const isRepoFile = (abs) => !rel(abs).startsWith('..') && !/[\\/]node_modules[\\/]/.test(abs);
const httpKind = (r) =>
  ROUTE_PATH_RE.test(r) ? 'route' : CONTROLLER_PATH_RE.test(r) ? 'controller' : null;

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === '__tests__' || ent.name === 'node_modules') continue;
      walk(full, out);
    } else if (SOURCE_EXT_RE.test(ent.name) && !isTestPath(full)) {
      out.push(full);
    }
  }
  return out;
}

function moduleOf(absPath) {
  const m = rel(absPath).match(/^backend\/modules\/([^/]+)\//);
  return m ? m[1] : null;
}

// Statement boundary: line start, or after `;` / `}` on the same line (minor 6).
const B = '(?:^|[\\n;}])[ \\t]*';
// Statement-shaped text the scanners read; a string/template span containing it fails closed.
const SPAN_SCAN_RE = new RegExp(
  `${B}(?:import|export)\\s[^;'"\`]*?from\\s*['"]|${B}import\\s*['"]|\\bimport\\s*\\(|\\b(?:createRequire|require)\\s*\\(`
);

// ── comment stripping (spans, newline-preserving) ─────────────────────────────────────
// Replaces every `//` and `/* */` comment with spaces of the same length (newlines kept)
// so line numbers survive, while strings, template literals and regex literals are copied
// verbatim and never mistaken for comment starts. Returns the code, the [start, end) spans
// of string/template literals (so callers can ignore statements inside a string) and the
// lexer fail-safe issues (unterminated template/block comment, statement text in a span).
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
// `)` closing one of these headers is followed by a statement, so a `/` there starts a regex.
const REGEX_HEADER_WORDS = new Set(['if', 'while', 'for', 'with']);

function stripComments(src) {
  let out = '';
  const spans = [];
  const issues = [];
  let i = 0;
  let prevSig = ''; // last significant character copied
  let prevWord = ''; // last identifier/keyword copied
  let word = '';
  const parenStack = []; // true when the `(` opened an if/while/for/with header
  let afterHeaderParen = false;
  const n = src.length;
  const lineAt = (idx) => out.slice(0, idx).split('\n').length;
  const flushWord = () => {
    if (word) prevWord = word;
    word = '';
  };
  const checkSpan = (start, kind) => {
    const inner = out.slice(start + 1, out.length - 1);
    const m = SPAN_SCAN_RE.exec(`\n${inner}`);
    if (m) {
      issues.push({
        line: lineAt(start),
        kind: `${kind} contains import/export/require text (${m[0].trim().slice(0, 60)})`,
      });
    }
  };
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
      const start = out.length;
      out += '  ';
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) {
        out += src[i] === '\n' ? '\n' : ' ';
        i += 1;
      }
      if (i < n) {
        out += '  ';
        i += 2;
      } else {
        issues.push({ line: lineAt(start), kind: 'unterminated block comment' });
      }
      continue;
    }
    if (c === "'" || c === '"') {
      flushWord();
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
      checkSpan(start, 'string literal');
      prevSig = c;
      afterHeaderParen = false;
      continue;
    }
    if (c === '`') {
      flushWord();
      const start = out.length;
      out += c;
      i += 1;
      let depth = 0;
      let closed = false;
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
        if (ch === '`' && depth === 0) {
          closed = true;
          break;
        }
      }
      spans.push([start, out.length]);
      if (!closed) issues.push({ line: lineAt(start), kind: 'unterminated template literal' });
      else checkSpan(start, 'template literal');
      prevSig = '`';
      afterHeaderParen = false;
      continue;
    }
    if (c === '/') {
      flushWord();
      const regexContext =
        prevSig === '' ||
        REGEX_AFTER_CHAR.test(prevSig) ||
        REGEX_AFTER_WORD.has(prevWord) ||
        (prevSig === ')' && afterHeaderParen);
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
        prevWord = '';
        afterHeaderParen = false;
        continue;
      }
    }
    out += c;
    i += 1;
    if (/[A-Za-z0-9_$]/.test(c)) {
      word += c;
      afterHeaderParen = false;
    } else {
      flushWord();
      if (c === '(') {
        parenStack.push(REGEX_HEADER_WORDS.has(prevWord));
        afterHeaderParen = false;
      } else if (c === ')') {
        afterHeaderParen = parenStack.length ? parenStack.pop() === true : false;
      } else if (!/\s/.test(c)) {
        afterHeaderParen = false;
      }
    }
    if (!/\s/.test(c)) prevSig = c;
  }
  return { code: out, spans, issues };
}

function lineOf(src, idx) {
  let n = 1;
  for (let i = 0; i < idx; i++) if (src.charCodeAt(i) === 10) n++;
  return n;
}

const inSpans = (spans, idx) => spans.some(([a, b]) => idx >= a && idx < b);

/** `{ a, b as c }` (the inner text) -> [{ orig: 'a', local: 'a' }, { orig: 'b', local: 'c' }]. */
function parseNameClause(inner) {
  return inner
    .split(',')
    .map((n) => n.trim())
    .filter(Boolean)
    .map((n) => {
      const [orig, local] = n.split(/\s+as\s+/).map((x) => x.trim());
      return { orig, local: local || orig };
    });
}

/** The R2 backslash rule, shared by module files and barrels; returns a violation line or null. */
let backslashCount = 0;
function backslashViolation(where, spec) {
  if (!spec.includes('\\')) return null;
  backslashCount += 1;
  return `R2 ${where} import specifier contains a backslash (${spec}); use forward slashes (Linux CI cannot resolve it)`;
}

// static import/export-from and side-effect import (on comment-stripped code)
const STATIC_RE = new RegExp(
  `${B}(?:import|export)\\s[^;'"\`]*?from\\s*(['"])([^'"\\n]*)\\1|${B}import\\s*(['"])([^'"\\n]*)\\3`,
  'g'
);
const DYNAMIC_RE = /\bimport\s*\(/g;
const COMMONJS_RE = /\b(createRequire|require)\s*\(/g;

function resolveSpec(fromFile, spec) {
  if (!spec.startsWith('.')) return null; // bare package import
  let target = path.resolve(path.dirname(fromFile), spec);
  if (fs.existsSync(target) && fs.statSync(target).isDirectory())
    target = path.join(target, 'index.mjs');
  if (!fs.existsSync(target))
    for (const ext of ['.mjs', '.js']) if (fs.existsSync(target + ext)) return target + ext;
  return target; // may not exist; still classified by path
}

/** Line of a match that may start with the boundary character itself. */
const matchLine = (code, m) => lineOf(code, m.index + (m[0].startsWith('\n') ? 1 : 0));
/** Index of the first non-boundary, non-space character of a boundary-anchored match. */
const keywordIndex = (m) => m.index + /^[\n;}]?[ \t]*/.exec(m[0])[0].length;

/**
 * All import sites of one file.
 *   sites:      [{ spec, target, line, dynamic }]   — specifiers that are plain quoted literals
 *   nonliteral: [{ line, snippet }]                 — dynamic import() with anything else
 *   commonjs:   [{ line, snippet }]                 — createRequire(…) / require(…) calls
 *   issues:     [{ line, kind }]                    — lexer fail-safe findings
 *   rawLines:   the original lines (for marker look-ups)
 */
const siteCache = new Map();
function importSites(file) {
  if (siteCache.has(file)) return siteCache.get(file);
  const raw = fs.readFileSync(file, 'utf8');
  const { code, spans, issues } = stripComments(raw);
  const sites = [];
  const nonliteral = [];
  const commonjs = [];
  STATIC_RE.lastIndex = 0;
  let m;
  while ((m = STATIC_RE.exec(code))) {
    if (inSpans(spans, keywordIndex(m))) continue; // an "import" inside a string span
    const spec = m[2] ?? m[4];
    sites.push({ spec, target: resolveSpec(file, spec), line: matchLine(code, m), dynamic: false });
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
  COMMONJS_RE.lastIndex = 0;
  while ((m = COMMONJS_RE.exec(code))) {
    if (inSpans(spans, m.index)) continue;
    const end = code.indexOf('\n', m.index);
    const line = lineOf(code, m.index);
    commonjs.push({
      line,
      snippet: code.slice(m.index, end === -1 ? m.index + 60 : Math.min(end, m.index + 60)).trim(),
    });
    // A literal require('…') is still an edge the closure must follow (round 4, M1: a .cjs
    // bridge between a barrel and a controller), on top of being a violation.
    if (m[1] === 'require') {
      let j = m.index + m[0].length;
      while (j < code.length && /\s/.test(code[j])) j += 1;
      const q = code[j];
      if (q === "'" || q === '"') {
        const close = code.indexOf(q, j + 1);
        if (close !== -1 && close < (end === -1 ? code.length : end)) {
          const spec = code.slice(j + 1, close);
          sites.push({ spec, target: resolveSpec(file, spec), line, dynamic: true });
        }
      }
    }
  }
  const result = { sites, nonliteral, commonjs, issues, rawLines: raw.split('\n') };
  siteCache.set(file, result);
  return result;
}

/** In-repo files a file imports directly (literal static, export-from and dynamic string imports). */
const directCache = new Map();
function directImports(file) {
  if (directCache.has(file)) return directCache.get(file);
  let out = [];
  if (fs.existsSync(file) && fs.statSync(file).isFile() && SOURCE_EXT_RE.test(file)) {
    out = importSites(file)
      .sites.map((s) => s.target)
      .filter((t) => t && isRepoFile(t));
  }
  directCache.set(file, out);
  return out;
}

/**
 * Breadth-first static import closure of `start` (start included). Returns the first route
 * module or controller file reached, with the path from `start`, or null.
 */
const closureHitCache = new Map();
/** Every file any barrel closure has walked (round 4, M2: shared-layer files get the "cannot see" checks). */
const closureVisited = new Set();
function closureHttpHit(start) {
  if (closureHitCache.has(start)) return closureHitCache.get(start);
  const parent = new Map([[start, null]]);
  const queue = [start];
  let hit = null;
  while (queue.length && !hit) {
    const f = queue.shift();
    closureVisited.add(f);
    const kind = httpKind(rel(f));
    if (kind) {
      hit = { kind, file: f };
      break;
    }
    for (const t of directImports(f)) {
      if (!parent.has(t)) {
        parent.set(t, f);
        queue.push(t);
      }
    }
  }
  let result = null;
  if (hit) {
    const chain = [];
    for (let f = hit.file; f; f = parent.get(f)) chain.unshift(rel(f));
    result = { kind: hit.kind, file: rel(hit.file), path: chain };
  }
  closureHitCache.set(start, result);
  return result;
}

// ── --closure <file> ───────────────────────────────────────────────────────────────────
function closureOf(startFile) {
  const seen = new Set();
  const stack = [path.resolve(REPO_ROOT, startFile)];
  while (stack.length) {
    const f = stack.pop();
    if (seen.has(f) || !fs.existsSync(f) || !SOURCE_EXT_RE.test(f) || !isRepoFile(f)) continue;
    seen.add(f);
    for (const t of directImports(f)) stack.push(t);
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
let commonjsCount = 0;
let lexerCount = 0;
const markedDeep = new Map(); // key "<file> -> <target>" -> where
const sharedHops = new Map(); // shared file -> Set(importing modules)

let cjsFiles = 0;
let deepImportCount = 0;
for (const file of files) {
  const fromModule = moduleOf(file);
  if (file.endsWith('.cjs')) {
    // Round 4, M1: the repo is ESM-only; a CommonJS module under backend/modules is a
    // bridge the graph cannot see through, so it fails outright.
    cjsFiles += 1;
    violations.push(
      `R2 ${rel(file)}:1 CommonJS module file (.cjs) under backend/modules; the repo is ESM-only — convert it to .mjs`
    );
  }
  const { sites, nonliteral, commonjs, issues, rawLines } = importSites(file);
  for (const is of issues) {
    lexerCount += 1;
    violations.push(
      `R2 ${rel(file)}:${is.line} lexer fail-safe: ${is.kind}; the gate cannot trust what follows — fix the source`
    );
  }
  for (const nl of nonliteral) {
    nonliteralCount += 1;
    violations.push(
      `R2 ${rel(file)}:${nl.line} dynamic import() whose specifier is not a plain quoted string literal (${nl.snippet}); the graph cannot see its target — use a static import or a quoted literal`
    );
  }
  for (const cj of commonjs) {
    commonjsCount += 1;
    violations.push(
      `R2 ${rel(file)}:${cj.line} CommonJS-style loading (${cj.snippet}) in an ESM-only module file; the graph cannot see its target — use a static import`
    );
  }
  for (const s of sites) {
    const where = `${rel(file)}:${s.line}`;
    const bs = backslashViolation(where, s.spec);
    if (bs) {
      violations.push(bs);
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
          deepImportCount += 1;
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
const RE_EXPORT_RE = new RegExp(
  `${B}export\\s*(\\*|\\{([^}]*)\\})\\s*(?:as\\s+[\\w$]+\\s*)?from\\s*(['"])([^'"\\n]*)\\3`,
  'g'
);
const IMPORT_BINDING_RE = new RegExp(
  `${B}import\\s+([^;'"\`]*?)\\s*from\\s*(['"])([^'"\\n]*)\\2`,
  'g'
);
const LOCAL_EXPORT_RE = new RegExp(`${B}export\\s*\\{([^}]*)\\}(?!\\s*from)`, 'g');
// `export default binding[.member]` and `export const X = binding[.member]`, semicolon optional.
const DEFAULT_EXPORT_RE = new RegExp(
  `${B}export\\s+default\\s+([A-Za-z_$][\\w$]*)(?:\\s*\\.\\s*[\\w$]+)*\\s*(?:;|\\n|$)`,
  'g'
);
const CONST_ALIAS_RE = new RegExp(
  `${B}export\\s+(?:const|let|var)\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*([A-Za-z_$][\\w$]*)(?:\\s*\\.\\s*[\\w$]+)*\\s*(?:;|\\n|$)`,
  'g'
);

/** `export { a as b, c } from 'spec'` and `export * from 'spec'` statements of a stripped source. */
function reExportStatements(code) {
  const out = [];
  RE_EXPORT_RE.lastIndex = 0;
  let m;
  while ((m = RE_EXPORT_RE.exec(code))) {
    out.push({
      names: m[1] === '*' ? '*' : parseNameClause(m[2]),
      spec: m[4],
      line: matchLine(code, m),
    });
  }
  return out;
}

/** The bindings an `import … from 'spec'` clause creates: [{ local, orig }] with orig 'default' or '*' as needed. */
function importClauseBindings(clause) {
  const bindings = [];
  const ns = clause.match(/\*\s+as\s+([\w$]+)/);
  if (ns) bindings.push({ local: ns[1], orig: '*' });
  const braces = clause.match(/\{([^}]*)\}/);
  if (braces)
    for (const nm of parseNameClause(braces[1])) bindings.push({ local: nm.local, orig: nm.orig });
  const def = clause
    .replace(/\{[^}]*\}/, '')
    .replace(/\*\s+as\s+[\w$]+/, '')
    .replace(/,/g, '')
    .trim();
  if (/^[A-Za-z_$][\w$]*$/.test(def)) bindings.push({ local: def, orig: 'default' });
  return bindings;
}

/** `import … from X` bindings of a stripped source: [{ local, orig, spec }]. */
function importBindingStatements(code) {
  const out = [];
  IMPORT_BINDING_RE.lastIndex = 0;
  let m;
  while ((m = IMPORT_BINDING_RE.exec(code))) {
    for (const b of importClauseBindings(m[1])) out.push({ ...b, spec: m[3] });
  }
  return out;
}

/**
 * Local re-exports of a stripped source: `export { a as b }`, `export default ident[.m]` and
 * `export const X = ident[.m]` -> [{ exported, local }] (local = the referenced binding).
 */
function localExportStatements(code) {
  const out = [];
  LOCAL_EXPORT_RE.lastIndex = 0;
  let m;
  while ((m = LOCAL_EXPORT_RE.exec(code))) {
    for (const nm of parseNameClause(m[1])) out.push({ exported: nm.local, local: nm.orig });
  }
  DEFAULT_EXPORT_RE.lastIndex = 0;
  while ((m = DEFAULT_EXPORT_RE.exec(code))) out.push({ exported: 'default', local: m[1] });
  CONST_ALIAS_RE.lastIndex = 0;
  while ((m = CONST_ALIAS_RE.exec(code))) out.push({ exported: m[1], local: m[2] });
  return out;
}

/**
 * Precise diagnostic: follow re-export chains from `absTarget` for the requested exported
 * names ('*' = all) until a route module or controller file is reached. Returns
 * { kind, chain } or null. (The closure rule below is the one that decides production
 * block violations; this names the controller when a chain explains the reach.)
 */
function classifyTarget(absTarget, wanted, depth = 0, visited = new Set()) {
  const r = rel(absTarget);
  const direct = httpKind(r);
  if (direct) return { kind: direct, chain: [r] };
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
  const follow = (spec, nextWanted) => {
    const next = resolveSpec(absTarget, spec);
    if (!next) return null;
    const res = classifyTarget(next, nextWanted, depth + 1, visited);
    return res ? { kind: res.kind, chain: [r, ...res.chain] } : null;
  };
  for (const st of reExportStatements(code)) {
    let nextWanted;
    if (st.names === '*') nextWanted = wanted;
    else if (all) nextWanted = ['*'];
    else {
      const hit = st.names.filter((nm) => wanted.includes(nm.local));
      if (!hit.length) continue;
      nextWanted = hit.map((nm) => nm.orig);
    }
    const res = follow(st.spec, nextWanted);
    if (res) return res;
  }
  // Two-statement re-exports: an imported binding exported locally (by name, as default, or as a const alias).
  const bindings = importBindingStatements(code);
  if (!bindings.length) return null;
  for (const le of localExportStatements(code)) {
    if (!all && !wanted.includes(le.exported)) continue;
    for (const b of bindings) {
      if (b.local !== le.local) continue;
      const res = follow(b.spec, b.orig === '*' ? ['*'] : [b.orig]);
      if (res) return res;
    }
  }
  return null;
}

let starExports = 0;
let httpInBarrel = 0;
let closureChecked = 0;
let closureHits = 0;
// R4 lines are emitted origin-first: a barrel's own bad line before the barrels whose
// closures merely walk through it (round 4, I).
const r4Direct = [];
const r4Cascade = [];
/** The line in `barrelAbs` whose import target is `nextRel` (for origin blame). */
const barrelLineImporting = (barrelAbs, nextRel) =>
  importSites(barrelAbs).sites.find((s) => s.target && rel(s.target) === nextRel)?.line;
/** Record a closure hit; a path through another barrel is a cascade that cites that barrel's line. */
function closureViolation(where, what, target, hit) {
  const base = `R4 ${where} barrel ${what}: the import closure of ${rel(target)} reaches ${hit.kind} ${hit.file} (${hit.path.join(' -> ')}) — barrel names must not evaluate the HTTP layer`;
  const inner = hit.path.slice(1, -1);
  let originIdx = -1;
  for (let i = inner.length - 1; i >= 0; i -= 1) {
    if (/^backend\/modules\/[^/]+\/index\.mjs$/.test(inner[i])) {
      originIdx = i;
      break;
    }
  }
  if (originIdx === -1) {
    r4Direct.push(base);
    return;
  }
  const originRel = inner[originIdx];
  const line = barrelLineImporting(path.join(REPO_ROOT, originRel), hit.path[originIdx + 2]);
  r4Cascade.push(`${base} — via origin ${originRel}:${line ?? '?'}`);
}
const STAR_EXPORT_RE = new RegExp(`${B}export\\s*\\*`, 'g');
const BARREL_STMT_RE = new RegExp(
  `${B}export\\s*\\{([^}]*)\\}\\s*from\\s*(['"])([^'"\\n]*)\\2|${B}import\\s([^;'"\`]*?)from\\s*(['"])([^'"\\n]*)\\5|${B}import\\s*(['"])([^'"\\n]*)\\7`,
  'g'
);
for (const mod of modules) {
  const barrel = path.join(MODULES_DIR, mod, 'index.mjs');
  const raw = fs.readFileSync(barrel, 'utf8');
  const { code, spans } = stripComments(raw);
  STAR_EXPORT_RE.lastIndex = 0;
  let m;
  while ((m = STAR_EXPORT_RE.exec(code))) {
    if (inSpans(spans, keywordIndex(m))) continue;
    starExports += 1;
    violations.push(
      `R3 ${rel(barrel)}:${matchLine(code, m)} \`export *\` in a barrel; list the names the consumers need`
    );
  }
  const handledLines = new Set();
  BARREL_STMT_RE.lastIndex = 0;
  while ((m = BARREL_STMT_RE.exec(code))) {
    if (inSpans(spans, keywordIndex(m))) continue;
    const isReExport = m[1] !== undefined;
    const spec = m[3] ?? m[6] ?? m[8];
    const line = matchLine(code, m);
    handledLines.add(line);
    const where = `${rel(barrel)}:${line}`;
    const bs = backslashViolation(where, spec);
    if (bs) {
      violations.push(bs);
      continue;
    }
    const target = resolveSpec(barrel, spec) || path.join(MODULES_DIR, mod, spec);
    let names = [];
    let wanted = ['*'];
    if (isReExport) {
      names = parseNameClause(m[1]);
      wanted = names.map((nm) => nm.orig);
    } else if (m[4] !== undefined) {
      const bindings = importClauseBindings(m[4]);
      wanted = bindings.some((b) => b.orig === '*') ? ['*'] : bindings.map((b) => b.orig);
      if (!wanted.length) wanted = ['*'];
    }
    const localNames = names.map((nm) => nm.local);
    const cls = classifyTarget(target, wanted);
    if (cls) {
      const via = cls.chain.length > 1 ? ` via ${cls.chain.join(' -> ')}` : '';
      httpInBarrel += 1;
      if (cls.kind === 'route') {
        r4Direct.push(
          `R4 ${where} barrel ${isReExport ? 're-exports' : 'imports'} a route module (${spec}${via}); backend/app/routers.mjs wires routes directly`
        );
      } else {
        // WS4 S5-pre (controller ruling): no controller in ANY barrel block — the former
        // labelled test-block exemption was a real runtime coupling, not a label.
        r4Direct.push(
          `R4 ${where} barrel ${isReExport ? `re-exports controller name(s) ${localNames.join(', ')}` : 'imports a controller file'} ${via ? via.trim() : `from ${spec}`}; controllers are never barrel exports, in any block`
        );
      }
      continue;
    }
    // Closure rule: no barrel name (any block) and no barrel import may evaluate the HTTP layer.
    closureChecked += 1;
    const hit = closureHttpHit(target);
    if (hit) {
      httpInBarrel += 1;
      closureHits += 1;
      closureViolation(
        where,
        isReExport ? `re-exports ${localNames.join(', ')} from ${spec}` : `imports ${spec}`,
        target,
        hit
      );
    }
  }
  // Round 4, I: the barrel's OWN import sites that the statement scanner does not model —
  // a dynamic import() inside an exported function, for instance — are closure-checked
  // too, and the blame lands on the barrel's own line.
  for (const s of importSites(barrel).sites) {
    if (handledLines.has(s.line) || !s.target) continue;
    const where = `${rel(barrel)}:${s.line}`;
    const bs = backslashViolation(where, s.spec);
    if (bs) {
      violations.push(bs);
      continue;
    }
    closureChecked += 1;
    const hit = closureHttpHit(s.target);
    if (hit) {
      httpInBarrel += 1;
      closureHits += 1;
      closureViolation(
        where,
        `${s.dynamic ? 'dynamically imports' : 'imports'} ${s.spec}`,
        s.target,
        hit
      );
    }
  }
}
violations.push(...r4Direct, ...r4Cascade);
// Round 4, M2: every shared-layer file a module closure walked through (backend/utils,
// backend/services, …) gets the "cannot see" checks — a hidden target there hides it from the graph.
const sharedFiles = [...closureVisited]
  .filter((f) => {
    const r = rel(f);
    return (
      r.startsWith('backend/') &&
      !r.startsWith('backend/modules/') &&
      fs.existsSync(f) &&
      fs.statSync(f).isFile()
    );
  })
  .sort();
let sharedViolationCount = 0;
for (const f of sharedFiles) {
  const { nonliteral, commonjs } = importSites(f);
  for (const nl of nonliteral) {
    sharedViolationCount += 1;
    violations.push(
      `R2 ${rel(f)}:${nl.line} dynamic import() whose specifier is not a plain quoted string literal (${nl.snippet}); a module closure walks this shared file and the graph cannot see its target`
    );
  }
  for (const cj of commonjs) {
    sharedViolationCount += 1;
    violations.push(
      `R2 ${rel(f)}:${cj.line} CommonJS-style loading (${cj.snippet}) in a shared-layer file a module closure walks; the graph cannot see its target`
    );
  }
}
// testBlockControllers is retired (WS4 S5-pre): no barrel may re-export a controller, so every entry is stale.
for (const key of Object.keys(testBlockListed)) {
  violations.push(
    `R4-allowlist stale entry "${key}" — controllers are never barrel exports (WS4 S5-pre); delete it (this section stays empty)`
  );
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
  // Each counter counts only its own violations (round 4 cosmetic 2): deep-imports is the
  // unmarked cross-module deep imports; cjs-files, commonjs, nonliteral-dynamic, backslash and
  // lexer-failsafe are the other R2 classes in module files; shared-violations covers the
  // shared-layer non-literal/CommonJS findings.
  `modules=${modules.length} files=${files.length} edges=${crossEdges} (dynamic ${dynamicEdges}) nonliteral-dynamic=${nonliteralCount} commonjs=${commonjsCount} cjs-files=${cjsFiles} backslash=${backslashCount} lexer-failsafe=${lexerCount} shared-files=${sharedFiles.length} shared-violations=${sharedViolationCount} ` +
  `cycles=${cycleCount} deep-imports=${deepImportCount} (marked ${markedDeep.size} listed ${Object.keys(deepImportsListed).length}) ` +
  `star-exports=${starExports} http-in-barrel=${httpInBarrel} closure-checked=${closureChecked} closure-hits=${closureHits} (testBlockControllers listed ${Object.keys(testBlockListed).length}, must be 0) ` +
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
