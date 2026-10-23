/**
 * 🌐 CORS + NO-ORIGIN POLICY (Equoria-515lv)
 *
 * Single authoritative source for the cross-origin policy, extracted verbatim
 * from app.mjs. Two cooperating layers, applied in this order by app.mjs:
 *   1. enforceNoOriginPolicy — hard-rejects no-origin mutations on API paths.
 *   2. cors(corsOptionsDelegate) — validates the Origin value against the
 *      allow list when present.
 *
 * Scope of the no-origin gate: STATE-CHANGING methods (POST/PUT/PATCH/DELETE)
 * targeting `/api/*`, AND only when a browser fetch signature (Sec-Fetch-Mode)
 * is present. Read-only GETs and non-browser CLI clients are intentionally
 * exempt — see the long-form rationale that previously lived inline in app.mjs.
 *
 * Defense in depth: CSRF (cookie + header double-submit) still fires on
 * authenticated mutations regardless of this gate.
 *
 * There is no machine-client API-key fallback. The prior dead `validateApiKey`
 * middleware was removed — do not reintroduce it.
 */

import config from './config.mjs';
import logger from '../utils/logger.mjs';

// Code carried by the error the delegate hands to cors()'s next(err), and by the
// 403 body errorHandler turns it into (Equoria-vsgi5).
export const ORIGIN_NOT_ALLOWED_CODE = 'ORIGIN_NOT_ALLOWED';
export const ORIGIN_NOT_ALLOWED_MESSAGE = 'This origin is not allowed to use the Equoria API.';

const NO_ORIGIN_ENFORCED_PREFIXES = ['/api/'];
const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const requiresOriginCheck = req => {
  if (!STATE_CHANGING_METHODS.has(req.method)) {
    return false;
  }
  // Sec-Fetch-Mode is injected by browsers for all fetches/navigations; CLI
  // tools (curl, wget, server-to-server) never set it. Skip Origin enforcement
  // for non-browser clients so E2E CLI tests and service calls aren't blocked.
  if (!req.get('Sec-Fetch-Mode')) {
    return false;
  }
  return NO_ORIGIN_ENFORCED_PREFIXES.some(
    prefix => req.path === prefix.replace(/\/$/, '') || req.path.startsWith(prefix),
  );
};

/**
 * Express middleware: rejects no-origin state-changing API mutations from
 * browser clients with a 403. Reflects everything else through.
 */
export const enforceNoOriginPolicy = (req, res, next) => {
  if (req.get('Origin')) {
    return next();
  }
  if (!requiresOriginCheck(req)) {
    return next();
  }
  logger.warn(`Blocked no-origin API mutation: ${req.method} ${req.path}`);
  return res.status(403).json({
    success: false,
    message: 'Origin header required',
    code: 'NO_ORIGIN_BLOCKED',
  });
};

// Local development origins. Built in everywhere except production, where the
// allow-list is ALLOWED_ORIGINS alone, so a page on a player's own loopback
// cannot make credentialed calls to the live API (Equoria-xb9oc, owner
// decision 2026-07-07). NODE_ENV=beta keeps them: it is the Playwright
// production-parity profile, run in CI with a localhost frontend and no
// ALLOWED_ORIGINS (test.yml e2e-tests, update-visual-baselines.yml).
const LOCAL_DEV_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
];

// Auto-accept same-origin requests: the browser sends `Origin` on mutations
// (and some GETs) even when the request targets the exact same host that
// served the page. Rejecting those would break the production SPA whenever
// ALLOWED_ORIGINS isn't explicitly configured. Compare the Origin's host
// against the request's Host header; if they match, treat the Origin as
// implicitly allowed.
const isSameOrigin = (origin, hostHeader) => {
  if (!origin || !hostHeader) {
    return false;
  }
  try {
    const { host: originHost } = new URL(origin);
    return originHost.toLowerCase() === hostHeader.toLowerCase();
  } catch {
    return false;
  }
};

/**
 * cors() option delegate: reflects no-origin and same-origin requests, allows
 * ALLOWED_ORIGINS (plus the local dev origins outside production), and
 * refuses everything else (error code ORIGIN_NOT_ALLOWED, answered 403).
 */
export const createCorsOptionsDelegate =
  ({ nodeEnv, allowedOrigins: configuredOrigins }) =>
  (req, callback) => {
    const origin = req.header('Origin');
    const baseOptions = {
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-CSRF-Token'],
    };

    // No-origin requests that reach this point are already exempt from the
    // state-changing-mutation gate above (safe methods, SPA HTML,
    // /health/ready/ping). Reflect them through.
    if (!origin) {
      return callback(null, { ...baseOptions, origin: true });
    }

    // Same-origin: the request's Host header matches the Origin's host. Always
    // allow — the browser sent Origin here even though same-origin requests
    // technically don't need CORS, and we shouldn't reject our own deployment.
    if (isSameOrigin(origin, req.headers.host)) {
      return callback(null, { ...baseOptions, origin: true });
    }

    const allowedOrigins = nodeEnv === 'production' ? [] : [...LOCAL_DEV_ORIGINS];
    if (configuredOrigins && configuredOrigins.length > 0) {
      allowedOrigins.push(...configuredOrigins);
    }

    if (allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, { ...baseOptions, origin: true });
    }

    logger.warn(`CORS blocked request from origin: ${origin} (host: ${req.headers.host})`);
    // A refused origin is a client error, not a server fault. errorHandler maps
    // this code to a 403 refusal (Equoria-vsgi5).
    return callback(
      Object.assign(new Error(ORIGIN_NOT_ALLOWED_MESSAGE), {
        statusCode: 403,
        code: ORIGIN_NOT_ALLOWED_CODE,
      }),
    );
  };

export const corsOptionsDelegate = createCorsOptionsDelegate({
  nodeEnv: config.env,
  allowedOrigins: config.allowedOrigins,
});
