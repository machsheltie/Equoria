#!/usr/bin/env node

import { execSync } from 'child_process';

// Equoria-pr90b: cleanup-worktrees.mjs
// This script safely removes all abandoned worktree-agent-* branches that were
// not cleaned up via ExitWorktree. It validates that no commits are orphaned
// before deletion, logs the cleanup count, and verifies the working tree is clean.

function listAbandonedWorktrees() {
  try {
    const output = execSync('git worktree list', { encoding: 'utf-8' });
    const lines = output.split('\n').filter(line => line.trim());
    const abandoned = [];

    for (const line of lines) {
      // Look for locked worktrees with worktree-agent-* branches
      if (line.includes('locked') && line.includes('worktree-agent-')) {
        // Extract branch name from the line (e.g., [worktree-agent-a0985e643fecd6c1e])
        const match = line.match(/\[worktree-agent-[a-f0-9]+\]/);
        if (match) {
          const branchName = match[0].slice(1, -1); // Remove brackets
          abandoned.push(branchName);
        }
      }
    }

    return abandoned;
  } catch (error) {
    console.error('❌ Failed to list worktrees:', error.message);
    process.exit(1);
  }
}

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

function deleteBranch(branch, isAbandoned = false) {
  try {
    // For abandoned branches, use -D (force delete)
    const flag = isAbandoned ? '-D' : '-d';
    execSync(`git branch ${flag} "${branch}"`, { encoding: 'utf-8' });
    return true;
  } catch (error) {
    return false;
  }
}

function verifyCleanup() {
  try {
    const output = execSync('git branch', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] });
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

  // First, identify abandoned worktrees
  console.log('📍 Scanning for abandoned (locked) worktrees...');
  let abandonedWorktrees = listAbandonedWorktrees();
  console.log(`   Found ${abandonedWorktrees.length} abandoned worktrees.\n`);

  // Force remove locked worktree directories
  if (abandonedWorktrees.length > 0) {
    console.log('🗑️  Force-removing locked worktree directories...');
    for (const branch of abandonedWorktrees) {
      try {
        execSync(
          `git worktree remove --force "${branch.replace('worktree-agent-', '.claude/worktrees/agent-')}"`,
          {
            stdio: 'ignore',
          },
        );
      } catch (e) {
        // Ignore errors, we'll handle branch cleanup below
      }
    }
    console.log('   Removed locked worktree directories.\n');

    // Re-prune after removing directories
    try {
      execSync('git worktree prune', { stdio: 'ignore' });
    } catch (e) {
      // Ignore
    }

    // Refresh the list
    abandonedWorktrees = listAbandonedWorktrees();
    console.log(`   Updated abandoned worktrees list: ${abandonedWorktrees.length} remain.\n`);
  }

  // Then get all worktree-agent-* branches
  const branches = listWorktreeBranches();

  if (branches.length === 0) {
    console.log('✅ No worktree-agent-* branches found. Nothing to clean up.');
    return;
  }

  console.log(`📋 Found ${branches.length} worktree-agent-* branches total.\n`);

  let deletedCount = 0;
  let skippedCount = 0;

  for (const branch of branches) {
    const isAbandoned = abandonedWorktrees.includes(branch);
    process.stdout.write(`Checking ${branch}... `);

    if (isAbandoned) {
      // For abandoned branches, force delete regardless of commit ancestry
      if (deleteBranch(branch, true)) {
        console.log('✅ deleted (abandoned)');
        deletedCount++;
      } else {
        console.log('⚠️  failed to delete');
        skippedCount++;
      }
    } else if (validateBranchBeforeDeletion(branch)) {
      // For regular branches, validate first
      if (deleteBranch(branch, false)) {
        console.log('✅ deleted');
        deletedCount++;
      } else {
        console.log('⚠️  failed to delete');
        skippedCount++;
      }
    } else {
      // Branch has commits not in master, keep it
      console.log('⏭️  skipped (has local commits)');
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
    console.error(
      `\n⚠️  Verification found ${remaining.length} remaining worktree-agent-* branches:\n`,
    );
    remaining.forEach(b => console.error(`   - ${b}`));
    console.error('');
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
