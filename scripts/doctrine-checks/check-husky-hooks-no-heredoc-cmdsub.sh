#!/usr/bin/env bash
# Doctrine: no heredoc-inside-command-substitution in .husky/ hooks.
#
# Source: Equoria-3hss / Equoria-wnsc. The wnsc bug was a `node - <<EOF ...
# EOF` heredoc wrapped in `$(...)` command substitution, where the heredoc
# body contained JS backtick template literals. Bash on Windows Git Bash 5.x
# mis-parses the backtick template as nested command substitution despite
# the single-quoted heredoc tag — and the inner parens of the template
# literal desync the outer `$(...)` parser. The result is a runtime syntax
# error AT THE END of the hook, after a 10-min Jest suite has already run.
#
# `bash -n` does NOT catch this class — the parse-only mode treats the
# pattern as syntactically valid; the bug only surfaces at execution time.
# So this check is a static lint for the anti-pattern itself: any line
# containing both `$(` and `<<` in a husky hook.
#
# Fix shape (when this check fires): move the inlined script to a regular
# file (e.g., scripts/preflight/<name>.mjs) and invoke it as a normal
# command. See scripts/preflight/db-probe.mjs for the canonical example.

set -uo pipefail

HOOKS_DIR=".husky"

[ -d "$HOOKS_DIR" ] || exit 0

# Match a line that opens command substitution `$(` AND opens a heredoc `<<`
# on the same line. Backtick command substitution (`` `cmd <<EOF` ``) is
# also a wnsc-class risk; matched separately.
PATTERN_DOLLAR_PAREN='\$\(.*<<'
PATTERN_BACKTICK='`[^`]*<<'

failures=0
err_log="$(mktemp)"
trap 'rm -f "$err_log"' EXIT

for hook in "$HOOKS_DIR"/*; do
  [ -f "$hook" ] || continue

  if grep -nE "$PATTERN_DOLLAR_PAREN" "$hook" >"$err_log" 2>/dev/null; then
    echo
    echo "Heredoc inside \$(...) command substitution found (wnsc-class anti-pattern): $hook"
    cat "$err_log"
    echo "  Fix: extract the inlined script to a regular file (e.g.,"
    echo "       scripts/preflight/<name>.mjs) and invoke it as a normal command."
    failures=$((failures + 1))
  fi

  if grep -nE "$PATTERN_BACKTICK" "$hook" >"$err_log" 2>/dev/null; then
    echo
    echo "Heredoc inside backtick command substitution (wnsc-class anti-pattern): $hook"
    cat "$err_log"
    echo "  Fix: extract the inlined script to a regular file."
    failures=$((failures + 1))
  fi
done

[ "$failures" -eq 0 ] && exit 0 || exit 1
