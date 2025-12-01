# React Query Client Wiring (Plan)

## Goal
Use generated OpenAPI client for /api/v1 in the Vite/React app.

## Steps
1) After OpenAPI generation, run openapi-typescript to produce types (e.g., scripts/generate-api-client.mjs).
2) Create frontend/src/lib/api-client.ts exporting a configured fetcher/axios instance.
3) Add domain hooks under frontend/src/hooks/api/{domain}.ts using React Query + generated types.
4) Replace mock data in pages (Index, StableView) with queries to /api/v1 endpoints.
5) Add auth header injection and normalize errors (e.g., 401 → logout/redirect).

## Notes
- Handle auth (JWT) via headers; add interceptors for error handling.
- Keep labs endpoints isolated until stable.
