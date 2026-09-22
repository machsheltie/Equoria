import { defineRailway, github, preserve, project, service } from 'railway/iac';

// Railway Infrastructure as Code for the Equoria backend service.
// https://docs.railway.com/infrastructure-as-code
//
// Replaces the deprecated railway.toml (Config as Code, hard cutoff
// 2026-12-01). Railway does NOT read this file at deploy time: it is applied
// to the linked project with `railway config plan` / `railway config apply`.
//
// This repository manages only its own resources in the environment. Other
// repositories export their own partial name.
// See https://docs.railway.com/infrastructure-as-code#multi-repo-projects
export const partial = 'Equoria';

export default defineRailway(() => {
  const Equoria = service('Equoria', {
    source: github('machsheltie/Equoria', { branch: 'master' }),
    build: {
      builder: 'DOCKERFILE',
      dockerfilePath: 'Dockerfile',
    },
    // Run database migrations before starting the server on every deploy.
    // prisma migrate deploy is idempotent — safe to run even with no new migrations.
    // FAIL-FAST (Equoria-oey96.35): the migrate command is chained with `&&`, so a
    // non-zero `prisma migrate deploy` exit aborts the deploy BEFORE `node server.mjs`
    // — the server never boots against a drifted/failed-migration schema. Do NOT add
    // a failure-swallowing operator (a double-pipe fallback, a semicolon, or a
    // background-ampersand) after migrate deploy; that re-opens the fail-open
    // regression the doctrine check check-railway-migrate-failfast.mjs guards
    // against. The `${DIRECT_URL:-$DATABASE_URL}` fallback (Supabase pooler, commit
    // c6c66db01) is parameter substitution, not a failure swallow — keep it.
    start:
      'sh -c \'cd /app/packages/database && (DATABASE_URL="${DIRECT_URL:-$DATABASE_URL}" npx prisma migrate deploy) && cd /app/backend && node server.mjs\'',
    healthcheck: '/health',
    healthcheckTimeout: 300,
    // Restart policy: railway.toml set ON_FAILURE with 10 retries, which is
    // Railway's platform default and what the live service instance reports.
    // `railway config apply` (CLI 5.58.0) accepts `deploy.restartPolicyType` /
    // `restartPolicyMaxRetries` but does not persist them, so declaring them
    // here leaves `railway config plan` permanently reporting drift. Leave
    // them unset unless the intended policy ever differs from the default.
    // Service variables live in Railway, never in source. IaC treats an
    // omitted variable as a DELETE, so every variable the service has must be
    // listed here with preserve() ("keep whatever value Railway already has").
    // Add a new name here when a new variable is created in the dashboard, or
    // the next `railway config apply` will remove it.
    env: {
      ALLOWED_ORIGINS: preserve(),
      API_KEY: preserve(),
      BCRYPT_SALT_ROUNDS: preserve(),
      DATABASE_URL: preserve(),
      JWT_ACCESS_TOKEN_EXPIRY: preserve(),
      JWT_REFRESH_SECRET: preserve(),
      JWT_REFRESH_TOKEN_EXPIRY: preserve(),
      JWT_SECRET: preserve(),
      LOG_LEVEL: preserve(),
      NODE_ENV: preserve(),
      PORT: preserve(),
      REDIS_DISABLED: preserve(),
    },
  });

  return project('Equoria', {
    resources: [Equoria],
  });
});
