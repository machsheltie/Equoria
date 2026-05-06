#!/usr/bin/env bash
#
# Equoria-ocy3 (B2): one-shot installer that wires `core.hooksPath` to
# the tracked `.husky/` directory and verifies the hooks are executable.
#
# Why this exists when `npm install` already runs `husky` via the root
# `prepare` script: in fresh worktrees, in CI, and on machines where a
# previous git config has set hooksPath to something else, the husky
# install can silently no-op. This script asserts the desired state.
#
# Idempotent: safe to re-run.

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"
if [ -z "$REPO_ROOT" ]; then
  echo "[setup-hooks] FATAL: not inside a git working tree" >&2
  exit 1
fi
cd "$REPO_ROOT"

if [ ! -d .husky ]; then
  echo "[setup-hooks] FATAL: .husky/ not found at repo root" >&2
  echo "[setup-hooks]   Run 'npm install' first (root package's prepare script" >&2
  echo "[setup-hooks]   creates the .husky/_/ helper directory)." >&2
  exit 1
fi

# Wire core.hooksPath to the tracked directory.
current="$(git config --get core.hooksPath 2>/dev/null || echo '')"
if [ "$current" = ".husky" ]; then
  printf '[setup-hooks] core.hooksPath already set to .husky\n'
else
  git config core.hooksPath .husky
  printf '[setup-hooks] core.hooksPath set to .husky (was: %s)\n' "${current:-<unset>}"
fi

# Make sure tracked hooks are executable. Git tracks the +x bit, but a
# fresh clone on Windows or via a non-default umask can still drop it.
for hook in pre-commit pre-push; do
  path=".husky/$hook"
  if [ -f "$path" ] && [ ! -x "$path" ]; then
    chmod +x "$path"
    printf '[setup-hooks] %s made executable\n' "$path"
  fi
done

printf '[setup-hooks] Done. Run a test push (--dry-run) to verify the hooks fire.\n'
