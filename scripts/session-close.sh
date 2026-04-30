#!/usr/bin/env bash
#
# Equoria-urtx (B6): session-close protocol script.
#
# Codifies the prose checklist that lives in the bd SessionStart context
# (the "🚨 SESSION CLOSE PROTOCOL 🚨" block injected at every session
# start). Wired to the Claude Code SessionEnd hook in
# `.claude/settings.json` so Claude — and the human driving Claude — see
# a loud failure if the session is ending in a state that contradicts
# the protocol.
#
# What this checks:
#
#   1. git working-tree is clean for tracked code paths (no uncommitted
#      .mjs / .ts / .tsx / .yml / .json edits hiding from the next
#      session). Submodule pointer changes and the `.beads/` index are
#      ignored — those are normal in-flight signals, not lost work.
#
#   2. bd state has been synced from main. We don't auto-pull (that
#      can produce merge conflicts during a session); we just check
#      `bd sync --status` and warn if drift is reported.
#
#   3. The doctrine-gate (`scripts/doctrine-checks/run-all.sh`) passes.
#      Any doctrine failure means the codebase is closing the session
#      with a known violation in place, which is exactly what the
#      protocol exists to surface.
#
#   4. (Informational only — does not block) the local commit count
#      ahead of `origin/<current-branch>`. A high count is a signal that
#      the session ended without pushing; not always a defect (the
#      Equoria standard pattern is local merge to master), but worth
#      surfacing.
#
# Modes:
#
#   STRICT (default, when run from the SessionEnd hook):
#     - Exit non-zero on git-dirty OR doctrine-gate failure.
#     - bd sync drift is reported but does not flip exit code (sync is
#       advisory).
#
#   --warn (CLI flag):
#     - Run all checks, report all results, ALWAYS exit 0.
#     - Useful when running manually as a status report, or during the
#       transition period while the doctrine-gate baseline is still
#       being cleaned by Equoria-5nqe (B1).
#
# Exit codes:
#   0  all required checks passed (or --warn used)
#   1  one or more required checks failed
#

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

WARN_ONLY=0
for arg in "$@"; do
  case "$arg" in
    --warn) WARN_ONLY=1 ;;
    -h|--help)
      sed -n '2,/^$/p' "$0" | sed 's/^# \?//'
      exit 0
      ;;
  esac
done

failures=0

bold() { printf '\033[1m%s\033[0m\n' "$1"; }
ok()   { printf '  \033[32m✓\033[0m %s\n' "$1"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$1"; }
bad()  { printf '  \033[31m✗\033[0m %s\n' "$1"; }

bold '── Session Close Protocol ──────────────────────────────────────────'

# ── Check 1: git working tree clean for tracked code paths ───────────
bold 'Check 1: working tree clean for tracked code'
# Strip `?? ` (untracked) and ` m ` (submodule content drift) lines —
# those are not "lost work" in the protocol sense. The `.beads/` dir
# is also excluded: bd writes to issues.jsonl during normal operation,
# and treating those writes as "uncommitted code" would make this
# check fire on every session that touched bd at all.
dirty_code="$(git status --porcelain 2>/dev/null \
  | grep -E '^\s?[MA]\s' \
  | grep -E '\.(mjs|ts|tsx|js|jsx|json|yml|yaml|prisma|md)$' \
  | grep -v -E '^\s?[MA]\s+\.beads/' \
  || true)"
if [ -z "$dirty_code" ]; then
  ok 'no uncommitted code changes'
else
  total="$(printf '%s\n' "$dirty_code" | wc -l)"
  bad "uncommitted code changes ($total file(s)):"
  # Cap output at 20 lines so a parallel-agent flood doesn't overwhelm
  # the SessionEnd terminal output. Full list is always available via
  # `git status` directly.
  printf '%s\n' "$dirty_code" | head -20 | sed 's/^/      /'
  if [ "$total" -gt 20 ]; then
    printf '      ... and %d more (run `git status` for the full list)\n' "$((total - 20))"
  fi
  failures=$((failures + 1))
fi

# ── Check 2: bd sync status ──────────────────────────────────────────
bold 'Check 2: bd sync status'
if command -v bd >/dev/null 2>&1; then
  sync_out="$(bd sync --status 2>&1 || true)"
  if echo "$sync_out" | grep -qiE 'in sync|nothing to sync|up to date'; then
    ok 'bd is in sync'
  else
    warn 'bd sync drift (advisory — does not block):'
    printf '%s\n' "$sync_out" | sed 's/^/      /'
  fi
else
  warn 'bd CLI not found; skipping sync check'
fi

# ── Check 3: doctrine-gate ───────────────────────────────────────────
bold 'Check 3: doctrine-gate'
if [ -x scripts/doctrine-checks/run-all.sh ]; then
  if bash scripts/doctrine-checks/run-all.sh > /tmp/.session-close-doctrine.log 2>&1; then
    ok 'doctrine-gate passed'
  else
    bad 'doctrine-gate failed (last 10 lines below):'
    tail -10 /tmp/.session-close-doctrine.log | sed 's/^/      /'
    failures=$((failures + 1))
  fi
  rm -f /tmp/.session-close-doctrine.log
else
  warn 'scripts/doctrine-checks/run-all.sh not executable; skipping'
fi

# ── Check 4 (informational): commits ahead of origin ─────────────────
bold 'Check 4: local commits ahead of origin (informational)'
branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '')"
if [ -n "$branch" ] && git rev-parse --verify "origin/$branch" >/dev/null 2>&1; then
  ahead="$(git rev-list --count "origin/$branch..HEAD" 2>/dev/null || echo 0)"
  if [ "$ahead" -eq 0 ]; then
    ok "branch $branch is in sync with origin"
  else
    warn "branch $branch is $ahead commit(s) ahead of origin (push or merge to integrate)"
  fi
else
  warn "no upstream tracking for current branch (Equoria standard pattern)"
fi

echo
bold '── Summary ─────────────────────────────────────────────────────────'
if [ "$failures" -eq 0 ]; then
  ok 'all required session-close checks passed'
  exit 0
fi

bad "$failures required check(s) failed"
if [ "$WARN_ONLY" -eq 1 ]; then
  warn '(--warn mode: returning exit 0 anyway)'
  exit 0
fi
echo
echo '  Re-run with --warn to see all results without exiting non-zero.'
echo '  This script is wired to .claude/settings.json SessionEnd, so the'
echo '  failure surfaces every time the session ends until the underlying'
echo '  state is cleaned up.'
exit 1
