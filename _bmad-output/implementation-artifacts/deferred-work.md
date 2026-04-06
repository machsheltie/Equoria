# Deferred Work

## Deferred from: code review of tech-spec-wip (2026-04-06)

- **sampleStat triangular distribution** — Box-Muller approximation `(r1+r2-1)*1.41` is triangular, not normal; stats with large std_devs are under-dispersed; revisit when breed differentiation matters more.
- **Horse name 4-digit collision** — `${BreedName} #${4-digit}` has 9000 possible values; duplicates plausible under concurrent purchases of same breed; add uniqueness suffix or retry loop if horse names gain uniqueness constraint.
- **breedsApi /api/breeds without /v1 prefix** — `breedsApi.list()` calls `/api/breeds` while all other v1 endpoints use `/api/v1/`; harmless now but will break if legacy routes are removed; migrate when API versioning is consolidated.
