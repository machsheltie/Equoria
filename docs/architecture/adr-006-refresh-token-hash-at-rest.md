# ADR-006: Hash Bearer Tokens at Rest with SHA-256

**Status:** Accepted
**Date:** 2026-04-23
**Scope:** Refresh-token and email-verification-token persistence

## Load rule

Load this ADR only when changing refresh-token or email-verification-token persistence, schema, migration, issuance, lookup, revocation, or cleanup. Verify field names and call paths against the Prisma schema and live token services.

## Context

A raw refresh or verification token recovered through read-only database access is immediately usable as a bearer credential. These tokens are generated with high cryptographic entropy, so they do not need the slow password-hashing treatment required for human-chosen secrets.

## Decision

Persist only the lowercase SHA-256 digest of each raw token.

Current invariants:

- Raw tokens exist only at the application boundary where they are issued or received.
- Services hash the raw value before every persistence lookup or write.
- `RefreshToken.tokenHash` and `EmailVerificationToken.tokenHash` are unique 64-character digest fields; no raw-token column is allowed.
- Logs, errors, fixtures, and telemetry must not expose the raw credential. A truncated digest may be used only when current logging doctrine permits it.
- Token comparison and lookup use the shared hashing implementation rather than duplicating the algorithm at call sites.

SHA-256 is appropriate here because the input tokens are high-entropy random/signed bearer values. This decision does not apply to passwords or other guessable human secrets.

## Consequences

- A read-only database leak does not directly reveal usable refresh or verification credentials.
- Raw values cannot be recovered from stored rows. Issuance and recovery flows must not depend on reversibility.
- A schema or service change that reintroduces raw token persistence is a security regression.
- JWT signing-key rotation is separate and governed by ADR-009; token-family reuse detection remains owned by the live rotation service.
