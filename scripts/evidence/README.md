# Executable evidence contracts

**Status:** Active CI format contract
**Owner:** Evidence Verification workflow
**Last verified:** 2026-08-19
**Load only when:** Editing `scripts/verify-evidence-files.mjs`, its workflow, or an existing evidence contract
**Do not load for:** Ordinary implementation, story planning, status tracking, or completion claims
**Live sources:** `scripts/verify-evidence-files.mjs` and `.github/workflows/evidence-verification.yml`
**Retire when:** The workflow and its final evidence contract are removed

The Evidence Verification workflow reruns the command in each evidence file
and fails if the output is missing a declared marker. This directory is an
executable input surface, not a story archive or a second issue tracker.

## Why this exists

The format is for a narrow class of durable checks whose behavior can silently
become vacuous. Each file contains one exact command and its expected markers;
CI reruns it on every pull request.

## File format

Each file lives at `scripts/evidence/<issue-id>.md`. It must contain:

- a `## Story` section with a one-line description;
- an `## Acceptance criteria` section;
- a `## Verification command` section containing exactly one fenced `bash`
  block that can run from the repository root;
- an `## Expected output markers` section whose `- ` list items must appear in
  combined stdout and stderr; and
- a `## Last verified` section with an ISO date and verifier identity.

An empty marker list means the command must exit zero but its output is not
matched.

### Optional runner directives

An optional `## Runner directives` section may contain:

- `runIn: skip` when CI cannot supply required infrastructure;
- `runIn: manual` for a check that cannot fit the CI runtime; or
- `timeout: <seconds>` to override the 60-second default.

## Runner behavior

`scripts/verify-evidence-files.mjs` returns:

- `0` when every evidence file verifies or follows its directive;
- `1` when expected output is missing;
- `2` when a file is malformed;
- `3` when a command times out; or
- `4` when the evidence directory cannot be read.

## Creation gate

Add a contract only when all of these are true:

- the check is a CI, security, or doctrine mechanism that can stay green while
  ceasing to test its stated property;
- no existing test or planted sentinel already proves the mechanism fires;
- the command is deterministic, self-contained, and normally completes in
  under 60 seconds; and
- the current owner explicitly wants a durable executable contract.

Ordinary features, test-suite fixes, implementation summaries, handoffs, and
completion claims do not get evidence files. Their live tests and current task
record are the evidence.
