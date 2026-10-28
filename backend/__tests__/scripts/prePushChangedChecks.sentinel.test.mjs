/**
 * Sentinel — pre-push changed-file checks (Equoria-zstml, owner ruling q233
 * 2026-10-28: the full check runs only on GitHub; the laptop runs only the
 * changed tests).
 *
 * scripts/preflight/changed-checks.mjs decides what a push changed and which
 * test files are related to it. These tests drive the REAL functions against
 * REAL temporary git repositories with a real bare remote (no git mocks), and
 * run the real script for its fail-closed exits.
 */
import { describe, it, expect, afterAll } from '@jest/globals';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  collectChangedFiles,
  lintTargets,
  listRepoFiles,
  parseRunnerCount,
  profileArgv,
  selectTests,
  testStem,
  withoutGitEnv,
} from '../../../scripts/preflight/changed-checks.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const scriptPath = path.join(repoRoot, 'scripts', 'preflight', 'changed-checks.mjs');
const zero = '0'.repeat(40);

const scratch = mkdtempSync(path.join(tmpdir(), 'equoria-changed-checks-'));
let seq = 0;

const gitConfigArgs = [
  '-c',
  'user.name=Sentinel',
  '-c',
  'user.email=sentinel@example.invalid',
  '-c',
  'commit.gpgsign=false',
  '-c',
  'core.autocrlf=false',
];
// Under `git push` the hook environment carries GIT_DIR and friends; every
// child git here runs without them so it acts on the temporary repository.
const gitEnv = withoutGitEnv(process.env);

const git = (cwd, ...args) =>
  execFileSync('git', [...gitConfigArgs, ...args], { cwd, encoding: 'utf8', env: gitEnv }).trim();

function write(repo, rel, text) {
  const full = path.join(repo, rel);
  mkdirSync(path.dirname(full), { recursive: true });
  writeFileSync(full, text);
}

function commit(repo, message) {
  git(repo, 'add', '-A');
  git(repo, 'commit', '-q', '-m', message);
  return git(repo, 'rev-parse', 'HEAD');
}

/** A work clone whose master is pushed to a bare remote (origin/master exists). */
function makeWorld() {
  const id = ++seq;
  const remote = path.join(scratch, `remote-${id}.git`);
  const work = path.join(scratch, `work-${id}`);
  git(scratch, 'init', '-q', '--bare', '-b', 'master', remote);
  mkdirSync(work);
  git(work, 'init', '-q', '-b', 'master');
  git(work, 'remote', 'add', 'origin', remote);
  write(work, 'backend/services/horseService.mjs', 'export const a = 1;\n');
  write(work, 'docs/note.md', 'one\n');
  const base = commit(work, 'base');
  git(work, 'push', '-q', 'origin', 'master');
  return { work, base };
}

const refLine = (localSha, remoteSha, localRef = 'HEAD', remoteRef = 'refs/heads/master') =>
  `${localRef} ${localSha} ${remoteRef} ${remoteSha}\n`;

const changed = (work, refsText) => collectChangedFiles({ cwd: work, refsText, env: gitEnv });

afterAll(() => {
  rmSync(scratch, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
});

describe('changed-checks — what the push changed', () => {
  it('lists only the files between the remote tip and the pushed commit', () => {
    const { work, base } = makeWorld();
    write(work, 'backend/services/horseService.mjs', 'export const a = 2;\n');
    write(work, 'frontend/src/pages/BankPage.tsx', 'export {};\n');
    const head = commit(work, 'next');
    const result = changed(work, refLine(head, base));
    expect(result.problems).toEqual([]);
    expect(result.files).toEqual(['backend/services/horseService.mjs', 'frontend/src/pages/BankPage.tsx']);
  });

  it('a new branch is compared with its merge-base on origin/master, not the whole history', () => {
    const { work } = makeWorld();
    git(work, 'switch', '-q', '-c', 'topic');
    write(work, 'backend/routes/x.mjs', 'export {};\n');
    const head = commit(work, 'topic work');
    const result = changed(work, refLine(head, zero, 'refs/heads/topic', 'refs/heads/topic'));
    expect(result.problems).toEqual([]);
    expect(result.files).toEqual(['backend/routes/x.mjs']);
  });

  it('includes untracked and modified working-tree files (an untracked test still runs)', () => {
    const { work, base } = makeWorld();
    write(work, 'backend/__tests__/newThing.test.mjs', 'it("x", () => {});\n');
    write(work, 'docs/note.md', 'two\n');
    const result = changed(work, refLine(base, base));
    expect(result.problems).toEqual([]);
    expect(result.files).toEqual(['backend/__tests__/newThing.test.mjs', 'docs/note.md']);
  });

  it('a push that only deletes refs has nothing to check', () => {
    const { work, base } = makeWorld();
    const result = changed(work, `(delete) ${zero} refs/heads/old ${base}\n`);
    expect(result).toMatchObject({ deletionsOnly: true, files: [], problems: [] });
  });

  it('fails closed when the remote tip is a commit this clone does not have', () => {
    const { work, base } = makeWorld();
    const result = changed(work, refLine(base, 'f'.repeat(40)));
    expect(result.problems).toHaveLength(1);
    expect(result.problems[0]).toContain('Run git fetch origin');
  });

  it('fails closed when a new branch has no origin/master to compare with', () => {
    const id = ++seq;
    const work = path.join(scratch, `lonely-${id}`);
    mkdirSync(work);
    git(work, 'init', '-q', '-b', 'master');
    write(work, 'backend/a.mjs', 'export {};\n');
    const head = commit(work, 'only');
    const result = changed(work, refLine(head, zero, 'refs/heads/topic', 'refs/heads/topic'));
    expect(result.problems).toHaveLength(1);
    expect(result.problems[0]).toContain('merge-base');
  });

  it('fails closed when git itself fails (not a repository)', () => {
    const notRepo = mkdtempSync(path.join(scratch, 'not-a-repo-'));
    const result = changed(notRepo, '');
    expect(result.problems.length).toBeGreaterThan(0);
    expect(listRepoFiles({ cwd: notRepo, env: gitEnv }).problem).toContain('git ls-files failed');
  });
});

describe('changed-checks — which tests are related', () => {
  const repoFiles = [
    'backend/services/horseService.mjs',
    'backend/__tests__/services/horseService.test.mjs',
    'backend/modules/horses/__tests__/horseService.integration.test.mjs',
    'backend/__tests__/horseServiceExtra.test.mjs',
    'backend/utils/index.mjs',
    'backend/utils/__tests__/index.test.mjs',
    'backend/routes/__tests__/index.test.mjs',
    'backend/__tests__/slow.perf.test.mjs',
    'backend/tests/load/foo.test.mjs',
    'backend/__tests__/scripts/hook.sentinel.test.mjs',
    'backend/__tests__/edited.test.mjs',
    'frontend/src/pages/BankPage.tsx',
    'frontend/src/pages/__tests__/BankPage.test.tsx',
    'frontend/src/components/Other.test.tsx',
  ];
  const texts = {
    'backend/__tests__/scripts/hook.sentinel.test.mjs': "readFileSync(path.join(ROOT, '.husky/pre-push'))",
  };
  const ignore = [/\/tests\/load\//, /\.perf\.test\.mjs$/];
  const pick = (changedFiles, extra = {}) =>
    selectTests({
      changed: changedFiles,
      repoFiles,
      exists: p => repoFiles.includes(p),
      readText: p => texts[p] ?? '',
      backendIgnore: ignore,
      ...extra,
    });

  it('runs a changed test file itself', () => {
    expect(pick(['backend/__tests__/edited.test.mjs']).backend.selected).toEqual(['backend/__tests__/edited.test.mjs']);
  });

  it('a changed source file selects the tests named after it anywhere in its package', () => {
    const { backend } = pick(['backend/services/horseService.mjs']);
    expect(backend.selected).toEqual([
      'backend/__tests__/services/horseService.test.mjs',
      'backend/modules/horses/__tests__/horseService.integration.test.mjs',
    ]);
    expect(backend.selected).not.toContain('backend/__tests__/horseServiceExtra.test.mjs');
  });

  it('a generic name (index) only matches its own directory and __tests__', () => {
    expect(pick(['backend/utils/index.mjs']).backend.selected).toEqual(['backend/utils/__tests__/index.test.mjs']);
  });

  it('a test that names a changed repository path is selected (hook and workflow sentinels)', () => {
    expect(pick(['.husky/pre-push']).backend.selected).toEqual(['backend/__tests__/scripts/hook.sentinel.test.mjs']);
  });

  it('frontend sources map to their Vitest files', () => {
    const result = pick(['frontend/src/pages/BankPage.tsx']);
    expect(result.frontend.selected).toEqual(['frontend/src/pages/__tests__/BankPage.test.tsx']);
    expect(result.backend.selected).toEqual([]);
  });

  it('never selects files the backend Jest config ignores, or deleted tests', () => {
    const result = pick([
      'backend/__tests__/slow.perf.test.mjs',
      'backend/tests/load/foo.test.mjs',
      'backend/__tests__/gone.test.mjs',
    ]);
    expect(result.backend.selected).toEqual([]);
  });

  it('the cap keeps changed tests first and reports what it left to GitHub', () => {
    const result = pick(['backend/services/horseService.mjs', 'backend/__tests__/edited.test.mjs'], {
      caps: { backend: 2, frontend: 40 },
    });
    expect(result.backend.selected[0]).toBe('backend/__tests__/edited.test.mjs');
    expect(result.backend.selected).toHaveLength(2);
    expect(result.backend.dropped).toEqual(['backend/modules/horses/__tests__/horseService.integration.test.mjs']);
  });

  it('a docs-only change selects nothing', () => {
    const result = pick(['docs/note.md']);
    expect(result.backend.selected).toEqual([]);
    expect(result.frontend.selected).toEqual([]);
  });

  it('strips every test suffix for the stem', () => {
    expect(testStem('a/foo.integration.test.mjs')).toBe('foo.integration');
    expect(testStem('a/Foo.spec.tsx')).toBe('Foo');
  });
});

describe('changed-checks — lint targets, profiles and the busy check', () => {
  it('lints only changed backend/frontend files that still exist', () => {
    const present = new Set(['backend/a.mjs', 'frontend/src/B.tsx', 'backend/README.md', 'scripts/x.mjs']);
    const targets = lintTargets(
      ['backend/a.mjs', 'frontend/src/B.tsx', 'backend/README.md', 'backend/gone.mjs', 'scripts/x.mjs'],
      p => present.has(p),
    );
    expect(targets).toEqual({
      backendEslint: ['backend/a.mjs'],
      backendPrettier: ['backend/a.mjs', 'backend/README.md'],
      frontendEslint: ['frontend/src/B.tsx'],
      frontendPrettier: ['frontend/src/B.tsx'],
    });
  });

  it('runs the real targeted backend profile and the real frontend test:run profile', () => {
    const backend = JSON.parse(readFileSync(path.join(repoRoot, 'backend/package.json'), 'utf8'));
    const frontend = JSON.parse(readFileSync(path.join(repoRoot, 'frontend/package.json'), 'utf8'));
    const be = profileArgv(backend.scripts['test:backend:targeted'], { replaceWith: ['NODE'] });
    expect(be).toEqual(expect.arrayContaining(['NODE', '--runInBand', 'node_modules/jest/bin/jest.js']));
    expect(be.join(' ')).toMatch(/--max-old-space-size=1536/);
    const fe = profileArgv(frontend.scripts['test:run'], { leading: 'vitest', replaceWith: ['NODE', 'VITEST'] });
    expect(fe).toEqual(['NODE', 'VITEST', 'run', '--maxWorkers=2']);
  });

  it('refuses a profile it cannot run safely (fail closed)', () => {
    expect(profileArgv('jest --runInBand')).toBeNull();
    expect(profileArgv('node a.js && rm -rf x')).toBeNull();
    expect(profileArgv(undefined)).toBeNull();
  });

  it('an empty or non-numeric process count means busy, never idle', () => {
    expect(parseRunnerCount('')).toBeNull();
    expect(parseRunnerCount('n/a')).toBeNull();
    expect(parseRunnerCount(undefined)).toBeNull();
    expect(parseRunnerCount('0\r\n')).toBe(0);
    expect(parseRunnerCount('3')).toBe(3);
  });

  it('child processes never inherit GIT_* variables', () => {
    // Windows environment names are case-insensitive, so a lower-case spelling counts too.
    const lowerCaseName = 'GIT_INDEX_FILE'.toLowerCase();
    const env = withoutGitEnv({ GIT_DIR: '/x', [lowerCaseName]: '/y', PATH: '/bin' });
    expect(env).toEqual({ PATH: '/bin' });
  });

  it('every test and lint child process is spawned without GIT_* variables', () => {
    // The hook no longer unsets GIT_* itself (git needs them to read the push);
    // changed-checks.mjs strips them per child. Guard that each non-git spawn
    // in the script passes the stripped environment.
    const source = readFileSync(scriptPath, 'utf8');
    const spawns = source.split('spawnSync(').slice(1);
    const childSpawns = spawns.filter(call => !/^'(?:git|powershell\.exe|ps)'/.test(call));
    expect(childSpawns.length).toBeGreaterThanOrEqual(2);
    for (const call of childSpawns) {
      expect(call.slice(0, 400)).toContain('env: withoutGitEnv()');
    }
  });
});

describe('changed-checks — the real script', () => {
  const runScript = input =>
    spawnSync(process.execPath, [scriptPath, '--dry-run'], { cwd: repoRoot, input, encoding: 'utf8', env: gitEnv });

  it('passes a push that only deletes a branch without running anything', () => {
    const out = runScript(`(delete) ${zero} refs/heads/old-branch ${'a'.repeat(40)}\n`);
    expect(out.status).toBe(0);
    expect(out.stderr).toContain('nothing to check');
  });

  it('refuses (exit 1) when it cannot work out what changed', () => {
    const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8', env: gitEnv }).trim();
    const out = runScript(refLine(head, 'e'.repeat(40)));
    expect(out.status).toBe(1);
    expect(out.stderr).toContain('REFUSED');
  });
});
