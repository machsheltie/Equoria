#!/usr/bin/env bash
# Doctrine: every npm audit step in workflows must run at --audit-level=moderate
# or stricter (low). high or critical only is too permissive — it ignores
# moderate-severity advisories that the project has historically blocked on.
#
# If you must raise the threshold, add an explicit exemption with reason in
# scripts/doctrine-checks/audit-level-exemptions.txt and reference an issue.

set -uo pipefail

violations=$(
  grep -rn 'npm audit' .github/workflows/ 2>/dev/null \
    | grep -v '^Binary' \
    | grep -- '--audit-level=' \
    | grep -E -- '--audit-level=(high|critical)' \
    || true
)

if [ -n "$violations" ]; then
  echo
  echo "npm audit steps with weak threshold (must be moderate or low):"
  echo "$violations"
  exit 1
fi

exit 0
