/**
 * Sentinel — pre-push candidate-state validation (Equoria-hqrqk, Phase E).
 *
 * The pre-push gate tests the checkout's working tree while git publishes the
 * commits on the hook's stdin. scripts/preflight/candidate-state.mjs refuses a
 * push whose candidate differs from what the gate would test. These tests drive
 * the REAL script against REAL temporary git repositories and a real bare
 * remote: no git mocks, no fixtures standing in for the repository.
 */
import { describe, it, expect, afterAll } from '@jest/globals';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  inspectCandidate,
  isGateRelevant,
  parsePushRefs,
  parseStatusZ,
} from '../../../scripts/preflight/candidate-state.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const scriptPath = path.join(repoRoot, 'scripts', 'preflight', 'candidate-state.mjs');
const ZERO = '0'.repeat(40);

const scratch = mkdtempSync(path.join(tmpdir(), 'equoria-candidate-state-'));
let seq = 0;

// Identity and signing are passed per command, so the developer's own git
// configuration cannot change what these temporary repositories do.
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
const gitEnv = { ...process.env };

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

/** A work clone with one commit pushed to a bare remote on master. */
function makeWorld() {
  const id = ++seq;
  const remote = path.join(scratch, `remote-${id}.git`);
  const work = path.join(scratch, `work-${id}`);
  git(scratch, 'init', '-q', '--bare', '-b', 'master', remote);
  mkdirSync(work);
  git(work, 'init', '-q', '-b', 'master');
  git(work, 'remote', 'add', 'origin', remote);
  write(work, 'backend/a.mjs', 'export const a = 1;\n');
  write(work, 'docs/note.md', 'one\n');
  const base = commit(work, 'base');
  git(work, 'push', '-q', 'origin', 'master');
  return { remote, work, base };
}

const refLine = (localSha, remoteSha, localRef = 'HEAD', remoteRef = 'refs/heads/master') =>
  `${localRef} ${localSha} ${remoteRef} ${remoteSha}\n`;

const run = (work, refsText, extra = {}) => inspectCandidate({ cwd: work, refsText, ...extra });

afterAll(() => {
  rmSync(scratch, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
});

describe('candidate-state — what the gate would test against what git publishes', () => {
  it('passes a clean fast-forward of HEAD', () => {
    const { work, base } = makeWorld();
    write(work, 'backend/a.mjs', 'export const a = 2;\n');
    const head = commit(work, 'next');
    const { problems } = run(work, refLine(head, base));
    expect(problems).toEqual([]);
  });

  it('passes a new branch (remote sha all zeros)', () => {
    const { work, base } = makeWorld();
    const { problems } = run(work, refLine(base, ZERO, 'refs/heads/topic', 'refs/heads/topic'));
    expect(problems).toEqual([]);
  });

  it('refuses a modified tracked file under a code root', () => {
    const { work, base } = makeWorld();
    write(work, 'backend/a.mjs', 'export const a = 99; // edited, never committed\n');
    const { problems } = run(work, refLine(base, base));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('backend/a.mjs');
    expect(problems[0]).toContain('differ from HEAD');
  });

  it('refuses an untracked file under a code root (the 2026-09-14 untracked sentinel)', () => {
    const { work, base } = makeWorld();
    write(work, 'backend/__tests__/newSentinel.test.mjs', 'it("x", () => {});\n');
    const { problems } = run(work, refLine(base, base));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('?? backend/__tests__/newSentinel.test.mjs');
  });

  it('refuses a staged but uncommitted change', () => {
    const { work, base } = makeWorld();
    write(work, 'scripts/tool.mjs', 'export {};\n');
    git(work, 'add', 'scripts/tool.mjs');
    const { problems } = run(work, refLine(base, base));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('scripts/tool.mjs');
  });

  it('only notes a difference outside the code roots, and says what it did not refuse', () => {
    const { work, base } = makeWorld();
    write(work, 'docs/note.md', 'two\n');
    write(work, 'EquoriaBible/notes.txt', 'untracked bible scratch\n');
    const { problems, notes } = run(work, refLine(base, base));
    expect(problems).toEqual([]);
    expect(notes.join('\n')).toMatch(/outside the code roots/);
  });

  it('refuses when the pushed commit is not the checked-out HEAD', () => {
    const { work, base } = makeWorld();
    write(work, 'backend/a.mjs', 'export const a = 3;\n');
    const other = commit(work, 'other');
    git(work, 'checkout', '-q', '--detach', base);
    const { problems } = run(work, refLine(other, base, 'refs/heads/other', 'refs/heads/master'));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/pushes .* but this checkout is at/);
  });

  it('refuses when the remote tip is a commit this clone does not have', () => {
    const { remote, work, base } = makeWorld();
    const second = path.join(scratch, `second-${++seq}`);
    git(scratch, 'clone', '-q', remote, second);
    write(second, 'backend/b.mjs', 'export const b = 1;\n');
    const advanced = commit(second, 'someone else pushed');
    git(second, 'push', '-q', 'origin', 'master');

    write(work, 'backend/a.mjs', 'export const a = 4;\n');
    const head = commit(work, 'mine');
    const { problems } = run(work, refLine(head, advanced));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('does not have');
    // sanity: the commit we built on is the one the remote started from
    expect(git(work, 'rev-parse', `${head}^`)).toBe(base);
  });

  it('refuses a diverged history, and allows it only on explicit opt-in', () => {
    const { work, base } = makeWorld();
    write(work, 'backend/a.mjs', 'export const a = 5;\n');
    const theirs = commit(work, 'theirs');
    git(work, 'reset', '-q', '--hard', base);
    write(work, 'backend/a.mjs', 'export const a = 6;\n');
    const mine = commit(work, 'mine');

    const refused = run(work, refLine(mine, theirs));
    expect(refused.problems).toHaveLength(1);
    expect(refused.problems[0]).toContain('non-fast-forward');

    const allowed = run(work, refLine(mine, theirs), { allowNonFastForward: true });
    expect(allowed.problems).toEqual([]);
  });

  it('allows deleting a remote ref even from a dirty tree: nothing is published to test', () => {
    const { work, base } = makeWorld();
    write(work, 'backend/a.mjs', 'export const a = 7;\n');
    const { problems, notes } = run(work, refLine(ZERO, base, '(delete)', 'refs/heads/topic'));
    expect(problems).toEqual([]);
    expect(notes.join('\n')).toMatch(/deletions/);
  });

  it('judges every ref in a multi-ref push', () => {
    const { work, base } = makeWorld();
    write(work, 'backend/a.mjs', 'export const a = 8;\n');
    const head = commit(work, 'head');
    const text =
      refLine(head, base, 'refs/heads/master', 'refs/heads/master') +
      refLine(base, ZERO, 'refs/heads/old', 'refs/heads/old');
    const { problems } = run(work, text);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('refs/heads/old');
  });

  it('after the gate: a tracked edit made during the run is refused', () => {
    const { work, base } = makeWorld();
    write(work, 'backend/a.mjs', 'export const a = 9; // edited while the gate ran\n');
    const { problems } = run(work, refLine(base, base), { phase: 'after' });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('changed while the gate ran');
  });

  it('after the gate: an untracked artifact the suite left behind is tolerated', () => {
    const { work, base } = makeWorld();
    write(work, 'backend/leftover.log', 'artifact\n');
    const { problems } = run(work, refLine(base, base), { phase: 'after' });
    expect(problems).toEqual([]);
  });

  it('fails closed when git cannot answer', () => {
    const notARepo = mkdtempSync(path.join(scratch, 'not-a-repo-'));
    const { problems } = run(notARepo, refLine('a'.repeat(40), 'b'.repeat(40)));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('cannot read HEAD');
  });
});

describe('candidate-state — parsing and path classification', () => {
  it('parses hook stdin lines and ignores blanks', () => {
    expect(parsePushRefs('\nHEAD abc refs/heads/m def\n\n')).toEqual([
      { localRef: 'HEAD', localSha: 'abc', remoteRef: 'refs/heads/m', remoteSha: 'def' },
    ]);
    expect(parsePushRefs('')).toEqual([]);
  });

  it('skips the second path of a rename entry in porcelain -z output', () => {
    const entries = parseStatusZ('R  new.mjs\0old.mjs\0 M backend/a.mjs\0?? scripts/x.mjs\0');
    expect(entries.map(e => e.path)).toEqual(['new.mjs', 'backend/a.mjs', 'scripts/x.mjs']);
    expect(entries[2].untracked).toBe(true);
  });

  it('treats code roots and gate config files as relevant, bible and docs as not', () => {
    for (const p of ['backend/x.mjs', 'frontend/src/a.tsx', 'packages/database/schema.prisma']) {
      expect(isGateRelevant(p)).toBe(true);
    }
    for (const p of ['package.json', 'package-lock.json', '.husky/pre-push', '.github/workflows/a.yml']) {
      expect(isGateRelevant(p)).toBe(true);
    }
    for (const p of ['docs/a.md', 'EquoriaBible/a.docx', '_bmad-output/x.md', 'README.md']) {
      expect(isGateRelevant(p)).toBe(false);
    }
  });
});

describe('candidate-state — the real entry point and the hook wiring', () => {
  it('exits 0 for a clean candidate and 1 with a REFUSED line for a dirty one', () => {
    const { work, base } = makeWorld();
    const ok = spawnSync(process.execPath, [scriptPath, 'before'], {
      cwd: work,
      input: refLine(base, base),
      encoding: 'utf8',
      env: gitEnv,
    });
    expect(ok.status).toBe(0);
    expect(ok.stderr).toContain('candidate-state (before): ok');

    write(work, 'backend/a.mjs', 'export const a = 10;\n');
    const bad = spawnSync(process.execPath, [scriptPath, 'before'], {
      cwd: work,
      input: refLine(base, base),
      encoding: 'utf8',
      env: gitEnv,
    });
    expect(bad.status).toBe(1);
    expect(bad.stderr).toContain('REFUSED');
    expect(bad.stderr).toContain('backend/a.mjs');
  });

  it('exits 2 without a valid phase', () => {
    const result = spawnSync(process.execPath, [scriptPath], { encoding: 'utf8', input: '' });
    expect(result.status).toBe(2);
  });

  it('is wired into .husky/pre-push before doctrine and again after the gate', () => {
    const hook = readFileSync(path.join(repoRoot, '.husky', 'pre-push'), 'utf8');
    const capture = hook.indexOf('PUSH_REFS="$(cat)"');
    const guard = hook.indexOf('session-guard.sh" prepush');
    const before = hook.indexOf('candidate-state.mjs" before');
    const doctrine = hook.indexOf('bash "$DOCTRINE_SCRIPT"');
    const gate = hook.indexOf('npm run test:backend:full');
    const after = hook.indexOf('candidate-state.mjs" after');
    expect(capture).toBeGreaterThan(-1);
    expect(capture).toBeLessThan(guard);
    expect(guard).toBeLessThan(before);
    expect(before).toBeLessThan(doctrine);
    expect(doctrine).toBeLessThan(gate);
    expect(gate).toBeLessThan(after);
    // stdin can be read once: nothing may read it except the single capture.
    expect(hook.match(/\$\(cat\)/g)).toHaveLength(1);
  });
});
