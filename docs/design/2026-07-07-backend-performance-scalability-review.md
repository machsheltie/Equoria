# Equoria Backend Performance & Scalability Review — Beta Scale

**Date:** 2026-07-07
**Status:** AUDIT + DESIGN — no code ships with this document. Every fix is a filed `bd` child issue under the epic listed in §10; schema changes are additionally gated on explicit user permission per the migration-gate convention (see Equoria-lffdv's gate clause).
**Scope:** the whole backend request graph at once — query plans/N+1 on the hot paths (competition, horses, leaderboards, breeding), index coverage vs. actual query shapes, pagination strategy, cron/background load, caching and connection pooling. Past audits caught these classes as one-offs (Equoria-2y91o, 4qpqb, lffdv, hikk1, icqqm, xal4m, mquci); this is the first pass that holds the interactions between them.
**Method:** six parallel read-only code audits (competition/breeding write paths, horse/leaderboard read paths, index coverage, pagination inventory, cron layer, caching/pooling), synthesized by a single orchestrator that spot-verified every P1 anchor against the code before filing. No EXPLAIN plans were run (see §11) — impact estimates are analytic, from query shapes and the schema.

**Beta-scale assumptions used throughout:** ~1,000 users, ~10,000 horses (rosters up to ~200/user per the game-balance spec), ~500k accumulated `CompetitionResult` rows, shows with up to ~200 entries (entries are uncapped per Equoria-nx8t1), single Railway instance.

**Severity scale:** P1 = player-visible latency/failures or wrong results at beta scale. P2 = degrades meaningfully as data grows. P3 = minor/theoretical or hygiene.

---

## §0. Executive summary — the whole-system picture

Six themes fall out of holding the entire graph at once. None of them is "the code is naive" — the codebase repeatedly contains the _correct_ pattern somewhere, sitting next to unfixed siblings of the same defect. The epic is largely "apply the in-house gold standard to its siblings."

1. **The 3-connection pool is the system-wide chokepoint (§1).** Production runs `connection_limit=3` (deliberate, Railway Hobby PgBouncer rationale), but the code's concurrency patterns assume a much larger pool: show settlement fires one interactive transaction _per entry_ concurrently (§2.1), the cron advisory lock pins one connection for a job's entire runtime (known: Equoria-mquci), two cron registries collide on the same minute (§7.1), and fire-and-forget notification prunes add stray acquisitions. Almost every P1 in this document is either a demand-side fix (fewer concurrent connections needed) or the supply-side decision (§1.3).

2. **Show settlement is the highest-blast-radius code in the game (§2).** One entry's transaction failing aborts the whole nightly batch, and — because shows are flipped to `completed` _before_ entries are processed (a conscious anti-double-pay trade, Equoria-koodu) — a partially-settled show is never retried. A player can place in a show and never receive the result or the prize, with no recovery path.

3. **The breeding/genetics analytics endpoints are combinatorial (§3).** An un-batched pedigree walker (~62 sequential queries per pair — the same defect already fixed in `lineageTree.mjs` under Equoria-a56gl/gakyp) is multiplied by a per-horse population loop and a sequential stallion×mare nested loop. A 10×10 herd ≈ 6,400 sequential queries for one authenticated API call; 20×20 ≈ 25,600. Cost is quadratic in the player's own herd size — a natural outcome of encouraged gameplay.

4. **Index coverage is inverted relative to load (§6).** The single hottest query family (training eligibility — checked before _every_ training action) runs against `TrainingLog`, which has **zero indexes**. Meanwhile 12 declared indexes are strict prefixes of other indexes on the same models — pure write amplification, on top of the 17 runtime orphans already condemned by the qh6jk/rsqqc audit.

5. **Pagination is OFFSET-based on non-unique sort keys nearly everywhere (§5).** Of 20+ live paginated endpoints, exactly one has a deterministic tiebreak. §5 designs ONE cursor convention (compound keyset cursor, opaque encoding, single cap policy, explicit totals story for the numbered-page UIs the frontend actually renders) instead of five ad-hoc fixes.

6. **Caching is simultaneously too aggressive and missing (§8).** The HTTP layer defaults to `Cache-Control: public, max-age=300` on **every** GET unless a handler opts out (currently masked only by the frontend's unconditional `cache:'no-store'`), while the one leaderboard endpoint that most needs the in-house query cache (`GET /api/leaderboards/competition`) is the only one without it — and it re-runs an unbounded distinct-count on every request. Plus one real invalidation bug (horse XP history never invalidates) and one unbounded per-request metrics `Map`.

---

## §1. The connection-pool chokepoint

### 1.1 Supply: 3 connections, deliberately

`packages/database/dbPoolConfig.mjs:32` — production default `connection_limit: 3`, `pool_timeout: 30s` (comment: Railway PgBouncer Session mode, Hobby tier ≤10). Exactly one `PrismaClient` exists at runtime (`packages/database/prismaClient.mjs:106-113`); no raw `pg` pool bypass in production code. So the supply side is clean and known — the problem is that nothing on the demand side was written against a budget of 3.

### 1.2 Demand: who holds connections concurrently

| Consumer                | Shape                                                                                                                                     | Evidence                                                                 |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Cron advisory lock      | 1 connection pinned for the job's **entire runtime** (up to 60 min by config) — the lock is held inside a long interactive `$transaction` | `backend/utils/cronLock.mjs:120-156` (known: Equoria-mquci, in progress) |
| Show settlement         | Up to **N concurrent** interactive transactions for an N-entry show, via `Promise.all`                                                    | `showController.mjs:562-689` (§2.1)                                      |
| Conformation settlement | 1 transaction held for 2×N sequential round-trips (30s timeout)                                                                           | `conformationShowService.mjs:324-403` (§2.3)                             |
| Notification prune      | Fire-and-forget unawaited query per notification created                                                                                  | `notificationService.mjs:33-75`                                          |
| Timed-out requests      | 408 sent to client but the DB work is not cancelled — connection stays held                                                               | `resourceManagement.mjs:385-419`                                         |
| Colliding cron jobs     | 2-3 jobs each pinning a lock connection at the same minute (00:05, 03:00)                                                                 | §7.1                                                                     |

At 03:00 UTC nightly: the show-execution job pins 1 connection (advisory lock), tokenCleanup pins another (schedule collision), leaving **1** connection for the entire per-entry settlement fan-out plus any live player traffic. This is the arithmetic behind the §2.1 P1.

### 1.3 Fix strategy: demand first, then supply

1. Restructure show settlement to O(1)+O(3) transactions (§2.1 child issue).
2. Land Equoria-mquci (dedicated lock connection) — already in progress.
3. De-collide the cron schedules (§7.1 child issue).
4. **Then** make the supply-side decision: raise `DB_POOL_SIZE` (Railway plan permitting) with the measured demand in hand. Three docs currently disagree about pool size (`CONNECTION_POOL_CONFIGURATION.md` describes a constant that no longer exists; `docs/implementation/SCALE-CONFIG.md:19` recommends 20; code says 3) — the decision child issue also reconciles the docs.

---

## §2. Show execution & competition write path

### 2.1 [P1] `executeClosedShows`: one interactive transaction per entry, concurrently, against a pool of 3

`backend/modules/competition/shows/showController.mjs:562-689`. `scored = entries.map(...)` (line 484 — **all** entries, not just podium; non-podium entries get `prizeShare = 0` but still get their own transaction), then `resultOps = scored.map(async ... prisma.$transaction(...))` and `await Promise.all(resultOps)` (line 689). For a 200-entry show: ~200 concurrent transaction acquisitions against 3 connections (§1.2), each non-podium transaction containing exactly one `competitionResult.create`. Most queue behind `pool_timeout: 30s`; cumulative queuing can throw Prisma `P2024` mid-settlement.

**Fix shape (child issue):** batch the non-podium entries into one `createMany` (single insert, no money movement — no transaction needed beyond the statement itself); keep individual transactions only for the ≤3 podium entries that touch escrow/`User.money`/rider stats; bound any remaining concurrency to the pool budget; wrap the money-moving transactions in `withRetryableTxMapping` (the entry-side transaction `showEscrowTx.mjs:38` is already retry-wrapped; the settlement side is not).

### 2.2 [P1] Failure cascade + unrecoverable partial shows

Same function. The `for (const show of shows)` loop (line 434) has no per-show try/catch; any entry-transaction rejection propagates out of `Promise.all` and aborts **every remaining show** in the batch (they stay `open` and wait ~24h for the next tick — payout delay). Worse: the failing show was already atomically flipped to `completed` (line 550-553, the koodu claim-then-process pattern) — the due-show query only matches `status:'open'`, so a partially-settled show is **never retried**. Some entrants get results/prizes, others silently never do. The koodu comment consciously accepted "partial-but-bounded writes, never double-pay" — what it did not provide is (a) isolation so one show's failure doesn't starve the others, and (b) any recovery path for the partial show.

**Fix shape (child issue):** per-show try/catch (log + continue); a recoverability mechanism for partial shows — e.g. settle idempotently per entry (the `@@unique([showId,horseId])` constraint already makes result-creation retry-safe; prize legs need an idempotency marker) so a `completed`-but-partial show can be re-driven, or a distinct `settlement_failed` status an admin/cron can retry.

### 2.3 [P2] Conformation shows: textbook N+1 + a 2×N-round-trip single transaction

`conformationShowService.mjs:259-285`: per-entry `groomAssignment.findFirst` (1+1+N queries; the ridden path already batches the identical lookup — `showController.mjs:474-481`), and `include: { horse: true }` pulls every JSONB column when scoring reads ~5 fields. Then lines 324-403: one transaction with a sequential `for` loop doing `horse.update` + `competitionResult.create` per entry (≈2×N round-trips, 30s timeout, one pool connection held throughout).

**Fix shape (child issue):** batch the groom lookup (`foalId: { in: ... }, isActive: true` + Map), scope the select, batch result creation via `createMany` and collapse the per-horse updates.

### 2.4 [P2] `resultModelService`: unbounded reads with full nested includes on player-facing routes

`resultModelService.mjs:139-204` (`getResultsByHorse`, `getResultsByShow`): no `take`, and `include: { horse: { include: { breed: true } }, show: true }` carries every Horse JSONB column per result row, returned to the client unfiltered (also leaks other players' genotype/traits on show results — flagged, security-adjacent). Same-file counter-example: `getResultsByUser` caps at 100 and `getUserResultsSummary` batches correctly.

**Fix shape (child issue):** cap + select-scope now; adopt the §5 cursor convention for these list endpoints when it lands.

### 2.5 [P3] Dead legacy instant-competition path is an N+1 template

`competitionController.mjs:214-241, 341-498` contains sequential per-horse loops, but both consuming routes are hard-deprecated to 410 (Equoria-kacla, locked by `legacyInstantPathDeprecation.test.mjs`). Not a live cost — but it's a plausible-looking template a future feature could copy. Child issue: delete it.

---

## §3. Breeding/genetics combinatorial explosions

The root cause appears three times; it was already fixed once. `lineageTree.mjs:188-305` (`collectAncestorIdsBFS`) batches the ancestor walk into one `findMany` per generation and has a sentinel test asserting bounded query counts (`advancedLineageAnalysisN1.sentinel.test.mjs`). Its two unfixed siblings:

| Walker copy             | File                                         | Status                                                                                               |
| ----------------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `collectAncestorIdsBFS` | `lineageTree.mjs:188-305`                    | ✅ batched (Equoria-a56gl/gakyp)                                                                     |
| `getLineage`            | `genetics/inbreedingAnalysis.mjs:56-95`      | ❌ one `findUnique` per ancestor — up to ~62 sequential queries per pair (5 generations × 2 parents) |
| `gatherLineage`         | `horses/services/foalingService.mjs:155-220` | ❌ same shape, 3 generations (~14 queries) — runs on **every foal birth** in the foaling cron        |

### 3.1 [P1] Fix the walker once, share it

Child issue: extract one canonical batched ancestor-walker (the `lineageTree.mjs` shape), use it in `inbreedingAnalysis.getLineage`; sentinel test per the existing precedent. This is the root fix that the two multipliers below depend on.

### 3.2 [P1] `analyzePopulationInbreeding`: O(M × 62) sequential queries, player-triggered

`genetics/populationHealth.mjs:67-106` — per-horse sequential `calculateDetailedInbreedingCoefficient` (the §3.1 walker ×2) over the caller-supplied `horseIds`. Reachable via `GET /api/genetics/population-health/:userId` and `POST /api/genetics/population-analysis` with a player's entire collection: 50 horses ≈ 3,100 sequential round-trips per call. Fix: one BFS over the union of ancestors, compute coefficients in memory.

### 3.3 [P1 — worst single finding] `generateOptimalBreedingRecommendations`: sequential stallion×mare loop, each pair re-fetching horses + re-running the walker

`genetics/breedingCompatibility.mjs:227-298` + `assessBreedingPairCompatibility:36-92`. Three compounding defects: (a) O(S×M) pairs, fully sequential; (b) every pair re-fetches both horses by ID even though the enclosing function already batch-loaded them; (c) every pair pays the ~62-query walk. 10 stallions × 10 mares ≈ **6,400 sequential queries for one API call** (`POST /api/genetics/optimal-breeding`). Fix: pass the fetched objects down, share one prefetched ancestor map, bound concurrency.

### 3.4 [P2] `generateGeneticDiversityReport` recomputes its own inputs 2-3×

`genetics/recommendationGenerators.mjs:407-419`: `trackPopulationGeneticHealth` runs twice for the same `horseIds`, `calculateAdvancedGeneticDiversity` at least 3×, and `analyzeGeneticTrends` re-runs diversity+inbreeding once per birth-year cohort — all multiplying the §3.2/§3.3 costs on `GET /api/genetics/diversity-report/:userId`. Fix: compute once at the top, thread results down as parameters.

### 3.5 [P2] `lineageTree` fetches unbounded `competitionResults: true` that no consumer reads

`lineageTree.mjs:31-47, 70-76, 245-251` — carried for the roots and every ancestor; neither `lineagePerformance.mjs` nor `lineageDiversity.mjs` reads it. Grows with the 500k-row results table for established ancestors. Fix: drop the include (or `_count` if a count is ever wanted).

### 3.6 [P3] Minor genetics cleanups

- `geneticDiversityMetrics.identifyGeneticFounders:347-422`: sequential per-candidate descendant walks (inner walk is level-batched, so bounded) — precompute one descendant map.
- `dynamicCompatibilityScoring.mjs:304-350`: same horse re-fetched once per groom in a `Promise.all` — pass the object.

---

## §4. Leaderboards & read paths

### 4.1 [P1] `GET /api/leaderboards/competition` is the only uncached leaderboard read — and the most expensive

Every sibling controller function wraps its query in `getCachedQuery(..., 300s)`; the `/competition` handler (`leaderboardRoutes.mjs:473-693`) has none (verified: zero `getCachedQuery` in the file). Every request re-runs the metric `groupBy` **plus** `groupDistinctHorseCount` (`leaderboardCompetitionQueries.mjs:92-98`) — an unbounded groupBy materializing every distinct scoring horse just to read `.length` (that half is Equoria-4qpqb, confirmed, together with its sibling in `getTopUsersByXP` `leaderboardController.mjs:122-126`). Tie-breaking instability across all leaderboard sorts is Equoria-2y91o, confirmed systemic at all four sites its evidence lists. The in-house reference for doing counts right already exists in the same controller: `getUserRankSummary`'s raw `COUNT`/`HAVING` "ahead" queries (`leaderboardController.mjs:523-577`).

Child issue: cache the `/competition` branch keyed on `discipline:period:metric:limit:offset` (same 300s convention), depends-on/pairs-with 4qpqb (real `COUNT(DISTINCT)`) and 2y91o (deterministic order — a cache of an unstable order is a cached lie).

### 4.2 [P2] `fetchHorseDetailsByIds` fetches full Horse rows for a 3-field read

`leaderboardCompetitionQueries.mjs:24-29` — top-level `include` returns every JSONB column; consumers read `name`, `userId`, `user.username`. The identical fix was already applied to `getTopHorsesByPerformance` (Equoria-847r, comment at `leaderboardController.mjs:174-182`) but never carried over. Fix: `select: { id, name, userId, user: { select: { username } } }`.

### 4.3 [P2] `UserRankSnapshot` grows 4 rows/user/day forever; the summary read fetches all of it

The nightly snapshot job has no retention purge (only GDPR-delete touches the table), and `getUserRankSummary` (`leaderboardController.mjs:593-607`) fetches the **entire** per-user snapshot history on every profile view (uncached by design) to dedupe in JS — ~1,460 rows/request after a year, unbounded. Two child issues: (a) a retention purge mirroring `auditLogRetentionService` (window decision: rank history UI reads max 365 days); (b) fix the read with `distinct: ['category']` + `orderBy: { capturedAt: 'desc' }` and `Promise.all` the ~11 independent sequential aggregates in the same function.

### 4.4 [P3] Small items

`GET /api/horses` accepts an uncapped client `limit` (`horseRoutes.mjs:75` — default 200 straight from the query string; bounded in practice by per-user roster size) — clamp it when the §5 cap policy lands. `getTopHorsesByPerformance` silently ignores documented `limit/offset` — already filed as Equoria-9svu0.

---

## §5. ONE cursor-based pagination convention (design)

### 5.1 What the inventory says (27 surfaces audited)

- Only **one** live endpoint has a deterministic sort today: `getTransactionsForUser` (`[{createdAt:'desc'},{id:'desc'}]`). Ties on `level`/`xp`/`totalEarnings`/`runDate`/`lastActivityAt` are the **norm** — a cursor design must assume non-unique primary sort keys.
- The frontend renders **numbered Previous/Next pages** consuming `total`/`totalPages` on leaderboards, marketplace, and forum (verified in `LeaderboardsPage.tsx`, `HorseMarketplacePage.tsx`, `forum.ts`). A cursor-only, no-totals API is a UI regression on those surfaces.
- A real in-house keyset precedent exists: the admin backfill loop (`adminController.mjs:391-422` — `cursor: {id}, skip: 1, orderBy: {id:'asc'}`, chosen explicitly to avoid OFFSET drift).
- Two **unused** cursor-helper scaffolds exist (`paginationHelper.mjs:216-300`, `apiResponseOptimizationService.mjs:70-149` — the latter only reachable via a labs metrics route) plus a dead-but-correct leaderboard service (`leaderboardService.mjs` — proper tiebreakers, unreachable via any route). Three parallel almost-implementations must collapse to one.
- Limit caps are a patchwork: 50 / 100 / fixed / 200-uncapped.

### 5.2 The convention

**Ordering contract.** Every paginated query's `orderBy` MUST terminate in a unique key: `orderBy: [...domainSort, { id: <dir> }]`. This is Equoria-2y91o's fix, promoted to a convention — it is a prerequisite for stable cursors _and_ it fixes today's OFFSET skip/duplicate bug even before any endpoint migrates.

**Cursor encoding.** The cursor is the tuple of the current page's last row's `orderBy` values, in order, ending with `id`. Wire format: `base64url(JSON.stringify([v1, v2, ..., id]))`. Opaque to clients; version-prefix (`"c1:"`) so the shape can evolve. Server rejects undecodable cursors with 400.

**Query shape.** Keyset predicate, not OFFSET: for `orderBy: [{x:'desc'},{id:'desc'}]`, `WHERE (x, id) < ($1, $2) ORDER BY x DESC, id DESC LIMIT n+1`. Prisma path: for single-model queries use Prisma `cursor: { id }` + `skip: 1` (valid because the trailing unique key makes the position deterministic); for tuple comparisons Prisma can't express (mixed directions) or `groupBy` aggregates, use `$queryRaw` row-value comparison. Fetch `limit+1` rows; the extra row's presence is `hasMore`, its key is `nextCursor`.

**Request contract.** `?cursor=<opaque>&limit=<n>`; `limit` default **20**, max **100**, clamped server-side by ONE shared helper (closing the cap patchwork, including `GET /api/horses`). `cursor` absent = first page. During migration, endpoints keep accepting `page`/`offset`; if `cursor` is present it wins.

**Response envelope.**

```json
{ "items": [...], "pageInfo": { "nextCursor": "c1:...", "hasMore": true, "total": 1234 } }
```

`total` is **optional and decoupled from the page query**: for the three numbered-page UIs it is a real bounded `count(where)` (or the 4qpqb `COUNT(DISTINCT)` replacement) cached with the endpoint's existing TTL; new surfaces should prefer `hasMore`-only (frontend moves to Previous/Next-without-page-numbers or load-more per surface, at that surface's own pace — never forced by the backend migration).

**Sanctioned exception — aggregate leaderboards.** Prisma `groupBy` leaderboards (wins/earnings/placements) cannot keyset-paginate on the aggregate without a materialized ranking. For those: keep `skip`/`take` **but** require (a) the 2y91o tiebreaker, (b) the §4.1 cache in front (within a 300s cache window the offset pages are internally consistent — the drift OFFSET suffers under concurrent writes is absorbed by the cache snapshot), (c) bounded counts. Document the exception in the helper's JSDoc so it doesn't become the default.

**One canonical helper.** Implement in `backend/utils/paginationHelper.mjs` (rewriting its dead cursor half), delete the `apiResponseOptimizationService` PaginationService, and delete or wire the dead `leaderboardService.mjs` duplicate — one decision child issue covers the consolidation.

### 5.3 Rollout order (by write-frequency × player impact)

1. Trailing tiebreakers everywhere (2y91o — independent, ship first).
2. Helper + contract (child issue, depends on 1).
3. Write-hot surfaces: competition results lists, horse XP/trait history, transactions (already tiebroken — trivial), messages.
4. Numbered-page surfaces with totals kept: marketplace, forum, leaderboard user lists.
5. Bound the never-paginated endpoints (horse competition history ×2, clubs/elections lists, trait history's uncapped limit, notifications) under the same helper.

---

## §6. Index coverage (all migration-gated — SQL posted on the issue, user approves before any run; one migration lane, serialized with e7tgc.1/icqqm/lffdv/etc.)

Project precedent (qh6jk/rsqqc audit): **no index ships without a demonstrated query shape**, because the horse table is the busiest write path in the game and write amplification is certain while read benefit is hypothetical until EXPLAIN'd. Every child issue below carries (a) the exact query it serves with file:line, (b) the exact `@@index` line, (c) an EXPLAIN-before/after AC.

### 6.1 Missing indexes (ranked)

| Rank | Model                                                                    | Proposed index                                                                                                          | Serving query (evidence)                                                                                                                                                                   |
| ---- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1    | `TrainingLog` (**zero indexes today** — verified, schema.prisma:582-593) | `@@index([horseId, discipline, trainedAt(sort: Desc)])` + `@@index([horseId, trainedAt(sort: Desc)])`                   | `getLastTrainingDate` / `getAnyRecentTraining` (`trainingModelService.mjs:79-87,172-179`) — gates **every** training action; full scan per check, table grows per session                  |
| 2    | `Horse`                                                                  | `@@index([inFoalSinceDate])`                                                                                            | daily foaling cron scans all horses for the due-pregnant subset (`foalingService.mjs:592-596,630-635`); sparse column, ideal single-column index                                           |
| 3    | `CompetitionResult`                                                      | `@@index([horseId, runDate(sort: Desc)])`                                                                               | horse detail + horse-list batch recent-results (`resultModelService.mjs:147-158`, `horseRouteQueries.mjs:88-100`); existing `(horseId,score)` doesn't serve the runDate sort               |
| 4    | `GroomAssignment`                                                        | `@@index([userId, createdAt(sort: Desc)])`                                                                              | every "My Grooms" load, salary calc, stats (`groomAssignmentService.mjs:295-464`) — **no index on this FK at all**                                                                         |
| 5    | `Show`                                                                   | `@@index([status, runDate])` + `@@index([runDate])`                                                                     | competition browser (`competitionRoutes.mjs:51-53`), dashboard upcoming shows (`userController.mjs:189-199`)                                                                               |
| 6    | `User`                                                                   | `@@index([level(sort: Desc), xp(sort: Desc)])`                                                                          | level leaderboard (`leaderboardController.mjs:26-49`)                                                                                                                                      |
| 7    | `Horse`                                                                  | `@@index([totalEarnings(sort: Desc)])`                                                                                  | earnings leaderboards (`leaderboardController.mjs:246-330`)                                                                                                                                |
| 8    | `CompetitionResult`                                                      | `@@index([discipline, runDate])` + `@@index([placement, runDate(sort: Desc)])`                                          | the uncached `/competition` leaderboard groupBys + recent winners (`leaderboardCompetitionQueries.mjs:32-98`, `leaderboardController.mjs:358-390`)                                         |
| 9    | `Rider`, `Trainer`                                                       | `@@index([retired, careerWeeks])` each                                                                                  | weekly retirement cron (`riderTrainerRetirementService.mjs:47-53,92-98`) — the exact composite already exists on `Groom` (schema line 393) but was never mirrored                          |
| 10   | `Rider`, `Trainer`                                                       | `@@index([userId, retired])` each                                                                                       | "My Riders/Trainers" pages (soft miss — bitmap-AND currently covers)                                                                                                                       |
| 11   | `GroomInteraction`                                                       | `@@index([foalId, timestamp])`                                                                                          | 4+ call sites filter `{foalId, timestamp range}` (`groomSystem.mjs:429`, `dailyCareAutomation.mjs:319`, `enhancedMilestoneEvaluationSystem.mjs:276`, `environmentalTriggerSystem.mjs:191`) |
| 12   | `Horse`                                                                  | `@@index([age])`                                                                                                        | nightly foal trait cron `age IN (0,1)` full scan (`foalTraitEvaluation.mjs:57-66`)                                                                                                         |
| 13   | `HorseSale`                                                              | `@@index([sellerId, soldAt(sort: Desc)])` + `@@index([buyerId, soldAt(sort: Desc)])`                                    | sale history (`marketplaceController.mjs:681-694`)                                                                                                                                         |
| 14   | `User.username` case-insensitive prefix search                           | **not expressible in Prisma schema** — needs raw-SQL functional index (`LOWER(username) text_pattern_ops`) or `pg_trgm` | `searchUsers` (`userController.mjs:834-856`) — `mode:'insensitive'` can't use the plain `@unique` btree                                                                                    |

Deliberately **not** proposed: GIN on `Horse.temporaryEpigeneticFlags` — the only filter is `not: []` (an inequality GIN can't serve), and the qh6jk audit already dropped 9 speculative JSONB GINs. `Horse.dateOfBirth` (two window-bounded cron filters) is left as a decision inside the Horse-index child issue: three new btree indexes on the hottest write table is already the cautious ceiling.

Community/messaging FK indexes (DirectMessage/Forum/Club) are **Equoria-lffdv** — already filed and migration-gated; not duplicated here.

### 6.2 Redundant strict-prefix indexes (drop candidates — write-amp with no read benefit)

Each is a strict prefix of another index (or of the unique-constraint index) on the same model: `GroomAssignment@@index([foalId])`, `TraitHistoryLog@@index([horseId])`, `MilestoneTraitLog@@index([horseId])`, `UltraRareTraitEvent@@index([horseId])`, `GroomHorseSynergy@@index([groomId])`, `GroomAssignmentLog@@index([groomId])`, `GroomTalentSelections@@index([groomId])`, `GroomMetrics@@index([groomId])`, `RiderAssignment@@index([riderId])`, `TrainerAssignment@@index([trainerId])`, `ShowEntry@@index([showId])`, `StaffMarketplaceState@@index([userId])` (12 total; schema lines in the child issue). Same EXPLAIN-verify + migration-gate discipline as additions; `Groom@@index([retired])` was checked and deliberately kept (used standalone).

---

## §7. Cron & background load

### 7.1 [P1] Two schedulers, never cross-checked, colliding schedules

Two independent registries exist: `CronJobService` (`services/cronJobs.mjs`, 12 jobs, all wrapped in `runWithHeartbeat`) and `initializeCronJobs()` (`services/cronJobService.mjs`, 5 jobs, advisory-lock only). Verified collisions: `dailyHorseAging` **and** `foaling` both at `5 0 * * *`; `tokenCleanup` at `0 3 * * *` — the same minute as `nightlyShowExecution`, the heaviest job in the system. Each simultaneous job pins a pool connection for its lock (§1.2). Child issue: de-collide (stagger minutes), and make one canonical schedule table (this doc's §7.3 is the audit snapshot; the code registries are the source of truth to fix).

### 7.2 [P1] Half the cron surface is invisible to `/api/admin/cron/health`

`adminController.mjs:23` imports only the first scheduler; the 5 second-registry jobs (weeklySalaries, tokenCleanup, foaling, riderTrainerRetirement, userRankSnapshot) never touch `runWithHeartbeat` — no `CronRunLog` rows, no staleness alert. weeklySalaries is exactly the job where a silent stall or double-run (Equoria-icqqm) most needs an operator signal; note also that the exported `triggerSalaryProcessing()` (`cronJobService.mjs:148-168`) calls `processWeeklySalaries()` directly, **bypassing even the advisory lock** (appended as evidence to icqqm). Child issue: wrap the 5 jobs in `runWithHeartbeat` (or register them in the first scheduler) so the health endpoint sees the whole surface.

### 7.3 Schedule/scaling snapshot (UTC)

| Time      | Job                                  | Scales to 10k horses?                                                                                                               | Heartbeat? |
| --------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| 00:00     | dailyTraitEvaluation                 | risky — N+1 per foal, unindexed `age` filter                                                                                        | ✅         |
| 00:05     | dailyHorseAging **⚠ collision**      | risky — full-table scan, redundant re-fetch + up to 3 extra round-trips per birthday horse (`horseAgingSystem.mjs:111-122,192-399`) | ✅         |
| 00:05     | foaling **⚠ collision**              | yes (gestation-bounded) but pays §3 walker per foal                                                                                 | ❌         |
| 00:10     | dailyFoalMilestoneEvaluation         | yes (window-bounded)                                                                                                                | ✅         |
| 00:15 Mon | weeklyRiderTrainerCareerWeeks        | yes — O(1) `updateMany` (gold standard)                                                                                             | ✅         |
| 00:20     | temporaryFlagExpiry                  | yes                                                                                                                                 | ✅         |
| 00:30 Mon | weeklyFlagEvaluation                 | yes (window-bounded, N+1 inside)                                                                                                    | ✅         |
| 02:00     | userRankSnapshot                     | yes — set-based rewrite (gold standard, Equoria-ky0x)                                                                               | ❌         |
| 03:00     | nightlyShowExecution **⚠ collision** | **no — §2.1/§2.2**                                                                                                                  | ✅         |
| 03:00     | tokenCleanup **⚠ collision**         | yes                                                                                                                                 | ❌         |
| 03:30     | auditLogRetention                    | yes — scoped bulk delete                                                                                                            | ✅         |
| 03:45     | hoofConditionDecay                   | yes — 3× `updateMany` (gold standard)                                                                                               | ✅         |
| 04:00     | docCoverageSnapshot                  | yes                                                                                                                                 | ✅         |
| 04:15     | cronRunLogRetention                  | yes                                                                                                                                 | ✅         |
| 09:00 Mon | weeklySalaries                       | risky — linear growth, per-user tx, per-row creates, **no idempotency (icqqm)**                                                     | ❌         |
| 09:30 Mon | riderTrainerRetirement               | yes — O(1) `updateMany`                                                                                                             | ❌         |
| \*/15     | electionStatusTransition             | yes — O(1)                                                                                                                          | ✅         |

### 7.4 Job-level fixes (children)

- **[P2] dailyHorseAging:** drop the redundant per-horse re-`findUnique` (the outer query already has the data), batch the birthday updates; linear-in-herd cost with no batching today.
- **[P3] weeklySalaries:** `createMany` for payment rows (idempotency itself is icqqm's scope).
- **[P3] dailyTraitEvaluation / weeklyFlagEvaluation:** bounded-concurrency batching; populations are window-bounded today, cost grows with breeding rate.

Known-good to preserve as templates: `hoofConditionDecay` (idempotent expected-level `updateMany` ladder), `userRankSnapshotService` (3 set-based reads + binary-search ranker + one `createMany`), `weeklyRiderTrainerCareerWeeks`, the foaling job's atomic per-mare claim.

---

## §8. Caching

The in-house query cache is real and well-built: `getCachedQuery` (`utils/cacheHelper.mjs:295`) — Redis via circuit breaker, bounded in-memory fallback (1,000 items), used with proper write invalidation on horses/grooms/training/users. The problems are at the edges:

### 8.1 [P2, latent P1] HTTP response caching is default-ALLOW on every GET

`apiResponseOptimizationService.mjs:398-419` (verified): the globally-mounted `responseOptimization()` middleware applies `Cache-Control: public, max-age=300, stale-while-revalidate=60` to **every** successful GET/HEAD unless the handler already set a `Cache-Control` — and only a handful do (health, auth profile, one horse route). **No `Vary` header exists anywhere.** Today this is masked solely by the frontend's unconditional `cache: 'no-store'` (`apiClient.ts:140`) and the absence of a CDN — one new API consumer, one CDN, or one deleted client line turns this into cross-session (potentially cross-user, absent `Vary`) stale-private-data serving with zero server-side signal. For a game whose constitution forbids serving stale state players decide on, the default is backwards. Child issue: invert to `no-store` default + explicit opt-in allow-list (breeds, trait definitions, show schedule metadata) + `Vary: Authorization/Cookie` on anything opted in. §8.5 is the classification the allow-list implements.

### 8.2 [P2] Horse XP history cache is never invalidated (real staleness bug)

`horseXpController.mjs:379` (verified): `invalidateCache(`horse:xp:history:${id}_`)` — but `invalidateCache` is exact-key; the `_` is a literal. Stored keys are parameterized (`:limit:offset`), so the delete never matches; players see pre-award history for up to 60s. Fix: `invalidateCachePattern` (used correctly in 4 sibling files).

### 8.3 [P2] Unbounded per-request metrics Map

`apiResponseOptimizationService.mjs:186` (verified): `performanceMetrics.serializationTime.set(Date.now(), ...)` on every JSON response, no cap/TTL/eviction, read only by a labs route. One entry per request forever between deploys. Sibling of Equoria-hikk1 (memory-service alerts array). Fix: delete the instrumentation or cap it like `cacheHelper`'s localCache.

### 8.4 [P3] Diagnostics that misbehave under concurrency

`resourceManagement.mjs:327-380` monkey-patches the shared client's `$queryRaw` per request (corrupts `X-DB-Queries` headers under interleaving; use `AsyncLocalStorage`); `:385-419` sends 408 without cancelling the DB work (§1.2).

### 8.5 Cache-safety classification (implements the §8.1 allow-list)

- **SAFE (long TTL, public):** breeds, trait definitions, breed genetic profiles (boot-preloaded), show _rules/discipline_ metadata. Identical for every player; no decision is made on freshness.
- **SHORT-TTL (≤300s, existing convention):** leaderboards (already), open-show browse lists, global stats. Display-only; every mutation path re-validates inside its transaction (e.g. `enterShowAtomicTx` re-checks `status:'open'`), so staleness affects what's _shown_, never what's _allowed_.
- **NEVER (`no-store`):** balance/bank/transactions, horse state (stats/health/XP/ownership), inventory & equip state, groom/rider/trainer rosters, auth/session/profile, CSRF, anything escrow- or settlement-adjacent. The cached value would be the direct input to a player's next decision or a session-correctness signal.

---

## §9. Already good — do not re-fix

`HORSE_LIST_SELECT` scoping + batched recent-results on the horse list (Equoria-55bo); single-query ownership middleware; `userRankSnapshotService` set-based rewrite; `getUserRankSummary`'s raw COUNT/HAVING "ahead" queries (the reference for fixing 4qpqb); `lineageTree` batched BFS + its N+1 sentinel test; rider-assignment batching in the ridden show path; `hoofConditionDecay`/`weeklyRiderTrainerCareerWeeks`/`electionTransition` O(1) updateMany jobs; the foaling job's atomic per-mare claim; scoped retention deletes (audit log, cron run log); the singleton Prisma client; `getTransactionsForUser`'s tiebroken pagination; the admin keyset backfill loop; bounded auth/MFA/rate-limit caches.

---

## §10. Findings → filed issues

Epic: **Equoria-cmw85** (filed 2026-07-07; each child cites its doc section).

| Issue            | Doc §          | Child issue                                                                             | Pri |
| ---------------- | -------------- | --------------------------------------------------------------------------------------- | --- |
| Equoria-cmw85.1  | §2.1           | Restructure executeClosedShows settlement (createMany + bounded money txs + retry-wrap) | P1  |
| Equoria-cmw85.2  | §2.2           | Per-show failure isolation + partial-show recovery                                      | P1  |
| Equoria-cmw85.3  | §3.1           | Shared batched ancestor-walker (root fix)                                               | P1  |
| Equoria-cmw85.4  | §3.2           | Batch analyzePopulationInbreeding                                                       | P1  |
| Equoria-cmw85.5  | §3.3           | Fix generateOptimalBreedingRecommendations pair loop                                    | P1  |
| Equoria-cmw85.6  | §4.1           | Cache GET /api/leaderboards/competition                                                 | P1  |
| Equoria-cmw85.7  | §6.1#1         | TrainingLog indexes (migration-gated)                                                   | P1  |
| Equoria-cmw85.8  | §7.1           | De-collide cron schedules                                                               | P1  |
| Equoria-cmw85.9  | §7.2           | Heartbeat coverage for the 5 second-registry jobs                                       | P1  |
| Equoria-cmw85.10 | §1.3           | Pool sizing decision + reconcile stale pool docs                                        | P1  |
| Equoria-cmw85.11 | §2.3           | Conformation show batching + select scoping                                             | P2  |
| Equoria-cmw85.12 | §2.4           | Bound + scope resultModelService reads                                                  | P2  |
| Equoria-cmw85.13 | §3.1 table     | foalingService.gatherLineage on the shared walker                                       | P2  |
| Equoria-cmw85.14 | §3.4           | Dedupe diversity-report recomputation                                                   | P2  |
| Equoria-cmw85.15 | §3.5           | Drop unused competitionResults includes in lineageTree                                  | P2  |
| Equoria-cmw85.16 | §4.2           | Select-scope fetchHorseDetailsByIds                                                     | P2  |
| Equoria-cmw85.17 | §4.3           | UserRankSnapshot retention purge                                                        | P2  |
| Equoria-cmw85.18 | §4.3           | getUserRankSummary distinct-on + parallelize                                            | P2  |
| Equoria-cmw85.19 | §5.2           | Canonical cursor pagination helper + contract                                           | P2  |
| Equoria-cmw85.20 | §5.3           | Migrate write-hot surfaces to cursor convention                                         | P2  |
| Equoria-cmw85.21 | §5.3           | Migrate numbered-page surfaces (totals kept)                                            | P2  |
| Equoria-cmw85.22 | §5.3           | Bound the never-paginated endpoints                                                     | P2  |
| Equoria-cmw85.23 | §6.1#3,8       | CompetitionResult indexes (migration-gated)                                             | P2  |
| Equoria-cmw85.24 | §6.1#2,7,12    | Horse table indexes (migration-gated, write-amp decision)                               | P2  |
| Equoria-cmw85.25 | §6.1#4,9,10,11 | Staff-domain indexes (migration-gated)                                                  | P2  |
| Equoria-cmw85.26 | §6.1#5,6,13    | Show/User/HorseSale indexes (migration-gated)                                           | P2  |
| Equoria-cmw85.27 | §7.4           | dailyHorseAging batching                                                                | P2  |
| Equoria-cmw85.28 | §8.1           | Invert HTTP cache default to no-store + allow-list + Vary                               | P2  |
| Equoria-cmw85.29 | §8.2           | Fix horse XP history invalidation                                                       | P2  |
| Equoria-cmw85.30 | §8.3           | Cap/delete serializationTime metrics Map                                                | P2  |
| Equoria-cmw85.31 | §2.5           | Delete deprecated instant-competition dead code                                         | P3  |
| Equoria-cmw85.32 | §3.6           | Precompute founders descendant map                                                      | P3  |
| Equoria-cmw85.33 | §3.6           | dynamicCompatibilityScoring redundant refetch                                           | P3  |
| Equoria-cmw85.34 | §5.2           | Consolidate/delete dead pagination scaffolds + dead leaderboardService                  | P3  |
| Equoria-cmw85.35 | §6.2           | Drop 12 redundant strict-prefix indexes (migration-gated)                               | P3  |
| Equoria-cmw85.36 | §6.1#14        | username case-insensitive search index (raw SQL decision)                               | P3  |
| Equoria-cmw85.37 | §7.4           | weeklySalaries createMany batching                                                      | P3  |
| Equoria-cmw85.38 | §7.4           | Trait/flag evaluation bounded-concurrency batching                                      | P3  |
| Equoria-cmw85.39 | §8.4           | AsyncLocalStorage for DB diagnostics middleware                                         | P3  |
| Equoria-cmw85.40 | §8.4           | Request-timeout does not cancel DB work                                                 | P3  |
| Equoria-cmw85.41 | —              | Retire databaseOptimizationService (dead; own Redis client; rsqqc step 5 decision)      | P3  |

New evidence appended to existing issues during this review: Equoria-icqqm (triggerSalaryProcessing bypasses the advisory lock; job invisible to cron health), Equoria-vck0 (three parallel age/stage systems recomputed nightly), Equoria-mquci (pool-of-3 compounding arithmetic).

Existing issues cited, not duplicated: Equoria-2y91o (tiebreakers — prerequisite of §5), 4qpqb (unbounded counts — both sites), lffdv (community FK indexes), icqqm (salary idempotency — lock-bypass evidence appended), xal4m (totalEarnings starvation), mquci (advisory-lock connection), hikk1 (alerts array leak), 9svu0 (ignored leaderboard params), vck0 (ageStage cache — "three overlapping age systems" evidence appended), 6lobd (average_placement 500).

---

## §11. What was NOT done, and closed decisions

**Not done (each has a home):**

- **No EXPLAIN ANALYZE runs.** This audit is static analysis of query shapes vs. schema. Per the rsqqc precedent, every index child issue carries an EXPLAIN-before/after acceptance criterion — the proof lands with the migration, not here.
- **No load testing / latency measurement.** Impact estimates are analytic (query counts as functions of N). If a finding's severity is disputed, measure before arguing.
- **No fixes implemented** — per the window's mandate. Index snippets are proposals inside issues; nothing applied.
- **Frontend pagination migration design** is sketched only to the contract level (§5.2); per-surface UI decisions (numbered pages vs. load-more) belong to each migration child.

**Closed decisions (no issue filed — nothing remains to do):**

- **No GIN on `temporaryEpigeneticFlags`:** the only production filter is `not: []`, which GIN cannot serve; adding one would repeat the qh6jk mistake.
- **First-run retention purge is unchunked** (`auditLogRetention`/`cronRunLogRetention`): steady-state purges are incremental; the one-time large delete at first deploy is self-limiting and observable via heartbeat. Re-evaluate only if a purge ever overruns its heartbeat window.
- **`getGameNotifications` fixed `take:100`:** acceptable bound; the §5.3 never-paginated child covers it only if the UI ever needs history beyond 100.
- **Test-env pool size (3/worker)** was recently and deliberately tuned (Equoria-6s3fl) — out of scope here.

**Known blind spots:** economy/bank, traits, grooms interaction write paths, and users routes were only touched where they intersected the five scope areas; a same-method pass over those modules is a candidate follow-up if this epic's fixes measurably move the needle.
