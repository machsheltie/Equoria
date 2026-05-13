# Deferred Work

## Deferred from: code review of tech-spec-wip (2026-04-06)

- **sampleStat triangular distribution** — Box-Muller approximation `(r1+r2-1)*1.41` is triangular, not normal; stats with large std_devs are under-dispersed; revisit when breed differentiation matters more.
- **Horse name 4-digit collision** — `${BreedName} #${4-digit}` has 9000 possible values; duplicates plausible under concurrent purchases of same breed; add uniqueness suffix or retry loop if horse names gain uniqueness constraint.
- **breedsApi /api/breeds without /v1 prefix** — `breedsApi.list()` calls `/api/breeds` while all other v1 endpoints use `/api/v1/`; harmless now but will break if legacy routes are removed; migrate when API versioning is consolidated.

## Deferred from: code review of 31f-1-conformation-show-scoring-engine (2026-04-06)

- **`finalScore: 0` on error indistinguishable from real 0** — pre-existing service-layer pattern; architectural decision on error return shape needed at higher level before changing.
- **`CONFORMATION_SHOW_CONFIG` not Object.freeze'd** — consistent with all other config objects in codebase; freeze pass can be done in a dedicated hardening story.
- **`synergyScore` in breakdown can exceed 100 (up to 115)** — blocked by decision on whether synergy scale should be normalized to [0,100]; resolve after decision-needed finding on synergy range is decided.

## Deferred from: code review of igg2-election-auto-closure (2026-05-13)

- **`nominate` allows upcoming elections** — `nominate` only rejects `closed`, not `upcoming`; a candidate can self-nominate before the election opens. Intentional asymmetry or gap? Defer as a separate story if the product intent is to block nominations until the election is `open`.
- **`getElectionResults` missing membership scope gate (CWE-639)** — any authenticated user who knows an `electionId` can fetch full results regardless of club membership. Same class of fix as the Equoria-w386/c1cv scope gates on `nominate` and `vote`. Defer as a separate security hardening story.
- **`getElections` missing membership scope gate** — returns elections for any `clubId` regardless of whether the requesting user is a club member. No existence-leakage risk (clubId is required param) but does expose election metadata to non-members. Defer with `getElectionResults` gate story above.
- **`_count` field leaks in `getElections` response** — `elections.map(e => ({ ...e, status: resolveElectionStatus(e) }))` spreads `_count: { candidates: N }` into the response because `findMany` includes `_count`. Should be stripped the same way `getClubs` strips `memberCount`. Defer as a cosmetic API hygiene fix.
