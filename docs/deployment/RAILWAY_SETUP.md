# Equoria — Railway Deployment Guide

**Architecture:** Monolithic — Express serves the React frontend as static files.
**One deploy = backend API + frontend SPA on the same Railway service.**

---

## Prerequisites

- Railway account: https://railway.app
- GitHub repo connected to Railway
- The `railway.toml` at the project root (already committed)

---

## Step 1: Create a Railway Project

1. Go to https://railway.app/new
2. Select **Deploy from GitHub repo** → select `Equoria`
3. Railway auto-detects the `Dockerfile` and `railway.toml`

---

## Step 2: Add PostgreSQL

1. In your Railway project, click **+ New Service → Database → PostgreSQL**
2. Railway automatically sets `DATABASE_URL` in your service's environment
3. No manual connection string needed

---

## Step 3: Add Redis (optional but recommended)

Rate limiting and caching use Redis. Without it the app degrades gracefully:

- Rate limiting falls back to in-memory (single-instance only)
- Caching is disabled

To add Redis:

1. Click **+ New Service → Database → Redis**
2. Copy the `REDIS_URL` from the Redis service's Variables tab
3. Paste into your app service's Variables (see Step 4)

---

## Step 4: Set Environment Variables

In the Equoria service → **Variables** tab, add:

| Variable             | Value                    | Notes                             |
| -------------------- | ------------------------ | --------------------------------- |
| `NODE_ENV`           | `production`             | Required                          |
| `JWT_SECRET`         | _(generate below)_       | Min 32 chars                      |
| `JWT_REFRESH_SECRET` | _(generate below)_       | Min 32 chars                      |
| `COOKIE_DOMAIN`      | `.yourdomain.com`        | Your domain, or leave empty       |
| `ALLOWED_ORIGINS`    | `https://yourdomain.com` | Your Railway URL or custom domain |
| `REDIS_URL`          | _(from Redis service)_   | Optional                          |
| `SENTRY_DSN`         | _(from sentry.io)_       | Optional, leave empty to disable  |

Generate secrets:

```bash
openssl rand -base64 48
```

`DATABASE_URL` is **auto-injected** by Railway when you add the PostgreSQL service — do not set it manually.

---

## Step 5: Deploy

Push to `master` branch. Railway automatically:

1. Builds the Docker image (multi-stage: frontend build → backend production)
2. Runs `prisma migrate deploy` (applies any new migrations)
3. Starts `node server.mjs`
4. Health-checks `/health` before routing traffic

---

## Step 6: Custom Domain (optional)

In Railway → Settings → Domains:

1. Add your custom domain
2. Point your DNS CNAME to the Railway-provided hostname
3. Railway provisions SSL automatically

---

## Database Migrations

Migrations run automatically on every deploy via the `railway.toml` `startCommand`.

To run migrations manually (e.g. to check status):

```bash
# In the Railway project, open a shell on the service
cd /app/packages/database
npx prisma migrate status
```

To create a new migration locally:

```bash
cd packages/database
npx prisma migrate dev --name your-migration-name
# Commit the generated migration file
# Push to master → Railway applies it on next deploy
```

---

## Staging vs Production

Railway supports multiple environments in one project:

1. In the Railway project, click **Environments → + New Environment** → name it `staging`
2. Create a separate PostgreSQL + Redis for staging
3. Set `NODE_ENV=staging` (or `production`) in the staging environment's variables
4. Connect `staging` environment to a `develop` branch for automatic staging deploys

---

## Monitoring

- **Health check:** `https://yourapp.railway.app/health` (JSON response with service status)
- **Logs:** Railway dashboard → Deployments → Logs
- **Sentry:** Set `SENTRY_DSN` to forward errors and performance traces

---

## Troubleshooting

| Issue                              | Fix                                                                                |
| ---------------------------------- | ---------------------------------------------------------------------------------- |
| Deploy fails at Prisma generate    | Check `DATABASE_URL` is set in Railway variables                                   |
| 500 on `/health` after deploy      | DB not reachable — verify `DATABASE_URL` and PostgreSQL service is running         |
| CORS errors in browser             | Add your domain to `ALLOWED_ORIGINS` env var                                       |
| `Cannot find module` error         | Check Docker build logs — usually a missing dependency                             |
| Frontend shows 404 on page refresh | Confirm `NODE_ENV=production` is set — static serving only activates in production |
