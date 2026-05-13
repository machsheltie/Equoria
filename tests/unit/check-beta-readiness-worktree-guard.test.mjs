/**
 * Sentinel test: check-beta-readiness.sh must reject worktree CWDs.
 *
 * Root cause: Jest testMatch globs break when CWD contains \.claude because
 * Node/Jest path normalization corrupts backslash-dot to a regex escape,
 * producing mixed-slash globs that micromatch cannot match. Zero test files
 * are discovered and the script silently reports 0 suites. The guard fails
 * fast with a clear error instead.
 */

import { spawnSync } from 'child_process';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, chmodSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const SCRIPT = join(PROJECT_ROOT, 'scripts', 'check-beta-readiness.sh');

function makeFakeGit(showTopLevel) {
  const dir = mkdtempSync(join(tmpdir(), 'fake-git-'));
  const bin = join(dir, 'bin');
  mkdirSync(bin);
  const gitScript = join(bin, 'git');
  // Fake git: only intercepts --show-toplevel; everything else delegates to real git
  writeFileSync(
    gitScript,
    `#!/usr/bin/env bash\nif [[ "$*" == *"--show-toplevel"* ]]; then\n  echo "${showTopLevel}"\nelse\n  "$(which git)" "$@"\nfi\n`
  );
  chmodSync(gitScript, 0o755);
  return { dir, bin };
}

test('check-beta-readiness.sh exits 2 when run from a Claude Code worktree', () => {
  const { dir, bin } = makeFakeGit('/home/user/project/.claude/worktrees/agent-abc1234');

  const result = spawnSync('bash', [SCRIPT], {
    cwd: PROJECT_ROOT,
    env: { ...process.env, PATH: `${bin}:${process.env.PATH ?? ''}` },
    encoding: 'utf8',
    timeout: 10_000,
  });

  rmSync(dir, { recursive: true, force: true });

  expect(result.status).toBe(2);
  expect(result.stderr).toContain('must be run from the main project checkout');
  expect(result.stderr).toContain('.claude/worktrees/');
});

test('check-beta-readiness.sh does not reject main project checkout', () => {
  const { dir, bin } = makeFakeGit('/home/user/equoria');

  const result = spawnSync('bash', [SCRIPT], {
    cwd: PROJECT_ROOT,
    env: { ...process.env, PATH: `${bin}:${process.env.PATH ?? ''}` },
    encoding: 'utf8',
    timeout: 10_000,
  });

  rmSync(dir, { recursive: true, force: true });

  // Exit 2 is reserved for argument errors and the worktree guard.
  // A normal checkout may fail on other gates (exit 0 or 1) but NOT exit 2
  // from the worktree guard.
  if (result.status === 2) {
    expect(result.stderr).not.toContain('must be run from the main project checkout');
  }
});
