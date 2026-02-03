#!/bin/bash

OUTPUT_FILE="/c/Users/heirr/AppData/Local/Temp/claude/C--Users-heirr-OneDrive-Desktop-Equoria/tasks/b4959df.output"

echo "=== TEST FAILURE ANALYSIS ==="
echo ""
echo "## Summary Statistics"
echo "Total lines in output: $(wc -l < "$OUTPUT_FILE")"
echo ""

echo "## Error Category Counts"
echo "Prisma breedId errors: $(grep -c "Unknown argument \`breedId\`" "$OUTPUT_FILE" || echo "0")"
echo "Prisma validation errors (total): $(grep -c "PrismaClientValidationError" "$OUTPUT_FILE" || echo "0")"
echo "Null/undefined errors: $(grep -c "Cannot read.*null\|Cannot read.*undefined" "$OUTPUT_FILE" || echo "0")"
echo "expect() failures: $(grep -c "expect(received)" "$OUTPUT_FILE" || echo "0")"
echo "HTTP 403 Forbidden: $(grep -c "expected 200 \"OK\", got 403" "$OUTPUT_FILE" || echo "0")"
echo "HTTP 404 Not Found: $(grep -c "expected 200 \"OK\", got 404" "$OUTPUT_FILE" || echo "0")"
echo ""

echo "## Failed Test Suites"
grep "FAIL " "$OUTPUT_FILE" | head -20
echo ""

echo "## Top Error Messages"
grep "●" "$OUTPUT_FILE" | grep -v "TCPSERVERWRAP" | head -30
