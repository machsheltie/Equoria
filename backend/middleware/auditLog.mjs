import logger from '../utils/logger.mjs';
import prisma from '../../packages/database/prismaClient.mjs';

/**
 * Audit Logging Middleware
 * Persists sensitive state-changing operations to the AuditLog table.
 *
 * Equoria-hjnrc (owner ruling 2026-10-22): the per-route auditLog() factory,
 * its six pre-built wrappers, the in-process suspicious-activity detector and
 * the Sentry threshold alerting were never mounted and were deleted. There is
 * no suspicious-activity detection; the live defences are the rate limiters
 * and this DB audit trail.
 *
 * Equoria-jw10w (OWASP A09): sensitive mutating operations are persisted to a
 * tamper-evident, queryable `AuditLog` DB table (see storeAuditLog below) and
 * enforced globally by construction via `globalAuditTrail` — NOT opt-in
 * per-route. Read (GET/HEAD/OPTIONS) traffic is intentionally NOT persisted:
 * the audit trail scopes to state-changing verbs (POST/PUT/PATCH/DELETE) on
 * the sensitive prefixes enumerated in SENSITIVE_AUDIT_PREFIXES. Audit writes
 * are best-effort/fail-soft: a write failure logs and is swallowed — it must
 * never break, delay-block, or 500 the underlying request.
 */

/**
 * Derive the logical resource + (best-effort) resource id from a request path.
 * `/api/auth/register` -> { resource: 'auth' }
 * `/api/v1/horses/42`  -> { resource: 'horses', resourceId: '42' }
 */
function deriveResource(path) {
  if (!path || typeof path !== 'string') {
    return { resource: null, resourceId: null };
  }
  const segments = path.split('?')[0].split('/').filter(Boolean);
  // Drop leading 'api' and an optional version segment ('v1', 'v2', …).
  let idx = 0;
  if (segments[idx] === 'api') {
    idx += 1;
  }
  if (segments[idx] && /^v\d+$/.test(segments[idx])) {
    idx += 1;
  }
  const resource = segments[idx] || null;
  // A numeric / uuid-ish segment immediately after the resource is its id.
  const candidate = segments[idx + 1];
  const looksLikeId =
    candidate &&
    (/^\d+$/.test(candidate) ||
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(candidate));
  return { resource, resourceId: looksLikeId ? candidate : null };
}

/**
 * Store audit log in the database (Equoria-jw10w).
 *
 * Best-effort / fail-soft: ANY error (validation, connectivity, schema) is
 * caught and logged — this function never throws and never rejects. It is
 * called off the request's critical path so an audit-subsystem outage cannot
 * break, delay-block, or 500 a user request. Exported for integration tests.
 *
 * Secrets in `logEntry.requestBody` / `.errorResponse` are already redacted by
 * `sanitizeLogData()` upstream; this function does not re-handle raw secrets.
 */
export async function storeAuditLog(logEntry) {
  try {
    const safeEntry = logEntry || {};
    const { resource, resourceId } = deriveResource(safeEntry.path);

    // Build a redacted metadata blob. requestBody/errorResponse are already
    // sanitized by sanitizeLogData(); params/query are low-risk but we still
    // pass them through sanitizeLogData for defence-in-depth.
    const metadata = {
      sensitivityLevel: safeEntry.sensitivityLevel ?? null,
      userEmail: safeEntry.userEmail ?? null,
      userRole: safeEntry.userRole ?? null,
      duration: typeof safeEntry.duration === 'number' ? safeEntry.duration : null,
      username:
        safeEntry.requestBody && typeof safeEntry.requestBody === 'object'
          ? (safeEntry.requestBody.username ?? null)
          : null,
      body: sanitizeLogData(safeEntry.requestBody),
      params: sanitizeLogData(safeEntry.requestParams),
      query: sanitizeLogData(safeEntry.requestQuery),
      errorResponse: safeEntry.errorResponse ?? null,
    };

    const statusCode = typeof safeEntry.statusCode === 'number' ? safeEntry.statusCode : 0;

    await prisma.auditLog.create({
      data: {
        userId: typeof safeEntry.userId === 'string' ? safeEntry.userId : null,
        action: typeof safeEntry.operationType === 'string' ? safeEntry.operationType : 'mutation',
        resource,
        resourceId,
        method: typeof safeEntry.method === 'string' ? safeEntry.method : 'UNKNOWN',
        path: typeof safeEntry.path === 'string' ? safeEntry.path : 'UNKNOWN',
        statusCode,
        ip: typeof safeEntry.ip === 'string' ? safeEntry.ip : null,
        userAgent: typeof safeEntry.userAgent === 'string' ? safeEntry.userAgent : null,
        success: statusCode > 0 ? statusCode < 400 : Boolean(safeEntry.success),
        metadata,
      },
    });
  } catch (error) {
    // Fail-soft: never propagate. A09 audit must not be on the critical path.
    logger.error('[audit] Failed to persist audit log to DB:', error?.message || error);
  }
}

const sensitiveLogFields = [
  'password',
  'token',
  'secret',
  'key',
  'auth',
  'credential',
  'ssn',
  'social',
  'credit',
  'card',
  'cvv',
  'pin',
  // Equoria-iqzn: date of birth is sensitive PII (COPPA age-gate input).
  // Substring match: redacts `dateOfBirth` (-> `dateofbirth` contains
  // `birth`) and any `dob`-named field from persisted audit metadata.
  'birth',
  'dob',
];

// Equoria-oierg: only objects and arrays are walked. A tag check, not a
// prototype identity check, so cross-realm objects (e.g. Prisma Json reads)
// still walk; Date, Buffer and Map are left as-is (matched by key only).
const sanitizeMaxDepth = 8;
const isWalkable = value =>
  Array.isArray(value) || Object.prototype.toString.call(value) === '[object Object]';

/**
 * Sanitize sensitive data for logging. Recurses (Equoria-oierg): a key
 * containing a sensitive substring has its whole subtree redacted at any depth,
 * arrays stay arrays, cycles become '[CIRCULAR]' and nesting past
 * sanitizeMaxDepth becomes '[MAX_DEPTH]' (never emitted unscanned). Never
 * mutates input. `depth` / `ancestors` are internal recursion state.
 * Exported for unit-testing pure branch coverage (Equoria-jkht)
 */
export function sanitizeLogData(data, depth = 0, ancestors = new Set()) {
  if (!data || typeof data !== 'object' || !isWalkable(data)) {
    return data;
  }
  if (ancestors.has(data)) {
    return '[CIRCULAR]';
  }
  if (depth >= sanitizeMaxDepth) {
    return '[MAX_DEPTH]';
  }
  ancestors.add(data);
  const sanitized = Array.isArray(data)
    ? data.map(item => sanitizeLogData(item, depth + 1, ancestors))
    : Object.fromEntries(
        Object.entries(data).map(([key, child]) => [
          key,
          sensitiveLogFields.some(s => key.toLowerCase().includes(s))
            ? '[REDACTED]'
            : sanitizeLogData(child, depth + 1, ancestors),
        ]),
      );
  // Ancestors only: a shared, non-cyclic reference is sanitized at every position.
  ancestors.delete(data);
  return sanitized;
}

/**
 * Equoria-jw10w — Global, enforced-by-construction audit trail.
 *
 * Mounted ONCE app-wide in app.mjs (not opt-in per route). Persists a DB
 * AuditLog row for every state-changing request (POST/PUT/PATCH/DELETE) whose
 * path begins with a sensitive prefix. Reads (GET/HEAD/OPTIONS) are NOT
 * persisted by design — the trail scopes to mutations (documented in
 * SECURITY.md A09). The classifier maps the prefix to a stable `action`.
 *
 * Path coverage rationale: auth (account/session), bank + transactions
 * (financial), breeding/breed, training, admin, and groom mutations are the
 * highest-value sensitive surfaces. Both the unversioned (`/api/...`) and
 * versioned (`/api/v1/...`) mounts are covered because authRouter is mounted
 * at BOTH in app.mjs.
 */
const AUDITED_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// Each entry: [pathTest, action]. pathTest runs against the request path with
// any leading `/api` and `/api/v1` stripped (normalized form).
const SENSITIVE_AUDIT_PREFIXES = [
  { match: p => p.startsWith('auth'), action: 'authentication' },
  // GDPR self-service account ops (Equoria-s3rf): data export + erasure are
  // among the highest-sensitivity operations a user can perform.
  { match: p => p.startsWith('account'), action: 'accountOperation' },
  { match: p => p.startsWith('bank'), action: 'transaction' },
  { match: p => p.startsWith('transactions'), action: 'transaction' },
  { match: p => p.startsWith('breeding') || p.startsWith('breed'), action: 'breeding' },
  { match: p => p.startsWith('training'), action: 'training' },
  { match: p => p.startsWith('admin'), action: 'adminOperation' },
  { match: p => p.startsWith('grooms') || p.startsWith('groom-'), action: 'groomOperation' },
];

/**
 * Strip leading /api and /api/v1 from a path for prefix classification.
 * `/api/v1/auth/login` -> `auth/login`; `/api/bank/withdraw` -> `bank/withdraw`
 */
function normalizeAuditPath(path) {
  if (!path || typeof path !== 'string') {
    return '';
  }
  const segs = path.split('?')[0].split('/').filter(Boolean);
  let i = 0;
  if (segs[i] === 'api') {
    i += 1;
  }
  if (segs[i] && /^v\d+$/.test(segs[i])) {
    i += 1;
  }
  return segs.slice(i).join('/');
}

/**
 * Classify a request into an audit action, or null if it must not be audited.
 */
export function classifyAuditAction(method, path) {
  if (!AUDITED_METHODS.has(method)) {
    return null;
  }
  const normalized = normalizeAuditPath(path);
  for (const { match, action } of SENSITIVE_AUDIT_PREFIXES) {
    if (match(normalized)) {
      return action;
    }
  }
  return null;
}

/**
 * Global audit middleware. It does NOT short-circuit in the test environment —
 * the DB trail must be verifiable by real-DB integration tests and behave
 * identically in prod and test.
 */
export const globalAuditTrail = (req, res, next) => {
  const action = classifyAuditAction(req.method, req.originalUrl || req.url || req.path);
  if (!action) {
    return next();
  }

  const startTime = Date.now();
  let audited = false;

  const persist = () => {
    if (audited) {
      return;
    }
    audited = true;
    // Fire-and-forget: storeAuditLog is fail-soft and never throws.
    storeAuditLog({
      timestamp: new Date(),
      userId: req.user?.id ?? null,
      userEmail: req.user?.email ?? null,
      userRole: req.user?.role ?? 'anonymous',
      operationType: action,
      sensitivityLevel: 'high',
      method: req.method,
      path: (req.originalUrl || req.url || req.path || '').split('?')[0],
      ip: req.ip,
      userAgent: req.get ? req.get('User-Agent') : undefined,
      statusCode: res.statusCode,
      duration: Date.now() - startTime,
      requestBody: sanitizeLogData(req.body),
      // Equoria-wp0ib: previously stored verbatim — a sensitive value in a
      // path param (e.g. /:token) or a query string (?password=...) would
      // persist into audit_logs for the 90-day retention window. Both
      // surfaces now route through the same sanitizeLogData() redactor.
      requestParams: sanitizeLogData(req.params),
      requestQuery: sanitizeLogData(req.query),
      success: res.statusCode < 400,
    });
  };

  // `finish` fires for normal responses; `close` covers aborted connections so
  // an attacker cannot evade the trail by killing the socket mid-response.
  res.on('finish', persist);
  res.on('close', persist);

  return next();
};

export default {
  globalAuditTrail,
  storeAuditLog,
  classifyAuditAction,
};
