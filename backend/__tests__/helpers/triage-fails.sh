#!/usr/bin/env bash
# 21R-SEC-3 follow-up: triage each failing security-suite test
# Captures one-line failure cause per suite for root-cause analysis
set -u
cd "$(dirname "$0")/../.." || exit 1

SUITES=(
  "__tests__/integration/crossSystemValidation.test.mjs"
  "__tests__/integration/redis-circuit-breaker.at.test.mjs"
  "__tests__/integration/redis-circuit-breaker.test.mjs"
  "__tests__/middleware/ownership.test.mjs"
  "__tests__/middleware/sessionManagement.test.mjs"
  "__tests__/unit/security/ownership-checks.test.mjs"
  "__tests__/unit/security/validate-environment.test.mjs"
  "__tests__/services/cronJobService.test.mjs"
  "modules/community/__tests__/clubController.test.mjs"
  "modules/community/__tests__/forumController.test.mjs"
  "modules/community/__tests__/messageController.test.mjs"
  "modules/competition/__tests__/conformationShowEntry.test.mjs"
  "modules/competition/__tests__/conformationShowExecution.test.mjs"
  "modules/competition/__tests__/conformationShowScoring.test.mjs"
  "modules/riders/__tests__/riderController.test.mjs"
  "modules/riders/__tests__/riderMarketplaceController.test.mjs"
  "modules/trainers/__tests__/trainerController.test.mjs"
)

for s in "${SUITES[@]}"; do
  echo ""
  echo "=========================================================="
  echo "SUITE: $s"
  echo "=========================================================="
  node --experimental-vm-modules node_modules/jest/bin/jest.js \
    --config=jest.config.security.mjs "$s" --no-coverage 2>&1 \
    | grep -E "Cannot find module|SyntaxError|TypeError|ReferenceError|expect\(|Expected:|Received:|✕|FAIL|PASS" \
    | head -10
done
