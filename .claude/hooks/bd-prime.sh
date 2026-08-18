#!/bin/bash
# .claude/hooks/bd-prime.sh
#
# Wrapper for the `bd prime` SessionStart/PreCompact hooks. Running the raw
# `bd prime` command dumps a full Node stack trace ("Error: spawn UNKNOWN")
# on every session start while bd.exe cannot execute: the npm wrapper
# (@beads/bd/bin/bd.js) spawns an unsigned native bd.exe, which Windows
# Smart App Control refuses (observed 2026-08-18, "An Application Control
# policy has blocked this file"). This wrapper passes through the real
# `bd prime` output when bd works, and collapses the failure into one
# honest line when it doesn't — no stack-trace wall, no false green.

out=$(bd prime 2>&1)
status=$?
if [ $status -eq 0 ]; then
  printf '%s\n' "$out"
else
  echo "⚠ bd prime unavailable — bd.exe cannot execute (Windows Smart App Control blocks the unsigned binary). bd CLI is down until the block is resolved."
fi
exit 0
