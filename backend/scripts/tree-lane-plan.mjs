/**
 * Tree-lane plan for run-suite-sharded.mjs (Equoria-rfv9j).
 *
 * Some suites WRITE throwaway violating files into the real working tree and
 * delete them again ("planters": doctrine sentinels proving their check fires),
 * and some suites WALK the whole tree and assert it is clean ("scanners"). With
 * --lanes=2 both lanes run in ONE checkout at the same time, so a scanner in one
 * lane read the other lane's plant: an ENOENT crash when the plant vanished
 * mid-read (WS4 S6 push), or a false violation when the plant was still there
 * (controllerMaxLines' 803-line file failing fileSizeThreshold's clean-tree
 * check; reproduced by holding the plant and running the check). Per-scanner
 * name exclusions only ever covered the pairs that had already failed.
 *
 * The fix is structural: every tree-touching suite runs in lane 1, in ONE
 * serial stream, so no planter is ever concurrent with a scanner. Lane 2 runs
 * only suites that touch nothing but their own database and temp dirs.
 *
 *   TREE set  = backend/__tests__/** (every doctrine planter and whole-tree
 *               scanner lives there; CI shard 3 is the same set) plus the docs
 *               suites (two of them share one fixture directory under
 *               modules/docs/__tests__) plus two module sentinels that walk the
 *               real backend tree.
 *   REST set  = everything else, Jest hash-sharded exactly as before.
 *
 * treeLanePinning.sentinel.test.mjs keeps this honest: it fails when a planter
 * or whole-tree scanner exists OUTSIDE the TREE set, and when CI stops running
 * the TREE set serially.
 *
 * Pure module: no I/O, no side effects; run-suite-sharded.mjs executes the plan.
 */
import path from 'node:path';

/** Backend-relative directories whose suites are tree-touching (whole subtree). */
export const TREE_SUITE_DIRS = Object.freeze(['__tests__', 'modules/docs/__tests__']);

/** Backend-relative single suites outside those directories that walk the real tree. */
export const TREE_SUITE_FILES = Object.freeze([
  'modules/grooms/__tests__/groomSalaryPassScoped.sentinel.test.mjs',
  'modules/traits/__tests__/flagEngineSingleSource.sentinel.test.mjs',
]);

/**
 * Most suites per tree batch (one fresh --runInBand process each). Kept near
 * the ~120-suite hash shards the 768MB lane heap was measured on, and short
 * enough that the explicit --runTestsByPath argv stays far below the Windows
 * 32767-character command-line limit (~100 chars per absolute path).
 */
export const TREE_BATCH_MAX_FILES = 110;

const SEP = '[\\\\/]';

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, match => `\\${match}`);
}

/** A backend-relative suite path as a regex matching its absolute path on either separator. */
export function suiteTailPattern(rel) {
  return `${rel.split('/').map(escapeRegex).join(SEP)}$`;
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
 * Jest testPathIgnorePatterns that drop exactly the TREE set from the hash
 * shards. Anchored on the backend directory's own name so `backend/__tests__/`
 * never matches `backend/modules/<x>/__tests__/`. Agreement with isTreeSuite()
 * is enforced at runtime by the runner's discovery reconciliation (a mismatch
 * shows up as a MISSING or duplicated suite and fails the run).
 */
export function treeIgnorePatterns(backendDirName) {
  const root = `${SEP}${escapeRegex(backendDirName)}${SEP}`;
  return [
    ...TREE_SUITE_DIRS.map(dir => `${root}${dir.split('/').map(escapeRegex).join(SEP)}${SEP}`),
    ...TREE_SUITE_FILES.map(rel => `${root}${suiteTailPattern(rel)}`),
  ];
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

/**
 * Plan the two lanes of a sharded run.
 *
 * @param {object} input
 * @param {string[]} input.discovered  absolute suite paths from `jest --listTests`
 * @param {string} input.backendDir    absolute backend directory
 * @param {(file: string) => boolean} input.isCanonical  suites owned by the canonical-db pass
 * @param {number} input.restShards    Jest hash shards for the REST set (the --jest-shards value)
 * @param {string[]} input.restArgs    extra Jest args for every REST shard (config/canonical
 *                                     ignore patterns, positional pattern)
 * @param {number} [input.maxTreeBatchFiles]
 * @returns {{ treeFiles: string[], lanes: [object[], object[]] }}
 *   lanes[0] = tree batches then the REST shards that balance it; lanes[1] = the
 *   other REST shards. Every batch has { index, label, jestArgs[, files] }.
 */
export function planTreeLanes({
  discovered,
  backendDir,
  isCanonical,
  restShards,
  restArgs,
  maxTreeBatchFiles = TREE_BATCH_MAX_FILES,
}) {
  if (!Number.isInteger(restShards) || restShards < 1) {
    throw new Error(`planTreeLanes: restShards must be a positive integer (got ${restShards})`);
  }
  const laneSuites = discovered.filter(file => !isCanonical(file));
  const treeFiles = laneSuites
    .filter(file => isTreeSuite(toBackendRelative(backendDir, file)))
    .sort();
  const restCount = laneSuites.length - treeFiles.length;

  const treeBatchCount = Math.ceil(treeFiles.length / maxTreeBatchFiles);
  const treeBatches = chunkEvenly(treeFiles, treeBatchCount).map((files, i) => ({
    label: `lane 1 tree ${i + 1}/${treeBatchCount}`,
    jestArgs: ['--runTestsByPath', ...files],
    files,
  }));

  // Lane 1 takes as many REST shards as bring its suite count closest to half.
  const perShard = restCount / restShards;
  const wanted =
    perShard > 0 ? Math.round((laneSuites.length / 2 - treeFiles.length) / perShard) : 0;
  const lane1RestShards = Math.min(restShards, Math.max(0, wanted));

  const ignoreArgs = treeIgnorePatterns(path.basename(backendDir)).map(
    patternText => `--testPathIgnorePatterns=${patternText}`,
  );
  const restBatches = Array.from({ length: restShards }, (_, i) => ({
    label: `lane ${i < lane1RestShards ? 1 : 2} shard ${i + 1}/${restShards}`,
    jestArgs: [`--shard=${i + 1}/${restShards}`, ...ignoreArgs, ...restArgs],
  }));

  const lanes = [
    [...treeBatches, ...restBatches.slice(0, lane1RestShards)],
    restBatches.slice(lane1RestShards),
  ];
  let index = 0;
  for (const lane of lanes) {
    for (const batch of lane) {
      batch.index = index++;
    }
  }
  return { treeFiles, lanes };
}
