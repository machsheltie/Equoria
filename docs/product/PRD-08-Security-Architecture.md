# Retired PRD-08 — Compatibility Stub

The substantive PRD was retired to the dated `docs/.archive` handoff. This path remains only because a legacy documentation-drift sentinel reads it.

It is not security or product authority. Use `.claude/rules/SECURITY.md`, live controls, and current tests. Compatibility fact: the shared auth limiter permits **200 failed** attempts per 15-minute window and skips successful requests; implementation and its sentinel own that value.

The following rows exist only for the legacy source-text sentinel. The enforced contract is `docs/api-contracts-backend/rate-limiting.md` and `backend/middleware/rateLimiting.mjs`.

| Compatibility key | Limit     | Window     |
| ----------------- | --------- | ---------- |
| **Training**      | 20 failed | 1 minute   |
| **Breeding**      | 10        | 5 minutes  |
| **Financial**     | 20        | 15 minutes |

Equoria-ftjm is resolved; the dedicated financial limiter exists in live source.
