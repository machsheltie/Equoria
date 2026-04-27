/**
 * Bulk migration for Workstream 5 — convert bypass-header test sites to
 * the real CSRF + Origin flow. Run from `backend/` as:
 *
 *   node tests/helpers/migrate-bypass.mjs           # dry run, prints plan
 *   node tests/helpers/migrate-bypass.mjs --apply   # write changes
 *
 * What it does to each file:
 *   1. Adds `import { fetchCsrf } from '<rel>/tests/helpers/csrfHelper.mjs';`
 *      after the other imports (if missing).
 *   2. Inserts a shared fixture inside the FIRST `describe(...)` body:
 *        let __csrf__;
 *        beforeAll(async () => { __csrf__ = await fetchCsrf(app); });
 *   3. Rewrites `.set('x-test-skip-csrf', 'true')` to:
 *        .set('Origin', 'http://localhost:3000')
 *        .set('Cookie', __csrf__.cookieHeader)
 *        .set('X-CSRF-Token', __csrf__.csrfToken)
 *   4. Strips `.set('X-Test-Bypass-Rate-Limit', 'true')` /
 *      `.set('x-test-bypass-rate-limit', 'true')` — rate limit bypass is
 *      dead; test env has max=1000 which absorbs normal suite traffic.
 *   5. FLAGS files that use `x-test-user-id` or `x-test-bypass-ownership`
 *      as needing structural migration (create real users and real owned
 *      resources). Does NOT auto-rewrite these — the fixes are semantic.
 *
 * Files the script skips (already rewritten / not test files):
 *   - tests/helpers/*
 *   - __tests__/integration/csrf-integration*.mjs
 *   - __tests__/integration/authenticated-auth-*
 *   - __tests__/integration/csrf-production-*
 *   - docs/**, _bmad-output/**, full-test-results*
 */

import { readFile, writeFile, readdir } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, relative, resolve, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const BACKEND_ROOT = resolve(__dirname, '..', '..');
const APPLY = process.argv.includes('--apply');

const SKIP_BYPASS = /\.set\(['"]x-test-skip-csrf['"],\s*['"]true['"]\)/g;
const RATE_BYPASS_UPPER = /\s*\.set\(['"]X-Test-Bypass-Rate-Limit['"],\s*['"]true['"]\)/g;
const RATE_BYPASS_LOWER = /\s*\.set\(['"]x-test-bypass-rate-limit['"],\s*['"]true['"]\)/g;

const STRUCTURAL = [
  { name: 'x-test-user-id', re: /\.set\(['"]x-test-user-id['"]/ },
  { name: 'x-test-bypass-ownership', re: /\.set\(['"]x-test-bypass-ownership['"]/ },
];

const FIRST_DESCRIBE_BODY_RE = /(describe\s*\([^,]*,\s*(?:async\s*)?\(\s*\)\s*=>\s*\{)\n/;

const REPLACEMENT_CHAIN =
  "      .set('Origin', 'http://localhost:3000')\n" +
  "      .set('Cookie', __csrf__.cookieHeader)\n" +
  "      .set('X-CSRF-Token', __csrf__.csrfToken)";

const SCAN_DETECT_RE =
  /\.set\(['"](?:x-test-skip-csrf|x-test-bypass-ownership|x-test-user-id|x-test-bypass-rate-limit|X-Test-Bypass-Rate-Limit)['"]|request\(app\)\s*\.(?:get|post|put|patch|delete)/;
const SKIP_DIRS = new Set([
  'node_modules',
  'coverage',
  '.git',
  'dist',
  'build',
  'public',
  '_bmad-output',
  'docs',
]);

async function walk(dir, out) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) {
        continue;
      }
      await walk(join(dir, e.name), out);
    } else if (e.isFile() && (e.name.endsWith('.mjs') || e.name.endsWith('.js'))) {
      out.push(join(dir, e.name));
    }
  }
}

async function findFiles() {
  const all = [];
  await walk(BACKEND_ROOT, all);
  const hits = [];
  for (const abs of all) {
    const rel = relative(BACKEND_ROOT, abs).replace(/\\/g, '/');
    if (
      rel.startsWith('tests/helpers/') ||
      rel.startsWith('__tests__/integration/csrf-integration') ||
      rel.startsWith('__tests__/integration/authenticated-auth-') ||
      rel.startsWith('__tests__/integration/csrf-production-') ||
      rel.includes('full-test-results')
    ) {
      continue;
    }
    const src = await readFile(abs, 'utf8');
    if (SCAN_DETECT_RE.test(src)) {
      hits.push(rel);
    }
  }
  return hits;
}

function csrfHelperImportPath(fileRelativeToBackend) {
  // Compute relative path from this file's dir to tests/helpers/csrfHelper.mjs
  const fromDir = dirname(fileRelativeToBackend);
  const toFile = 'tests/helpers/csrfHelper.mjs';
  let rel = relative(fromDir, toFile).replace(/\\/g, '/');
  if (!rel.startsWith('.')) {
    rel = `./${rel}`;
  }
  return rel;
}

function addImport(source, relPath) {
  if (source.includes(`from '${relPath}'`) || source.match(/from ['"][^'"]*csrfHelper\.mjs['"]/)) {
    return { source, added: false };
  }
  // Match each line that ENDS an import statement (handles multi-line imports).
  const importEndings = [...source.matchAll(/^[^\n]*from\s+['"][^'"]+['"];\s*$/gm)];
  if (importEndings.length === 0) {
    return { source, added: false };
  }
  const last = importEndings[importEndings.length - 1];
  const insertAt = last.index + last[0].length;
  const importLine = `\nimport { fetchCsrf } from '${relPath}';`;
  const updated = `${source.slice(0, insertAt)}${importLine}${source.slice(insertAt)}`;
  return { source: updated, added: true };
}

function addFixture(source) {
  if (source.includes('__csrf__') && source.includes('await fetchCsrf(')) {
    return { source, added: false };
  }
  const m = source.match(FIRST_DESCRIBE_BODY_RE);
  if (!m) {
    return { source, added: false };
  }
  const insertion = `${m[1]}\n  let __csrf__;\n  beforeAll(async () => {\n    __csrf__ = await fetchCsrf(app);\n  });\n`;
  return { source: source.replace(FIRST_DESCRIBE_BODY_RE, `${insertion}\n`), added: true };
}

function rewriteBypasses(source) {
  let updated = source;
  let skipCount = 0;
  updated = updated.replace(SKIP_BYPASS, () => {
    skipCount += 1;
    return REPLACEMENT_CHAIN.trim();
  });
  let rateCount = 0;
  updated = updated.replace(RATE_BYPASS_UPPER, () => {
    rateCount += 1;
    return '';
  });
  updated = updated.replace(RATE_BYPASS_LOWER, () => {
    rateCount += 1;
    return '';
  });

  // Ensure every request(app).method(...) chain carries an Origin header so
  // the WS3 no-origin policy does not reject it. Only add when the existing
  // chain does not already set Origin.
  let originCount = 0;
  updated = updated.replace(
    /(request\(app\)\s*\.(?:get|post|put|patch|delete|head|options)\([^)]*\))(\s*(?:\.[a-zA-Z_]\w*\([^)]*\)\s*)*)/g,
    (match, head, tail) => {
      if (/\.set\(['"]Origin['"]/i.test(match)) {
        return match;
      }
      originCount += 1;
      return `${head}\n      .set('Origin', 'http://localhost:3000')${tail}`;
    },
  );

  return { source: updated, skipCount, rateCount, originCount };
}

function findStructuralFlags(source) {
  return STRUCTURAL.filter(s => s.re.test(source)).map(s => s.name);
}

function needsAppImport(source) {
  return (
    /import\s+app\s+from\s+['"][^'"]+['"]/.test(source) ||
    /from\s+['"][^'"]*app\.mjs['"]/.test(source) ||
    /(?:await\s+)?import\(['"][^'"]*app\.mjs['"]\)/.test(source) ||
    /request\(app\)/.test(source)
  );
}

const files = await findFiles();
console.log(`Inspecting ${files.length} files`);
const report = {
  rewritten: [],
  flagged: [],
  skipped: [],
};

for (const relFile of files) {
  const abs = resolve(BACKEND_ROOT, relFile);
  const original = await readFile(abs, 'utf8');

  if (!needsAppImport(original)) {
    report.skipped.push({
      file: relFile,
      reason: 'no app import — not a supertest integration file',
    });
    continue;
  }

  const relPath = csrfHelperImportPath(relFile);
  let working = original;

  const afterImport = addImport(working, relPath);
  working = afterImport.source;

  const afterFixture = addFixture(working);
  working = afterFixture.source;

  const rewrite = rewriteBypasses(working);
  working = rewrite.source;

  const structural = findStructuralFlags(working);

  const changed = working !== original;
  if (changed) {
    report.rewritten.push({
      file: relFile,
      importAdded: afterImport.added,
      fixtureAdded: afterFixture.added,
      skipReplacements: rewrite.skipCount,
      rateRemovals: rewrite.rateCount,
      originAdditions: rewrite.originCount,
      structuralFlags: structural,
    });
    if (APPLY) {
      await writeFile(abs, working, 'utf8');
    }
  } else {
    report.skipped.push({ file: relFile, reason: 'no changes produced' });
  }

  if (structural.length > 0 && !report.rewritten.find(r => r.file === relFile)) {
    report.flagged.push({ file: relFile, structural });
  }
}

console.log(`\nRewritten: ${report.rewritten.length}`);
for (const r of report.rewritten) {
  const flags = r.structuralFlags.length ? `  [structural: ${r.structuralFlags.join(', ')}]` : '';
  console.log(
    `  ${r.file}  skip:${r.skipReplacements} rate:${r.rateRemovals} origin:${r.originAdditions}${flags}`,
  );
}
console.log(`\nSkipped (no rewrite): ${report.skipped.length}`);
for (const s of report.skipped) {
  console.log(`  ${s.file}  -- ${s.reason}`);
}
console.log(APPLY ? '\n--apply: files written.' : '\n(dry run; rerun with --apply to write)');
