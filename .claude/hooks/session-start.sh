#!/bin/bash
# .claude/hooks/session-start.sh
#
# Ensure the bd (beads issue tracker) CLI is available, then make sure the
# project is initialized. This runs on EVERY SessionStart, so it must be
# idempotent and quiet when bd is already present.
#
# History: this hook used to run `npm install -g @beads/bd` unconditionally
# on every session start. On Windows the global bd.exe is locked while the
# CLI is in use, so the reinstall failed with `EBUSY: resource busy or
# locked` and a wall of `npm error` output every single startup. The fix is
# to install only when bd is genuinely missing.

if command -v bd >/dev/null 2>&1; then
  # bd already on PATH — nothing to install. Don't touch the global install
  # (re-running `npm install -g` here is what triggered the EBUSY error).
  :
else
  echo "bd not found — installing beads issue tracker..."
  npm install -g @beads/bd
fi

# Initialize bd in the project (if not already initialized)
if [ ! -d .beads ] && command -v bd >/dev/null 2>&1; then
  bd init --quiet
fi

if command -v bd >/dev/null 2>&1; then
  echo "✓ bd is ready! Use 'bd ready' to see available work."
else
  echo "⚠ bd is not available. Install manually: npm install -g @beads/bd"
fi
