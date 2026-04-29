import logger from '../utils/logger.mjs';

/**
 * 21R-OBS-2 (Equoria-2ns5): redact credential-class fields from values
 * passed to logger metadata.
 *
 * Background. After 21R-OBS-1 made the Winston printf format preserve
 * metadata, the `errorRequestLogger` below — which logs `req.body`,
 * `req.query`, and `req.params` on every failed request — exposes
 * plaintext passwords, refresh tokens, reset tokens, etc. on every
 * failed `/auth/login`, `/auth/register`, `/auth/reset-password`,
 * `/auth/change-password`. Pre-OBS-1 this was silently dropped (privacy
 * by accident); post-OBS-1 it lands in stdout / SIEM. This module
 * redacts the value of any field whose key matches a credential-class
 * key name before passing it to the logger.
 *
 * Why exact-match (not substring): the legacy `sanitizeLogData` in
 * `auditLog.mjs` uses substring matching (`fieldLower.includes('auth')`)
 * which over-redacts (`authorizationStatus`, `tokenization`,
 * `passwordPolicy` would all be redacted as if they were credentials).
 * That defect is tracked separately. This redactor uses exact-key
 * matching (case-insensitive) — explicit allowlist semantics, no false
 * positives, auditable.
 *
 * Why recursive: a careless caller logs `{ user: { password } }` or
 * `{ items: [{ token }, ...] }`. Top-level-only redaction would miss
 * those. The redactor walks objects and arrays-of-objects to any depth.
 *
 * The list of credential-class keys is intentionally small and explicit.
 * Adding a new key here is a deliberate ops decision; if a new field
 * type joins the list, audit existing log call sites for back-fill.
 */
const REDACTED_KEYS = new Set([
  'password',
  'newpassword',
  'oldpassword',
  'currentpassword',
  'token',
  'refreshtoken',
  'accesstoken',
  'csrftoken',
  'jwt',
  'authorization',
  'cookie',
  'secret',
  'apikey',
  'privatekey',
  'creditcard',
  'ssn',
]);

const REDACTED_MARKER = '[REDACTED]';

/**
 * Normalise a key for credential-class matching.
 *
 * Lowercases and strips non-alphanumeric separators so the same semantic
 * field is recognised regardless of the casing convention the client used.
 * REDACTED_KEYS entries are stored in alphanumeric-only lowercase form
 * (e.g., `accesstoken`, `creditcard`), so:
 *
 *   accessToken     -> accesstoken    -> match
 *   access_token    -> accesstoken    -> match  (OAuth2 / RFC 6749 style)
 *   ACCESS-TOKEN    -> accesstoken    -> match  (header style)
 *   passwordPolicy  -> passwordpolicy -> NO match (NOT in set)
 *   tokenization    -> tokenization   -> NO match (NOT in set)
 *
 * The substring-safety guard relies on the fact that the set contains the
 * exact normalised credential names and nothing else — long words that
 * happen to start with `password`, `token`, `auth`, etc. don't collapse to
 * one of those entries after normalisation.
 */
function normaliseKey(key) {
  return String(key)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Recursively redact credential-class field values inside `value`.
 *
 *   - Objects: each own enumerable key is normalised (lowercased, with
 *     `_` and `-` and other non-alphanumerics stripped) and checked
 *     against REDACTED_KEYS. Sensitive values become '[REDACTED]'.
 *     Non-sensitive values recurse.
 *   - Arrays: each element recurses. Array indexes are not key names
 *     and are never redacted.
 *   - Primitives, null, undefined, functions: returned as-is.
 *   - Buffer, Date, Map, Set: returned as-is to avoid silent JSON
 *     serialisation surprises (the caller chose to log them).
 *
 * Non-mutating: returns a new object/array tree; never writes into the
 * caller's input. Idempotent: calling twice produces the same output.
 */
function redactCredentialFields(value) {
  if (value === null || value === undefined) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(redactCredentialFields);
  }
  if (typeof value !== 'object') {
    return value;
  }
  // Buffer / Date / Map / Set: return as-is; they don't have credential
  // keys in any normal use, and recursing into them would produce
  // unexpected output.
  const proto = Object.getPrototypeOf(value);
  if (proto !== null && proto !== Object.prototype) {
    return value;
  }

  const out = {};
  for (const key of Object.keys(value)) {
    if (REDACTED_KEYS.has(normaliseKey(key))) {
      out[key] = REDACTED_MARKER;
    } else {
      out[key] = redactCredentialFields(value[key]);
    }
  }
  return out;
}

/**
 * Request Logging Middleware
 * Logs all incoming requests with relevant details
 */
export const requestLogger = (req, res, next) => {
  const start = Date.now();

  // Log request start. The fields here are deliberately scoped to
  // non-sensitive request envelope data (method, URL, IP, userAgent).
  // Body / params / query are NOT included — see errorRequestLogger
  // below for the rationale and redaction layer.
  logger.info(`[${req.method}] ${req.originalUrl}`, {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    contentType: req.get('Content-Type'),
    contentLength: req.get('Content-Length'),
    userId: req.user?.id || 'anonymous',
  });

  // Override res.end to log response
  const originalEnd = res.end;
  res.end = function (chunk, encoding) {
    const duration = Date.now() - start;

    logger.info(`[${req.method}] ${req.originalUrl} - ${res.statusCode}`, {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userId: req.user?.id || 'anonymous',
    });

    originalEnd.call(this, chunk, encoding);
  };

  next();
};

/**
 * Error Request Logger
 *
 * Logs failed requests with additional error context. Body / query /
 * params are passed through `redactCredentialFields` so passwords,
 * tokens, secrets, and similar credential-class fields are masked
 * before reaching any log transport. See REDACTED_KEYS above for the
 * exact list and the rationale for exact-match semantics.
 *
 * 21R-OBS-2 (Equoria-2ns5): pre-redaction, plaintext passwords landed
 * in stdout / SIEM on every failed auth request. Post-redaction, every
 * sensitive value is replaced with the literal string '[REDACTED]'
 * BEFORE the metadata reaches the logger format chain.
 */
export const errorRequestLogger = (err, req, res, next) => {
  logger.error(`[${req.method}] ${req.originalUrl} - ERROR`, {
    method: req.method,
    url: req.originalUrl,
    error: err.message,
    stack: err.stack,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id || 'anonymous',
    body: redactCredentialFields(req.body),
    params: redactCredentialFields(req.params),
    query: redactCredentialFields(req.query),
  });

  next(err);
};
