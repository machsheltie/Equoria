# Backend API Contracts

**Status:** Active index
**Last reviewed:** 2026-08-19

Endpoint behavior is owned by live mounts, middleware, validators,
controllers/services, schema, tests, and consumers. This directory retains only
narrow contracts with a named drift mechanism.

- Load `rate-limiting.md` only for limiter values, counting semantics,
  overrides, Redis failure posture, mounting, or its code-to-document sentinel.
- Do not create a hand-copied endpoint catalog here.
- A new contract must name its live source, executable verification, scope,
  exclusions, and retirement trigger.

The running Swagger UI reads `backend/docs/swagger.yaml`; verify it against live
routes before relying on it. Generated or prose API descriptions never override
the implementation.
