# Retired PRD-02 — Compatibility Stub

The substantive PRD was retired to the dated `docs/.archive` handoff. This path remains only because a legacy documentation-drift sentinel reads it.

It is not product authority. Use root `PRODUCT.md`, live source, and current tests. Compatibility fact: the shared auth limiter permits **200 failed** attempts per 15-minute window and skips successful requests; implementation and its sentinel own that value.
