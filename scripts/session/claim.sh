#!/usr/bin/env sh
#
# Equoria-9ai5g — session-start entry point for the shared-working-tree guard.
#
# Run this once when a session starts working in a checkout:
#
#   bash scripts/session/claim.sh
#
# It claims the checkout for this session and, if another LIVE session already
# holds it, says so with the claim's age and tells you to use a worktree. It
# always exits 0: a session start must never be blocked by a warning, and the
# refusals live in the commit and push hooks where the damage would occur.
#
# To run it automatically, add a SessionStart hook to .claude/settings.json
# alongside the existing ones (this file deliberately does not edit settings):
#
#   {
#     "hooks": [
#       { "command": "bash \"$CLAUDE_PROJECT_DIR\"/scripts/session/claim.sh",
#         "type": "command" }
#     ]
#   }
#
# See scripts/session/session-guard.sh for the detector itself.

exec sh "$(dirname "$0")/session-guard.sh" claim
