#!/usr/bin/env node
/**
 * Equoria production build (Equoria-6q7cf).
 *
 * The one native build command shared by Railway (Railpack `buildCommand`,
 * see .railway/railway.ts) and CI (`production-build` job in
 * .github/workflows/test.yml). It replaces the multi-stage application
 * Dockerfile that was removed on 2026-09-30; the owner does not use Docker.
 *
 * Stages, in order, each fail-fast (the first non-zero exit stops the build):
 *   1. backend            npm ci --omit=dev --ignore-scripts
 *   2. packages/database  npm ci --include=dev --ignore-scripts (keeps the
 *                         Prisma CLI, a devDependency, which `prisma generate`
 *                         here and `prisma migrate deploy` at start both need)
 *   3. frontend           npm ci --include=dev   (tsc and vite are devDeps)
 *   4. packages/database  prisma generate (called through node, not the
 *                         Windows-oriented `npm run generate` wrapper)
 *   5. frontend           npm run build   (tsc + vite build)
 *   6. frontend           npm run verify:assets
 *
 * The backend serves frontend/dist directly (backend/config/staticAssets.mjs),
 * so nothing is copied into backend/public.
 *
 * Every stage runs from the repository root's subdirectories with relative
 * paths, so the same command works in Railpack's /app, a CI checkout, or a
 * local clone. Pass --dry-run to print the stages without executing them.
 *
 * Local caution: stage 1 installs the backend WITHOUT devDependencies. Do not
 * run this on a development checkout you intend to keep testing from.
 */

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DRY_RUN = process.argv.includes('--dry-run');

const STAGES = [
  {
    name: 'install backend (production dependencies only)',
    cwd: 'backend',
    cmd: 'npm ci --omit=dev --ignore-scripts',
  },
  // `--include=dev` is explicit because npm omits devDependencies whenever
  // NODE_ENV=production is set, and Railpack sets exactly that. The Prisma
  // CLI, tsc and vite are devDependencies that the build and start need.
  {
    name: 'install database package (includes Prisma CLI)',
    cwd: 'packages/database',
    cmd: 'npm ci --include=dev --ignore-scripts',
  },
  {
    name: 'install frontend (includes tsc and vite)',
    cwd: 'frontend',
    cmd: 'npm ci --include=dev',
  },
  {
    name: 'generate Prisma client',
    cwd: 'packages/database',
    cmd: 'node node_modules/prisma/build/index.js generate --schema=prisma/schema.prisma',
  },
  {
    name: 'build frontend',
    cwd: 'frontend',
    cmd: 'npm run build',
  },
  {
    name: 'verify required frontend assets',
    cwd: 'frontend',
    cmd: 'npm run verify:assets',
  },
];

function run(stage, index) {
  const label = `[build:production] ${index + 1}/${STAGES.length} ${stage.name}`;
  console.log(`\n${label}\n  cwd: ${stage.cwd}\n  cmd: ${stage.cmd}`);
  if (DRY_RUN) return;

  const result = spawnSync(stage.cmd, {
    cwd: path.join(REPO_ROOT, stage.cwd),
    stdio: 'inherit',
    shell: true,
    env: process.env,
  });

  if (result.error) {
    console.error(`${label} FAILED to start: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(`${label} FAILED (exit ${result.status ?? 'signal ' + result.signal})`);
    process.exit(result.status ?? 1);
  }
}

function main() {
  STAGES.forEach(run);
  console.log(
    DRY_RUN
      ? '\n[build:production] dry run complete (nothing executed).'
      : '\n[build:production] complete: dependencies installed, Prisma generated, frontend built and verified.'
  );
}

// Import-safe entry guard (.claude/rules/CONTRIBUTING.md): the stages only run
// when this file is the direct entrypoint.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
