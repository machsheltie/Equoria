#!/bin/bash

# Equoria-c14yx: verify-session-close.sh
# Validates that a session has properly closed per CLAUDE.md Session close checklist.
# This script ensures:
# - git status is clean (no uncommitted changes)
# - current branch is master
# - no worktrees are checked out
# - no local branches exist that are not in origin (no stale local tracking)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$SCRIPT_DIR"

echo "🔍 Verifying session-close state..."
echo ""

EXIT_CODE=0

# 1. Check git status
echo "✓ Checking working tree..."
if ! git status --porcelain | grep -q . ; then
  echo "  ✅ Working tree is clean"
else
  echo "  ❌ Working tree has uncommitted changes:"
  git status --porcelain | sed 's/^/     /'
  EXIT_CODE=1
fi
echo ""

# 2. Check current branch is master
echo "✓ Checking current branch..."
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" = "master" ]; then
  echo "  ✅ On master branch"
else
  echo "  ❌ Not on master branch (current: $CURRENT_BRANCH)"
  EXIT_CODE=1
fi
echo ""

# 3. Check for worktrees
echo "✓ Checking for worktrees..."
WORKTREE_COUNT=$(git worktree list --porcelain | wc -l)
if [ "$WORKTREE_COUNT" -le 1 ]; then
  # Only the main worktree should exist
  echo "  ✅ No active worktrees"
else
  echo "  ❌ Found $(( WORKTREE_COUNT - 1 )) active worktree(s):"
  git worktree list | grep -v "^$(pwd)" | sed 's/^/     /' || true
  EXIT_CODE=1
fi
echo ""

# 4. Check for stale local branches
echo "✓ Checking for stale branches..."
# Find branches that are local but not in origin
# Exception: master is expected to be local
STALE_BRANCHES=$(git branch -vv | grep -v origin | grep -v master | awk '{print $1}' | sort || true)

if [ -z "$STALE_BRANCHES" ]; then
  echo "  ✅ No stale local branches"
else
  # This is a warning, not an error, since stale branches might be intentional
  # (e.g., commits not yet pushed, legitimate feature branches)
  STALE_COUNT=$(echo "$STALE_BRANCHES" | wc -l)
  echo "  ⚠️  Found $STALE_COUNT local branch(es) not tracking origin:"
  echo "$STALE_BRANCHES" | sed 's/^/     /'
fi
echo ""

# Final status
if [ "$EXIT_CODE" -eq 0 ]; then
  echo "✅ Session close verification PASSED"
  echo ""
  echo "Summary:"
  echo "  • Working tree is clean"
  echo "  • On master branch"
  echo "  • No active worktrees"
  echo "  • No critical issues detected"
  echo ""
  echo "Ready to exit session."
else
  echo "❌ Session close verification FAILED"
  echo ""
  echo "Issues detected:"
  echo "  • Check git status for uncommitted changes"
  echo "  • Switch to master branch (git checkout master)"
  echo "  • Clean up worktrees (ExitWorktree or rm -rf)"
  echo ""
  echo "CLAUDE.md Session close checklist (required before exit):"
  echo "  1. git pull --rebase origin master"
  echo "  2. bd push (push any changes)"
  echo "  3. git push origin master (--no-verify per exception)"
  echo "  4. git status (verify clean)"
  echo "  5. bash scripts/verify-session-close.sh (this script)"
fi

echo ""
exit "$EXIT_CODE"
