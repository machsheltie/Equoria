#!/usr/bin/env bash
# Doctrine: a backend test may not rename or move a tracked data file.
#
# Source: OWNER RULING 2026-09-14 10:23 (Equoria-rlvgn) — "Tests may not rename
# tracked data files at all; the affected suite works on a copy."
#
# WHAT WENT WRONG THAT THIS PREVENTS
#   foalCreationBreedDataOutage.test.mjs used to prove its 500 arm by renaming
#   the TRACKED backend/data/breedProfiles.json aside for one request and
#   restoring it in a `finally`. A `finally` does not run when the process is
#   killed, and this campaign already hit one OOM death — so a killed run could
#   leave the tracked file missing from the shared working tree, and every
#   breed-dependent suite then saw a fabricated outage with no explanation until
#   that one suite ran again and self-healed.
#
# WHAT THIS CHECK ACTUALLY PROVES — read this before trusting it
#   It is a grep pairing, not dataflow. A backend test file is flagged when it
#   BOTH (a) references a data file under backend/data/ and (b) contains a
#   rename/move call. It cannot prove the rename targets that exact path, and it
#   cannot see a rename assembled from computed strings or performed by a helper
#   in another file. It catches the shape that caused the incident, cheaply, at
#   the moment it is written.
#
# EXEMPTION
#   A per-line comment marker on the same line:
#       // doctrine-allow: tracked-data-rename
#   Use it only for a file whose purpose is to enforce this very doctrine (a
#   guard spec scanning for these strings).
#
# WHAT TO DO INSTEAD
#   A suite that genuinely needs an unreadable data source works on a COPY. The
#   worked example is backend/modules/horses/__tests__/foalCreationBreedDataOutage.test.mjs:
#   it copies the tracked file into an mkdtemp directory outside the repository,
#   points the code under test at that copy through the loader's ordinary path
#   configuration — BREED_PROFILES_PATH in
#   backend/modules/horses/data/breedProfileLoader.mjs, read the same way in
#   every environment and defaulting to the repository file when unset, the same
#   shape as DATABASE_URL — and then deletes the COPY for one request. The
#   tracked path is only ever read.
#
#   That variable is plain configuration, NOT a test-only seam. Do not reach for
#   a NODE_ENV-gated or TEST-prefixed escape hatch here: see
#   .claude/rules/INTERLEAVING_TEST_SEAMS.md for why that shape is capped and
#   what a seam has to satisfy before it may exist at all.

set -uo pipefail

MARKER='doctrine-allow: tracked-data-rename'

# (a) a reference to a data file under backend/data/ — either spelled out, or
#     reached relatively as the loader and its tests do ('../../../data/x.json').
DATA_REF_RE='backend/data/|(^|[^A-Za-z0-9_])data/[A-Za-z0-9_.-]+\.(json|csv|ndjson)'

# (b) a filesystem rename/move. fs.rename / fs.renameSync / a destructured
#     rename(...) / renameSync(...) / a shelled-out `mv`.
RENAME_RE="(^|[^A-Za-z0-9_])rename(Sync)?[[:space:]]*\(|(^|[^A-Za-z0-9_])mv[[:space:]]+[^[:space:]]*(backend/)?data/"

if [ ! -d backend ]; then
  echo "doctrine-check: ERROR — no backend/ directory. Wrong working directory?" >&2
  exit 2
fi

# Every backend test file: *.test.* / *.spec.* anywhere under backend/, plus
# anything living inside a __tests__ or tests directory (helpers included).
# Untracked files are scanned deliberately — a planted test is still a test.
mapfile -t files < <(
  find backend \
    -type d \( -name node_modules -o -name coverage -o -name 'coverage-*' -o -name dist -o -name build \) -prune \
    -o -type f \( -name '*.test.*' -o -name '*.spec.*' -o -path '*/__tests__/*' -o -path '*/tests/*' \) -print \
    | sort
)

if [ ${#files[@]} -eq 0 ]; then
  echo "doctrine-check: ERROR — no backend test files found. Wrong working directory?" >&2
  exit 2
fi

violations=""

# grep exits 0 (matched), 1 (no match), or >1 on a READ ERROR — EACCES, a file
# that vanished mid-scan, a directory. The shell neighbours discard that
# distinction with `2>/dev/null … || true`, which silently under-scans and still
# prints OK. This check is the executable guard for an owner ruling, so it fails
# loudly instead: same stance the .mjs checks took under Equoria-p1mlt /
# Equoria-8nq7i. A file this check cannot read is a file it cannot clear.
scan_errors=""

for f in "${files[@]}"; do
  # Stage (a): does this file deal with a backend/data file at all?
  grep -Eq "$DATA_REF_RE" "$f"
  rc=$?
  if [ "$rc" -gt 1 ]; then
    scan_errors+="  $f (grep exit $rc while scanning for a backend/data reference)"$'\n'
    continue
  fi
  [ "$rc" -eq 0 ] || continue

  # Stage (b): does it rename/move anything? Report the offending lines.
  hits=$(grep -EnH "$RENAME_RE" "$f")
  rc=$?
  if [ "$rc" -gt 1 ]; then
    scan_errors+="  $f (grep exit $rc while scanning for a rename)"$'\n'
    continue
  fi
  if [ "$rc" -eq 0 ]; then
    hits=$(printf '%s\n' "$hits" | grep -v -F "$MARKER")
    [ -n "$hits" ] && violations+="$hits"$'\n'
  fi
done

if [ -n "$scan_errors" ]; then
  {
    echo
    echo "doctrine-check: ERROR — could not read one or more backend test files:"
    printf '%s' "$scan_errors"
    echo "This check will not pass by omission. Fix the access problem (or remove the"
    echo "file) and re-run."
  } >&2
  exit 2
fi

if [ -n "$violations" ]; then
  echo
  echo "Backend test files rename or move a file while referencing backend/data/ (forbidden):"
  printf '%s' "$violations"
  echo
  echo "OWNER RULING 2026-09-14 10:23 (Equoria-rlvgn): tests may not rename tracked data files"
  echo "at all. A killed run leaves the tracked file missing from the shared working tree and"
  echo "every suite that reads it then fails for a reason that is not its own."
  echo
  echo "Work on a COPY instead: copy the data file into an OS temp directory, point the code"
  echo "under test at the copy through its ordinary path configuration, and break the copy. See"
  echo "backend/modules/horses/__tests__/foalCreationBreedDataOutage.test.mjs."
  echo
  echo "If a line is part of a doctrine-enforcement guard, append:"
  echo "    // $MARKER"
  exit 1
fi

exit 0
