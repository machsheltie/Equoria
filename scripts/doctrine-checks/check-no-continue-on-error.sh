#!/usr/bin/env bash
# Doctrine: forbid `continue-on-error: true` on security, coverage, audit,
# gate, doctrine, or beta-readiness steps.
# Source: CLAUDE.md "EDGE_CASE_FIX_DISCIPLINE.md §2 No gate weakening"
#         and 21R "No bypass evidence" doctrine.
#
# Per-line exemption marker (for steps that are genuinely informational and
# do not gate readiness):
#   continue-on-error: true # doctrine-allow: continue-on-error-informational
# The marker must appear on the same line.

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

MARKER='doctrine-allow: continue-on-error-informational'

# Find every `continue-on-error: true` in workflow YAML, excluding the marker.
# Skip markdown checklist lines (`- [x]` or `- [ ]`) which appear in PR-body
# templates and reference the literal as documentation.
# Skip YAML comment lines (lines whose first non-whitespace char is `#`) that
# may quote the literal string for documentation purposes inside step bodies.
matches=$(grep -rn "continue-on-error:[[:space:]]*true" .github/workflows/ 2>/dev/null \
  | grep -v -F "$MARKER" \
  | grep -v -E ':[[:space:]]*-[[:space:]]*\[[ x]\]' \
  | grep -v -E ':[[:space:]]*#' || true)

if [ -z "$matches" ]; then
  exit 0
fi

# Filter to suspicious contexts: lines whose surrounding step/job name contains
# any of: audit, security, coverage, gate, doctrine, beta-readiness.
violations=""
while IFS= read -r line; do
  [ -z "$line" ] && continue
  file="${line%%:*}"
  rest="${line#*:}"
  lineno="${rest%%:*}"

  # Look back up to 8 lines for a `name:` or `id:` describing the step,
  # and the parent job name.
  preceding=$(sed -n "$(( lineno > 8 ? lineno - 8 : 1 )),${lineno}p" "$file" 2>/dev/null || true)

  if echo "$preceding" | grep -qiE 'audit|security|coverage|gate|doctrine|beta-readiness|sast|zap|sarif|codeql|snyk|trivy'; then
    violations="${violations}${line}"$'\n'
  fi
done <<< "$matches"

if [ -n "$violations" ]; then
  echo
  echo "continue-on-error: true on security/coverage/gate steps (forbidden by doctrine):"
  echo "$violations"
  echo "If a step is genuinely informational, append:"
  echo "    # $MARKER"
  exit 1
fi

exit 0
