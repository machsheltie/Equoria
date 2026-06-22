#!/usr/bin/env node

import { execSync } from 'child_process';
import { existsSync } from 'fs';

// Equoria-pr90b: cleanup-worktrees.mjs
// This script safely removes all abandoned worktree-agent-* branches that were
// not cleaned up via ExitWorktree. It validates that no commits are orphaned
// before deletion, logs the cleanup count, and verifies the working tree is clean.
//
// Equoria-6a4h5: extended to also clean up stale worktree REGISTRATIONS (not just
// branches). `git worktree prune` alone cannot remove locked registrations even
// when their directory is gone, so they accumulate. This pass:
//   Phase A — registrations whose directory no longer exists: unlock + prune
//             (zero risk; nothing to lose).
//   Phase B — registrations whose directory exists AND is clean: unlock first
//             (git refuses to remove a locked worktree even with --force) then
//             `git worktree remove --force`. The branch + all commits survive in
//             the repo — only the working copy is discarded.
//   Phase C — registrations whose directory exists AND has uncommitted changes:
//             PRESERVE and report (never destroy uncommitted work — Constitution §1).
// The main checkout is never touched.

function listWorktreeBranches() {
  try {
    const output = execSync('git branch', { encoding: 'utf-8' });
    const branches = output
      .split('\n')
      .map(line => line.trim().replace(/^[+*] /, '')) // Remove markers like + or *
      .filter(line => line.startsWith('worktree-agent-'));
    return branches;
  } catch (error) {
    console.error('❌ Failed to list branches:', error.message);
    process.exit(1);
  }
}

function validateBranchBeforeDeletion(branch) {
  try {
    // Get the commit hash for this branch
    const branchCommit = execSync(`git rev-parse "${branch}"`, { encoding: 'utf-8' }).trim();

    // Check if this commit exists in origin/master
    // merge-base --is-ancestor exits 0 if ancestor, 1 if not
    try {
      execSync(`git merge-base --is-ancestor "${branchCommit}" origin/master`, {
        stdio: 'ignore',
      });
      // Exit code 0 means it's an ancestor, safe to delete
      return true;
    } catch (_ancestorError) {
      // Exit code non-zero means NOT an ancestor
      return false;
    }
  } catch (_error) {
    // If we can't get the commit hash, assume it's safe (orphaned)
    return true;
  }
}

function deleteBranch(branch) {
  try {
    // Try to delete with -d first, if fails use -D (force)
    execSync(`git branch -d "${branch}"`, { stdio: 'ignore' });
    return true;
  } catch (_error) {
    try {
      execSync(`git branch -D "${branch}"`, { stdio: 'ignore' });
      return true;
    } catch (_forceError) {
      return false;
    }
  }
}

function verifyCleanup() {
  try {
    const output = execSync('git branch', { encoding: 'utf-8' });
    const remaining = output
      .split('\n')
      .map(line => line.trim().replace(/^[+*] /, ''))
      .filter(line => line.startsWith('worktree-agent-'));
    return remaining.length === 0;
  } catch (_error) {
    return false;
  }
}

function verifyWorkingTree() {
  try {
    const status = execSync('git status --porcelain', { encoding: 'utf-8' });
    return status.trim() === '';
  } catch (error) {
    console.error('❌ Failed to check working tree status:', error.message);
    process.exit(1);
  }
}

// --- Equoria-6a4h5: worktree REGISTRATION cleanup ---------------------------

function repoTopLevel() {
  return execSync('git rev-parse --show-toplevel', { encoding: 'utf-8' }).trim();
}

// Parse `git worktree list --porcelain` into structured records.
// Each record: { path, branch, locked, exists, dirtyCount, trackedDirty }.
function listWorktreeRegistrations() {
  const out = execSync('git worktree list --porcelain', { encoding: 'utf-8' });
  const records = [];
  let cur = null;
  for (const raw of out.split('\n')) {
    const line = raw.trim();
    if (line.startsWith('worktree ')) {
      if (cur) {
        records.push(cur);
      }
      cur = { path: line.slice('worktree '.length), branch: null, locked: false };
    } else if (cur && line.startsWith('branch ')) {
      cur.branch = line.slice('branch '.length);
    } else if (cur && line === 'locked') {
      cur.locked = true;
    } else if (cur && line.startsWith('locked ')) {
      cur.locked = true;
    }
  }
  if (cur) {
    records.push(cur);
  }

  for (const r of records) {
    r.exists = existsSync(r.path);
    r.dirtyCount = 0;
    r.trackedDirty = 0;
    if (r.exists) {
      try {
        const status = execSync('git status --porcelain', {
          cwd: r.path,
          encoding: 'utf-8',
        });
        const lines = status.split('\n').filter(l => l.length > 0);
        r.dirtyCount = lines.length;
        // Lines NOT starting with '??' are tracked modifications/staged — the
        // ones that represent real, potentially-unrecoverable work.
        r.trackedDirty = lines.filter(l => !l.startsWith('??')).length;
      } catch {
        // Unreadable worktree (corrupt/partial) — treat as dirty to be safe.
        r.dirtyCount = -1;
        r.trackedDirty = -1;
      }
    }
  }
  return records;
}

function cleanupWorktreeRegistrations(dryRun) {
  const top = repoTopLevel();
  const norm = p => p.replace(/\\/g, '/').replace(/\/+$/, '');
  const all = listWorktreeRegistrations();
  // Never touch:
  //  - the main checkout (matches repo top-level)
  //  - bd/dolt infrastructure worktrees under .git/beads-worktrees/
  //  - external-path worktrees outside this repo's .claude/worktrees/ that still
  //    exist (e.g. .claude-worktrees/, sibling dirs) — they may belong to other
  //    live sessions; only sweep GONE registrations + in-repo agent worktrees.
  const inRepoWorktrees = `${norm(top)}/.claude/worktrees/`;
  const candidates = all.filter(r => {
    if (norm(r.path) === norm(top)) {
      return false;
    }
    if (norm(r.path).includes('/.git/beads-worktrees/')) {
      return false;
    }
    // Existing external worktrees (real dir, not under this repo's .claude/worktrees/)
    // are left alone; gone registrations anywhere are still swept.
    if (r.exists && !norm(r.path).startsWith(inRepoWorktrees)) {
      return false;
    }
    return true;
  });

  const gone = candidates.filter(r => !r.exists);
  const cleanExists = candidates.filter(r => r.exists && r.dirtyCount === 0);
  const dirtyExists = candidates.filter(r => r.exists && r.dirtyCount !== 0);

  console.log(`\n🌳 Worktree registration cleanup${dryRun ? ' (DRY RUN — no changes)' : ''}:`);
  console.log(`  Total registrations: ${all.length} (main + ${candidates.length} others)`);
  console.log(`  Phase A — directory gone (zero-risk remove): ${gone.length}`);
  console.log(`  Phase B — exists + clean (safe remove, branch survives): ${cleanExists.length}`);
  console.log(`  Phase C — exists + uncommitted changes (PRESERVE): ${dirtyExists.length}`);

  let removed = 0;
  let failed = 0;

  // Phase A: gone directories — unlock then prune handles them in one sweep.
  if (gone.length > 0 && !dryRun) {
    for (const r of gone) {
      try {
        execSync(`git worktree unlock "${r.path}"`, { stdio: 'ignore' });
      } catch {
        // already unlocked or not lockable — fine
      }
    }
    try {
      execSync('git worktree prune', { stdio: 'ignore' });
    } catch (e) {
      console.warn(`  ⚠️  prune failed: ${e.message}`);
    }
  }

  // Phase B: existing + clean — unlock first (git refuses to remove a locked
  // worktree even with --force), then force-remove. Branch + commits survive.
  for (const r of cleanExists) {
    if (dryRun) {
      removed++;
      continue;
    }
    if (r.locked) {
      try {
        execSync(`git worktree unlock "${r.path}"`, { stdio: 'ignore' });
      } catch {
        // not lockable / already unlocked — proceed to remove
      }
    }
    try {
      execSync(`git worktree remove --force "${r.path}"`, { stdio: 'ignore' });
      removed++;
    } catch (e) {
      failed++;
      console.warn(`  ⚠️  could not remove ${r.path}: ${e.message.split('\n')[0]}`);
    }
  }

  // Phase A removals are counted after the fact (prune is all-or-nothing).
  if (!dryRun) {
    const afterGone = listWorktreeRegistrations().filter(
      r => norm(r.path) !== norm(top) && !r.exists,
    ).length;
    removed += gone.length - afterGone;
  } else {
    removed += gone.length;
  }

  // Phase C: report preserved dirty worktrees so they aren't silently abandoned.
  if (dirtyExists.length > 0) {
    console.log('\n  ⚠️  PRESERVED (uncommitted work — review manually):');
    for (const r of dirtyExists) {
      const kind =
        r.trackedDirty > 0
          ? `${r.trackedDirty} tracked + ${r.dirtyCount - r.trackedDirty} untracked`
          : `${r.dirtyCount} untracked-only (likely build artifacts)`;
      console.log(`     ${r.path}  [${r.branch || 'detached'}]  — ${kind}`);
    }
  }

  console.log(
    `\n  📊 Registrations ${dryRun ? 'would be removed' : 'removed'}: ${removed}${
      failed ? `, failed: ${failed}` : ''
    }, preserved (dirty): ${dirtyExists.length}`,
  );

  return { removed, failed, preserved: dirtyExists.length };
}

function main() {
  const dryRun = process.argv.includes('--dry-run');
  console.log(`🧹 Starting worktree cleanup${dryRun ? ' (DRY RUN)' : ''}...\n`);

  // Equoria-6a4h5: clean stale worktree REGISTRATIONS first — this frees any
  // branches that were checked out in those worktrees so the branch pass below
  // can then delete the merged ones.
  cleanupWorktreeRegistrations(dryRun);

  // Get all worktree-agent-* branches
  const branches = listWorktreeBranches();

  if (branches.length === 0) {
    console.log('✅ No worktree-agent-* branches found. Nothing to clean up.');
    console.log('✅ Working tree is clean.');
    console.log('\n✅ Worktree cleanup completed!\n');
    return;
  }

  console.log(`📋 Found ${branches.length} worktree-agent-* branches total.\n`);

  let deletedCount = 0;
  let skippedCount = 0;

  for (const branch of branches) {
    process.stdout.write(`Checking ${branch}... `);

    if (validateBranchBeforeDeletion(branch)) {
      // Branch is safe to delete (all commits in origin/master)
      if (deleteBranch(branch)) {
        console.log('✅ deleted');
        deletedCount++;
      } else {
        // Failed to delete (likely still checked out in a worktree)
        console.log('⏭️  in use');
        skippedCount++;
      }
    } else {
      // Branch has commits not in master, keep it
      console.log('⏭️  has local commits');
      skippedCount++;
    }
  }

  console.log('\n📊 Cleanup summary:');
  console.log(`  - Deleted: ${deletedCount}`);
  console.log(`  - Skipped: ${skippedCount}`);

  // Verify cleanup was successful
  if (verifyCleanup()) {
    console.log('\n✅ Verification passed: no worktree-agent-* branches remain.\n');
  } else {
    const remaining = listWorktreeBranches();
    console.log(
      `\n⚠️  ${remaining.length} worktree-agent-* branches remain (${remaining.filter(b => !validateBranchBeforeDeletion(b)).length} with local commits, ${remaining.filter(b => validateBranchBeforeDeletion(b)).length} still checked out).\n`,
    );
  }

  // Verify working tree is clean
  if (verifyWorkingTree()) {
    console.log('✅ Working tree is clean.');
  } else {
    console.warn('⚠️  Working tree has uncommitted changes.');
  }

  console.log('\n✅ Worktree cleanup completed!\n');
}

// Equoria-5z0if: main-module guard. main() mutates git branch state — must NOT
// run on bare import (e.g. parse-check `node -e "import('./x.mjs')"`).
// Handle both absolute and relative paths for process.argv[1].
if (process.argv[1]) {
  const isAbsolute = process.argv[1].startsWith('/') || /^[A-Za-z]:/.test(process.argv[1]);
  const targetUrl = isAbsolute
    ? `file://${process.argv[1].replace(/\\/g, '/')}`
    : `file://${process.cwd()}/${process.argv[1]}`.replace(/\\/g, '/');

  if (
    import.meta.url === targetUrl ||
    import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))
  ) {
    main();
  }
}
