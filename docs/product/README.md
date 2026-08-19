# Product Compatibility Paths

**Status:** Compatibility only
**Last reviewed:** 2026-08-19

Root `PRODUCT.md` is Equoria's sole durable product authority. Root `DESIGN.md`
governs its player-facing expression.

The two PRD-named files in this directory remain only because
`backend/__tests__/authRateLimitDocDrift.sentinel.test.mjs` reads their exact
paths. They are deliberately tiny, non-authoritative stubs. Never load this
directory for product, design, feature, security, or engineering work, and do
not rebuild the retired PRD set around them.
