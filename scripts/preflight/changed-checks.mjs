#!/usr/bin/env node
/**
 * Pre-push changed-file checks (Equoria-zstml, owner ruling q233 2026-10-28:
 * "Full check runs only on GitHub after pushes; laptop runs only the changed
 * tests").
 *
 * The full gate (sharded backend suite, frontend suite, typecheck, lint,
 * doctrine) runs on GitHub Actions for every push to master and every PR. The
 * laptop's pre-push hook runs this script instead, which checks only what the
 * push changes:
 *
 *   1. eslint + prettier --check on the changed backend and frontend files,
 *      with the same rules CI's Lint & Format job applies to the whole tree;
 *   2. the backend Jest test files related to the change, serially
 *      (the `test:backend:targeted` profile plus --forceExit);
 *   3. the frontend Vitest test files related to the change (the package
 *      `test:run` profile, two workers).
 *
 * "Related" means, in priority order:
 *   tier 1  test files the push adds or changes;
 *   tier 2  tests named after a changed source file (`foo.mjs` ->
 *           `foo.test.mjs`, `foo.integration.test.mjs`, `Foo.test.tsx`) in the
 *           same directory or its `__tests__/`, and, for a name that is not
 *           generic (`index`, `utils`, ...), anywhere in that package;
 *   tier 3  tests whose text names the changed file's repository path
 *           (sentinels that read `.husky/pre-push`, a workflow, or a script).
 * Each package is capped (backendCap / frontendCap). Over the cap the lowest
 * tiers are dropped first and the hook prints how many it left to GitHub.
 *
 * What the change set is: for each ref git is pushing, the files that differ
 * between the remote tip (or, for a new branch, its merge-base with
 * origin/master) and the pushed commit, plus every modified or untracked file
 * in the working tree (an untracked test still runs; candidate-state.mjs
 * refuses a push whose code roots are dirty before this script runs).
 *
 * FAIL-CLOSED: a git error, an unreadable package profile, a missing CLI, an
 * unreachable test database, or a busy machine is a failure, never a pass. A
 * push that deletes refs only, or that changes nothing testable, passes.
 *
 * NOT covered here, stated rather than hidden (GitHub's full gate covers them):
 *   - tests that reach a changed module only through imports (a changed
 *     service whose tests have a different name);
 *   - config, schema, setup-file, dependency or workflow changes whose effect
 *     is on every test; typecheck; Playwright; Storybook browser tests;
 *     root `tests/` and `packages/` Jest suites.
 *
 * Usage (from .husky/pre-push, which feeds the hook's stdin through unchanged):
 *   printf '%s\n' "$PUSH_REFS" | node scripts/preflight/changed-checks.mjs
 * Manual run (no stdin): compares HEAD and the working tree with origin/master.
 *   node scripts/preflight/changed-checks.mjs [--dry-run]
 *
 * Exit: 0 ok · 1 a check failed or could not run.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parsePushRefs } from './candidate-state.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const zeroSha = /^0+$/;

export const baseRef = 'refs/remotes/origin/master';
export const backendCap = 30;
export const frontendCap = 40;
// Busy machine: wait this long for other test runs to finish, then refuse.
const busyWaitMs = 10 * 60 * 1000;
const busyPollMs = 15 * 1000;

// File names too common to match across a whole package by name alone.
export const genericNames = new Set([
  'index',
  'utils',
  'util',
  'helpers',
  'helper',
  'types',
  'constants',
  'config',
  'setup',
  'common',
  'shared',
  'main',
]);

const backendTestRe = /^backend\/.+\.test\.(?:mjs|js)$/;
const frontendTestRe = /^frontend\/src\/.+\.(?:test|spec)\.(?:js|mjs|cjs|ts|mts|cts|jsx|tsx)$/;
const backendSourceRe = /^backend\/.+\.(?:mjs|js|cjs)$/;
const frontendSourceRe = /^frontend\/src\/.+\.(?:ts|tsx|js|jsx|mjs)$/;
const backendLintRe = /^backend\/.+\.(?:mjs|js|cjs)$/;
const frontendLintRe = /^frontend\/.+\.(?:ts|tsx|js|jsx|mjs|cjs)$/;
const prettierRe = /\.(?:mjs|cjs|js|jsx|ts|tsx|mts|cts|json|css|scss|md|ya?ml|html)$/;
const neverRe = /(?:^|\/)(?:node_modules|coverage|dist|build)\//;

const norm = (p) => String(p).replace(/\\/g, '/');

function defaultGit(args, cwd, env) {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    env,
    maxBuffer: 64 * 1024 * 1024,
  });
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? (result.error ? String(result.error.message) : ''),
  };
}

/** Child processes (tests, linters) must not inherit the hook's GIT_* variables. */
export function withoutGitEnv(env = process.env) {
  return Object.fromEntries(
    Object.entries(env).filter(([name]) => !name.toUpperCase().startsWith('GIT_'))
  );
}

function splitZ(raw) {
  return raw.split('\0').filter(Boolean).map(norm);
}

/**
 * @returns {{ files: string[], problems: string[], notes: string[], deletionsOnly: boolean }}
 */
export function collectChangedFiles({
  cwd,
  refsText,
  env = process.env,
  git = (args, dir) => defaultGit(args, dir, env),
}) {
  const problems = [];
  const notes = [];
  const files = new Set();
  const all = parsePushRefs(refsText);
  const refs = all.filter((r) => !zeroSha.test(r.localSha));

  if (all.length > 0 && refs.length === 0) {
    return {
      files: [],
      problems,
      notes: ['only ref deletions are being pushed'],
      deletionsOnly: true,
    };
  }

  const diff = (base, tip) => {
    const out = git(['diff', '--name-only', '--no-renames', '-z', `${base}...${tip}`], cwd);
    if (out.status !== 0) {
      problems.push(
        `cannot list changes ${base.slice(0, 9)}...${tip.slice(0, 9)} (git diff failed: ${out.stderr.trim()})`
      );
      return;
    }
    for (const f of splitZ(out.stdout)) {
      files.add(f);
    }
  };
  const mergeBase = (tip) => {
    const out = git(['merge-base', tip, baseRef], cwd);
    if (out.status !== 0 || !out.stdout.trim()) {
      problems.push(
        `cannot find where ${String(tip).slice(0, 9)} leaves ${baseRef} (git merge-base failed: ${out.stderr.trim() || 'no common ancestor'}). Run git fetch origin.`
      );
      return null;
    }
    return out.stdout.trim();
  };

  if (refs.length === 0) {
    notes.push(
      `no refs on stdin (manual run): comparing HEAD and the working tree with ${baseRef}`
    );
    const base = mergeBase('HEAD');
    if (base) {
      diff(base, 'HEAD');
    }
  }
  for (const ref of refs) {
    if (zeroSha.test(ref.remoteSha)) {
      const base = mergeBase(ref.localSha);
      if (base) {
        diff(base, ref.localSha);
      }
      continue;
    }
    const known = git(['cat-file', '-e', `${ref.remoteSha}^{commit}`], cwd);
    if (known.status !== 0) {
      problems.push(
        `${ref.remoteRef} is at ${ref.remoteSha.slice(0, 9)}, a commit this clone does not have. Run git fetch origin.`
      );
      continue;
    }
    diff(ref.remoteSha, ref.localSha);
  }

  const status = git(
    ['status', '--porcelain=v1', '-z', '--untracked-files=all', '--no-renames'],
    cwd
  );
  if (status.status !== 0) {
    problems.push(`cannot read working-tree status (git status failed: ${status.stderr.trim()})`);
  } else {
    for (const field of status.stdout.split('\0')) {
      if (field.length > 3) {
        files.add(norm(field.slice(3)));
      }
    }
  }

  return { files: [...files].sort(), problems, notes, deletionsOnly: false };
}

/** Lists tracked plus untracked (not ignored) files: the test inventory. */
export function listRepoFiles({
  cwd,
  env = process.env,
  git = (args, dir) => defaultGit(args, dir, env),
}) {
  const tracked = git(['ls-files', '-z'], cwd);
  const untracked = git(['ls-files', '--others', '--exclude-standard', '-z'], cwd);
  if (tracked.status !== 0 || untracked.status !== 0) {
    return {
      files: null,
      problem: `cannot list repository files (git ls-files failed: ${(tracked.stderr || untracked.stderr).trim()})`,
    };
  }
  return {
    files: [...new Set([...splitZ(tracked.stdout), ...splitZ(untracked.stdout)])].sort(),
    problem: null,
  };
}

export function isBackendTest(rel, ignorePatterns = []) {
  const p = norm(rel);
  return (
    backendTestRe.test(p) && !neverRe.test(p) && !ignorePatterns.some((re) => re.test(`/${p}`))
  );
}

export function isFrontendTest(rel) {
  const p = norm(rel);
  return frontendTestRe.test(p) && !neverRe.test(p);
}

/** `foo.integration.test.mjs` -> `foo.integration`; `Foo.spec.tsx` -> `Foo`. */
export function testStem(rel) {
  return path.posix.basename(norm(rel)).replace(/\.(?:test|spec)\.[^.]+$/, '');
}

function sourceStem(rel) {
  return path.posix.basename(norm(rel)).replace(/\.[^.]+$/, '');
}

function nameMatches(stem, base) {
  return stem === base || stem.startsWith(`${base}.`);
}

/**
 * Chooses the related test files for each package.
 *
 * @param {object} input
 * @param {string[]} input.changed      repository-relative changed paths
 * @param {string[]} input.repoFiles    tracked + untracked repository files
 * @param {(rel: string) => boolean} input.exists
 * @param {(rel: string) => string} input.readText  test file contents ('' if unreadable)
 * @param {RegExp[]} [input.backendIgnore]  backend jest testPathIgnorePatterns
 */
export function selectTests({
  changed,
  repoFiles,
  exists,
  readText,
  backendIgnore = [],
  caps = { backend: backendCap, frontend: frontendCap },
}) {
  const packages = {
    backend: {
      isTest: (p) => isBackendTest(p, backendIgnore),
      isSource: (p) => backendSourceRe.test(p),
    },
    frontend: {
      isTest: isFrontendTest,
      isSource: (p) => frontendSourceRe.test(p) && !p.endsWith('.d.ts'),
    },
  };
  const result = {};

  for (const [name, pkg] of Object.entries(packages)) {
    const inventory = repoFiles.map(norm).filter((p) => pkg.isTest(p) && exists(p));
    const tiers = [new Set(), new Set(), new Set()];

    for (const raw of changed) {
      const p = norm(raw);
      if (pkg.isTest(p)) {
        if (exists(p)) {
          tiers[0].add(p);
        }
        continue;
      }
      if (!pkg.isSource(p) || neverRe.test(p)) {
        continue;
      }
      const base = sourceStem(p);
      const dir = path.posix.dirname(p);
      const neighbourDirs = new Set([dir, `${dir}/__tests__`]);
      const packageWide = !genericNames.has(base) && base.length >= 3;
      for (const t of inventory) {
        if (!nameMatches(testStem(t), base)) {
          continue;
        }
        if (packageWide || neighbourDirs.has(path.posix.dirname(t))) {
          tiers[1].add(t);
        }
      }
    }

    // Tier 3: a test that names a changed path verbatim (any changed file, any package).
    const wanted = changed.map(norm).filter((p) => !neverRe.test(p) && p.includes('/'));
    if (wanted.length > 0) {
      for (const t of inventory) {
        if (tiers[0].has(t) || tiers[1].has(t)) {
          continue;
        }
        const text = readText(t);
        if (text && wanted.some((p) => p !== t && text.includes(p))) {
          tiers[2].add(t);
        }
      }
    }

    const ordered = [];
    const seen = new Set();
    for (const tier of tiers) {
      for (const t of [...tier].sort()) {
        if (!seen.has(t)) {
          seen.add(t);
          ordered.push(t);
        }
      }
    }
    const cap = caps[name];
    result[name] = {
      selected: ordered.slice(0, cap),
      dropped: ordered.slice(cap),
      changedTests: tiers[0].size,
    };
  }
  return result;
}

/** Changed files each linter should check (existing files only). */
export function lintTargets(changed, exists) {
  const present = changed.map(norm).filter((p) => !neverRe.test(p) && exists(p));
  return {
    backendEslint: present.filter((p) => backendLintRe.test(p)),
    backendPrettier: present.filter((p) => p.startsWith('backend/') && prettierRe.test(p)),
    frontendEslint: present.filter((p) => frontendLintRe.test(p)),
    frontendPrettier: present.filter((p) => p.startsWith('frontend/') && prettierRe.test(p)),
  };
}

/**
 * Turns a package script such as
 *   "node --experimental-vm-modules ... node_modules/jest/bin/jest.js --runInBand"
 * into [execPath, ...args]. Refuses any other shape (fail closed).
 */
export function profileArgv(script, { leading = 'node', replaceWith = [process.execPath] } = {}) {
  if (typeof script !== 'string') {
    return null;
  }
  const tokens = script.trim().split(/\s+/);
  if (tokens[0] !== leading || tokens.some((t) => /[|&;<>()$`'"]/.test(t))) {
    return null;
  }
  return [...replaceWith, ...tokens.slice(1)];
}

/** One integer = number of foreign test runners. Anything else = unknown = busy. */
export function parseRunnerCount(text) {
  const t = String(text ?? '').trim();
  return /^\d+$/.test(t) ? Number(t) : null;
}

function countForeignRunners() {
  const pattern = 'jest|vitest|run-suite-sharded|playwright test';
  if (process.platform === 'win32') {
    const ps =
      `@(Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { ` +
      `$_.CommandLine -match '${pattern}' -and $_.CommandLine -notmatch '@playwright/mcp' ` +
      `-and $_.CommandLine -notmatch 'run-locked' }).Count`;
    const out = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], {
      encoding: 'utf8',
    });
    return out.status === 0 ? parseRunnerCount(out.stdout) : null;
  }
  const out = spawnSync('ps', ['-A', '-o', 'args='], { encoding: 'utf8' });
  if (out.status !== 0) {
    return null;
  }
  const re = new RegExp(pattern);
  return out.stdout
    .split('\n')
    .filter(
      (line) =>
        /\bnode\b/.test(line) &&
        re.test(line) &&
        !line.includes('@playwright/mcp') &&
        !line.includes('run-locked')
    ).length;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForIdleMachine(log) {
  const deadline = Date.now() + busyWaitMs;
  for (;;) {
    const n = countForeignRunners();
    if (n === 0) {
      return true;
    }
    const why =
      n === null ? 'could not count running test processes' : `${n} other test process(es) running`;
    if (Date.now() >= deadline) {
      log(
        `REFUSED: ${why}; waited ${busyWaitMs / 60000} min. Run the push again when the machine is idle.`
      );
      return false;
    }
    log(
      `waiting: ${why} (re-checking every ${busyPollMs / 1000}s, up to ${busyWaitMs / 60000} min)`
    );
    await sleep(busyPollMs);
  }
}

function resolveCli(rel, bases) {
  for (const base of bases) {
    const candidate = path.join(repoRoot, base, 'node_modules', ...rel.split('/'));
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

function runStep(label, argv, cwd, log) {
  log(`${label} ...`);
  const result = spawnSync(argv[0], argv.slice(1), { cwd, stdio: 'inherit', env: withoutGitEnv() });
  if (result.error) {
    log(`FAILED: ${label} could not start (${result.error.message})`);
    return false;
  }
  if (result.status !== 0) {
    log(`FAILED: ${label} (exit ${result.status ?? result.signal})`);
    return false;
  }
  return true;
}

const relTo = (pkg, files) => files.map((f) => f.slice(pkg.length + 1));

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const log = (msg) => console.error(`[pre-push] changed-checks: ${msg}`);
  const refsText = process.stdin.isTTY ? '' : await readStdin();

  const changes = collectChangedFiles({ cwd: repoRoot, refsText });
  for (const note of changes.notes) {
    log(`note: ${note}`);
  }
  if (changes.problems.length > 0) {
    for (const problem of changes.problems) {
      log(`REFUSED: ${problem}`);
    }
    return 1;
  }
  if (changes.deletionsOnly) {
    log('nothing to check');
    return 0;
  }

  const inventory = listRepoFiles({ cwd: repoRoot });
  if (inventory.problem) {
    log(`REFUSED: ${inventory.problem}`);
    return 1;
  }
  const { default: backendJest } = await import(
    pathToFileURL(path.join(repoRoot, 'backend/jest.config.mjs')).href
  );
  const backendIgnore = (backendJest.testPathIgnorePatterns ?? []).map((p) => new RegExp(p));
  const exists = (rel) => existsSync(path.join(repoRoot, rel));
  const readText = (rel) => {
    try {
      return readFileSync(path.join(repoRoot, rel), 'utf8');
    } catch {
      return ''; // a test that cannot be read is not selected by tier 3; tiers 1-2 never read files
    }
  };
  const chosen = selectTests({
    changed: changes.files,
    repoFiles: inventory.files,
    exists,
    readText,
    backendIgnore,
  });
  const lint = lintTargets(changes.files, exists);

  log(`${changes.files.length} changed path(s)`);
  for (const [name, pick] of Object.entries(chosen)) {
    log(
      `${name}: ${pick.selected.length} related test file(s)${pick.dropped.length ? `, ${pick.dropped.length} over the cap left to GitHub (first: ${pick.dropped[0]})` : ''}`
    );
    for (const t of pick.selected) {
      log(`  ${t}`);
    }
  }
  if (dryRun) {
    log(
      `dry run: lint ${lint.backendEslint.length + lint.frontendEslint.length} file(s), prettier ${lint.backendPrettier.length + lint.frontendPrettier.length} file(s); nothing executed`
    );
    return 0;
  }

  const anyWork =
    chosen.backend.selected.length +
      chosen.frontend.selected.length +
      Object.values(lint).reduce((n, l) => n + l.length, 0) >
    0;
  if (!anyWork) {
    log('no changed backend/frontend code or tests: nothing to run (GitHub runs the full gate)');
    return 0;
  }
  if (!(await waitForIdleMachine(log))) {
    return 1;
  }

  let ok = true;

  // 1. Lint and format, changed files only, with the rules CI's Lint & Format job uses.
  const eslint = resolveCli('eslint/bin/eslint.js', ['backend', '.']);
  const prettier = resolveCli('prettier/bin/prettier.cjs', ['backend', '.']);
  const feEslint = resolveCli('eslint/bin/eslint.js', ['frontend', '.', 'backend']);
  const fePrettier = resolveCli('prettier/bin/prettier.cjs', ['frontend', '.', 'backend']);
  const steps = [
    [
      lint.backendEslint,
      eslint,
      'backend',
      (f) => ['--quiet', '--no-warn-ignored', ...f],
      'backend eslint (errors)',
    ],
    [
      lint.backendPrettier,
      prettier,
      'backend',
      (f) => ['--check', '--ignore-unknown', ...f],
      'backend prettier --check',
    ],
    [
      lint.frontendEslint,
      feEslint,
      'frontend',
      (f) => [
        '--report-unused-disable-directives',
        '--max-warnings',
        '0',
        '--no-warn-ignored',
        ...f,
      ],
      'frontend eslint (--max-warnings 0)',
    ],
    [
      lint.frontendPrettier,
      fePrettier,
      'frontend',
      (f) => ['--check', '--ignore-unknown', ...f],
      'frontend prettier --check',
    ],
  ];
  for (const [files, cli, pkg, args, label] of steps) {
    if (files.length === 0) {
      continue;
    }
    if (!cli) {
      log(`FAILED: ${label}: the CLI is not installed under ${pkg}/node_modules or the repo root`);
      ok = false;
      continue;
    }
    ok =
      runStep(
        `${label} on ${files.length} file(s)`,
        [process.execPath, cli, ...args(relTo(pkg, files))],
        path.join(repoRoot, pkg),
        log
      ) && ok;
  }

  // 2. Backend tests: serial, the targeted profile, real test database.
  if (chosen.backend.selected.length > 0) {
    const pkgJson = JSON.parse(readFileSync(path.join(repoRoot, 'backend/package.json'), 'utf8'));
    const argv = profileArgv(pkgJson.scripts?.['test:backend:targeted']);
    if (!argv) {
      log(
        'FAILED: backend/package.json test:backend:targeted is not the expected `node ... jest.js` command'
      );
      return 1;
    }
    for (const probe of ['db-probe.mjs', 'db-health.mjs']) {
      const out = spawnSync(
        process.execPath,
        ['--experimental-vm-modules', path.join(repoRoot, 'scripts/preflight', probe)],
        {
          cwd: path.join(repoRoot, 'backend'),
          encoding: 'utf8',
          env: withoutGitEnv(),
        }
      );
      if (out.status !== 0) {
        log(
          `FAILED: ${probe}: the test database is not usable. ${`${out.stdout ?? ''}${out.stderr ?? ''}`.trim()}`
        );
        return 1;
      }
    }
    ok =
      runStep(
        `backend jest on ${chosen.backend.selected.length} file(s)`,
        [...argv, '--forceExit', '--runTestsByPath', ...relTo('backend', chosen.backend.selected)],
        path.join(repoRoot, 'backend'),
        log
      ) && ok;
  }

  // 3. Frontend tests: the package's own `test:run` profile (two workers).
  if (chosen.frontend.selected.length > 0) {
    const pkgJson = JSON.parse(readFileSync(path.join(repoRoot, 'frontend/package.json'), 'utf8'));
    const vitest = path.join(repoRoot, 'frontend/node_modules/vitest/vitest.mjs');
    const argv = existsSync(vitest)
      ? profileArgv(pkgJson.scripts?.['test:run'], {
          leading: 'vitest',
          replaceWith: [process.execPath, vitest],
        })
      : null;
    if (!argv) {
      log(
        'FAILED: frontend vitest is missing or frontend/package.json test:run is not the expected `vitest run ...` command'
      );
      return 1;
    }
    ok =
      runStep(
        `frontend vitest on ${chosen.frontend.selected.length} file(s)`,
        [...argv, ...relTo('frontend', chosen.frontend.selected)],
        path.join(repoRoot, 'frontend'),
        log
      ) && ok;
  }

  log(ok ? 'ok' : 'FAILED (see above)');
  return ok ? 0 : 1;
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().then(
    (code) => process.exit(code),
    (error) => {
      console.error(`[pre-push] changed-checks: FATAL: ${error.stack || error.message}`);
      process.exit(1);
    }
  );
}
