/**
 * 🗂️  STATIC ASSET CONFIGURATION (Equoria-515lv)
 *
 * Pure configuration extracted from app.mjs: which directories hold the
 * built frontend, which one is the canonical SPA root, and what Cache-Control
 * headers each served file gets.
 *
 * Behavior is intentionally identical to the prior inline logic in app.mjs —
 * this module only relocates it so the composition root reads as assembly,
 * not directory-probing. No directory probing happens at import-time beyond
 * the existsSync checks that previously ran at module top-level in app.mjs.
 */

import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// ESM equivalents of __filename / __dirname relative to backend/ root.
// This file lives in backend/config/, so the backend root is one level up.
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const backendRoot = join(__dirname, '..');

const backendPublicDir = join(backendRoot, 'public');
const frontendDistDir = join(backendRoot, '..', 'frontend', 'dist');
const frontendPublicDir = join(backendRoot, '..', 'frontend', 'public');

// Assets that must all be present for a directory to count as a complete
// SPA build (used to prefer backend/public when it has a full mirror).
const requiredFrontendAssets = [
  'index.html',
  'images/bg-stable.webp',
  'images/bg-horse-detail.webp',
  'assets/art/farrier.webp',
  'images/farriershop.webp',
];

const hasRequiredFrontendAssets = publicDir =>
  requiredFrontendAssets.every(assetPath => existsSync(join(publicDir, assetPath)));

/**
 * Directories to serve via express.static, in priority order, filtered to
 * those that actually exist. Earlier entries win for duplicate paths.
 */
export const staticAssetDirs = [backendPublicDir, frontendDistDir, frontendPublicDir].filter(
  publicDir => existsSync(publicDir),
);

/**
 * The canonical directory whose index.html is the SPA shell, or null when no
 * complete SPA build is present. Prefers backend/public when it has the full
 * required-asset mirror; otherwise falls back to frontend/dist when it has an
 * index.html.
 */
export const spaPublicDir = hasRequiredFrontendAssets(backendPublicDir)
  ? backendPublicDir
  : existsSync(join(frontendDistDir, 'index.html'))
    ? frontendDistDir
    : null;

/**
 * express.static setHeaders callback. ZAP rule 10049 ("Storable but
 * Non-Cacheable Content"):
 * - /assets/* and /fonts/* — Vite emits content-hashed filenames, safely
 *   cached forever. `immutable` skips revalidation.
 * - everything else — short-lived cache with mandatory revalidation so
 *   replacement images propagate promptly.
 */
export const setStaticCacheHeaders = (res, filePath) => {
  const urlPath = filePath.replace(/\\/g, '/');
  if (/\/assets\/[^/]+$|\/fonts\/[^/]+$/.test(urlPath)) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  } else {
    res.setHeader('Cache-Control', 'public, max-age=3600, must-revalidate');
  }
};
