# Evidence: Equoria-veql (21R-CI-2)

## Story

Tighten the frontend mock-data scan regex from a bare `MOCK_` substring (which over-matched env-flag identifiers like `VITE_MOCK_FLAG`) to a declaration-context pattern that catches actual mock-fixture constants while skipping env flags.

## Acceptance criteria

- The new regex returns zero matches in current `frontend/src/` (no false positives).
- The regex still catches a hypothetical `MOCK_DATA = [...]` declaration (sentinel-positive).
- The canonical CI workflow uses the new pattern.

> **Re-established 2026-05-20 (Equoria evidence-verification fix):** the
> original AC clause read "Both `.github/workflows/ci-cd.yml` and
> `.github/workflows/test.yml` use the new pattern" and the command counted
> the pattern in BOTH workflows (expecting `CI-CD-PATTERN-COUNT:3`). Since
> then, the mock-data scan — along with five other duplicated jobs — was
> intentionally removed from `ci-cd.yml` in commits `616107abc`
> (Equoria-1mpp, de-duplicate gates) and `a903379ae` (Equoria-wj8m/tic2,
> drop duplicate jobs). `test.yml` ("Equoria Quality Gate") is now the
> single canonical workflow that owns the static scans; `ci-cd.yml` keeps
> only the jobs unique to it (build-validation, lighthouse,
> session-lifetime-nightly). The tightened mock-data scan that this story
> established is therefore still live and gating — it lives in the canonical
> workflow only. The AC clause and the verification command were updated to
> count the pattern in the canonical workflow (`test.yml`) so the evidence
> re-runs cleanly AND reflects the current de-duplicated reality. This is a
> stale-evidence re-establishment, not a marker edit to paper over a
> regression: the underlying protection (live tightened regex in the
> canonical CI gate) is verified true (see markers below).

## Verification command

```bash
{
  echo "=== production scan should be empty ===";
  grep -rEn "mockApi|\b(const|let|var|export\s+(const|let|var))\s+MOCK_[A-Z][A-Z_]*\b|allMockHorses|mockSummary" frontend/src/ --include="*.tsx" --include="*.ts" 2>/dev/null | grep -v "__tests__\|\.test\.\|\.spec\." | grep -v "^Binary" || echo "PROD-SCAN-EMPTY: 0 matches";
  echo "=== sentinel positive ===";
  SENTINEL=$(mktemp --suffix=.tsx);
  echo 'export const MOCK_DATA = [{ id: 1 }];' > "$SENTINEL";
  if grep -rEn "mockApi|\b(const|let|var|export\s+(const|let|var))\s+MOCK_[A-Z][A-Z_]*\b|allMockHorses|mockSummary" "$SENTINEL" --include="*.tsx" --include="*.ts" 2>/dev/null | grep -q .; then
    echo "SENTINEL-POSITIVE-OK: planted MOCK_DATA detected";
  else
    echo "SENTINEL-POSITIVE-FAIL: planted MOCK_DATA NOT detected";
  fi;
  rm -f "$SENTINEL";
  echo "=== canonical workflow uses the new pattern ===";
  grep -c "MOCK_\[A-Z\]\[A-Z_\]\*" .github/workflows/test.yml | awk '{print "TEST-PATTERN-COUNT:" $1}';
}
```

## Expected output markers

- `PROD-SCAN-EMPTY: 0 matches`
- `SENTINEL-POSITIVE-OK: planted MOCK_DATA detected`
- `TEST-PATTERN-COUNT:3`

## Last verified

2026-05-20 by Equoria session (re-established after ci-cd.yml de-dup; original 2026-04-30)
