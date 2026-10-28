/**
 * /api-info advertises only addresses the app actually mounts (Equoria-ccjj7, ARCH-01).
 *
 * Equoria-4bs3s removed every unversioned `/api/*` mount, and the trait-discovery
 * routes were deleted (445dceeb1), yet /api-info kept advertising `/api/auth`,
 * `/api/horses`, `/api/trait-discovery`, `/api/milestones` and the rest. Each of
 * those answered the 404 "Route not found".
 *
 * The real app's mount tree is walked: an advertised address resolves when a
 * mounted router owns its prefix or a route matches it exactly. Path-less ('/')
 * router layers are descended into but never count as owning a path, and plain
 * middleware (auth, CSRF, the /api/ rate limiter) never resolves anything, so an
 * address that only reaches the catch-all 404 handler fails.
 */

import { describe, it, expect } from '@jest/globals';
import app from '../app.mjs';
import { apiInfoHandler } from '../config/healthHandlers.mjs';

function callApiInfo() {
  let body;
  const res = {
    setHeader() {},
    json(payload) {
      body = payload;
    },
  };
  apiInfoHandler({}, res);
  return body;
}

/** True when some router or route in `stack` owns `path`. */
function resolves(stack, path) {
  for (const layer of stack) {
    const isRouter = layer.name === 'router' && Array.isArray(layer.handle?.stack);
    if (layer.route) {
      if (layer.match(path)) {
        return true;
      }
      continue;
    }
    if (!isRouter) {
      continue;
    }
    // A path-less ('/') mount matches '/' and consumes no path segment.
    if (layer.match('/') && layer.path === '') {
      if (resolves(layer.handle.stack, path)) {
        return true;
      }
      continue;
    }
    if (layer.match(path)) {
      const rest = path.slice(layer.path.length) || '/';
      // The router owns the prefix; the remainder resolves when it is the mount
      // itself or some layer inside the router owns it.
      if (rest === '/' || resolves(layer.handle.stack, rest)) {
        return true;
      }
    }
  }
  return false;
}

function advertisedAddresses(body) {
  return [body.documentation, body.versioned, body.health, ...Object.values(body.endpoints)];
}

describe('/api-info advertised addresses (Equoria-ccjj7)', () => {
  const stack = app._router.stack;

  it('the resolver rejects addresses the app does not mount', () => {
    // Planted violations: the retired unversioned and trait-discovery addresses.
    expect(resolves(stack, '/api/horses')).toBe(false);
    expect(resolves(stack, '/api/v1/trait-discovery')).toBe(false);
    expect(resolves(stack, '/api/v1/milestones')).toBe(false);
    // And accepts real ones.
    expect(resolves(stack, '/api/v1/horses')).toBe(true);
    expect(resolves(stack, '/health')).toBe(true);
  });

  it('every advertised address resolves to a mounted route', () => {
    const body = callApiInfo();
    const unresolved = advertisedAddresses(body).filter(address => !resolves(stack, address));

    expect(unresolved).toEqual([]);
  });

  it('advertises only versioned /api/v1 game endpoints', () => {
    const body = callApiInfo();

    for (const address of Object.values(body.endpoints)) {
      expect(address).toMatch(/^\/api\/v1\//);
    }
    expect(body.endpoints).not.toHaveProperty('traitDiscovery');
    expect(body.endpoints).not.toHaveProperty('milestones');
  });
});
