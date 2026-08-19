# Cross-Owner Stud Service Contract

**Status:** Planned; public listing exists, cross-owner breeding and private requests are not implemented
**Owner:** Breeding and economy systems
**Last verified:** 2026-08-19
**Load only when:** implementing or reviewing public/private stud listings, cross-owner breeding, stud-fee transfer, stud eligibility, or private breeding requests
**Do not load for:** own-horse breeding, unrelated economy work, generic horse-detail UI, or broad visual work
**Live sources:** current horse-breeding routes/controllers, breeding services, financial ledger, Prisma schema/migrations, GDPR service, tests, and the current issue state
**Retire when:** the durable rules move into implemented source-backed contracts or the owner cancels/supersedes the feature

This file preserves the owner-approved gameplay, money, authorization, and
concurrency invariants for cross-owner breeding. It is not an implementation
plan, route-layout prescription, issue checklist, or permission to run a
migration. Verify all proposed names and paths against current source.

`PRODUCT.md`, `DESIGN.md`, and the triggered design-system documents govern
every player-facing surface. This contract cannot approve a marketplace
template, admin inbox, generic card grid, tabs, modal, toast, or dependency.

## Current boundary

The current application can mark an owned stallion `At Public Stud` with a
fee, but no cross-owner breeding flow consumes that listing. The existing
own-both-parents flow and delayed pregnancy/foaling model remain separate until
an explicitly scoped implementation unifies them safely.

The planned feature has two modes:

- **Public:** a mare owner breeds immediately to a listed stallion. One
  transaction starts the pregnancy and transfers the listed fee.
- **Private:** a mare owner submits a request without payment. The current
  stallion owner accepts or rejects it; money moves only on acceptance.

## Product decisions

1. **Beta crossbreeding fails closed.** Same-breed pairs are allowed. Different
   breeds are rejected until the owner supplies a compatibility ruleset.
   Horses with no `breedId` are rejected because compatibility cannot be
   evaluated. This is a beta boundary, not permission to invent a permanent
   crossbreed taxonomy.
2. **Listing state stays on the horse.** The existing `studStatus` and
   `studFee` fields remain the listing source; do not add a parallel listing
   table without a new decision.
3. **Private requests snapshot the submitted fee.** Acceptance charges the
   exact amount the requester consented to, even if the listing later changes.
4. **Leaving private mode closes pending requests.** Unlisting, switching to
   public mode, or anonymizing the owner/stallion must atomically reject all
   pending requests for that stallion without moving money.
5. **Permanent and temporary accept failures differ.** A permanently invalid
   request becomes rejected. Temporary lack of funds, cooldown, recoverable
   health, or an underage horse leaves it pending so it may become valid.
6. **Players cannot pay themselves.** A mare owner cannot use the paid
   cross-owner flow with their own stallion; the existing own-horse breeding
   path serves that case.
7. **Zero-fee listings are valid.** Breeding may proceed, but no zero-value
   ledger rows are created.
8. **Mare age is 3–20 game years inclusive.** Stallions retain the existing
   minimum age of 3. A stallion maximum remains an open owner decision.
9. **Both parents must pass the critical-health gate.** Cross-owner breeding
   cannot bypass existing health restrictions.
10. **A public breeding pays the stable in-transaction fee.** Listing and fee
    edits racing a breed must serialize so the player is never charged an
    unconfirmed amount.

## Private-request state machine

`pending` is the only mutable state. Terminal states never transition again.

```text
pending -> accepted   payment and pregnancy commit exactly once
pending -> rejected   owner action, permanent invalidity, or listing removed
pending -> cancelled  requester action
```

A mare may have at most one pending private request across all stallions. This
must be enforced by the database, not by a read-then-insert check. A partial
unique index on `mareId` where `status = 'pending'` is the intended invariant;
map a racing unique violation to a stable conflict response.

A request retains:

- stallion and mare references;
- the requester/payer;
- a display-only submit-time stallion-owner snapshot;
- the fee snapshot;
- state, resolution reason, and timestamps;
- optional foal intent that is validated before being written to pregnancy
  state.

Authorization and payment always use the stallion's **current** owner at
acceptance. The snapshot is never an authorization or payee source.

## Shared eligibility contract

Public breeding, private submission, and private acceptance must use one
shared decision function. Submission is advisory; acceptance and public
breeding re-evaluate inside the authoritative transaction.

The shared rules include:

- different horse IDs, stallion sire, mare dam;
- requester owns the mare but not the stallion;
- required public/private listing mode is still active;
- same-breed-only beta compatibility and non-null breed IDs;
- any supplied foal breed exists and matches the allowed pairing;
- mare age 3–20 inclusive and stallion age at least 3;
- neither parent's displayed health is critical;
- mare is not pregnant and is at least seven UTC calendar days beyond the
  conception-stamped dam cooldown;
- requester has enough money for the applicable fee.

Every failure needs a stable machine-readable code. Ownership failures for a
caller-supplied horse ID use the repository's not-found/not-owned response
shape. Do not leak another player's private horse or account data while
explaining eligibility.

Treat these as permanently invalid for an already-pending request when they
cannot recover: wrong identity/sex/owner, dead listing, unknown or incompatible
breed, invalid foal breed, overage, already-pregnant mare, or sold stallion.
Treat recoverable health, cooldown, insufficient funds, and aging into the
minimum as temporary.

## Money and transaction invariants

Every money-moving breed or accept operation must use one Prisma transaction
and the repository's retryable transaction handling.

Within that transaction:

1. claim the still-active listing or pending request;
2. load/revalidate current stallion, mare, owners, and fee;
3. atomically claim the mare only if she is owned by the requester, not
   pregnant, and off cooldown;
4. conditionally debit the requester only when their balance is sufficient;
5. credit the current stallion owner by the same amount;
6. write the paired debit and credit ledger entries;
7. commit pregnancy state, request state, and payment together.

If any step fails, nothing moves: no partial pregnancy, balance change, ledger
row, or accepted request may remain. Notifications happen only after commit.
At fee zero, skip both balance and ledger operations.

The reusable user-to-user transfer must reject non-positive amounts and
self-transfers, keep `sum(User.money)` invariant, and write both sides of the
ledger through the transaction client. Existing user-to-system debit helpers
are not substitutes for a user-to-user transfer.

## Concurrency acceptance criteria

Implementation is incomplete until real-database tests prove all of these:

- two accepts of one request yield one acceptance and one payment;
- cancel racing accept yields exactly one terminal state, with payment only
  when accepted;
- two submissions for one mare yield one pending row;
- public breeding racing private acceptance for one mare yields one pregnancy
  and at most one fee;
- unlisting racing acceptance yields either a paid acceptance or an unpaid
  rejection, never charged-and-rejected;
- two public breeds racing for one mare yield one pregnancy and only the winner
  pays.

Tests must also prove fee conservation, snapshot-price behavior, zero-fee
behavior, ownership/privacy responses, cooldown and age boundaries, health and
breed rejection, terminal-state immutability, and no-charge failures.

## Privacy and lifecycle

- Account export includes requests made by the player when the feature exists.
- Deletion/cascade behavior must not strand pending requests.
- If account erasure preserves and anonymizes a stallion, pending requests are
  rejected in the same transaction before ownership disappears.
- A soft owner snapshot may remain only under the same documented retention
  basis as other audit-like soft references; it cannot be used operationally.
- Mutations retain current authentication, CSRF, validation, pollution,
  rate-limit, ownership, and audit middleware. This document does not freeze
  route names or middleware ordering; verify the current application pipeline.

## Player journeys

The implementation must support these complete journeys without turning the
game into a marketplace dashboard:

- discover a stallion through horse-led identity, lineage, performance,
  owner, mode, and fee context;
- review the mare and stallion together with compatibility, blocking reasons,
  fee consequence, and foal intent before committing;
- submit a private request with the fee snapshot and no payment;
- manage a stallion's mode and fee from the stallion's own context, including
  the consequence of closing pending requests;
- accept, reject, review, or cancel requests as equestrian correspondence or a
  breeding book—not an enterprise inbox.

Loading, error, empty, success, and mutation-pending states remain distinct.
Do not fabricate eligibility, fee, balance, or availability; do not expose raw
server errors; and do not communicate ownership, mode, or state by color alone.
Phone and desktop must preserve the same complete decision through responsive
recomposition.

## Open owner decisions

- permanent crossbreed compatibility rules beyond same-breed-only beta scope;
- policy for legacy horses without a breed;
- whether stallions receive a maximum breeding age.

Surface these decisions before expanding the beta rule. Do not infer answers
from an old implementation plan or from common horse-game conventions.
