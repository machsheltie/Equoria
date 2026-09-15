---
paths:
  - "backend/modules/*/services/*RaceBarrier.mjs"
  - "scripts/doctrine-checks/check-no-test-only-imports.mjs"
---

# Interleaving Test Seams — Safety Contract and Cap

**Status:** Active rule
**Owner:** Project owner
**Last verified:** 2026-09-14
**Load only when:** An interleaving seam module, a production call site that awaits one, or the allow-list in `check-no-test-only-imports.mjs` is read or changed
**Do not load for:** Ordinary backend, service, controller, or test work that does not touch a seam
**Live sources:** `backend/modules/marketplace/services/marketplaceRaceBarrier.mjs`, `backend/modules/grooms/services/groomHireRaceBarrier.mjs`, `scripts/doctrine-checks/check-no-test-only-imports.mjs`
**Retire when:** The owner rules that interleaving seams are no longer permitted, or replaces the pattern

An interleaving seam is test-only machinery that lives in production service
code so a test can suspend ONE in-flight request at an exact point and prove a
guard that no ordinary rejection reaches. It exists because some guards fire
only in an interleaved state: an ordinary rejection fails BEFORE the guarded
write, so it proves nothing about the guard, and a two-caller `Promise.all`
race decides the loser's branch non-deterministically — which is precisely how
the groom double-hire 409 went uncovered for three review rounds
(Equoria-clh80, Equoria-ypb7d).

## Owner ruling, 2026-09-14 10:23

> Cap it at the two seams that exist and write the safety contract into a rule
> (.claude/rules), so any future seam must satisfy it rather than merely
> resemble the last one.

## The cap

Exactly **two** interleaving seams exist and are ruled acceptable:

1. `backend/modules/marketplace/services/marketplaceRaceBarrier.mjs`
   (Equoria-6p398.4)
2. `backend/modules/grooms/services/groomHireRaceBarrier.mjs`
   (Equoria-ypb7d.2)

A **third seam requires an owner ruling recorded in the tracker before it is
written**. Resemblance to these two is not authorization; "it matches the house
pattern" is the precedent-by-default outcome the owner ruled against. Bring the
case to the owner first: which guard has no deterministic coverage without it,
and why no non-seam proof exists.

The cap is executable. `scripts/doctrine-checks/check-no-test-only-imports.mjs`
enumerates every production module that exports a `__TESTING_ONLY_set*` arming
function and fails if that set is not exactly the two files above. Adding a
third seam therefore fails the doctrine gate until someone edits
`KNOWN_INTERLEAVING_SEAM_MODULES` — which is the point at which the owner's
ruling must already exist.

## The safety contract

Every seam — the two that exist, and any future one the owner allows — must
satisfy all six clauses. These are not aspirations; each was verified by
execution on the existing seams.

1. **Arming throws outside `NODE_ENV === 'test'`.** The
   `__TESTING_ONLY_set*` function throws for production, development, and an
   unset `NODE_ENV` alike — the guard is an explicit `!== 'test'` test, never a
   `=== 'production'` test, so an unset environment fails closed.
2. **An unarmed call returns immediately, with zero imports.** The awaiter's
   only module-level state is a `null` barrier; the module imports nothing, so
   an unarmed call cannot reach Prisma, the database, or any other subsystem.
   This is what makes the seam inert in a deployed process even if clause 1
   ever regressed.
3. **Not exported from the module barrel.** The seam is a same-module
   internal. It must NOT appear in `backend/modules/<domain>/index.mjs`, so it
   is not part of any public API and cannot be imported by another module.
4. **Both exports carry the `__TESTING_ONLY_` name prefix.** The prefix is what
   makes the detector see every consumer. A seam that passes the check by
   naming omission defeats the whole arrangement.
5. **Every production call site is allow-listed with a stated reason.** Each
   importing file is registered in `PERMITTED_TEST_ONLY_IMPORTS` in
   `check-no-test-only-imports.mjs`, mapped to the exact binding(s) it may
   import, with a one-line reason production cannot reach the gated behaviour.
   The allow-list is per binding, not per file: an unrelated
   `__TESTING_ONLY_` import added to an allow-listed file still fails.
6. **The seam may only DELAY or ABORT.** It receives a stage name and a
   read-only context and awaits whatever the test hands back. It never supplies
   a query result, never fabricates data, and never changes what SQL any
   statement runs. An abort's rejection propagates and rolls the surrounding
   transaction back where it stands; it does not re-route execution down a
   different branch. Every read and write that runs is the real one against the
   real database.

Two further obligations on the call site and the test:

- **Place the await where a suspended request holds nothing.** The grooms seam
  sits OUTSIDE `prisma.$transaction` deliberately: a request suspended inside a
  transaction holds row locks and a pooled connection, which starved the test
  Prisma pool when it was tried (task-19 §7.2). If a seam genuinely must pause
  mid-transaction, say so in its header and prove the pool survives it.
- **Tests MUST clear the barrier in a `finally` or `afterEach`,** so a failed
  assertion cannot leave a later suite suspended.

## Known limitation of the executable cap

The cap detects a seam by its `__TESTING_ONLY_set*` arming export. A future
seam that armed itself some other way (a setter named differently, a mutable
exported object) would not be counted. That is a detector gap, not a licence:
the ruling caps the pattern, not the spelling.
