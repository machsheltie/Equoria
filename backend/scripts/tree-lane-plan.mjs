/**
 * Batch and lane plan for run-suite-sharded.mjs (Equoria-rfv9j).
 *
 * Two defects of the earlier `jest --shard=i/n` per-batch design, both rooted in
 * the shared working tree:
 *
 * 1. Cross-lane planter/scanner race. Some suites WRITE throwaway violating
 *    files into the real tree and delete them again ("planters"); some WALK the
 *    tree and assert it is clean ("scanners"). With --lanes=2 both lanes run in
 *    ONE checkout at once, so a scanner read the other lane's plant: ENOENT (WS4
 *    S6 push) or a false violation (holding controllerMaxLines' 803-line plant
 *    makes check-file-size-thresholds exit 1). Fix: every tree-touching suite
 *    runs in lane 1, in ONE serial stream; lane 2 only runs suites that touch
 *    nothing but their own database and temp dirs.
 *
 * 2. Per-batch discovery. Each `--shard=i/n` invocation discovered the test
 *    files itself, at its own start. Planters write *.test.mjs files (e.g.
 *    planted.test.mjs, __doctrine_jest_plant_70pb9__.test.mjs), so a shard
 *    starting while a plant existed saw a different sorted list and different
 *    slice boundaries: a boundary suite ran twice (gate equoria-shard-nwrKX9:
 *    traitRevelationAnalytics in batch-2 AND batch-3) or not at all. Fix: the
 *    runner discovers ONCE, before any lane starts, and every batch gets an
 *    EXPLICIT --runTestsByPath list computed here. Discovery-time plant
 *    artifacts (reserved scratch/plant names) are dropped by isPlantedTestPath.
 *
 *   TREE set  = backend/__tests__/** (every doctrine planter and whole-tree
 *               scanner lives there; CI's serial shard 3 is the same set) plus
 *               modules/docs/__tests__/** (two suites share one fixture dir
 *               there) plus two module sentinels that walk the real tree.
 *   REST set  = everything else, ordered by a hash of its path and split into
 *               --jest-shards contiguous slices (the same spreading Jest's own
 *               --shard used, minus the per-invocation discovery).
 *
 * treeLanePinning.sentinel.test.mjs keeps this honest: it fails when a planter
 * or whole-tree scanner exists OUTSIDE the TREE set, and when CI stops running
 * the TREE set serially.
 *
 * Pure module: no I/O, no side effects; run-suite-sharded.mjs executes the plan.
 */
import { createHash } from 'node:crypto';
import path from 'node:path';
import { isReservedScratchPlantPathSegment } from '../../scripts/lib/doctrine-scan-patterns.mjs';

/** Backend-relative directories whose suites are tree-touching (whole subtree). */
export const TREE_SUITE_DIRS = Object.freeze(['__tests__', 'modules/docs/__tests__']);

/** Backend-relative single suites outside those directories that walk the real tree. */
export const TREE_SUITE_FILES = Object.freeze([
  'modules/grooms/__tests__/groomSalaryPassScoped.sentinel.test.mjs',
  'modules/traits/__tests__/flagEngineSingleSource.sentinel.test.mjs',
  // Equoria-or2ua: walks modules/ to prove no rider payload exposes the retirement age.
  'modules/riders/__tests__/riderRetirementHidden.integration.test.mjs',
]);

/**
 * Backend-relative timing sentinels that need a quiet machine (Equoria-jeci6,
 * Equoria-xh7zd). They assert wall-clock bounds, so a busy neighbour (the other
 * lane, a second Jest worker, a heap grown over hundreds of suites) can fail
 * them with no code change. The local gate runs them in its serial canonical
 * pass (run-suite-sharded.mjs); CI runs them in their own fresh single-process
 * step of the shard that owns them (test.yml `quiet:`).
 * check-ci-shard-exclusivity.mjs proves CI's quiet step selects exactly this list.
 */
export const quietTimingSuites = Object.freeze([
  'modules/auth/__tests__/forgotPasswordTimingOracle.integration.test.mjs',
  'modules/auth/__tests__/loginTimingOracle.sentinel.test.mjs',
]);

/**
 * Most suites per tree batch (one fresh --runInBand process each). Kept near
 * the ~120-suite shards the 768MB lane heap was measured on. Batches pass
 * backend-relative paths (~60 chars each), far below the Windows
 * 32767-character command-line limit.
 */
export const TREE_BATCH_MAX_FILES = 110;

/**
 * Per-batch budget for the Jest arguments the planner controls. Windows caps a
 * whole command line at 32,767 chars; the runner's fixed part (node path, heap,
 * --experimental-vm-modules, jest.js, --json, --outputFile=<tmp>) is well under
 * 1,500, so 30,000 leaves headroom.
 */
export const MAX_BATCH_ARGV_CHARS = 30000;

/** Characters these args occupy on a command line (one separator each, quotes ignored). */
export function argvChars(args) {
  return args.reduce((sum, arg) => sum + arg.length + 1, 0);
}

/** `file` relative to `backendDir`, with forward slashes. */
export function toBackendRelative(backendDir, file) {
  return path.relative(backendDir, file).split(path.sep).join('/');
}

/** True when a backend-relative suite path belongs to the TREE set. */
export function isTreeSuite(rel) {
  return TREE_SUITE_DIRS.some(dir => rel.startsWith(`${dir}/`)) || TREE_SUITE_FILES.includes(rel);
}

/**
 * True when a backend-relative path is a sentinel's transient plant (any path
 * segment carries a DO_NOT_COMMIT/PLANTED marker or a reserved scratch/plant
 * token), so discovery must not schedule it.
 */
export function isPlantedTestPath(rel) {
  return rel.split('/').some(segment => isReservedScratchPlantPathSegment(segment));
}

/** Consecutive slices of `size` items (the last may be shorter). */
export function chunk(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

function chunkEvenly(items, count) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const start = Math.floor((i * items.length) / count);
    const end = Math.floor(((i + 1) * items.length) / count);
    out.push(items.slice(start, end));
  }
  return out;
}

function hashOrder(rel) {
  return createHash('sha1').update(rel).digest('hex');
}

/**
 * One `--runTestsByPath` batch for `files`, or several "part p/q" batches (split
 * evenly, deterministic) when the explicit list would push the Jest argv past
 * `maxArgvChars`. Every batch the runner hands Jest goes through here: the
 * planned lanes, the single-lane --batch-size chunks and the canonical-db pass.
 * Throws, naming the batch, if even one suite per batch cannot fit.
 *
 * @returns {{ label: string, jestArgs: string[], files: string[] }[]} (no index)
 */
export function argvBoundedBatches({
  label,
  files,
  backendDir,
  maxArgvChars = MAX_BATCH_ARGV_CHARS,
}) {
  const rel = file => toBackendRelative(backendDir, file);
  const make = (lbl, part) => ({
    label: lbl,
    jestArgs: ['--runTestsByPath', ...part.map(rel)],
    files: part,
  });
  for (let parts = 1; parts <= Math.max(1, files.length); parts++) {
    const planned = chunkEvenly(files, parts).map((part, p) =>
      make(parts === 1 ? label : `${label} part ${p + 1}/${parts}`, part),
    );
    if (planned.every(b => argvChars(b.jestArgs) <= maxArgvChars)) {
      return planned;
    }
  }
  const longest = files.map(rel).reduce((a, b) => (b.length > a.length ? b : a));
  throw new Error(
    `${label} cannot fit the ${maxArgvChars}-char argv budget even one suite per batch ` +
      `(longest path ${longest.length} chars: ${longest})`,
  );
}

/**
 * The post-lane canonical-db pass: the discovered canonical suites, argv-bounded,
 * indexed from `firstIndex` (after every lane batch). [] when there are none.
 */
export function canonicalPassBatches({
  discovered,
  backendDir,
  isCanonical,
  firstIndex,
  maxArgvChars,
}) {
  const files = discovered.filter(isCanonical);
  if (files.length === 0) {
    return [];
  }
  return argvBoundedBatches({
    label: `canonical-db pass (${files.length} suite(s))`,
    files,
    backendDir,
    maxArgvChars,
  }).map((b, i) => ({ ...b, index: firstIndex + i }));
}

/** Single-lane --batch-size mode: consecutive chunks of `batchSize`, each argv-bounded, indexed in order. */
export function batchModeBatches({ discovered, backendDir, batchSize, maxArgvChars }) {
  return chunk(discovered, batchSize)
    .flatMap((files, i) =>
      argvBoundedBatches({ label: `batch ${i + 1}`, files, backendDir, maxArgvChars }),
    )
    .map((b, index) => ({ ...b, index }));
}

/**
 * Plan the batches and lanes of a sharded run from ONE discovery.
 *
 * @param {object} input
 * @param {string[]} input.discovered  absolute suite paths from the single `jest --listTests`
 * @param {string} input.backendDir    absolute backend directory
 * @param {(file: string) => boolean} input.isCanonical  suites owned by the canonical-db pass
 * @param {number} input.shards        REST slices (the --jest-shards value)
 * @param {number} input.lanes         1 or 2
 * @param {number} [input.maxTreeBatchFiles]
 * @param {number} [input.maxArgvChars]  per-batch Jest argv budget; an oversize slice is
 *   split deterministically into "part p/q" batches in the same lane (e.g. --jest-shards=1
 *   would otherwise hand Jest ~42K chars, over the Windows 32,767 command-line limit)
 * @returns {{ treeFiles: string[], lanes: object[][] }}
 *   Two lanes: lanes[0] = tree batches then the REST slices that balance it,
 *   lanes[1] = the other REST slices. One lane: everything in lanes[0].
 *   Every batch is { index, label, jestArgs: ['--runTestsByPath', ...rel], files: abs[] }.
 *   Every non-canonical discovered suite is in exactly one batch.
 *
 * A positional pattern narrows discovery (runner side), so a targeted run can
 * leave a REST slice empty; empty slices are dropped rather than handed to Jest,
 * which would exit 1 with "No tests found". The canonical gate passes no pattern.
 */
export function planLanes({
  discovered,
  backendDir,
  isCanonical,
  shards,
  lanes,
  maxTreeBatchFiles = TREE_BATCH_MAX_FILES,
  maxArgvChars = MAX_BATCH_ARGV_CHARS,
}) {
  if (!Number.isInteger(shards) || shards < 1) {
    throw new Error(`planLanes: shards must be a positive integer (got ${shards})`);
  }
  if (lanes !== 1 && lanes !== 2) {
    throw new Error(`planLanes: lanes must be 1 or 2 (got ${lanes})`);
  }
  const laneSuites = discovered.filter(file => !isCanonical(file));
  const rel = new Map(laneSuites.map(file => [file, toBackendRelative(backendDir, file)]));
  const treeFiles = laneSuites.filter(file => isTreeSuite(rel.get(file))).sort();
  const restFiles = laneSuites
    .filter(file => !isTreeSuite(rel.get(file)))
    .sort((a, b) => hashOrder(rel.get(a)).localeCompare(hashOrder(rel.get(b))));

  const batches = (label, files) => argvBoundedBatches({ label, files, backendDir, maxArgvChars });
  const treeBatchCount = Math.ceil(treeFiles.length / maxTreeBatchFiles);
  const treeBatches = chunkEvenly(treeFiles, treeBatchCount).flatMap((files, i) =>
    batches(`lane 1 tree ${i + 1}/${treeBatchCount}`, files),
  );
  const restSlices = chunkEvenly(restFiles, shards);

  // Lane 1 takes as many REST slices as bring its suite count closest to half.
  const perShard = restFiles.length / shards;
  const wanted =
    lanes === 1
      ? shards
      : perShard > 0
        ? Math.round((laneSuites.length / 2 - treeFiles.length) / perShard)
        : 0;
  const lane1Slices = Math.min(shards, Math.max(0, wanted));
  const restBatches = restSlices.flatMap((files, i) =>
    files.length === 0
      ? []
      : batches(`lane ${i < lane1Slices ? 1 : 2} shard ${i + 1}/${shards}`, files).map(b => ({
          ...b,
          lane: i < lane1Slices ? 0 : 1,
        })),
  );

  const planned = [
    [...treeBatches, ...restBatches.filter(b => b.lane === 0)],
    restBatches.filter(b => b.lane === 1),
  ].slice(0, lanes);
  let index = 0;
  for (const laneBatches of planned) {
    for (const b of laneBatches) {
      delete b.lane;
      b.index = index++;
    }
  }
  return { treeFiles, lanes: planned };
}
