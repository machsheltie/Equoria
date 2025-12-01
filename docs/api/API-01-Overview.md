# API-01: Equoria API Overview (Web)

## Purpose
Explain how to use the versioned /api/v1 surface, authentication, pagination, errors, and labs endpoints.

## Base URL
- Dev: http://localhost:3000/api/v1
- Prod (placeholder): https://api.equoria.example.com/api/v1

## Auth
- JWT-based (per backend config). Include Authorization: Bearer <token>.
- Session/cookie flows TBD — document once stable.

## Versioning & Stability
- Stable endpoints live under /api/v1/*.
- Experimental/labs endpoints live under /api/v1/labs/* and are non-SLO, subject to change.

## Pagination & Errors
- Pagination: page, limit (or domain-specific) — to be documented per endpoint when spec is generated.
- Errors: JSON with success: false, message, optional code/details.

## OpenAPI Spec
- Source of truth: docs/api/openapi.yaml (generated from code). Served via Swagger UI.

## Next Steps
- Generate schemas per domain (auth, horses, breeding, traits, training, competition, grooms, leaderboards).
- Add examples and error codes once spec generation is wired.
