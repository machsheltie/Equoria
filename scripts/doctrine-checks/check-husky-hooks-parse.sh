#!/usr/bin/env bash
# Doctrine: every regular file in .husky/ must parse cleanly with `bash -n`.
#
# Source: Equoria-3hss (sentinel for the Equoria-wnsc class). Equoria-wnsc
# was a heredoc-in-command-substitution syntax error in .husky/pre-push that
# only manifested at hook-execution time on Windows Git Bash, AFTER the full
# ~10-min backend Jest suite had already run. A static `bash -n` parse-check
# would have caught it in <1s. This check is that sentinel: any future
# regression of the same class (mismatched parens, unclosed heredoc, invalid
# substitution shape) trips the doctrine-gate before merge.

set -uo pipefail

HOOKS_DIR=".husky"

# Silently skip when no hooks dir exists (fresh clone before husky install,
# detached worktree, etc.). The check is purely about catching parse-time
# regressions in committed hooks; absence is not a violation.
[ -d "$HOOKS_DIR" ] || exit 0

failures=0
err_log="$(mktemp)"
trap 'rm -f "$err_log"' EXIT

for hook in "$HOOKS_DIR"/*; do
  # Husky ships a `.husky/_/` helper directory; only check regular files.
  [ -f "$hook" ] || continue

  if ! bash -n "$hook" 2>"$err_log"; then
    echo
    echo "Hook has shell syntax error: $hook"
    cat "$err_log"
    failures=$((failures + 1))
  fi
done

[ "$failures" -eq 0 ] && exit 0 || exit 1
