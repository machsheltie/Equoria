# Evidence: Equoria-veql (21R-CI-2)

## Story

Tighten the frontend mock-data scan regex from a bare `MOCK_` substring (which over-matched env-flag identifiers like `VITE_MOCK_FLAG`) to a declaration-context pattern that catches actual mock-fixture constants while skipping env flags.

## Acceptance criteria

- The new regex returns zero matches in current `frontend/src/` (no false positives).
- The regex still catches a hypothetical `MOCK_DATA = [...]` declaration (sentinel-positive).
- Both `.github/workflows/ci-cd.yml` and `.github/workflows/test.yml` use the new pattern.

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
  echo "=== both workflows use the new pattern ===";
  grep -c "MOCK_\[A-Z\]\[A-Z_\]\*" .github/workflows/ci-cd.yml | awk '{print "CI-CD-PATTERN-COUNT:" $1}';
  grep -c "MOCK_\[A-Z\]\[A-Z_\]\*" .github/workflows/test.yml | awk '{print "TEST-PATTERN-COUNT:" $1}';
}
```

## Expected output markers

- `PROD-SCAN-EMPTY: 0 matches`
- `SENTINEL-POSITIVE-OK: planted MOCK_DATA detected`
- `CI-CD-PATTERN-COUNT:3`
- `TEST-PATTERN-COUNT:3`

## Last verified

2026-04-30 by Equoria session
