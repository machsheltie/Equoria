# Doctrine Checks

Machine-checked enforcement of Equoria's active rules. Each script verifies a
contract in `CLAUDE.md`, a current path-scoped rule, or the live beta-readiness
configuration. Each script exits non-zero on violation.

`run-all.sh` invokes every check and aggregates failures.

## Why these exist

Doctrine in prose is bypassable: an agent can interpret around it, a developer
can forget it, a reviewer can miss it. Doctrine in CI is not bypassable: the
workflow fails, the merge is blocked, the rule is enforced.

If you find yourself wanting to add `--exclude-dir`, `continue-on-error: true`,
`it.skip`, or any other "small exception just for this case", that is a story
to fix the underlying problem. It is not a license to weaken the check.

## Scripts

- `check-no-bypass-headers.sh` — no `x-test-*` / `VITE_E2E_TEST` anywhere in
  E2E specs or frontend api-client. No directory exclusions allowed. The token
  set is single-sourced from `scripts/lib/beta-readiness-scans.sh`
  (`EQUORIA_SCAN_RE_BYPASS_HEADER`, the strict union of all consumers' tokens;
  Equoria-4iudq).
- `check-no-cleanup-routes.mjs` / `check-no-db-mocks.mjs` /
  `check-no-frontend-mocks.mjs` — Node checks whose forbidden pattern/token/
  marker DATA is single-sourced from `scripts/lib/doctrine-scan-patterns.mjs`
  (Equoria-4iudq); their structural scan/walk logic stays local to each check.
- `check-staff-routes-guarded.mjs` — every `router.<method>(` in
  `backend/modules/staff/routes/*.mjs` names `requireStaffCapability(` or
  `requireAnyStaffCapability(`; `requireStaffRole` alone is allowed only for
  `POST /checkin/request`, `POST /checkin/verify` and `GET /me`; `router.use(`
  (non-guard) and `router.route(` are rejected (Equoria-puj1e.1).
- `check-audit-level.sh` — every `npm audit` step in `.github/workflows/`
  uses `--audit-level=moderate` or stricter (`low`).
- `check-gates-run-on-prs.sh` — every job named `*-gate` (except those in
  `gates-allowlist.txt`) must run on PRs, not just master.
- `check-critical-jobs-mirrors.mjs` — the `critical-jobs-ran` skip sentinel in
  `.github/workflows/test.yml` (Equoria-axyem.7) decides whether a `skipped`
  job is a defect or a legitimate exclusion by comparing against `EXPECT_*`
  env values that mirror each conditional job's own `if:`. Nothing in YAML ties
  a mirror to what it mirrors. This check asserts each mirror is character-
  identical to its job's `if:`, that every job checked as unconditional really
  has no `if:`, and that the sentinel's `needs:` list and its `check` lines are
  the same set. Optional argv[2] points it at an alternate workflow copy, which
  is how the drift cases were proven RED without editing the tree.
- `check-no-skips-in-readiness.sh` — no `it.skip` / `test.skip` /
  `describe.skip` / `test.fixme` in any beta-readiness Playwright spec.
- `check-module-dependency-graph.mjs` — the backend module graph stays a DAG
  of named service contracts (Equoria-q4uem.4, WS4 S5). Production files under
  `backend/modules/**` only, one parse pass, well under a second; comments are
  stripped as spans (strings, template and regex literals kept), so a
  commented-out import is not an edge and `/* x */ import …` is. R1 no
  cross-module cycle (every elementary cycle printed with a file:line per edge);
  R2 cross-module imports go through `modules/<n>/index.mjs` — a deep import
  fails unless the line before it carries the existing
  `eslint-disable-next-line no-restricted-imports -- Equoria-hk739` TDZ marker
  AND its `<file> -> <target>` pair is pinned in
  `module-dependency-graph-allowlist.json` (`deepImports`; S6 empties it and
  makes R2 strict); also under R2, because the graph cannot see such a target:
  a dynamic `import()` whose first argument is not a plain single- or
  double-quoted string literal (a template literal, a variable,
  `join(__dirname, …)`), any `createRequire(…)` or `require(…)` call (the repo is
  ESM-only), any import specifier containing a backslash (Linux CI cannot
  resolve it), and the lexer fail-safe (an unterminated template literal or
  block comment at end of file, or a template/string literal that CONTAINS
  statement-shaped import/export/`require(`/`import(` text the scanners would
  otherwise have read, fails closed; a long template without such text passes;
  comment spans are stripped and never fail closed — JSDoc `{import('x')}` types
  live there); statements are matched at statement boundaries (line start, or
  after `;` / `}` on the same line), not only at line starts; R3 no `export *`
  in a barrel; R4 no HTTP layer in barrels — CLOSURE-BASED, every block: for
  every barrel re-export and every barrel `import`, the static import closure of
  the target file (static imports, `export … from`, dynamic string imports) may
  reach no route module (`/routes/` or `*Routes.mjs`) and no controller
  (`/controllers/` directory OR `*Controller.mjs` file name); the path to the
  offending file is reported, and the re-export chain (`export … from`,
  `export * from`, `import … from X` + `export { … }` /
  `export const X = binding[.member]` / `export default binding`, namespace
  imports) is followed only to name the controller precisely. There is no
  test-block exemption for controllers (WS4 S5-pre: the former labelled block was
  a real runtime coupling — importing the economy barrel evaluated
  tackShopController); the `// Test-consumed only (… Equoria-7t1tn` label may
  still head NON-controller names consumed only by other modules' tests, and the
  allow-list's `testBlockControllers` section is retired and must stay empty (any
  entry fails); R5 no module file imports `backend/app/**`. The `deepImports`
  allow-list section may only SHRINK: an unpinned marked import fails, and so does
  a pinned pair that no longer matches anything on disk; every entry needs a
  `reason` and an `issue`. Shared-layer round trips (a
  `backend/utils|services` file that modules import and that imports a module
  back) and a barrel-less directory under `modules/` print as `WARN` only, with
  no exit-code effect and no baseline (controller ruling Q9a). Fewer than 10
  modules or 50 files parsed, or a missing allow-list file, is a failure, not a
  pass. `--closure <file>` prints a file's transitive import closure.
  Sentinel-positive:
  `backend/__tests__/scripts/moduleDependencyGraphDoctrine.sentinel.test.mjs`.
- `check-horse-name-gated.mjs` reads the import braces with comments stripped and
  matches the EXACT policy identifiers on the `horses/index.mjs` and
  `routes/_validators.mjs` paths (WS4 S5 review M5). Sentinel-positive:
  `backend/__tests__/scripts/horseNameGatedDoctrine.sentinel.test.mjs`.
- `check-railway-migrate-failfast.mjs` — the Railway start command in
  `.railway/railway.ts` (`start:` / `startCommand:`; plus a legacy
  `railway.toml` `startCommand =` while that file exists) must NOT swallow a
  failed `prisma migrate deploy` (Equoria-oey96.35).
  Fails if the migrate command is terminated by a fail-open shell operator
  (`||`, `;`, a lone `|`, or a lone `&`) that lets the deploy proceed to
  `node server.mjs` despite a non-zero migrate exit. Only `&&` (fail-fast) is
  allowed. The `${DIRECT_URL:-$DATABASE_URL}` parameter-substitution fallback is
  not a swallow and is unaffected. Sentinel-positive:
  `backend/__tests__/railwayMigrateFailfastDoctrine.sentinel.test.mjs`.

## Adding a new check

1. Drop a script in this directory. It must exit `0` on pass, non-zero on
   fail, and print the offending file:line on fail.
2. Append it to `run-all.sh`.
3. If the rule needs an allowlist (e.g., `gates-allowlist.txt`), document why
   each entry is exempt directly in the allowlist file as a comment.
4. Add the rule to `CLAUDE.md` so humans see what the script enforces.

## Running locally

```bash
bash scripts/doctrine-checks/run-all.sh
```

The pre-push hook runs this automatically. CI re-runs it on the merge commit
to catch any push that used `--no-verify`.
