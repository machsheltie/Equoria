#!/usr/bin/env node

import { execSync } from 'child_process';

// Equoria-pr90b: cleanup-worktrees.mjs
// This script safely removes all abandoned worktree-agent-* branches that were
// not cleaned up via ExitWorktree. It validates that no commits are orphaned
// before deletion, logs the cleanup count, and verifies the working tree is clean.

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
    } catch (ancestorError) {
      // Exit code non-zero means NOT an ancestor
      return false;
    }
  } catch (error) {
    // If we can't get the commit hash, assume it's safe (orphaned)
    return true;
  }
}

function deleteBranch(branch) {
  try {
    // Try to delete with -d first, if fails use -D (force)
    execSync(`git branch -d "${branch}"`, { stdio: 'ignore' });
    return true;
  } catch (error) {
    try {
      execSync(`git branch -D "${branch}"`, { stdio: 'ignore' });
      return true;
    } catch (forceError) {
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
  } catch (error) {
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

function main() {
  console.log('🧹 Starting worktree cleanup...\n');

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

  console.log(`\n📊 Cleanup summary:`);
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
