#!/usr/bin/env bash
# Run all doctrine checks. Exit non-zero if any fail.
# Aggregates failures so you see every violation, not just the first.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

failures=0
ran=0

for script in "$SCRIPT_DIR"/check-*.sh "$SCRIPT_DIR"/check-*.mjs; do
  [ -e "$script" ] || continue
  ran=$((ran + 1))
  name="$(basename "$script")"
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
  echo "✓ All $ran doctrine checks passed"
  exit 0
else
  echo "✗ $failures of $ran doctrine checks failed"
  exit 1
fi
