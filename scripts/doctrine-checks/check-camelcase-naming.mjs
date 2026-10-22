#!/usr/bin/env node
/**
 * Equoria-pjvp8 camelCase naming ratchet.
 *
 * Owner ruling 2026-10-21 (Stacey): Equoria strictly uses camelCase. Every
 * name Equoria controls — identifiers, constants, object keys, stored string
 * values, API codes, JSON data keys and Prisma enum values — is camelCase.
 *
 * What counts as a violation:
 *   - lowerSnake  `foal_care`, `fooBar_baz`
 *   - upperSnake  `GROOM_CONFIG`, `INVALID_CSRF_TOKEN`
 * found as
 *   - a JS/TS identifier (binding, reference, property key, type member);
 *   - a whole string literal (`'foal_care'`, `` `in_progress` ``);
 *   - a JSON key or string value in tracked data JSON;
 *   - a key or string value inside the `$json$…$json$` body of a breed seed;
 *   - a Prisma enum value, field name or `@default("…")` string.
 *
 * Never counted (not Equoria's to rename):
 *   - comments, regex literals, template-literal fragments;
 *   - environment variable names (collected from `process.env.X`,
 *     `import.meta.env.X` and the tracked `.env.example` files);
 *   - import/export module specifiers;
 *   - Postgres physical names in Prisma `@map`/`@@map`/`map:` (kept by ruling);
 *   - genetic locus keys (`E_Extension`, `MFSD12_Mushroom`): upper-start
 *     mixed case, not snake;
 *   - tokens in camelcase-naming-allowlist.json, each with its reason;
 *   - packages/database/prisma/migrations (applied files are checksummed and
 *     data migrations must name the old spellings they rewrite).
 *
 * Ratchet: camelcase-naming-baseline.json holds the per-file count. A file
 * may never exceed its count; a file that drops below it must lower its entry
 * in the same commit (run with --shrink-baseline), so the burn-down is always
 * recorded. Stale entries (file gone) fail. Target: an empty baseline, after
 * which ESLint `camelcase` takes over (Equoria-pjvp8.7).
 *
 * Flags:
 *   --baseline <path>   alternate baseline (sentinel hook)
 *   --report <path>     write every occurrence as JSON, then run the check
 *   --shrink-baseline   lower entries to the observed counts; never raises
 *
 * Auto-runs via scripts/doctrine-checks/run-all.sh by file-name pattern.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { readScannedFileSyncTolerant, walkFiles } from '../lib/doctrine-scan-patterns.mjs';

const label = 'camelcase-naming';
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..', '..');
const backslash = String.fromCharCode(92);

const scanRoots = [
  'backend',
  'frontend',
  'packages/database',
  'scripts',
  'tests',
  'samples/Breeds',
  'config',
  'services',
  'utils',
];
const skipDirNames = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'coverage',
  'playwright-report',
  'test-results',
  'storybook-static',
  'generated',
  '.vite',
  'migrations',
]);
const codeExt = /\.(mjs|cjs|js|jsx|ts|tsx|mts|cts)$/;
const skipJsonNames =
  /^(package(-lock)?\.json|tsconfig[^/]*\.json|camelcase-naming-(baseline|allowlist)\.json)$/;
const envExampleFiles = [
  'backend/.env.example',
  'frontend/.env.example',
  'packages/database/.env.example',
];

const lowerSnake = /^[a-z][a-zA-Z0-9]*(?:_[a-zA-Z0-9]+)+$/;
const upperSnake = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/;

function snakeKind(raw) {
  const text = raw.replace(/^_+|_+$/g, '');
  if (lowerSnake.test(text)) return 'lowerSnake';
  if (upperSnake.test(text)) return 'upperSnake';
  return null;
}

function parseArgs(argv) {
  const args = { baseline: path.join(scriptDir, 'camelcase-naming-baseline.json') };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--baseline') args.baseline = path.resolve(argv[(i += 1)]);
    else if (argv[i] === '--report') args.report = path.resolve(argv[(i += 1)]);
    else if (argv[i] === '--shrink-baseline') args.shrink = true;
    else throw new Error(`[${label}] unknown argument ${argv[i]}`);
  }
  return args;
}

function toRelKey(absPath) {
  return path.relative(repoRoot, absPath).split(backslash).join('/');
}

function includeFile(name, full) {
  const rel = toRelKey(full);
  if (codeExt.test(name)) return true;
  if (name.endsWith('.json')) return !skipJsonNames.test(name);
  if (name === 'schema.prisma') return true;
  if (name.endsWith('.txt'))
    return rel.startsWith('backend/data/breeds/') || rel.startsWith('samples/Breeds/');
  return false;
}

function listFiles() {
  return walkFiles(
    scanRoots.map((r) => path.join(repoRoot, r)),
    { skipDir: (name) => skipDirNames.has(name), includeFile }
  );
}

function scriptKindFor(file) {
  if (file.endsWith('.tsx')) return ts.ScriptKind.TSX;
  if (file.endsWith('.jsx')) return ts.ScriptKind.JSX;
  if (/\.(ts|mts|cts)$/.test(file)) return ts.ScriptKind.TS;
  return ts.ScriptKind.JS;
}

function parseCode(file, src) {
  return ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, scriptKindFor(file));
}

function isEnvObject(expr) {
  const text = expr.getText();
  return text === 'process.env' || text === 'import.meta.env' || /(^|\.)env$/.test(text);
}

/**
 * Postgres physical names stay snake_case by owner ruling: table/column maps
 * and index names declared in schema.prisma, plus every double-quoted
 * identifier and named index/constraint/table/type in the migration SQL.
 */
function collectDbNames() {
  const names = new Set();
  const schema = path.join(repoRoot, 'packages/database/prisma/schema.prisma');
  if (fs.existsSync(schema)) {
    for (const m of fs.readFileSync(schema, 'utf8').matchAll(/(?:@@?map\(|map:\s*)"([^"]+)"/g))
      names.add(m[1]);
  }
  const migrations = path.join(repoRoot, 'packages/database/prisma/migrations');
  if (!fs.existsSync(migrations)) return names;
  for (const dir of fs.readdirSync(migrations, { withFileTypes: true })) {
    const sql = path.join(migrations, dir.name, 'migration.sql');
    if (!dir.isDirectory() || !fs.existsSync(sql)) continue;
    const text = fs.readFileSync(sql, 'utf8');
    for (const m of text.matchAll(/"([A-Za-z0-9_]+)"/g)) names.add(m[1]);
    for (const m of text.matchAll(
      /\b(?:INDEX|CONSTRAINT|TABLE|TYPE)\s+(?:IF\s+(?:NOT\s+)?EXISTS\s+)?([A-Za-z][A-Za-z0-9_]*)/gi
    )) {
      names.add(m[1]);
    }
  }
  return names;
}

function collectEnvNames(files) {
  const names = new Set();
  const railway = path.join(repoRoot, '.railway/railway.ts');
  if (fs.existsSync(railway)) {
    for (const m of fs
      .readFileSync(railway, 'utf8')
      .matchAll(/\b([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+)\b/g))
      names.add(m[1]);
  }
  for (const rel of envExampleFiles) {
    const abs = path.join(repoRoot, rel);
    if (!fs.existsSync(abs)) continue;
    for (const line of fs.readFileSync(abs, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*#?\s*([A-Z][A-Z0-9_]*)\s*=/);
      if (m) names.add(m[1]);
    }
  }
  for (const file of files) {
    if (!codeExt.test(file)) continue;
    const src = readScannedFileSyncTolerant(file, label);
    if (src === null || !src.includes('env')) continue;
    const sf = parseCode(file, src);
    const visit = (node) => {
      if (ts.isPropertyAccessExpression(node) && isEnvObject(node.expression)) {
        names.add(node.name.text);
      } else if (
        ts.isElementAccessExpression(node) &&
        isEnvObject(node.expression) &&
        ts.isStringLiteralLike(node.argumentExpression)
      ) {
        names.add(node.argumentExpression.text);
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  return names;
}

function isModuleSpecifier(node) {
  const parent = node.parent;
  if (!parent) return false;
  if (
    (ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent)) &&
    parent.moduleSpecifier === node
  )
    return true;
  if (ts.isExternalModuleReference(parent)) return true;
  if (ts.isLiteralTypeNode(parent) && parent.parent && ts.isImportTypeNode(parent.parent))
    return true;
  if (ts.isCallExpression(parent) && parent.arguments[0] === node) {
    const callee = parent.expression.getText();
    return (
      callee === 'import' ||
      callee === 'require' ||
      /(^|\.)(mock|unstable_mockModule|doMock|importActual|importOriginal)$/.test(callee)
    );
  }
  return false;
}

const testPath = /(^|\/)(__tests__|tests?|e2e)\/|\.(test|spec|stories)\.[cm]?[jt]sx?$/;

function scanCode(file, src, envNames, allow) {
  const hits = [];
  const sf = parseCode(file, src);
  const testFile = testPath.test(toRelKey(file));
  const record = (node, token, where) => {
    const kind = snakeKind(token);
    if (!kind || allow.has(token)) return;
    const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
    hits.push({ line: line + 1, token, kind, where });
  };
  const visit = (node) => {
    if (ts.isIdentifier(node)) {
      const parent = node.parent;
      const envMember =
        parent &&
        ts.isPropertyAccessExpression(parent) &&
        parent.name === node &&
        isEnvObject(parent.expression);
      const envKey =
        envNames.has(node.text) &&
        parent &&
        ((ts.isPropertyAssignment(parent) && parent.name === node) ||
          (ts.isPropertySignature(parent) && parent.name === node) ||
          (ts.isBindingElement(parent) && parent.propertyName === node));
      if (!envMember && !envKey) record(node, node.text, 'identifier');
    } else if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      if (
        !isModuleSpecifier(node) &&
        !envNames.has(node.text) &&
        !(testFile && isFixturePrefix(node))
      ) {
        if (snakeKind(node.text)) record(node, node.text, 'string');
        else if (isConcatOperand(node))
          recordFragments(node, node.text, true, true, 'concatFragment');
      }
    } else if (ts.isTemplateExpression(node) && !isSqlTemplate(node)) {
      recordFragments(node.head, node.head.text, false, true, 'templateFragment');
      node.templateSpans.forEach((span, i) => {
        const last = i === node.templateSpans.length - 1;
        recordFragments(span.literal, span.literal.text, true, !last, 'templateFragment');
      });
    }
    ts.forEachChild(node, visit);
  };
  // A snake name assembled at runtime: `resists_${trait}`, 'age_' + n,
  // `${type}_${variation}`. A fragment touching an edge that joins another
  // value is padded before testing, so `req_` reads as `req_x`.
  const recordFragments = (node, text, joinsBefore, joinsAfter, where) => {
    // Test fixture identities (`testuser_${Date.now()}`) are throwaway data,
    // not names; only production code is fragment-scanned.
    if (testFile) return;
    for (const m of text.matchAll(/[A-Za-z0-9_]+/g)) {
      if (envNames.has(m[0])) continue;
      const frag = m[0];
      if (!frag.includes('_') || !/[A-Za-z]/.test(frag)) continue;
      const atStart = joinsBefore && m.index === 0;
      const atEnd = joinsAfter && m.index + frag.length === text.length;
      const padded = `${atStart && frag.startsWith('_') ? 'x' : ''}${frag}${atEnd && frag.endsWith('_') ? 'x' : ''}`;
      if (snakeKind(padded) && !allow.has(frag) && !allow.has(padded)) {
        const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
        hits.push({ line: line + 1, token: frag, kind: snakeKind(padded), where });
      }
    }
  };
  visit(sf);
  return hits;
}

/**
 * Owner ruling 2026-10-22: test-account prefixes are exempt. They build
 * throwaway fixture e-mails and usernames (`pwreset_int_`, SUITE_PREFIX =
 * 'setpref_e2e'), production lower-cases e-mails, and camelCasing them broke
 * the fixtures. Only in test files, and only a string assigned to a
 * `*prefix*` variable or key (EMAIL_PREFIX, SUITE_PREFIX). Production id
 * prefixes such as `mkt_rider_` stay counted.
 */
function isFixturePrefix(node) {
  const parent = node.parent;
  const holder =
    parent &&
    ((ts.isVariableDeclaration(parent) && parent.initializer === node) ||
      (ts.isPropertyAssignment(parent) && parent.initializer === node))
      ? parent.name
      : null;
  return Boolean(holder && ts.isIdentifier(holder) && /prefix/i.test(holder.text));
}

function isConcatOperand(node) {
  const parent = node.parent;
  return Boolean(
    parent && ts.isBinaryExpression(parent) && parent.operatorToken.kind === ts.SyntaxKind.PlusToken
  );
}

const sqlWords =
  /\b(SELECT|INSERT|UPDATE|DELETE|WHERE|FROM|CREATE|ALTER|DROP|JOIN|VALUES|RETURNING)\b/;

// Postgres names inside SQL stay snake_case by owner ruling, so SQL text is
// never fragment-scanned: tagged SQL templates and SQL-looking text.
function isSqlTemplate(node) {
  if (node.parent && ts.isTaggedTemplateExpression(node.parent)) return true;
  const text = [node.head.text, ...node.templateSpans.map((s) => s.literal.text)].join(' ');
  return sqlWords.test(text);
}

function lineOf(src, index) {
  let line = 1;
  for (let i = 0; i < index && i < src.length; i += 1) if (src.charCodeAt(i) === 10) line += 1;
  return line;
}

function scanJsonValue(value, baseLine, allow, hits) {
  const visit = (v) => {
    if (Array.isArray(v)) {
      v.forEach(visit);
    } else if (v && typeof v === 'object') {
      for (const [k, child] of Object.entries(v)) {
        const kind = snakeKind(k);
        if (kind && !allow.has(k)) hits.push({ line: baseLine, token: k, kind, where: 'jsonKey' });
        visit(child);
      }
    } else if (typeof v === 'string') {
      const kind = snakeKind(v);
      if (kind && !allow.has(v)) hits.push({ line: baseLine, token: v, kind, where: 'jsonValue' });
    }
  };
  visit(value);
}

function scanJsonFile(file, src, allow) {
  const hits = [];
  let parsed;
  try {
    parsed = JSON.parse(src);
  } catch (err) {
    throw new Error(`[${label}] ${toRelKey(file)} is not valid JSON: ${err.message}`, {
      cause: err,
    });
  }
  scanJsonValue(parsed, 1, allow, hits);
  return hits;
}

function scanBreedSeed(file, src, allow) {
  const hits = [];
  const re = /\$json\$([\s\S]*?)\$json\$/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    let parsed;
    try {
      parsed = JSON.parse(m[1]);
    } catch (err) {
      throw new Error(
        `[${label}] ${toRelKey(file)} has an unparsable $json$ body: ${err.message}`,
        { cause: err }
      );
    }
    scanJsonValue(parsed, lineOf(src, m.index), allow, hits);
  }
  return hits;
}

function scanPrisma(src, allow) {
  const hits = [];
  let block = null;
  src.split(/\r?\n/).forEach((rawLine, i) => {
    const line = rawLine.replace(/\/\/.*$/, '').trim();
    const open = line.match(/^(model|enum|type)\s+\w+\s*\{/);
    if (open) {
      block = open[1];
      return;
    }
    if (line.startsWith('}')) {
      block = null;
      return;
    }
    if (!block || line === '' || line.startsWith('@@')) return;
    const name = line.split(/\s+/)[0];
    const push = (token, where) => {
      const kind = snakeKind(token);
      if (kind && !allow.has(token)) hits.push({ line: i + 1, token, kind, where });
    };
    push(name, block === 'enum' ? 'prismaEnumValue' : 'prismaField');
    for (const d of line.matchAll(/@default\("([^"]*)"\)/g)) push(d[1], 'prismaDefault');
  });
  return hits;
}

function loadJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/**
 * Exempt tokens: allow-list entries, allow-list patterns, and Postgres
 * physical names. Returned as a Set-like `has` so every scanner shares it.
 */
function buildAllow(allowList) {
  const tokens = new Set(Object.keys(allowList.tokens ?? {}));
  const patterns = (allowList.patterns ?? []).map((p) => new RegExp(p.regex));
  const dbNames = collectDbNames();
  return {
    has: (token) =>
      tokens.has(token) || dbNames.has(token) || patterns.some((re) => re.test(token)),
  };
}

function scanAll(allow) {
  const files = listFiles();
  const envNames = collectEnvNames(files);
  const results = new Map();
  for (const file of files) {
    const src = readScannedFileSyncTolerant(file, label);
    if (src === null) continue;
    let hits;
    if (codeExt.test(file)) hits = scanCode(file, src, envNames, allow);
    else if (file.endsWith('.json')) hits = scanJsonFile(file, src, allow);
    else if (file.endsWith('.prisma')) hits = scanPrisma(src, allow);
    else hits = scanBreedSeed(file, src, allow);
    if (hits.length > 0) results.set(toRelKey(file), hits);
  }
  return results;
}

function main() {
  const args = parseArgs(process.argv);
  const allowList = loadJson(path.join(scriptDir, 'camelcase-naming-allowlist.json'), {
    tokens: {},
  });
  const allow = buildAllow(allowList);
  if (!fs.existsSync(args.baseline)) {
    console.error(`[${label}] baseline not found at ${args.baseline}`);
    process.exit(2);
  }
  const baseline = loadJson(args.baseline, {});
  const results = scanAll(allow);

  if (args.report) {
    const report = [...results].map(([file, hits]) => ({ file, hits }));
    fs.writeFileSync(args.report, JSON.stringify(report, null, 2));
    console.log(`[${label}] wrote ${report.length} files to ${args.report}`);
  }

  const stale = Object.keys(baseline).filter(
    (key) => !fs.existsSync(path.join(repoRoot, ...key.split('/')))
  );
  const grew = [];
  const shrank = [];
  let total = 0;
  for (const [file, hits] of results) {
    total += hits.length;
    const allowed = baseline[file] ?? 0;
    if (hits.length > allowed) grew.push({ file, allowed, hits });
  }
  for (const [file, allowed] of Object.entries(baseline)) {
    const observed = results.get(file)?.length ?? 0;
    if (observed < allowed && !stale.includes(file)) shrank.push({ file, allowed, observed });
  }

  if (args.shrink) {
    const next = {};
    for (const [file, allowed] of Object.entries(baseline)) {
      const observed = results.get(file)?.length ?? 0;
      const kept = Math.min(observed, allowed);
      if (kept > 0) next[file] = kept;
    }
    fs.writeFileSync(args.baseline, `${JSON.stringify(next, null, 2)}\n`);
    console.log(
      `[${label}] baseline shrunk: ${Object.keys(baseline).length} -> ${Object.keys(next).length} files`
    );
    stale.length = 0;
    shrank.length = 0;
  }

  if (stale.length > 0 || grew.length > 0 || shrank.length > 0) {
    console.error(`[${label}] FAIL`);
    for (const s of stale) console.error(`  stale baseline entry (file gone): ${s}`);
    for (const g of grew) {
      console.error(`  ${g.file}: ${g.hits.length} snake-case names (baseline ${g.allowed})`);
      for (const h of g.hits.slice(0, 10))
        console.error(`    line ${h.line}: ${h.token} (${h.where})`);
    }
    for (const s of shrank) {
      console.error(
        `  ${s.file}: ${s.observed} < baseline ${s.allowed} — run with --shrink-baseline and commit it`
      );
    }
    console.error('Rename to camelCase; the baseline may only shrink (Equoria-pjvp8).');
    process.exit(1);
  }
  console.log(
    `[${label}] OK — ${total} legacy snake-case names in ${results.size} files, none new`
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    main();
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}
