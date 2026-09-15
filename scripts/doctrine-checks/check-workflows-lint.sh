#!/usr/bin/env bash
# Doctrine: every file in .github/workflows/ must pass actionlint.
#
# Source: Equoria-axyem.6. Equoria-axyem exists because a workflow edit
# (a `verify_migration.js` step referencing a file that had been deleted)
# sat broken on master for 18 days. A workflow change produces NO local
# signal today: it is not compiled, not imported, not covered by any test,
# and the only place it executes is the default branch. This check is the
# static half of closing that hole — a syntactically broken workflow, an
# unknown key, a malformed `${{ }}` expression, an unpinned/unknown action
# input, or a bad `needs:`/`runs-on:` reference fails the local pre-push
# gate before it can reach master.
#
# ─────────────────────────────────────────────────────────────────────────
# INSTALLING actionlint (REQUIRED — this check fails loudly without it)
# ─────────────────────────────────────────────────────────────────────────
# Pinned floor: see ACTIONLINT_PINNED_VERSION below. Newer is accepted;
# older is rejected, because older actionlint releases do not know the
# newer action/runner metadata this repository's workflows rely on.
#
#   Windows (Git Bash — the primary developer environment):
#     winget install rhysd.actionlint
#     scoop install actionlint
#
#   macOS:        brew install actionlint
#   Any platform: go install github.com/rhysd/actionlint/cmd/actionlint@v1.7.12
#
# No package manager? Put the release binary in the PER-USER cache below.
# It lives OUTSIDE the repository on purpose: the repository root is a
# closed enumeration in docs/REPOSITORY_MAP.md, and this check is not
# entitled to add a root directory to it.
#
#   Windows:  %LOCALAPPDATA%\equoria\actionlint\<version>\actionlint.exe
#   POSIX:    ${XDG_CACHE_HOME:-$HOME/.cache}/equoria/actionlint/<version>/actionlint
#
#   e.g. on Windows Git Bash:
#     DEST="$LOCALAPPDATA/equoria/actionlint/1.7.12"
#     mkdir -p "$DEST" && cd "$DEST"
#     curl -sSL -o al.zip \
#       https://github.com/rhysd/actionlint/releases/download/v1.7.12/actionlint_1.7.12_windows_amd64.zip
#     unzip -oj al.zip actionlint.exe && rm al.zip
#
# Resolution order: $ACTIONLINT -> actionlint on PATH -> the per-user cache.
#
# ─────────────────────────────────────────────────────────────────────────
# WHAT THIS CHECK DOES NOT COVER (stated, not hidden)
# ─────────────────────────────────────────────────────────────────────────
# actionlint can shell out to `shellcheck` and `pyflakes` to lint the bodies
# of `run:` steps. Both integrations are DISABLED here, pending triage:
#
#   1. Determinism. Whether they run depends on whether those two unrelated
#      binaries happen to be installed. ubuntu-latest ships shellcheck;
#      Windows Git Bash does not. A gate whose verdict depends on the host's
#      incidental tooling is not a gate.
#   2. SC1083 is a structural false positive against GitHub Actions: every
#      `${{ ... }}` expression in a `run:` block reads to shellcheck as a
#      literal brace. There is no per-expression fix.
#
# Measured with shellcheck 0.11.0 on the tree at the time of writing: 69
# findings — 50x SC2086 (unquoted expansion), 7x SC2129 (redirect grouping),
# 6x SC1083 (the `${{ }}` false positive), 3x SC2034 (unused variable),
# and one each of SC2059, SC2046, SC2044.
#
# Do NOT read that list as "all cosmetic". SC2086, SC2046 and SC2044 are
# correctness-capable — unquoted expansion and word-splitting over `find`
# output are real bug classes, and 52 of the 69 findings fall in them. What
# can honestly be said is narrower: none of them is the class Equoria-axyem
# was about (a step referencing a deleted file), and NONE OF THEM HAS BEEN
# TRIAGED. Enabling the integration means pinning shellcheck as a second
# required tool on every developer machine and CI job, triaging all 69, and
# finding a way to suppress the SC1083 class. That is its own bead, not this
# check's scope. Until that bead is done, shell-script correctness inside
# `run:` bodies is an OPEN, UNTRIAGED GAP of this check.
#
# actionlint's own workflow/expression/action checks all run at full
# strength. There is no allowlist, no baseline file, and no `-ignore` regex.
# If actionlint reports something, fix the workflow.

set -uo pipefail

ACTIONLINT_PINNED_VERSION='1.7.12'

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

WORKFLOWS_DIR='.github/workflows'

install_instructions() {
  cat >&2 <<INSTALL
actionlint (>= $ACTIONLINT_PINNED_VERSION) is REQUIRED by this doctrine check.

This check does not pass when its linter is missing. A workflow gate that
skips itself when the tool is absent is exactly the silent-skip failure
Equoria-axyem exists to remove.

Install one of these ways:

  Windows (Git Bash):  winget install rhysd.actionlint
                       scoop install actionlint
  macOS:               brew install actionlint
  Any platform (Go):   go install github.com/rhysd/actionlint/cmd/actionlint@v$ACTIONLINT_PINNED_VERSION

  Or put the release binary in the per-user cache (OUTSIDE the repository):
    Windows: %LOCALAPPDATA%\\equoria\\actionlint\\$ACTIONLINT_PINNED_VERSION\\actionlint.exe
    POSIX:   \${XDG_CACHE_HOME:-\$HOME/.cache}/equoria/actionlint/$ACTIONLINT_PINNED_VERSION/actionlint
    Releases: https://github.com/rhysd/actionlint/releases/tag/v$ACTIONLINT_PINNED_VERSION

Resolution order: \$ACTIONLINT -> actionlint on PATH -> the per-user cache.
Full procedure: docs/devops-cicd.md, "Verifying a workflow change before it
reaches master".
INSTALL
}

# ── The subject must exist ──────────────────────────────────────────────
# A repository with no workflows is NOT a pass. Equoria has workflows; if
# this directory is gone or empty, something deleted or moved the CI
# pipeline, or the check is running from the wrong root. Reporting OK in
# that state is the exact signal-free outcome this check exists to prevent
# (Equoria-axyem.6 review M1).
if [ ! -d "$WORKFLOWS_DIR" ]; then
  echo >&2
  echo "$WORKFLOWS_DIR does not exist." >&2
  echo "This repository's CI lives there. A missing workflows directory is a" >&2
  echo "failure, not a pass: it means the pipeline was deleted or moved, or" >&2
  echo "this check is running from the wrong root (cwd: $REPO_ROOT)." >&2
  exit 1
fi

workflow_count=$(find "$WORKFLOWS_DIR" -maxdepth 1 -type f \( -name '*.yml' -o -name '*.yaml' \) 2>/dev/null | wc -l | tr -d '[:space:]')
if [ "${workflow_count:-0}" -eq 0 ]; then
  echo >&2
  echo "$WORKFLOWS_DIR contains no .yml/.yaml files." >&2
  echo "actionlint would exit 0 with nothing to lint. That is a vacuous pass," >&2
  echo "so this check fails instead. Restore the workflows or fix the root." >&2
  exit 1
fi

# ── Per-user cache location (outside the repository; see header) ────────
if [ -n "${LOCALAPPDATA:-}" ]; then
  CACHE_ROOT="$LOCALAPPDATA/equoria/actionlint"
else
  CACHE_ROOT="${XDG_CACHE_HOME:-$HOME/.cache}/equoria/actionlint"
fi

# ── Resolve the binary ──────────────────────────────────────────────────
BIN=''
if [ -n "${ACTIONLINT:-}" ]; then
  if [ ! -x "$ACTIONLINT" ] && ! command -v "$ACTIONLINT" >/dev/null 2>&1; then
    echo >&2
    echo "ACTIONLINT is set to '$ACTIONLINT' but that is not an executable." >&2
    install_instructions
    exit 1
  fi
  BIN="$ACTIONLINT"
elif command -v actionlint >/dev/null 2>&1; then
  BIN='actionlint'
else
  # Newest cached version first, so an upgraded cache wins without edits.
  while IFS= read -r candidate; do
    [ -n "$candidate" ] || continue
    if [ -x "$CACHE_ROOT/$candidate/actionlint.exe" ]; then
      BIN="$CACHE_ROOT/$candidate/actionlint.exe"
      break
    elif [ -x "$CACHE_ROOT/$candidate/actionlint" ]; then
      BIN="$CACHE_ROOT/$candidate/actionlint"
      break
    fi
  done <<< "$(ls -1 "$CACHE_ROOT" 2>/dev/null | sort -Vr)"
fi

if [ -z "$BIN" ]; then
  echo >&2
  echo "actionlint not found (\$ACTIONLINT, PATH, and $CACHE_ROOT all checked)." >&2
  install_instructions
  exit 1
fi

# ── Enforce the pinned floor ────────────────────────────────────────────
# `actionlint --version` prints the bare version on line 1 today, but a
# distro build, a `go install` from a branch, or a wrapper may print
# `v1.7.0`, `actionlint 1.7.0`, `(devel)`, or nothing useful. Extract the
# first X.Y.Z and REFUSE anything that cannot be parsed — an unparseable
# version must never be treated as "new enough".
version_output="$("$BIN" --version 2>/dev/null | tr -d '\r')"
found_version="$(printf '%s' "$version_output" | grep -Eo '[0-9]+\.[0-9]+\.[0-9]+' | head -1)"

if [ -z "$found_version" ]; then
  echo >&2
  echo "Could not parse an X.Y.Z version from '$BIN --version'." >&2
  echo "Raw output was:" >&2
  if [ -z "$version_output" ]; then
    echo "  (empty)" >&2
  else
    printf '  %s\n' "$version_output" >&2
  fi
  echo "An unparseable version is rejected, not assumed current." >&2
  install_instructions
  exit 1
fi

# Numeric, field-by-field comparison. Deliberately NOT `sort -V` on the raw
# strings: a prefixed or decorated string ('v1.7.0', 'actionlint 1.7.0')
# sorts ahead of the bare pinned string and would silently accept a STALE
# binary (Equoria-axyem.6 review I1).
IFS='.' read -r f_major f_minor f_patch <<< "$found_version"
IFS='.' read -r p_major p_minor p_patch <<< "$ACTIONLINT_PINNED_VERSION"

too_old=0
if [ "$f_major" -lt "$p_major" ]; then
  too_old=1
elif [ "$f_major" -eq "$p_major" ]; then
  if [ "$f_minor" -lt "$p_minor" ]; then
    too_old=1
  elif [ "$f_minor" -eq "$p_minor" ] && [ "$f_patch" -lt "$p_patch" ]; then
    too_old=1
  fi
fi

if [ "$too_old" -eq 1 ]; then
  echo >&2
  echo "actionlint $found_version is older than the pinned floor $ACTIONLINT_PINNED_VERSION." >&2
  echo "Resolved binary: $BIN" >&2
  install_instructions
  exit 1
fi

# ── Lint ────────────────────────────────────────────────────────────────
# -shellcheck= / -pyflakes= disable the external integrations (see header).
# -oneline keeps failures greppable; -no-color keeps CI logs readable.
output="$("$BIN" -no-color -oneline -shellcheck= -pyflakes= 2>&1)"
rc=$?

if [ $rc -eq 0 ]; then
  exit 0
fi

echo
echo "actionlint found problems in $WORKFLOWS_DIR (actionlint $found_version):"
echo "$output"
echo
echo "Checks reference: https://github.com/rhysd/actionlint/blob/v$ACTIONLINT_PINNED_VERSION/docs/checks.md"
exit 1
