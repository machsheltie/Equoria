# ADR-010: Shared Beta-Readiness Static Scans

**Status:** Accepted (updated to current implementation)
**Date:** 2026-05-18
**Scope:** Doctrine scan definitions and CI/local consumer parity

## Load rule

Load this ADR only when changing beta-readiness static scan definitions, the shared scan library, a scan consumer, parity checks, or sentinel fixtures. Verify paths and behavior against the scripts themselves.

## Context

Beta readiness depends on repository-wide scans for prohibited production patterns. When CI, local verification, and package scripts carry independent inline copies of those patterns, they drift: one gate can pass while another checks a different rule set.

## Decision

Define scan behavior once and make every gate consume the shared definitions.

Current ownership:

- `scripts/lib/doctrine-scan-patterns.mjs` owns machine-readable scan patterns.
- `scripts/lib/beta-readiness-scans.sh` owns the reusable scan execution.
- Doctrine and CI entry points call the shared implementation rather than maintaining private inline copies.
- Parity and sentinel checks must fail when a consumer diverges or when known-bad fixtures stop being detected.

## Invariants

- A new prohibited pattern is added to the shared definition first, with a sentinel that demonstrates detection.
- Consumer-specific setup may differ, but the rule semantics may not.
- Exclusions must be narrow, explicit, and tested; generated output or documentation must not silently broaden source exclusions.
- A green local gate and a green CI gate must mean the same scan set ran.

## Consequences

The shared library becomes security- and doctrine-sensitive infrastructure. Changes require syntax validation plus the doctrine scan parity/sentinel checks. This ADR does not freeze implementation filenames forever; if ownership moves, update this record and every consumer together.
