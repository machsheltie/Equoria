# SCHEMA-GENERATION-NOTES

## Plan
- Add zod (or express-validator) schema files per domain under ackend/schemas/{domain}.
- Wrap route handlers to validate req/res and export schemas for OpenAPI generation.
- Use a generator (e.g., express-zod-api or zod-to-openapi) to emit docs/api/openapi.yaml.

## Steps
1) Install tooling (future, not run): zod, zod-to-openapi (or equivalent), express-openapi-validator (optional).
2) For each route file, define request/response schemas and attach to handler metadata.
3) Add a generation script (e.g., 
ode scripts/generate-openapi.mjs) that imports schemas and writes docs/api/openapi.yaml.
4) Point Swagger UI to the generated file.

## Domains to cover
- auth, users, horses, breeding/foals, traits/epigenetics, training, competition, grooms, leaderboards, admin, docs; labs marked as experimental.
