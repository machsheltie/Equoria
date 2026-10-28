#!/usr/bin/env bash
# Run all doctrine checks. Exit non-zero if any fail.
# Aggregates failures so you see every violation, not just the first.
#
# --fast (used by .husky/pre-push, Equoria-zstml): skips only the checks named
# in FAST_SKIP below, each because the pre-push hook runs a proportionate
# replacement on the changed files and the Doctrine Gate on GitHub still runs
# the full check on every push to master and every PR. Each skip is printed.
# Without --fast (CI, manual runs) every check runs.
#
#   check-backend-lint-and-format.mjs — whole-tree eslint + prettier for backend
#     and frontend (~1.6 GB, 1-3 min). Pre-push lints the changed files instead
#     (scripts/preflight/changed-checks.mjs).

set -uo pipefail

FAST=0
for arg in "$@"; do
  case "$arg" in
    --fast) FAST=1 ;;
    *)
      echo "run-all.sh: unknown argument: $arg (only --fast is accepted)" >&2
      exit 2
      ;;
  esac
done
FAST_SKIP=' check-backend-lint-and-format.mjs '
skipped=0

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

failures=0
ran=0

for script in "$SCRIPT_DIR"/check-*.sh "$SCRIPT_DIR"/check-*.mjs; do
  [ -e "$script" ] || continue
  name="$(basename "$script")"
  if [ "$FAST" -eq 1 ] && [ "${FAST_SKIP#* $name }" != "$FAST_SKIP" ]; then
    printf '── %s SKIPPED (--fast: pre-push lints the changed files; the Doctrine Gate runs it in full)\n' "$name"
    skipped=$((skipped + 1))
    continue
  fi
  ran=$((ran + 1))
  printf '── %s ' "$name"

  case "$script" in
    *.sh)  bash "$script" ;;
    *.mjs) node "$script" ;;
  esac

  rc=$?
  if [ $rc -eq 0 ]; then
    printf 'OK\n'
  else
    printf 'FAIL (exit %d)\n' "$rc"
    failures=$((failures + 1))
  fi
done

echo
if [ $failures -eq 0 ]; then
  echo "✓ All $ran doctrine checks passed ($skipped skipped by --fast)"
  exit 0
else
  echo "✗ $failures of $ran doctrine checks failed"
  exit 1
fi
