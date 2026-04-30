# Evidence files

Equoria-ptf7 (B4) — re-runnable verification for completed stories.

Per `COMPLETION_VERIFICATION_POLICY.md`, every story moved to `done` in a PR
should have an evidence file in this directory. The CI workflow
`evidence-verification.yml` re-runs the verification command from each
file on every PR and fails the build if the actual output is missing
any of the declared expected-output markers.

## Why this exists

The 21R audit found 4 of 6 stories falsely marked done in
`sprint-status.yaml` — the work hadn't been verified against the
acceptance criteria, but the status update happened anyway. Pasting
verification evidence into the PR description (the B3 mechanism) is one
half; this file format is the other half. Each evidence file contains
the exact command + expected output, and CI re-runs the command on
every PR. If a future change silently breaks the verified behaviour, the
evidence file's marker fails to appear in the new output, and the PR
is blocked.

## File format

Each file lives at `_bmad-output/test-artifacts/evidence/<story-id>.md`
where `<story-id>` is the bd issue identifier (e.g., `Equoria-veql`,
`Equoria-w45l`). The file MUST contain:

- A **`## Story`** section with a one-line description of what was
  shipped.
- An **`## Acceptance criteria`** section listing the AC items the
  command verifies.
- A **`## Verification command`** section containing exactly one
  fenced bash code block. The command must be self-contained and
  re-runnable from the repository root with no arguments. Commands
  that take more than 60 seconds will time out by default; use
  `runIn: manual` (see below) if a long-running command is the only
  way to verify.
- An **`## Expected output markers`** section listing one or more
  literal substrings that MUST appear in the command's combined
  stdout+stderr output. List items use the standard `- ` markdown
  bullet syntax. Empty marker list means "command must exit 0; output
  is not asserted on".
- An **`## Last verified`** section with an ISO date and the verifier
  identity.

### Optional metadata

Add a `## Runner directives` section with one or more of:

- `runIn: skip` — verifier reads the file but does not execute the
  command. Use for evidence that depends on infra not present in CI
  (e.g., requires a production database).
- `runIn: manual` — verifier prints a "must be re-run manually" notice
  and does not execute. Use for very-long commands.
- `timeout: <seconds>` — override the default 60-second timeout.

## Worked example

See `Equoria-veql.md` in this directory.

## What the runner does

`scripts/verify-evidence-files.mjs` walks this directory, parses each
`*.md` file, executes its verification command (subject to the
`runIn:` directive), and checks that every marker substring appears in
the captured output. Exit codes:

- `0` — all evidence files verified or skipped per directive.
- `1` — one or more evidence files have output that no longer matches
  the expected markers. Output the actual command output for each
  failing file, then exits.
- `2` — one or more evidence files are malformed (missing required
  section, multiple bash blocks, etc.).
- `3` — one or more evidence files timed out.

## When to add an evidence file

- The story is non-trivial (more than a one-line typo fix) AND
- The verification command runs in under 60 seconds AND
- The check would silently regress without anyone noticing (security
  gates, doctrine scans, governance rules).

A test-suite-only fix doesn't need an evidence file; the test itself is
the evidence. A CI-gate, doctrine-rule, or workflow change SHOULD have
an evidence file because the gate's behaviour is what's being asserted,
and the assertion needs to be re-run as part of the codebase's living
contract.
