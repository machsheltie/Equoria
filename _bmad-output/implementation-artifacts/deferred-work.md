# Deferred Work

## Deferred from: code review of tech-spec-wip (2026-04-06)

- **sampleStat triangular distribution** — Box-Muller approximation `(r1+r2-1)*1.41` is triangular, not normal; stats with large std_devs are under-dispersed; revisit when breed differentiation matters more.
- **Horse name 4-digit collision** — `${BreedName} #${4-digit}` has 9000 possible values; duplicates plausible under concurrent purchases of same breed; add uniqueness suffix or retry loop if horse names gain uniqueness constraint.
- **breedsApi /api/breeds without /v1 prefix** — `breedsApi.list()` calls `/api/breeds` while all other v1 endpoints use `/api/v1/`; harmless now but will break if legacy routes are removed; migrate when API versioning is consolidated.

## Deferred from: code review of 31f-1-conformation-show-scoring-engine (2026-04-06)

- **`finalScore: 0` on error indistinguishable from real 0** — pre-existing service-layer pattern; architectural decision on error return shape needed at higher level before changing.
- **`CONFORMATION_SHOW_CONFIG` not Object.freeze'd** — consistent with all other config objects in codebase; freeze pass can be done in a dedicated hardening story.
- **`synergyScore` in breakdown can exceed 100 (up to 115)** — blocked by decision on whether synergy scale should be normalized to [0,100]; resolve after decision-needed finding on synergy range is decided.
