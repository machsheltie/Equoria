# Retired Project Context — Compatibility Stub

The generated project-context template was retired to `docs/.archive/retired-2026-08-19/docs-root/project_context.md`. It prescribed obsolete versions, Radix-based UI, generic toast behavior, dashboard patterns, and testing guidance that conflicts with current Equoria doctrine.

This path remains only because a legacy documentation-drift sentinel reads it. Do not load it as project context. Use `AGENTS.md`, `CLAUDE.md`, `PRODUCT.md`, `DESIGN.md`, live source, and task-specific governed documents.

Compatibility fact enforced elsewhere: the shared auth rate limiter allows **200 failed** authentication attempts per 15-minute window and does not count successful requests. The implementation and its sentinel own that value.
