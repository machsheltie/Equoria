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
 *   1. tree-lane-plan.mjs puts every TREE suite in lane 1, and its Jest ignore
 *      patterns drop exactly the TREE set from the hash shards (so no REST shard
 *      — and therefore nothing in lane 2 — can select a TREE suite).
 *   2. No planter or whole-tree scanner exists OUTSIDE the TREE set. The
 *      detector is a static heuristic over each test file's code (comments
 *      stripped): an fs write call in a file that never creates a temp dir, a
 *      reference to scripts/doctrine-checks, or a recursive/typed directory
 *      walk. It is proved to fire on planted sources and on the real planters
 *      and scanners it exists to catch.
 *   3. CI parity: test.yml's serial shard selects every TREE suite and runs
 *      with --runInBand (shard 3 previously ran them at --maxWorkers=2, the same
 *      interleaving in one job).
 */
import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  TREE_BATCH_MAX_FILES,
  isTreeSuite,
  planTreeLanes,
  toBackendRelative,
  treeIgnorePatterns,
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
const FS_MODULE = '[\'"](?:node:)?fs(?:/promises)?[\'"]';

function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
}

/** Local names bound to fs write functions, and fs namespace/default import names. */
function fsBindings(code) {
  const writers = [];
  const namespaces = [];
  // Every import form: `{ a, b as c }`, `fs`, `* as fs`, and `fs, { a }`.
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
      if (original && FS_WRITE_FNS.includes(original.trim())) {
        writers.push((alias || original).trim());
      }
    }
  }
  return { writers, namespaces };
}

/** Why a test file's code touches the shared tree; [] when it does not. */
function treeTouchReasons(source) {
  const code = stripComments(source);
  const reasons = [];
  const { writers, namespaces } = fsBindings(code);
  const writeCalls = [
    ...writers.map(name => new RegExp(`(?<![\\w.])${name}\\s*\\(`)),
    ...namespaces.map(ns => new RegExp(`\\b${ns}\\.(?:${FS_WRITE_FNS.join('|')})\\s*\\(`)),
  ];
  const usesTempDir = /\b(?:mkdtempSync|mkdtemp|tmpdir)\s*\(/.test(code);
  if (writeCalls.some(re => re.test(code)) && !usesTempDir) {
    reasons.push('writes files without a temp dir');
  }
  if (/doctrine-checks/.test(code)) {
    reasons.push('runs a scripts/doctrine-checks check');
  }
  if (/\breaddir\w*\s*\([^)]*\b(?:withFileTypes|recursive)\s*:\s*true|\bwalkFiles\s*\(|\bglobSync\s*\(/.test(code)) {
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
    it('the hash-shard ignore patterns drop EXACTLY the TREE set (Windows and POSIX paths)', () => {
      const regexes = treeIgnorePatterns(path.basename(BACKEND)).map(p => new RegExp(p));
      const ignoredBy = p => regexes.some(re => re.test(p));
      const disagreements = [];
      for (const [i, file] of files.entries()) {
        const posix = `/home/runner/work/Equoria/Equoria/backend/${rels[i]}`;
        for (const candidate of [file, posix]) {
          if (ignoredBy(candidate) !== isTreeSuite(rels[i])) {
            disagreements.push(candidate);
          }
        }
      }
      expect(disagreements).toEqual([]);
    });

    it('SENTINEL-POSITIVE: the patterns fire on TREE paths and not on look-alikes', () => {
      const regexes = treeIgnorePatterns('backend').map(p => new RegExp(p));
      const ignored = p => regexes.some(re => re.test(p));
      expect(ignored('C:\\r\\backend\\__tests__\\scripts\\x.test.mjs')).toBe(true);
      expect(ignored('/r/backend/modules/docs/__tests__/x.test.mjs')).toBe(true);
      expect(ignored('/r/backend/modules/grooms/__tests__/groomSalaryPassScoped.sentinel.test.mjs')).toBe(true);
      expect(ignored('/r/backend/modules/horses/__tests__/x.test.mjs')).toBe(false);
      expect(ignored('/r/backend/modules/docsx/__tests__/x.test.mjs')).toBe(false);
      expect(ignored('/r/backend/tests/__tests__x/x.test.mjs')).toBe(false);
    });

    it('lane 1 runs every TREE suite; lane 2 holds only hash shards; nothing runs twice', () => {
      const canonical = files.find(f => toBackendRelative(BACKEND, f).startsWith('__tests__/'));
      const { treeFiles, lanes } = planTreeLanes({
        discovered: files,
        backendDir: BACKEND,
        isCanonical: f => f === canonical,
        restShards: 8,
        restArgs: [],
      });
      const expectedTree = files.filter((f, i) => f !== canonical && isTreeSuite(rels[i]));
      expect([...treeFiles].sort()).toEqual([...expectedTree].sort());

      const lane1Files = lanes[0].flatMap(batch => batch.files ?? []);
      expect(lane1Files.sort()).toEqual([...expectedTree].sort());
      expect(new Set(lane1Files).size).toBe(lane1Files.length);
      expect(lane1Files).not.toContain(canonical);

      for (const batch of lanes[1]) {
        expect(batch.files).toBeUndefined();
        expect(batch.jestArgs[0]).toMatch(/^--shard=\d+\/8$/);
      }
      const shards = lanes.flat().filter(batch => !batch.files);
      expect(shards).toHaveLength(8);
      for (const batch of shards) {
        expect(batch.jestArgs.filter(a => a.startsWith('--testPathIgnorePatterns='))).toHaveLength(
          treeIgnorePatterns(path.basename(BACKEND)).length,
        );
      }
      const indices = lanes.flat().map(batch => batch.index);
      expect(indices).toEqual(indices.map((_, i) => i));
    });

    it('tree batches stay within the per-process size and the lanes stay balanced', () => {
      const { treeFiles, lanes } = planTreeLanes({
        discovered: files,
        backendDir: BACKEND,
        isCanonical: () => false,
        restShards: 8,
        restArgs: [],
      });
      const treeBatches = lanes[0].filter(batch => batch.files);
      for (const batch of treeBatches) {
        expect(batch.files.length).toBeLessThanOrEqual(TREE_BATCH_MAX_FILES);
      }
      const perShard = (files.length - treeFiles.length) / 8;
      const lane1Shards = lanes[0].length - treeBatches.length;
      const lane1Suites = treeFiles.length + lane1Shards * perShard;
      expect(Math.abs(lane1Suites - files.length / 2)).toBeLessThanOrEqual(perShard / 2 + 1);
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
      expect(
        treeTouchReasons("import fs from 'node:fs';\nfs.writeFileSync(path.join(BACKEND, 'services/x.mjs'), src);"),
      ).toEqual(['writes files without a temp dir']);
      expect(treeTouchReasons("import { mkdirSync, rmSync as wipe } from 'fs';\nmkdirSync(dir);\nwipe(dir);")).toEqual([
        'writes files without a temp dir',
      ]);
      expect(
        treeTouchReasons("import fs, { existsSync } from 'node:fs';\nif (!existsSync(p)) fs.mkdirSync(p);"),
      ).toEqual(['writes files without a temp dir']);
      expect(treeTouchReasons("const CHECK = path.join(ROOT, 'scripts', 'doctrine-checks', 'c.mjs');")).toEqual([
        'runs a scripts/doctrine-checks check',
      ]);
      expect(treeTouchReasons("import fs from 'fs';\nconst e = fs.readdirSync(dir, { withFileTypes: true });")).toEqual(
        ['walks directories'],
      );
    });

    it('NEGATIVE CONTROL: temp-dir writers, comments, look-alike names and flat reads stay clean', () => {
      expect(
        treeTouchReasons(
          "import fs from 'node:fs';\nconst d = fs.mkdtempSync(path.join(os.tmpdir(), 'x-'));\nfs.writeFileSync(path.join(d, 'a'), '');",
        ),
      ).toEqual([]);
      expect(treeTouchReasons('// runs scripts/doctrine-checks/check-x.mjs in CI\n')).toEqual([]);
      expect(
        treeTouchReasons("import fs from 'fs';\nfunction rename(id) { return request(app).put(id); }\nrename(1);"),
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

    it('the backend test step passes --runInBand when the matrix entry is serial', () => {
      expect(workflowText).toMatch(/SHARD_SERIAL:\s*\$\{\{\s*matrix\.serial\s*\}\}/);
      expect(workflowText).toMatch(/if \[ "\$SHARD_SERIAL" = "true" \]; then serial_args=\(--runInBand\); fi/);
      expect(workflowText).toMatch(/npm run test:backend:ci -- \\\r?\n(?:.*\r?\n){0,3}?\s*"\$\{serial_args\[@\]\}"/);
    });
  });
});
