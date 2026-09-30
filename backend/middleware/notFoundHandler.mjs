/**
 * notFoundHandler — app-level catch-all for undefined routes.
 *
 * In production, client-side routes (e.g. /horses/5) get the SPA's index.html
 * so the browser can boot the React router. Backend paths — /api, /health,
 * /api-docs — must ALWAYS get a JSON 404 so API callers see a real error.
 *
 * Mounting note: app.mjs mounts this with `app.use('*', ...)`. Under a mounted
 * path Express rewrites `req.path` relative to the mount point, so `req.path`
 * is '/' for every request that reaches the handler. The backend-path guard
 * therefore has to read `req.originalUrl`, never `req.path`. (Regression:
 * the original guard used `req.path`, so every unknown API route in
 * production was answered with index.html and the frontend failed with
 * `Unexpected token '<', "<!doctype "... is not valid JSON`.)
 */

const BACKEND_PATH_PREFIXES = ['/api', '/health', '/api-docs'];

/** Path portion of the request's original URL, without query or fragment. */
function requestPathname(req) {
  return String(req.originalUrl ?? req.url ?? '').split(/[?#]/)[0];
}

/** True when the request targets the backend and must never receive SPA html. */
function isBackendPath(pathname) {
  return BACKEND_PATH_PREFIXES.some(prefix => pathname.startsWith(prefix));
}

/**
 * @param {object} options
 * @param {string|null} options.spaHtml - index.html contents, or null when the
 *   SPA fallback is unavailable.
 * @param {{ warn: (message: string) => void }} options.logger
 */
export function createNotFoundHandler({ spaHtml, logger }) {
  return (req, res) => {
    if (spaHtml && process.env.NODE_ENV === 'production' && !isBackendPath(requestPathname(req))) {
      // SPA HTML pins the current bundle hash — it must never be served from
      // a stale cache, otherwise users boot an old bundle whose chunks no
      // longer exist on the server (ZAP rule 10049).
      res.setHeader('Cache-Control', 'no-store');
      return res.type('html').send(spaHtml);
    }

    logger.warn(`404 - Route not found: ${req.method} ${req.originalUrl} from ${req.ip}`);
    return res.status(404).json({
      success: false,
      message: 'Route not found',
      path: req.originalUrl,
      method: req.method,
    });
  };
}

export default createNotFoundHandler;
