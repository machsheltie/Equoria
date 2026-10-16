/**
 * Sentinel (Equoria-rfv9j): every suite that plants files in, or scans, the
 * shared working tree runs in ONE serial stream — lane 1 of the local gate, and
 * the serial CI shard.
 *
 * Why: planter sentinels write throwaway violating files into the real tree and
 * delete them; scanner sentinels walk the tree and assert it is clean. Run
 * concurrently in one checkout, a scanner reads the other lane's plant — an
 * ENOENT crash (WS4 S6 push) or a false violation. Holding controllerMaxLines'
 * 803-line plant on disk makes check-file-size-thresholds exit 1 (the clean-tree
 * arm of fileSizeThresholdDoctrine), and the same holds for noUnsafeRawSql ->
 * unsafeRawSqlAllowlistStale and rethrowAfterLog -> doctrineBaselineStale. The
 * pre-fix runner hash-sharded those pairs into DIFFERENT lanes.
 *
 * What this pins:
 *   1. tree-lane-plan.mjs, fed ONE discovery, puts every suite in exactly one
 *      batch as an explicit --runTestsByPath list (no batch re-discovers, so a
 *      planted *.test.mjs can no longer shift slice boundaries and run a suite
 *      twice or never — gate equoria-shard-nwrKX9), every TREE suite in lane 1
 *      and none in lane 2.
 *   2. No planter or whole-tree scanner exists OUTSIDE the TREE set. The
 *      detector is a static heuristic over each test file's code (comments
 *      stripped): an fs write (sync, callback or promises API) whose path
 *      argument derives from the checkout (REPO_ROOT/BACKEND/__dirname/
 *      process.cwd()/…, followed through const/assignment/object-key
 *      definitions; only an os.tmpdir() value is temp, so a mkdtemp() with a
 *      repo prefix counts as in-tree), a reference to scripts/doctrine-checks,
 *      or a recursive directory walk (typed/recursive readdir,
 *      stat().isDirectory() + readdir, walkFiles, globSync). fs bindings are
 *      followed through imports, `fs.promises` aliases and destructuring. It is
 *      proved to fire on planted sources and on the real planters and scanners
 *      it exists to catch.
 *      KNOWN LIMITS (a heuristic, by design): a path that reaches the write only
 *      through a FUNCTION PARAMETER (`function plant(dir) { writeFileSync(dir…) }`)
 *      is not traced to its call sites; nor are paths built in another module,
 *      require()-style or dynamic-import fs handles, or computed property names.
 *   3. CI parity: test.yml's serial shard selects every TREE suite and runs it
 *      through test:backend:ci:serial (one worker); shard 3 previously ran them
 *      at --maxWorkers=2, the same interleaving inside one job.
 */
import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MAX_BATCH_ARGV_CHARS,
  TREE_BATCH_MAX_FILES,
  argvChars,
  isPlantedTestPath,
  isTreeSuite,
  planLanes,
  toBackendRelative,
} from '../../scripts/tree-lane-plan.mjs';
import { extractShardPatterns } from '../../../scripts/doctrine-checks/check-ci-shard-exclusivity.mjs';
import { readdirSyncTolerant, readScannedFileSyncTolerant } from '../../../scripts/lib/doctrine-scan-patterns.mjs';

const BACKEND = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const REPO_ROOT = path.dirname(BACKEND);
const LABEL = 'tree-lane-pinning';
const SKIP_DIRS = new Set(['node_modules', '.git', 'coverage', 'dist', 'build']);

function listBackendTestFiles() {
  const out = [];
  const walk = dir => {
    for (const entry of readdirSyncTolerant(dir, { withFileTypes: true }, LABEL)) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) {
          walk(full);
        }
      } else if (/\.test\.m?js$/.test(entry.name)) {
        out.push(full);
      }
    }
  };
  walk(BACKEND);
  return out.sort();
}

// ---------------------------------------------------------------------------
// Static detector for tree-touching suites
// ---------------------------------------------------------------------------

const FS_WRITE_FNS = [
  'writeFileSync',
  'writeFile',
  'appendFileSync',
  'appendFile',
  'mkdtempSync',
  'mkdtemp',
  'mkdirSync',
  'mkdir',
  'copyFileSync',
  'copyFile',
  'cpSync',
  'cp',
  'renameSync',
  'rename',
  'symlinkSync',
  'symlink',
  'rmSync',
  'rm',
  'unlinkSync',
  'unlink',
  'rmdirSync',
  'rmdir',
];
const WRITE_ALT = FS_WRITE_FNS.join('|');
const FS_MODULE = '[\'"](?:node:)?fs(?:/promises)?[\'"]';
// Expressions that name the repository checkout (or this file's place in it).
// process.cwd() counts: Jest runs suites with cwd = backend/.
const ROOT_TOKEN =
  /\b(?:[A-Z_]*ROOT[A-Z_]*|repoRoot|projectRoot|rootDir|BACKEND[A-Z_]*|backendDir|HERE|__dirname|__filename)\b|import\.meta\.(?:url|dirname|filename)|\bprocess\.cwd\s*\(/;
// Only the OS temp dir makes a path temp. A mkdtemp() whose prefix is in the
// repo (mkdtempSync(path.join(BACKEND, 'x-'))) creates a directory IN the tree.
const TEMP_TOKEN = /\btmpdir\s*\(/;
// Bounded argument span: survives nested calls like readdirSync(join(a, b), {...}).
const SPAN = '[\\s\\S]{0,200}?';

function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
}

/** Local names bound to fs write functions, and names bound to an fs (or fs.promises) namespace. */
function fsBindings(code) {
  const writers = [];
  const namespaces = [];
  // Every import form: `{ a, b as c, promises as fsp }`, `fs`, `* as fs`, `fs, { a }`,
  // from fs, node:fs, fs/promises or node:fs/promises.
  const importRe = new RegExp(
    `import\\s+(?:(?:\\*\\s+as\\s+)?(\\w+)\\s*,?\\s*)?(?:\\{([^}]*)\\})?\\s*from\\s*${FS_MODULE}`,
    'g',
  );
  for (const m of code.matchAll(importRe)) {
    if (m[1]) {
      namespaces.push(m[1]);
    }
    for (const part of (m[2] ?? '').split(',')) {
      const [original, alias] = part.trim().split(/\s+as\s+/);
      const local = (alias || original || '').trim();
      if (original?.trim() === 'promises') {
        namespaces.push(local);
      } else if (original && FS_WRITE_FNS.includes(original.trim())) {
        writers.push([original.trim(), local]);
      }
    }
  }
  // Re-bindings of an fs namespace: `const fsp = fs.promises;` and destructuring
  // `const { promises: fsp, writeFileSync: put } = fs;` (or `= fs.promises`).
  for (const m of code.matchAll(/\b(?:const|let|var)\s+(\w+)\s*=\s*(\w+)\.promises\b/g)) {
    if (namespaces.includes(m[2])) {
      namespaces.push(m[1]);
    }
  }
  for (const m of code.matchAll(/\b(?:const|let|var)\s*\{([^}]*)\}\s*=\s*(\w+)(?:\.promises)?\b/g)) {
    if (!namespaces.includes(m[2])) {
      continue;
    }
    for (const part of m[1].split(',')) {
      const [original, alias] = part.trim().split(/\s*:\s*/);
      const local = (alias || original || '').trim();
      if (original?.trim() === 'promises') {
        namespaces.push(local);
      } else if (original && FS_WRITE_FNS.includes(original.trim())) {
        writers.push([original.trim(), local]);
      }
    }
  }
  return { writers, namespaces };
}

/** True when `expr` names the checkout: a root token or a tainted name, and no temp dir. */
function namesRepo(expr, tainted) {
  if (TEMP_TOKEN.test(expr)) {
    return false;
  }
  return ROOT_TOKEN.test(expr) || [...tainted].some(name => new RegExp(`\\b${name}\\b`).test(expr));
}

/**
 * Names whose value is derived from the checkout: `const PLANT = path.join(REPO_ROOT, …)`,
 * `testDocsPath = join(__dirname, …)`, `{ abs: path.join(BACKEND, …) }`, transitively.
 * A name built from mkdtemp()/tmpdir() is never tainted (per-definition temp check).
 */
function repoTaintedNames(code) {
  const defs = [
    ...[...code.matchAll(/\b(\w+)\s*=(?![=>])\s*([\s\S]{0,300}?);/g)].map(m => [m[1], m[2]]),
    // Lookahead capture so a nested key (`{ a: { abs: … } }`) is not swallowed by its parent's match.
    ...[...code.matchAll(/\b(\w+)\s*:(?=\s*([^,\n}]{1,300}))/g)].map(m => [m[1], m[2]]),
  ];
  const tainted = new Set();
  let grew = true;
  while (grew) {
    grew = false;
    for (const [name, rhs] of defs) {
      if (!tainted.has(name) && namesRepo(rhs, tainted)) {
        tainted.add(name);
        grew = true;
      }
    }
  }
  return tainted;
}

/** Top-level arguments of the call whose `(` is at `open`, scanning at most 400 chars. */
function callArguments(code, open) {
  const args = [];
  let depth = 0;
  let start = open + 1;
  for (let i = open + 1; i < Math.min(code.length, open + 400); i++) {
    const ch = code[i];
    if (ch === '(' || ch === '[' || ch === '{') {
      depth++;
    } else if (ch === ')' || ch === ']' || ch === '}') {
      if (depth === 0) {
        args.push(code.slice(start, i));
        return args;
      }
      depth--;
    } else if (ch === ',' && depth === 0) {
      args.push(code.slice(start, i));
      start = i + 1;
    }
  }
  args.push(code.slice(start, open + 400));
  return args;
}

/** Which arguments a write function changes on disk: the destination of a copy/link, both ends of a move. */
function writtenArguments(fn, args) {
  if (/^(?:copyFile|cp|symlink)/.test(fn)) {
    return args.slice(1, 2);
  }
  if (/^rename/.test(fn)) {
    return args.slice(0, 2);
  }
  return args.slice(0, 1);
}

/** Why a test file's code touches the shared tree; [] when it does not. */
function treeTouchReasons(source) {
  const code = stripComments(source);
  const reasons = [];
  const { writers, namespaces } = fsBindings(code);
  const tainted = repoTaintedNames(code);
  // Each call regex captures the fs function's ORIGINAL name (group 1) for writtenArguments().
  const callRes = [
    ...writers.map(([original, local]) => [original, new RegExp(`(?<![\\w.])${local}\\s*\\(`, 'g')]),
    ...namespaces.map(ns => [null, new RegExp(`\\b${ns}\\.(?:promises\\.)?(${WRITE_ALT})\\s*\\(`, 'g')]),
  ];
  const writesRepo = callRes.some(([original, re]) =>
    [...code.matchAll(re)].some(m => {
      const args = callArguments(code, m.index + m[0].length - 1);
      return writtenArguments(original ?? m[1], args).some(arg => namesRepo(arg, tainted));
    }),
  );
  if (writesRepo) {
    reasons.push('writes files into the repository tree');
  }
  if (/doctrine-checks/.test(code)) {
    reasons.push('runs a scripts/doctrine-checks check');
  }
  const typedWalk = new RegExp(`\\breaddir\\w*\\s*\\(${SPAN}\\b(?:withFileTypes|recursive)\\s*:\\s*true`);
  const statWalk =
    new RegExp(`\\bstat(?:Sync)?\\s*\\(${SPAN}\\)\\s*\\.isDirectory\\s*\\(`).test(code) &&
    /\breaddir\w*\s*\(/.test(code);
  if (typedWalk.test(code) || statWalk || /\bwalkFiles\s*\(|\bglobSync\s*\(/.test(code)) {
    reasons.push('walks directories');
  }
  return reasons;
}

// ---------------------------------------------------------------------------

describe('tree-touching suites run in one serial stream (Equoria-rfv9j)', () => {
  const files = listBackendTestFiles();
  const rels = files.map(file => toBackendRelative(BACKEND, file));

  it('enumerates the real backend suite (guards a vacuous pass)', () => {
    expect(files.length).toBeGreaterThan(900);
    expect(rels.filter(isTreeSuite).length).toBeGreaterThan(300);
  });

  describe('tree-lane-plan.mjs', () => {
    const canonical = files.find(f => toBackendRelative(BACKEND, f).startsWith('__tests__/'));
    const plan2 = () =>
      planLanes({ discovered: files, backendDir: BACKEND, isCanonical: f => f === canonical, shards: 8, lanes: 2 });

    it('every non-canonical suite is in exactly one batch, as an explicit --runTestsByPath list', () => {
      const { lanes } = plan2();
      const scheduled = lanes.flat().flatMap(batch => batch.files);
      expect(new Set(scheduled).size).toBe(scheduled.length);
      expect([...scheduled].sort()).toEqual(files.filter(f => f !== canonical).sort());
      for (const batch of lanes.flat()) {
        // No batch re-discovers: no --shard, no pattern, only the exact list (backend-relative).
        expect(batch.jestArgs).toEqual(['--runTestsByPath', ...batch.files.map(f => toBackendRelative(BACKEND, f))]);
        expect(batch.files.length).toBeGreaterThan(0);
      }
      const indices = lanes.flat().map(batch => batch.index);
      expect(indices).toEqual(indices.map((_, i) => i));
    });

    it('lane 1 holds every TREE suite and lane 2 holds none', () => {
      const { treeFiles, lanes } = plan2();
      const expectedTree = files.filter((f, i) => f !== canonical && isTreeSuite(rels[i]));
      expect([...treeFiles].sort()).toEqual([...expectedTree].sort());
      const lane2 = lanes[1].flatMap(batch => batch.files);
      expect(lane2.filter(f => isTreeSuite(toBackendRelative(BACKEND, f)))).toEqual([]);
      expect(lanes[0].flatMap(batch => batch.files)).toEqual(expect.arrayContaining(expectedTree));
    });

    it('the plan depends only on the discovered set, never on discovery order', () => {
      const reversed = planLanes({
        discovered: [...files].reverse(),
        backendDir: BACKEND,
        isCanonical: f => f === canonical,
        shards: 8,
        lanes: 2,
      });
      expect(reversed.lanes).toEqual(plan2().lanes);
    });

    it('one lane: every suite once, canonical included, all batches in lane 1', () => {
      const { lanes } = planLanes({
        discovered: files,
        backendDir: BACKEND,
        isCanonical: () => false,
        shards: 8,
        lanes: 1,
      });
      expect(lanes).toHaveLength(1);
      const scheduled = lanes[0].flatMap(batch => batch.files);
      expect([...scheduled].sort()).toEqual([...files].sort());
    });

    it('tree batches stay within the per-process size and the lanes stay balanced by suite count', () => {
      const { treeFiles, lanes } = plan2();
      const treeBatches = lanes[0].filter(batch => batch.label.includes('tree'));
      for (const batch of treeBatches) {
        expect(batch.files.length).toBeLessThanOrEqual(TREE_BATCH_MAX_FILES);
      }
      const perShard = (files.length - 1 - treeFiles.length) / 8;
      const lane1Suites = lanes[0].flatMap(batch => batch.files).length;
      expect(Math.abs(lane1Suites - (files.length - 1) / 2)).toBeLessThanOrEqual(perShard / 2 + 1);
    });

    it('an oversize slice is split deterministically under the argv budget (synthetic 1,200 suites)', () => {
      const synthetic = Array.from({ length: 1200 }, (_, i) =>
        path.join(
          BACKEND,
          'modules',
          `m${i % 40}`,
          '__tests__',
          `synthetic${String(i).padStart(4, '0')}Long.integration.test.mjs`,
        ),
      );
      const input = { discovered: synthetic, backendDir: BACKEND, isCanonical: () => false, shards: 1, lanes: 1 };
      const unsplit = argvChars(['--runTestsByPath', ...synthetic.map(f => toBackendRelative(BACKEND, f))]);
      expect(unsplit).toBeGreaterThan(MAX_BATCH_ARGV_CHARS);
      const { lanes } = planLanes(input);
      const all = lanes.flat();
      expect(all.length).toBeGreaterThan(1);
      for (const batch of all) {
        expect(argvChars(batch.jestArgs)).toBeLessThanOrEqual(MAX_BATCH_ARGV_CHARS);
      }
      expect(all.map(batch => batch.label)).toEqual(all.map((_, i) => `lane 1 shard 1/1 part ${i + 1}/${all.length}`));
      expect(all.flatMap(batch => batch.files).sort()).toEqual([...synthetic].sort());
      expect(planLanes(input).lanes).toEqual(lanes);
    });

    it('the real suite fits the argv budget at --jest-shards=1 (split) and at the canonical 8', () => {
      for (const shards of [1, 8]) {
        const { lanes } = planLanes({
          discovered: files,
          backendDir: BACKEND,
          isCanonical: () => false,
          shards,
          lanes: 2,
        });
        const scheduled = lanes.flat().flatMap(batch => batch.files);
        expect(scheduled).toHaveLength(files.length);
        for (const batch of lanes.flat()) {
          expect(argvChars(batch.jestArgs)).toBeLessThanOrEqual(MAX_BATCH_ARGV_CHARS);
        }
      }
    });

    it('throws, naming the batch, when even one suite per batch exceeds the budget', () => {
      expect(() =>
        planLanes({
          discovered: [path.join(BACKEND, 'modules', 'x', '__tests__', `${'a'.repeat(80)}.test.mjs`)],
          backendDir: BACKEND,
          isCanonical: () => false,
          shards: 1,
          lanes: 1,
          maxArgvChars: 50,
        }),
      ).toThrow(/lane 1 shard 1\/1 cannot fit the 50-char argv budget/);
    });

    it('discovery drops transient plants, and only them', () => {
      expect(rels.filter(isPlantedTestPath)).toEqual([]); // no real suite carries a plant name
      for (const planted of [
        '__tests__/__doctrine_jest_plant_70pb9__.test.mjs',
        'modules/horses/__tests__/__doctrine_jest_plant_70pb9__.test.mjs',
        '__tests__/__planted_placeholder_fefh2_sentinel_tmp__.test.mjs',
        '__tests__/__placeholder_artifact_DO_NOT_COMMIT__.test.mjs',
        'modules/horses/__tests__/_v8l96_sentinel_test_cross.test.mjs',
        '__tests__/_q7lqz_vanished_scan_scratch/planted.test.mjs',
        '__tests__/_silent_catch_doctrine_sentinel/planted.test.mjs',
        '__tests__/_console_log_sentinel_scratch/planted.test.mjs',
        '__tests__/_deep_prisma_import_sentinel_scratch/planted.test.mjs',
        '__tests__/_file_size_doctrine_sentinel/plantedThing.test.mjs',
        '__tests__/__ml7jj_inscope_70pb9__.test.mjs',
        'routes/__ml7jj_oos_70pb9__.test.mjs',
      ]) {
        expect(isPlantedTestPath(planted)).toBe(true);
      }
    });

    it('the runner discovers once and never hands Jest a --shard (source contract)', () => {
      const src = readFileSync(path.join(BACKEND, 'scripts', 'run-suite-sharded.mjs'), 'utf8');
      expect(src.match(/=\s*listTestFiles\(\)/g)).toHaveLength(1);
      expect(src).not.toMatch(/[`'"]--shard=/);
      expect(src).toMatch(/planLanes\(/);
    });
  });

  describe('no planter or whole-tree scanner outside the TREE set', () => {
    it('every test file outside the TREE set is clean', () => {
      const offenders = [];
      for (const [i, file] of files.entries()) {
        if (isTreeSuite(rels[i])) {
          continue;
        }
        const source = readScannedFileSyncTolerant(file, LABEL);
        if (source === null) {
          continue;
        }
        const reasons = treeTouchReasons(source);
        if (reasons.length) {
          offenders.push(`${rels[i]}: ${reasons.join('; ')}`);
        }
      }
      // A failure here means a suite that plants in, or scans, the shared tree
      // would run concurrently with the planters/scanners in lane 1. Move it
      // under backend/__tests__/, or add it to TREE_SUITE_FILES in
      // backend/scripts/tree-lane-plan.mjs AND to test.yml's serial shard.
      expect(offenders).toEqual([]);
    });

    it('SENTINEL-POSITIVE: the detector fires on planted planter and scanner sources', () => {
      const WRITES = ['writes files into the repository tree'];
      const WALKS = ['walks directories'];
      const planted = {
        nsWrite: "import fs from 'node:fs';\nfs.writeFileSync(path.join(BACKEND, 'services/x.mjs'), src);",
        aliasViaTaintedConst:
          "import { mkdirSync, rmSync as wipe } from 'fs';\nconst PLANT = path.join(REPO_ROOT, 'backend/x');\nmkdirSync(PLANT);\nwipe(PLANT);",
        mixedImport:
          "import fs, { existsSync } from 'node:fs';\nconst p = join(__dirname, 'fixtures');\nif (!existsSync(p)) fs.mkdirSync(p);",
        objectKey:
          "import fs from 'node:fs';\nconst PLANTS = { a: { abs: path.join(BACKEND, 'modules/x.mjs') } };\nfs.writeFileSync(p.abs, src);",
        // Review probes (I2): nested-call argument span, fs.promises in all three
        // spellings, a stat()-based walk, and a temp dir elsewhere in the file.
        nestedReaddir:
          "import fs from 'fs';\nconst e = fs.readdirSync(join(ROOT, 'backend'), { withFileTypes: true });",
        promisesAlias: "import { promises as fsp } from 'fs';\nawait fsp.writeFile(path.join(BACKEND, 'x.mjs'), s);",
        fsPromisesModule: "import { writeFile } from 'fs/promises';\nawait writeFile(path.join(REPO_ROOT, 'x'), s);",
        nsPromises: "import fs from 'node:fs';\nawait fs.promises.rm(path.join(BACKEND, 'x'), { recursive: true });",
        statWalk:
          "import { readdirSync, statSync } from 'fs';\nfor (const n of readdirSync(dir)) {\n  if (statSync(join(dir, n)).isDirectory()) walk(join(dir, n));\n}",
        // Review round 2 (latent minors): cwd-rooted paths, a repo-prefixed mkdtemp,
        // and fs.promises / writers reached through re-binding or destructuring.
        cwdRooted: "import fs from 'node:fs';\nfs.writeFileSync(path.join(process.cwd(), 'services/x.mjs'), s);",
        mkdtempInRepo:
          "import fs from 'node:fs';\nconst dir = fs.mkdtempSync(path.join(BACKEND, 'x-'));\nfs.writeFileSync(path.join(dir, 'a'), '');",
        destructuredPromises:
          "import fs from 'node:fs';\nconst { promises: fsp } = fs;\nawait fsp.writeFile(path.join(BACKEND, 'x.mjs'), s);",
        promisesRebound: "import fs from 'fs';\nconst fsp = fs.promises;\nawait fsp.rm(path.join(REPO_ROOT, 'x'));",
        destructuredWriter:
          "import fs from 'fs';\nconst { writeFileSync: put } = fs;\nput(path.join(BACKEND, 'x.mjs'), s);",
        copyIntoRepo:
          "import { copyFileSync } from 'node:fs';\nconst SRC = join(os.tmpdir(), 'x');\ncopyFileSync(SRC, path.join(BACKEND, 'data/x.json'));",
        tempElsewhere:
          "import fs from 'node:fs';\nconst tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'x-'));\nfs.writeFileSync(path.join(tmp, 'a'), '');\nfs.writeFileSync(path.join(__dirname, 'leak.txt'), '');",
      };
      expect(treeTouchReasons(planted.nsWrite)).toEqual(WRITES);
      expect(treeTouchReasons(planted.aliasViaTaintedConst)).toEqual(WRITES);
      expect(treeTouchReasons(planted.mixedImport)).toEqual(WRITES);
      expect(treeTouchReasons(planted.objectKey)).toEqual(WRITES);
      expect(treeTouchReasons(planted.nestedReaddir)).toEqual(WALKS);
      expect(treeTouchReasons(planted.promisesAlias)).toEqual(WRITES);
      expect(treeTouchReasons(planted.fsPromisesModule)).toEqual(WRITES);
      expect(treeTouchReasons(planted.nsPromises)).toEqual(WRITES);
      expect(treeTouchReasons(planted.statWalk)).toEqual(WALKS);
      expect(treeTouchReasons(planted.tempElsewhere)).toEqual(WRITES);
      expect(treeTouchReasons(planted.copyIntoRepo)).toEqual(WRITES);
      expect(treeTouchReasons(planted.cwdRooted)).toEqual(WRITES);
      expect(treeTouchReasons(planted.mkdtempInRepo)).toEqual(WRITES);
      expect(treeTouchReasons(planted.destructuredPromises)).toEqual(WRITES);
      expect(treeTouchReasons(planted.promisesRebound)).toEqual(WRITES);
      expect(treeTouchReasons(planted.destructuredWriter)).toEqual(WRITES);
      expect(treeTouchReasons("const CHECK = path.join(ROOT, 'scripts', 'doctrine-checks', 'c.mjs');")).toEqual([
        'runs a scripts/doctrine-checks check',
      ]);
    });

    it('NEGATIVE CONTROL: temp-dir writers, comments, look-alike names and flat reads stay clean', () => {
      expect(
        treeTouchReasons(
          "import fs from 'node:fs';\nconst d = fs.mkdtempSync(path.join(os.tmpdir(), 'x-'));\nfs.writeFileSync(path.join(d, 'a'), '');",
        ),
      ).toEqual([]);
      expect(
        treeTouchReasons(
          "import { writeFile } from 'fs/promises';\nfunction save(dir) { return writeFile(path.join(dir, 'a'), ''); }",
        ),
      ).toEqual([]);
      // foalCreationBreedDataOutage's shape: READ a tracked file, write its copy into a temp dir.
      expect(
        treeTouchReasons(
          "import { copyFileSync, mkdtempSync, rmSync } from 'node:fs';\nconst SRC = resolve(__dirname, '../data/x.json');\nconst DIR = mkdtempSync(join(tmpdir(), 'x-'));\nconst COPY = join(DIR, 'x.json');\ncopyFileSync(SRC, COPY);\nrmSync(COPY);",
        ),
      ).toEqual([]);
      expect(treeTouchReasons('// runs scripts/doctrine-checks/check-x.mjs in CI\n')).toEqual([]);
      expect(
        treeTouchReasons("import fs from 'fs';\nfunction mkdir(name) { return request(app).post(name); }\nmkdir('x');"),
      ).toEqual([]);
      expect(treeTouchReasons("import { readdirSync } from 'fs';\nconst f = readdirSync(DATA_DIR);")).toEqual([]);
    });

    it('SENTINEL-POSITIVE: the detector flags the real planters and scanners of the observed races', () => {
      const known = [
        '__tests__/controllerMaxLinesDoctrine.sentinel.test.mjs',
        '__tests__/fileSizeThresholdDoctrine.sentinel.test.mjs',
        '__tests__/noUnsafeRawSqlDoctrine.sentinel.test.mjs',
        '__tests__/scripts/unsafeRawSqlAllowlistStale.sentinel.test.mjs',
        '__tests__/rethrowAfterLogDoctrine.sentinel.test.mjs',
        '__tests__/silentCleanupCatchDoctrine.sentinel.test.mjs',
        '__tests__/scripts/doctrineBaselineStale.sentinel.test.mjs',
        '__tests__/scripts/moduleBarrelBoundaryEslint.sentinel.test.mjs',
        '__tests__/scripts/moduleDependencyGraphDoctrine.sentinel.test.mjs',
        'modules/docs/__tests__/userDocumentation.test.mjs',
        'modules/docs/__tests__/userDocumentationRoutes.test.mjs',
        'modules/grooms/__tests__/groomSalaryPassScoped.sentinel.test.mjs',
        'modules/traits/__tests__/flagEngineSingleSource.sentinel.test.mjs',
      ];
      const missed = known.filter(rel => treeTouchReasons(readFileSync(path.join(BACKEND, rel), 'utf8')).length === 0);
      expect(missed).toEqual([]);
    });
  });

  describe('CI runs the TREE set serially', () => {
    const workflowText = readFileSync(path.join(REPO_ROOT, '.github/workflows/test.yml'), 'utf8');

    it('exactly one shard selects every TREE suite, and that shard is marked serial', () => {
      const patterns = extractShardPatterns(workflowText).map(p => ({ ...p, re: new RegExp(p.pattern) }));
      const treeRepoPaths = rels.filter(isTreeSuite).map(rel => `backend/${rel}`);
      const owners = new Set();
      const unowned = [];
      for (const p of treeRepoPaths) {
        const hits = patterns.filter(s => s.re.test(p));
        if (hits.length !== 1) {
          unowned.push(`${p} -> ${hits.length} shard(s)`);
        }
        for (const h of hits) {
          owners.add(h.shard);
        }
      }
      expect(unowned).toEqual([]);
      expect([...owners]).toHaveLength(1);

      const [serialShard] = owners;
      const item = workflowText.match(
        new RegExp(`-\\s*shard:\\s*${serialShard}\\s*\\r?\\n((?:(?![ \\t]*-\\s*shard:)[^\\n]*\\n)*)`),
      );
      expect(item).not.toBeNull();
      expect(item[1]).toMatch(/^\s*serial:\s*true\s*$/m);
    });

    it('the backend test step runs a serial matrix entry through test:backend:ci:serial', () => {
      expect(workflowText).toMatch(/SHARD_SERIAL:\s*\$\{\{\s*matrix\.serial\s*\}\}/);
      expect(workflowText).toMatch(
        /if \[ "\$SHARD_SERIAL" = "true" \]; then\s*\r?\n\s*npm run test:backend:ci:serial -- "\$\{jest_args\[@\]\}"[^\n]*\r?\n\s*else\s*\r?\n\s*npm run test:backend:ci -- "\$\{jest_args\[@\]\}"/,
      );
    });

    it('test:backend:ci:serial is test:backend:ci with one worker (never --runInBand beside --maxWorkers)', () => {
      const { scripts } = JSON.parse(readFileSync(path.join(BACKEND, 'package.json'), 'utf8'));
      const serial = scripts['test:backend:ci:serial'];
      expect(serial).toBe(scripts['test:backend:ci'].replace('--maxWorkers=2', '--maxWorkers=1'));
      expect(serial).toMatch(/--maxWorkers=1\b/);
      // jest-cli 30 rejects the pair: "Both --runInBand and --maxWorkers were specified".
      expect(serial).not.toMatch(/--runInBand/);
    });
  });
});
