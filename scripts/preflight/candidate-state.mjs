#!/usr/bin/env node
/**
 * Pre-push candidate-state validation (Equoria-hqrqk, handoff Phase E).
 *
 * The pre-push hook runs the doctrine checks and the changed-file tests
 * (scripts/preflight/changed-checks.mjs; since 2026-10-28 the full suite runs
 * only on GitHub, Equoria-zstml) against the WORKING TREE of the checkout it runs in. Git, however, publishes the
 * COMMITS named on the hook's stdin. Three ways those two differ, each of which
 * has cost a gate run or could pass one on the wrong code:
 *
 *   1. The pushed commit is not the checked-out one (`git push origin other:master`
 *      from a checkout whose HEAD is elsewhere): the gate would prove HEAD, not
 *      what is published.
 *   2. Gate-relevant files differ from HEAD: a modified tracked file or an
 *      untracked file under a code root is tested but never published (an
 *      untracked sentinel test failed a push on 2026-09-14; the reverse, a
 *      local edit that makes a red commit green, is the same defect).
 *   3. The remote tip moved since this clone last saw it, so Git will reject the
 *      push as non-fast-forward after the gate has already spent minutes.
 *
 * This script judges all three BEFORE any test runs (phase "before"), and re-reads
 * HEAD and tracked modifications after the gate (phase "after"), because the tree
 * can be edited during a seven-minute run and the verdict must still describe the
 * pushed commit when the gate ends.
 *
 * FAIL-CLOSED: every git failure is a problem, never a pass.
 *
 * Usage (from .husky/pre-push, which feeds the hook's stdin through unchanged):
 *   printf '%s\n' "$PUSH_REFS" | node scripts/preflight/candidate-state.mjs before|after
 *
 * Exit: 0 ok · 1 problems found (printed to stderr) · 2 bad invocation.
 *
 * Opt-in: EQUORIA_PUSH_ALLOW_NON_FF=1 allows a deliberate non-fast-forward push
 * (a rebased feature branch). It never relaxes checks 1 and 2.
 *
 * NOT covered, stated rather than hidden:
 *   - Dirty files OUTSIDE the code roots below only produce a note. At least one
 *     backend test reads EquoriaBible/RelevantFiles/*.xlsx, so a modified bible
 *     file can still change a verdict; it is not refused because the owner's main
 *     checkout routinely carries unrelated document edits.
 *   - The remote tip is the one Git reported when the push began. A push that
 *     lands between the gate and the ref update is rejected by Git itself.
 *   - Admission (the machine-wide lock) lives in backend/scripts/gate-lock.mjs and
 *     is taken by the runner, not here.
 */

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const zeroSha = /^0+$/;

// Top-level directories whose contents the gate executes or reads as inputs.
export const gateRoots = [
  'backend/',
  'frontend/',
  'packages/',
  'scripts/',
  'tests/',
  'samples/',
  'config/',
  'utils/',
  'plugins/',
  '.github/',
  '.husky/',
];

// Root-level files that configure the gate.
export const gateRootFiles = [
  'package.json',
  'package-lock.json',
  'jest.config.js',
  'eslint.config.js',
  'playwright.config.ts',
  'playwright.beta-readiness.config.ts',
];

export function isGateRelevant(relPath) {
  const p = relPath.replace(/\\/g, '/');
  return gateRootFiles.includes(p) || gateRoots.some((root) => p.startsWith(root));
}

export function parsePushRefs(text) {
  const refs = [];
  for (const line of String(text ?? '').split(/\r?\n/)) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 4 || !parts[0]) {
      continue;
    }
    const [localRef, localSha, remoteRef, remoteSha] = parts;
    refs.push({ localRef, localSha, remoteRef, remoteSha });
  }
  return refs;
}

function defaultGit(args, cwd, env) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8', env });
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? (result.error ? String(result.error.message) : ''),
  };
}

// Parses `git status --porcelain=v1 -z`: "XY path\0" and, for renames/copies,
// a second "origpath\0" entry that must be skipped.
export function parseStatusZ(raw) {
  const entries = [];
  const fields = raw.split('\0');
  for (let i = 0; i < fields.length; i++) {
    const field = fields[i];
    if (field.length < 4) {
      continue;
    }
    const code = field.slice(0, 2);
    const entryPath = field.slice(3);
    entries.push({ code, path: entryPath, untracked: code === '??' });
    if (code[0] === 'R' || code[0] === 'C' || code[1] === 'R' || code[1] === 'C') {
      i++;
    }
  }
  return entries;
}

function short(sha) {
  return String(sha).slice(0, 9);
}

/**
 * @returns {{ problems: string[], notes: string[] }}
 */
export function inspectCandidate({
  cwd,
  refsText,
  phase = 'before',
  allowNonFastForward = false,
  // The environment git runs in. In the hook it carries GIT_DIR and friends,
  // which is what points git at the repository being pushed; a caller that
  // inspects a different repository passes an environment without them.
  env = process.env,
  git = (args, dir) => defaultGit(args, dir, env),
}) {
  const problems = [];
  const notes = [];

  const head = git(['rev-parse', '--verify', 'HEAD'], cwd);
  if (head.status !== 0) {
    problems.push(`cannot read HEAD (git rev-parse failed: ${head.stderr.trim()})`);
    return { problems, notes };
  }
  const headSha = head.stdout.trim();

  const refs = parsePushRefs(refsText).filter((r) => !zeroSha.test(r.localSha));
  const deletionsOnly = parsePushRefs(refsText).length > 0 && refs.length === 0;
  if (parsePushRefs(refsText).length === 0) {
    notes.push('no refs on stdin (manual run): pushed-commit and remote-tip checks skipped');
  }
  if (deletionsOnly) {
    notes.push('only ref deletions are being pushed: nothing to validate');
    return { problems, notes };
  }

  // 1. The gate tests HEAD's checked-out tree, so that is what must be pushed.
  for (const ref of refs) {
    if (ref.localSha !== headSha) {
      problems.push(
        `${ref.localRef} -> ${ref.remoteRef} pushes ${short(ref.localSha)}, but this checkout is at ${short(headSha)}. ` +
          'The gate tests the checked-out tree, not the commit being published. Check out the commit you are pushing (or push from its own worktree).'
      );
    }
  }

  // 2. Working tree against HEAD.
  const status = git(['status', '--porcelain=v1', '-z', '--untracked-files=all'], cwd);
  if (status.status !== 0) {
    problems.push(`cannot read working-tree status (git status failed: ${status.stderr.trim()})`);
  } else {
    const entries = parseStatusZ(status.stdout);
    // After the gate only tracked edits are judged: the suite may legitimately
    // leave untracked artifacts, but it must never rewrite a tracked source.
    const relevant = entries.filter(
      (e) => isGateRelevant(e.path) && (phase === 'before' || !e.untracked)
    );
    const outside = entries.filter((e) => !isGateRelevant(e.path));
    if (relevant.length > 0) {
      const shown = relevant
        .slice(0, 15)
        .map((e) => `  ${e.untracked ? '??' : e.code.trim() || 'M'} ${e.path}`)
        .join('\n');
      const more = relevant.length > 15 ? `\n  ... and ${relevant.length - 15} more` : '';
      problems.push(
        phase === 'before'
          ? `${relevant.length} gate-relevant path(s) differ from HEAD ${short(headSha)}, so the gate would test code that is not being pushed:\n${shown}${more}\nCommit them, park them in a WIP commit on a branch, or push from a clean worktree.`
          : `${relevant.length} tracked gate-relevant path(s) changed while the gate ran, so its result no longer describes HEAD ${short(headSha)}:\n${shown}${more}`
      );
    }
    if (outside.length > 0 && phase === 'before') {
      notes.push(
        `${outside.length} path(s) outside the code roots differ from HEAD and were not refused (for example ${outside[0].path})`
      );
    }
  }

  // 3. Remote freshness, before any test runs.
  if (phase === 'before') {
    for (const ref of refs) {
      if (zeroSha.test(ref.remoteSha)) {
        continue; // new branch on the remote
      }
      const known = git(['cat-file', '-e', `${ref.remoteSha}^{commit}`], cwd);
      if (known.status !== 0) {
        problems.push(
          `${ref.remoteRef} is at ${short(ref.remoteSha)} on the remote, a commit this clone does not have. Run git fetch and rebase onto it before spending a gate run.`
        );
        continue;
      }
      const ancestor = git(['merge-base', '--is-ancestor', ref.remoteSha, ref.localSha], cwd);
      if (ancestor.status === 1 && !allowNonFastForward) {
        problems.push(
          `${ref.remoteRef} (${short(ref.remoteSha)}) is not an ancestor of ${short(ref.localSha)}: Git would reject this push as non-fast-forward after the gate ran. Fetch and rebase first (EQUORIA_PUSH_ALLOW_NON_FF=1 allows a deliberate non-fast-forward).`
        );
      } else if (ancestor.status > 1) {
        problems.push(
          `cannot compare ${short(ref.remoteSha)} with ${short(ref.localSha)} (git merge-base failed: ${ancestor.stderr.trim()})`
        );
      }
    }
  }

  return { problems, notes };
}

async function readStdin() {
  if (process.stdin.isTTY) {
    return '';
  }
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function main() {
  const phase = process.argv[2];
  if (phase !== 'before' && phase !== 'after') {
    console.error('usage: candidate-state.mjs before|after   (hook stdin on standard input)');
    return 2;
  }
  const refsText = await readStdin();
  const { problems, notes } = inspectCandidate({
    cwd: process.cwd(),
    refsText,
    phase,
    allowNonFastForward: process.env.EQUORIA_PUSH_ALLOW_NON_FF === '1',
  });
  for (const note of notes) {
    console.error(`[pre-push] candidate-state (${phase}): note: ${note}`);
  }
  if (problems.length > 0) {
    for (const problem of problems) {
      console.error(`[pre-push] candidate-state (${phase}): REFUSED: ${problem}`);
    }
    return 1;
  }
  console.error(`[pre-push] candidate-state (${phase}): ok`);
  return 0;
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  main().then(
    (code) => process.exit(code),
    (error) => {
      console.error(`[pre-push] candidate-state: FATAL: ${error.message}`);
      process.exit(1);
    }
  );
}
