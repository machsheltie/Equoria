# ADR-010: Beta-Readiness Static Scans — Shared Shell Library (was: CI Re-implements Inline)

**Status:** Accepted (superseded the inline-duplication design 2026-05-26, Equoria-iffbt)
**Date:** 2026-05-18 (original); 2026-05-26 (shared-library follow-up)
**Deciders:** CI / Security / Beta-Readiness
**Implementation:** `scripts/lib/beta-readiness-scans.sh` (single source of the
four scan regexes + scan/sentinel functions), sourced by
`scripts/check-beta-readiness.sh` (canonical signoff) and the
`beta-readiness-gate` job in `.github/workflows/test.yml`;
`scripts/doctrine-checks/check-beta-readiness-scan-parity.mjs` (single-source
invariant assertion — no inline copy may reappear)
**Tracking:** bd `Equoria-862l` (inline design), `Equoria-iffbt` (shared-library follow-up)

---

## Update (2026-05-27, Equoria-4iudq) — Standalone doctrine checks single-sourced too

The `iffbt` work below single-sourced the four scans for the two HEAVY-PATH
consumers (the signoff script + the `beta-readiness-gate` CI job). The four
STANDALONE doctrine-check scripts in `scripts/doctrine-checks/`
(`check-no-bypass-headers.sh`, `check-no-cleanup-routes.mjs`,
`check-no-db-mocks.mjs`, `check-no-frontend-mocks.mjs`) still embedded their own
copies of the same token/pattern sets. `Equoria-4iudq` removed that remaining
duplication **without weakening any gate** by making the shared definitions the
STRICT SUPERSET (union) of every consumer's patterns:

- **Bash side:** `EQUORIA_SCAN_RE_BYPASS_HEADER` in
  `scripts/lib/beta-readiness-scans.sh` was strengthened to the union of the
  library's tokens and the standalone bash check's tokens — adding
  `x-test-bypass-ownership` (the library lacked it) while keeping the broader
  `bypass-auth` (which already covers the narrower `x-test-bypass-auth`).
  `scripts/doctrine-checks/check-no-bypass-headers.sh` now `source`s that var
  instead of duplicating the literal. The library's bypass-header sentinel was
  extended to plant EVERY union token (proves the stricter set fires).
- **Node side:** a bash library cannot be `source`d by Node, so a sibling Node
  module `scripts/lib/doctrine-scan-patterns.mjs` is the canonical single source
  of the three Node checks' pattern/token/marker data (the route regex +
  forbidden cleanup-path patterns, the mock-call + prisma-target regexes incl.
  `vi.mock`, the frontend mock-token superset incl. `seededFakePlayers` /
  `fakeMetrics`). The three Node checks IMPORT their data from it; their
  structural scan/walk logic stays local (it differs per check). The
  walk/skip-logic sharing was deliberately left out of scope (filed follow-up).
- **Cross-language single-source guard:** the bypass-header and frontend-mock
  token sets exist in both a bash regex and the Node module. Because they cannot
  physically share one literal,
  `backend/__tests__/scripts/doctrineScanPatterns.sentinel.test.mjs` asserts the
  two representations are token-for-token identical (equality-guarded single
  source) AND plants each forbidden token to prove every standalone check still
  fires after the refactor.

No gate was weakened: every change is equal-or-stricter, and all 18 doctrine
checks plus the parity check still pass on a clean tree. The `iffbt` parity
check (`check-beta-readiness-scan-parity.mjs`) was unaffected — it inspects only
the two heavy-path consumers and the library var marker (`x-test-skip-csrf`),
both still present.

---

## Update (2026-05-26, Equoria-iffbt) — Shared library replaces inline duplication

The follow-up spike recorded below as Alternatives §2 ("Single shared scan
library sourced by both") has now been **implemented**. The four canonical
static scans (HTTP cleanup-route, integration-test DB-mock, frontend mock-data,
E2E/api-client bypass-header) are defined ONCE in
`scripts/lib/beta-readiness-scans.sh` as readonly regex variables plus a scan
function per regex (and two sentinel-self-test functions). Both consumers
`source` that library:

- `scripts/check-beta-readiness.sh` gates 6/7/8 call the library functions.
- The `beta-readiness-gate` job in `.github/workflows/test.yml` has a single
  "Beta-readiness static scans (shared library)" step that sources the library,
  runs the sentinel self-tests, then runs the four scans.

Because the regexes now physically exist in exactly one place, the byte-equality
drift hazard is structurally gone. `check-beta-readiness-scan-parity.mjs` was
therefore **repurposed** (not deleted): it now asserts the single-source
invariant — the library defines all four regex variables, both consumers source
the library, and no inline regex copy has reappeared in either consumer. Its
sentinel test (`backend/__tests__/scripts/betaReadinessScanParity.sentinel.test.mjs`)
proves the assertion fires on each violation.

The remainder of this ADR documents the original 2026-05-18 inline-duplication
design (Equoria-862l) for historical context; the byte-parity mechanism it
describes has been superseded by the shared library above.

---

## Context

`CLAUDE.md` designates `bash scripts/check-beta-readiness.sh` as the
**required final beta-readiness signoff**. That script runs all 10 gates:
the doctrine-checks suite, backend ESLint, `tsc --noEmit`, the full
backend routes / integration / module Jest suites, the Playwright
beta-readiness suite, and a set of cheap static scans (HTTP cleanup-route
scan, integration-test DB-mock scan, frontend mock-data scan, E2E/api-client
bypass-header scan).

A 2026-05-18 audit (Equoria-862l) found that **no CI workflow invokes
`scripts/check-beta-readiness.sh`**. Instead, the `beta-readiness-gate`
job in `.github/workflows/test.yml` **re-implements the cheap static
scans inline** as fast pre-flight steps (e.g. "Scan frontend production
code for mock data", "Scan E2E specs and api-client for bypass headers"),
each with its own copy of the scan regex.

The audit also found a concrete instance of the hazard: the inline
frontend-mock-data scan had been tightened by Equoria-veql (21R-CI-2)
from a bare `MOCK_` substring to a declaration-context ERE, but the copy
in `check-beta-readiness.sh` was **never updated** — it still used the
old broad pattern. The canonical signoff script and the CI gate had
silently drifted, and the script was the weaker of the two.

## Decision

**Keep the static scans deliberately duplicated** (inline in CI +
canonical in the signoff script) rather than having CI invoke the full
script, AND add an automated drift assertion so the two copies can never
silently diverge again.

Rationale for NOT having CI invoke `scripts/check-beta-readiness.sh`
directly from the `beta-readiness-gate` job:

1. The script runs **all 10 gates**, including the full backend Jest
   suites and the entire Playwright beta-readiness run (tens of minutes).
   The `beta-readiness-gate` job already runs the Playwright suite as its
   own dedicated step with job-specific setup (DB migrate, breed seed,
   browser install). Invoking the whole script there would **double-run**
   the heavy suites and roughly double the job wall-clock.
2. The script assumes an environment (local dev / full signoff context,
   `npm run seed:shows`, interactive signoff YAML mutation) that the CI
   job does not fully provide. Running it as-is in the gate job would
   either fail on environment assumptions or require forking its
   behaviour behind CI-only flags — which is itself a drift vector.
3. The cheap static scans are valuable **as fast pre-flight gates** that
   fail in seconds, before the expensive Playwright step. Inlining them
   preserves that fast-fail property.

The accepted residual risk — that the inline copies and the script
copies drift — is mitigated, not just documented:
`scripts/doctrine-checks/check-beta-readiness-scan-parity.mjs` extracts
the canonical scan regexes from BOTH `scripts/check-beta-readiness.sh`
and `.github/workflows/test.yml` and asserts each pair is
**byte-identical**. It runs as part of the doctrine-checks suite
(`run-all.sh`), which is GATE 1 of `check-beta-readiness.sh` itself and
also runs on every PR via `doctrine-gate.yml`. Any future one-sided edit
to a canonical scan fails this gate.

The drift assertion covers **all four** duplicated scans (Equoria-v9v14;
the original 862l implementation asserted only scans 3 and 4, leaving a
silent-drift path for the HTTP cleanup-route and integration-test
DB-mock scans). Each scan is located by a unique content marker that
appears verbatim inside its grep regex on both sides:

| #   | Scan                         | Marker                |
| --- | ---------------------------- | --------------------- |
| 1   | HTTP cleanup-route           | `test/cleanup`        |
| 2   | integration-test DB-mock     | `unstable_mockModule` |
| 3   | frontend mock-data           | `allMockHorses`       |
| 4   | E2E/api-client bypass-header | `x-test-skip-csrf`    |

The extractor tolerates the shell line-continuation form
(`grep -rn \` then the regex on the next line) used by scans 1 and 2.
Adding a new duplicated scan under the assertion is a one-line edit to
the `CANONICAL_SCANS` table in the parity script. The matching inline
step in `test.yml` must use the identical regex string. The assertion is
sentinel-tested by
`backend/__tests__/scripts/betaReadinessScanParity.sentinel.test.mjs`,
which proves it FIRES when any of the four pairs is mutated on one side.

## Consequences

- **Positive:** Fast-fail static gates retained in CI; full signoff
  semantics retained in the canonical script; "no silent drift path
  remains" (the 862l acceptance criterion) is enforced by an automated,
  sentinel-tested gate rather than by reviewer vigilance.
- **Negative / accepted:** The scan regexes still physically exist in two
  places. Editing one requires editing the other; the drift-check turns
  a forgotten mirror-edit into a hard CI failure rather than a silent
  weakening. This is the explicitly accepted cost of the fast-fail
  design.
- **Follow-up not done here:** A deeper refactor that extracts every
  static scan into a single shared shell library `source`-d by both the
  script and a thin CI step would eliminate the duplication entirely.
  That is a larger change (CI step would need to `source` a repo script
  and the script would need to be safe to source in isolation) and is
  out of scope for 862l. Filed as a candidate spike rather than bundled
  (per OPTIMAL_FIX_DISCIPLINE §3/§5).

## Alternatives Considered

1. **CI invokes the full `check-beta-readiness.sh`.** Rejected: doubles
   the heavy suites, breaks on environment assumptions, removes the
   fast-fail property (see Decision §1–3).
2. **Single shared scan library sourced by both.** Deferred: correct
   long-term shape but a materially larger change than 862l's scope;
   recorded as a follow-up spike, not silently dropped.
3. **Document the drift risk only (pure ADR, no check).** Rejected: the
   862l acceptance criterion explicitly requires that "no silent drift
   path remains" — a prose caveat is exactly the kind of
   documentation-only non-fix the 21R doctrine forbids.
