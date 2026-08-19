#!/usr/bin/env node

/**
 * Compatibility shim for the retired Markdown/YAML sprint-prerequisite system.
 *
 * Current work state and dependencies live in bd. The former
 * docs/sprint-artifacts/sprint-status.yaml and retrospective/action-item gates
 * were archived on 2026-08-19 because they were stale parallel project state.
 */

console.error(
  'The legacy sprint prerequisite tracker has been retired. ' +
    'Inspect the current issue and its dependencies with bd; archived sprint ' +
    'Markdown/YAML is historical evidence only.'
);
process.exit(1);
