#!/usr/bin/env node
/**
 * Equoria-h1oi6 doctrine check: the REJECTED UI dependency ratchet.
 *
 * CLAUDE.md ("Dependency and component policy") rejects five packages in one
 * paragraph: `@radix-ui`, `sonner`, `recharts`, `chart.js` and
 * `react-chartjs-2`. Only `@radix-ui` was ever enforced
 * (check-no-radix-imports.mjs). The other four were constitution-only, so they
 * kept appearing — the measurement on Equoria-h1oi6 found chart consumers that
 * had never been excepted or tracked by anything.
 *
 * This gate closes that hole for the remaining four. `@radix-ui` stays with its
 * own sibling check: Radix is at a HARD ZERO (fully retired), and a hard-zero
 * gate must not be softened into a baseline one.
 *
 * ── WHY A RATCHET AND NOT A HARD ZERO ─────────────────────────────────────
 * Radix could be a hard zero because its rip-out had already landed. These four
 * have NOT been ripped out: at the time this check was written the live count
 * was 32 imports across 30 files — 23 sonner, 5 recharts, 2 chart.js, 2
 * react-chartjs-2. CLAUDE.md says existing usage is migration state, not
 * approval — the ban is on ADDING. A check that failed on every occurrence
 * would be red the moment it landed, would block every push, and would be
 * deleted or bypassed within a day. So this is a baseline ratchet in the exact
 * shape of the sibling rethrow-after-log gate: the recorded per-file, per-
 * package counts may only SHRINK.
 *
 *   - observed > baseline for a file/package  → FAIL (a new import was added)
 *   - a file not in the baseline importing any of them → FAIL (baseline 0)
 *   - observed < baseline                     → FAIL, with the instruction to
 *     delete/decrement that line in the SAME commit. Leftover headroom is
 *     grandfathered space a future regression hides under; the ratchet only
 *     ratchets if it is tightened as the migration proceeds.
 *   - a baseline path that no longer exists   → FAIL (stale entry, same reason)
 *
 * Migration issues that shrink this: sonner → Equoria-7i4cw (Surface-Owned +
 * Stable Log: InlineError for local failure, the surface's own changed state
 * for success, CinematicMoment for ceremony). Charts → purpose-built semantic
 * HTML, accessible tables, CSS Grid, timelines, ledgers, gauges, pedigrees or
 * authored inline SVG. Do NOT pick a replacement yourself: an agent may decide
 * THAT a rejected component goes, never WHAT arrives in its place — that goes
 * through /impeccable to the owner.
 *
 * ── EXCEPTIONS.md DOES NOT APPLY ──────────────────────────────────────────
 * docs/design-system/EXCEPTIONS.md governs the design-audit rule ids
 * (palette-classes, text-opacity, …) consumed by
 * scripts/design-audit/check-design-system.mjs, and it says in its own
 * Authority section that an exception "cannot approve a rejected dependency."
 * Three of the chart consumers hold `palette-classes` rows there; those rows
 * suppress raw-color-class findings, not the rejected import. This check
 * therefore reads no exception registry on purpose — the baseline JSON beside
 * it is the only ledger, and it may only shrink. (That split is exactly how
 * the count grew unnoticed: the palette rule caught colors, nothing caught the
 * import that brings the generic composition with it.)
 *
 * Scope: `frontend/src/**` for *.ts/*.tsx/*.js/*.jsx/*.mjs, tests included —
 * excluding tests would leave an obvious loophole. Matches the package as the
 * START of a quoted module specifier in an `import` / `export … from` /
 * dynamic `import()` / `require()`, so a doc-comment mention of "sonner" is not
 * a violation. One violation is counted per package per line, matching the
 * sibling no-radix-imports detector.
 *
 * Optional argv[2]: alternate baseline JSON path (sentinel-test hook);
 * production callers pass no argument.
 * Run: `node scripts/doctrine-checks/check-no-new-rejected-ui-deps.mjs`
 * Auto-runs via scripts/doctrine-checks/run-all.sh (file-name glob).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  isPlantArtifactBasename,
  readScannedFileSyncTolerant,
  readdirSyncTolerant,
} from '../lib/doctrine-scan-patterns.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..', '..');
const SCAN_ROOT = path.join(REPO_ROOT, 'frontend', 'src');
const BASELINE_PATH = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(SCRIPT_DIR, 'rejected-ui-deps-baseline.json');

const LABEL = 'no-new-rejected-ui-deps';
const SCAN_FILE_RE = /\.(mjs|js|jsx|ts|tsx)$/;
const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', '__mocks__']);
const BACKSLASH = String.fromCharCode(92);

/**
 * The rejected packages this gate ratchets. `@radix-ui` is deliberately ABSENT:
 * it is at a hard zero and owns check-no-radix-imports.mjs. Adding it here
 * would give it baseline headroom it must never have.
 *
 * The regex is built per package so the failure output names WHICH rejected
 * dependency was added, not just "a banned import" (a gate that catches sonner
 * and silently misses chart.js is the exact defect Equoria-h1oi6 reports).
 */
export const REJECTED_PACKAGES = ['sonner', 'recharts', 'chart.js', 'react-chartjs-2'];

function escapeForRegex(literal) {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, `${BACKSLASH}$&`);
}

// `(?:/[^'"]*)?` allows a subpath import (chart.js/auto, recharts/es6, …).
// Anchoring on from/import/require + quote means a prose mention never matches.
const PACKAGE_PATTERNS = REJECTED_PACKAGES.map((pkg) => ({
  pkg,
  re: new RegExp(`(?:from|import|require)\\s*\\(?\\s*['"]${escapeForRegex(pkg)}(?:/[^'"]*)?['"]`),
}));

/**
 * Pure detector: return { pkg: count } for every rejected-package import in
 * `src`, counting at most one per package per line. Exported for the sentinel.
 */
export function findRejectedImports(src) {
  const counts = {};
  for (const line of src.split('\n')) {
    for (const { pkg, re } of PACKAGE_PATTERNS) {
      if (re.test(line)) counts[pkg] = (counts[pkg] ?? 0) + 1;
    }
  }
  return counts;
}

function walk(dir, acc) {
  // Tolerate ONLY ENOENT (an optional root that vanished mid-scan), loudly;
  // any other fault is rethrown so a partially-read tree can never report a
  // green "0 violations".
  const ents = readdirSyncTolerant(dir, { withFileTypes: true }, LABEL);
  for (const e of ents) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      walk(full, acc);
    } else if (e.isFile() && SCAN_FILE_RE.test(e.name) && !isPlantArtifactBasename(e.name)) {
      // Uppercase-marker plant artifacts belong to concurrent jest sentinels.
      // Lowercase `planted.*` IS scanned — this gate's own sentinel-positive
      // arm depends on it firing there.
      acc.push(full);
    }
  }
}

function toRelKey(absPath) {
  return path.relative(REPO_ROOT, absPath).split(BACKSLASH).join('/');
}

function loadBaseline() {
  if (!fs.existsSync(BASELINE_PATH)) {
    console.error(`[${LABEL}] baseline not found at ${BASELINE_PATH}`);
    process.exit(2);
  }
  return JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
}

function fail(lines) {
  for (const l of lines) console.error(l);
  console.error('');
  console.error('CLAUDE.md rejects sonner, Recharts, Chart.js and react-chartjs-2.');
  console.error('Existing usage is migration state, not approval: the recorded baseline in');
  console.error(`  ${path.relative(REPO_ROOT, BASELINE_PATH).split(BACKSLASH).join('/')}`);
  console.error('may only SHRINK, never grow.');
  console.error("  - Adding one? Do not. sonner feedback → InlineError / the surface's");
  console.error('    own changed state / CinematicMoment (Equoria-7i4cw).');
  console.error('    Charts → semantic HTML, accessible tables, CSS Grid, timelines,');
  console.error('    ledgers, gauges, pedigrees or authored inline SVG.');
  console.error('  - Removed one? Decrement or delete that line in the SAME commit.');
  console.error('  - An EXCEPTIONS.md row cannot approve a rejected dependency.');
  console.error('  - See Equoria-h1oi6.');
  process.exit(1);
}

function main() {
  const baseline = loadBaseline();

  const files = [];
  walk(SCAN_ROOT, files);

  const observedByFile = new Map();
  let observedTotal = 0;
  for (const f of files) {
    const src = readScannedFileSyncTolerant(f, LABEL);
    if (src === null) continue; // vanished mid-scan (ENOENT) — skipped, noticed
    const counts = findRejectedImports(src);
    if (Object.keys(counts).length > 0) {
      observedByFile.set(toRelKey(f), counts);
      observedTotal += Object.values(counts).reduce((s, n) => s + n, 0);
    }
  }

  const grew = [];
  const shrank = [];
  const stale = [];

  for (const [key, counts] of observedByFile) {
    const base = baseline[key] ?? {};
    for (const [pkg, observed] of Object.entries(counts)) {
      const allowed = base[pkg] ?? 0;
      if (observed > allowed) grew.push({ key, pkg, allowed, observed });
    }
  }

  for (const [key, base] of Object.entries(baseline)) {
    if (!fs.existsSync(path.join(REPO_ROOT, ...key.split('/')))) {
      stale.push(key);
      continue;
    }
    const counts = observedByFile.get(key) ?? {};
    for (const [pkg, allowed] of Object.entries(base)) {
      const observed = counts[pkg] ?? 0;
      if (observed < allowed) shrank.push({ key, pkg, allowed, observed });
    }
  }

  if (grew.length > 0) {
    fail([
      `[${LABEL}] FAIL — rejected-dependency imports grew above baseline:`,
      ...grew.map(
        (v) =>
          `  ${v.key}  imports '${v.pkg}'  baseline=${v.allowed}, observed=${v.observed} (+${v.observed - v.allowed})`
      ),
    ]);
  }

  if (stale.length > 0) {
    fail([
      `[${LABEL}] FAIL — stale baseline entries (file no longer exists on disk):`,
      ...stale.map((k) => `  ${k}`),
    ]);
  }

  if (shrank.length > 0) {
    fail([
      `[${LABEL}] FAIL — baseline headroom left behind (the import is gone; the entry is not):`,
      ...shrank.map((v) => `  ${v.key}  '${v.pkg}'  baseline=${v.allowed}, observed=${v.observed}`),
    ]);
  }

  const baselineTotal = Object.values(baseline).reduce(
    (s, counts) => s + Object.values(counts).reduce((a, n) => a + n, 0),
    0
  );
  console.log(
    `[${LABEL}] OK — scanned ${files.length} frontend/src files; ` +
      `${observedTotal} rejected-dependency imports across ${observedByFile.size} files, ` +
      `exactly matching the baseline (total=${baselineTotal}; ` +
      `${REJECTED_PACKAGES.join(', ')})`
  );
}

// Main-module guard: only run when invoked directly, not on import (the
// sentinel imports findRejectedImports without running the scan).
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
