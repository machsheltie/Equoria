# Evidence: Equoria-veql (21R-CI-2)

## Story

Tighten the frontend mock-data scan regex from a bare `MOCK_` substring (which over-matched env-flag identifiers like `VITE_MOCK_FLAG`) to a declaration-context pattern that catches actual mock-fixture constants while skipping env flags.

## Acceptance criteria

- The tightened regex returns zero matches in current `frontend/src/` (no false positives).
- The deployed scan still catches a planted `MOCK_DATA = [...]` declaration inside the real scanned tree (sentinel-positive).
- The tightened pattern is single-sourced in the canonical scan library, and both canonical consumers (the `beta-readiness-gate` job in `.github/workflows/test.yml` and the signoff script `scripts/check-beta-readiness.sh`) consume it from there.

> **Re-established 2026-05-20 (Equoria evidence-verification fix):** the
> original AC clause read "Both `.github/workflows/ci-cd.yml` and
> `.github/workflows/test.yml` use the new pattern" and the command counted
> the pattern in BOTH workflows (expecting `CI-CD-PATTERN-COUNT:3`). Since
> then, the mock-data scan — along with five other duplicated jobs — was
> intentionally removed from `ci-cd.yml` in commits `616107abc`
> (Equoria-1mpp, de-duplicate gates) and `a903379ae` (Equoria-wj8m/tic2,
> drop duplicate jobs). `test.yml` ("Equoria Quality Gate") became the
> single canonical workflow owning the static scans, and the marker was
> updated to count the inline pattern there (`TEST-PATTERN-COUNT:3`).

> **Re-established 2026-06-10 (Equoria-fefh2.18):** the previous marker
> `TEST-PATTERN-COUNT:3` counted the tightened regex literal INLINE in
> `.github/workflows/test.yml`. Commit `8902af0f9` (Equoria-iffbt,
> 2026-05-26; ADR-010 shared-library update) extracted all four
> beta-readiness static scans out of the workflow into
> `scripts/lib/beta-readiness-scans.sh` — the single source of truth —
> so the inline literal count in `test.yml` is now legitimately 0. The
> protection this story established did NOT regress; it moved and got
> stronger: the tightened ERE lives once as
> `EQUORIA_SCAN_RE_FRONTEND_MOCK` in the library, the `beta-readiness-gate`
> job sources the library and runs both the production scan
> (`equoria_scan_frontend_mock_data`) and its sentinel self-test
> (`equoria_scan_sentinel_frontend_mock_data`) on every PR, the signoff
> script consumes the same function, and
> `scripts/doctrine-checks/check-beta-readiness-scan-parity.mjs` asserts
> no inline regex copy reappears in either consumer. The verification
> command below was updated to exercise the new canonical implementation
> directly (library function + library sentinel + wiring counts) instead
> of counting a literal that no longer exists by design. This is a
> stale-evidence re-establishment, not a marker edit to paper over a
> regression.

## Verification command

```bash
{
  source scripts/lib/beta-readiness-scans.sh;
  echo "=== production scan (canonical library function) ===";
  if equoria_scan_frontend_mock_data; then
    echo "PROD-SCAN-CLEAN: frontend/src has zero mock-data matches";
  fi;
  echo "=== sentinel positive (library self-test plants MOCK_DATA in frontend/src) ===";
  if equoria_scan_sentinel_frontend_mock_data; then
    echo "SENTINEL-POSITIVE-OK: planted MOCK_DATA detected and cleaned";
  fi;
  echo "=== tightened regex single-sourced in the scan library ===";
  grep -c "MOCK_\[A-Z\]\[A-Z_\]\*" scripts/lib/beta-readiness-scans.sh | awk '{print "LIB-PATTERN-COUNT:" $1}';
  echo "=== both canonical consumers use the library ===";
  grep -c "source scripts/lib/beta-readiness-scans.sh" .github/workflows/test.yml | awk '{print "WORKFLOW-SOURCES-LIB:" $1}';
  grep -c "equoria_scan_frontend_mock_data" .github/workflows/test.yml | awk '{print "WORKFLOW-RUNS-FRONTEND-MOCK-SCAN:" $1}';
  grep -c "equoria_scan_frontend_mock_data" scripts/check-beta-readiness.sh | awk '{print "SIGNOFF-RUNS-FRONTEND-MOCK-SCAN:" $1}';
}
```

## Expected output markers

- `PROD-SCAN-CLEAN: frontend/src has zero mock-data matches`
- `SENTINEL-POSITIVE-OK: planted MOCK_DATA detected and cleaned`
- `LIB-PATTERN-COUNT:1`
- `WORKFLOW-SOURCES-LIB:1`
- `WORKFLOW-RUNS-FRONTEND-MOCK-SCAN:1`
- `SIGNOFF-RUNS-FRONTEND-MOCK-SCAN:1`

## Last verified

2026-06-10 by Equoria session (re-established after iffbt shared-library extraction; previously re-established 2026-05-20 after ci-cd.yml de-dup; original 2026-04-30)
