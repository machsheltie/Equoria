# Retired Architecture Overview — Compatibility Stub

The substantive architecture document was retired to `docs/.archive/retired-2026-08-19/docs-root/architecture.md`. It was a superseded 2025 implementation plan and is not current architecture or implementation authority.

This path remains only because a legacy documentation-drift sentinel reads it. Do not load it for implementation. Use live source and configuration, `AGENTS.md`, `CLAUDE.md`, and the narrowly scoped decisions in `docs/architecture/README.md`.

Compatibility fact enforced elsewhere: the shared auth rate limiter allows **200 failed** authentication attempts per 15-minute window and does not count successful requests. The implementation and its sentinel own that value.
