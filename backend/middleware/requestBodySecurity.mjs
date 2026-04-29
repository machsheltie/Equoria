import { AppError } from '../errors/index.mjs';
import logger from '../utils/logger.mjs';

const FORBIDDEN_KEY = '__proto__';
const FORBIDDEN_CONSTRUCTOR_KEY = 'constructor';
const FORBIDDEN_PROTOTYPE_KEY = 'prototype';

// Sanitize a value for inclusion in a structured log payload. Truncates
// strings to a hard length cap and strips ASCII control characters
// (0x00-0x1F + 0x7F) so an attacker cannot inject CRLF, ANSI escapes, or
// other shell-control bytes via an error message that ends up in the
// log. Returns `undefined` for non-strings so the JSON-serialised log
// line stays clean. Used by the unexpected-scanner-error path of
// verifyJsonBody (21R-SEC-3-FOLLOW-1, Equoria-ixqg).
//
// Truncation operates on UTF-16 code units (matching JS string semantics),
// but back-tracks one position when the cap would split a surrogate pair.
// Splitting a surrogate produces an unpaired surrogate which JSON-serialise
// rejects in some pipelines (`Unexpected token \uD800`). Length after
// truncation is therefore either `maxLength + 1` (cap + ellipsis) or
// `maxLength` (cap - 1 + ellipsis, when boundary fell inside a pair).
function sanitizeForLog(value, maxLength) {
  if (typeof value !== 'string') {
    return undefined;
  }
  // eslint-disable-next-line no-control-regex -- intentional: stripping ASCII control chars from log payload
  const stripped = value.replace(/[\x00-\x1F\x7F]/g, '?');
  if (stripped.length <= maxLength) {
    return stripped;
  }
  // High surrogate at boundary index → back up one position so the slice
  // ends BEFORE the surrogate pair, avoiding lone-surrogate output.
  const boundaryUnit = stripped.charCodeAt(maxLength - 1);
  const isHighSurrogate = boundaryUnit >= 0xd800 && boundaryUnit <= 0xdbff;
  const safeEnd = isHighSurrogate ? maxLength - 1 : maxLength;
  return `${stripped.slice(0, safeEnd)}…`;
}

// Single source of truth for the error-message prefix that wires the
// `verifyJsonBody` / `assertNoPollutingKeys` throws to the
// `requestBodySecurityErrorHandler` matcher. Eliminates the cross-function
// string-coupling defect surfaced during ultra-think review of
// 21R-SEC-3-FOLLOW-1 (Equoria-ixqg): if both ends of the contract reference
// the same constant, a future rename can't silently break the handler match.
//
// Exported so the contract can be pinned by unit tests AND so future
// throws elsewhere in this module (depth cap, dup key, prototype pollution)
// can adopt the constant in a follow-up refactor. The legacy throws still
// use the literal 'Invalid request body:' string for now — they were
// correct before this work and a wholesale switch is out of scope per
// EDGE_CASE_FIX_DISCIPLINE §7 (no bundling).
export const ERROR_MESSAGE_PREFIX = 'Invalid request body:';

// Single source of truth for the message prefix used when the unexpected-
// scanner-error path fires inside `verifyJsonBody`. Production code logs
// this message; the silent-catch test filters spy calls by this prefix.
// Sharing the constant prevents the two ends from drifting silently —
// same hygiene as ERROR_MESSAGE_PREFIX above (21R-SEC-3-FOLLOW-1
// iteration-3 review hardening).
export const UNEXPECTED_SCANNER_LOG_PREFIX =
  '[RequestBodySecurity] Unexpected scanner error — failing closed';

// Maximum allowed JSON nesting depth. Exceeding this throws AppError(400).
// 21R-SEC-3 (Equoria-expn): without a cap, recursive scanValue() and
// assertNoPollutingKeys() can be tricked into stack overflow by a deeply
// nested payload. Combined with a silent catch upstream, that bypasses
// both the duplicate-key detector and the prototype-pollution detector.
// Codebase audit (backend/__tests__/helpers/check-depth.mjs) confirmed the
// max bracket-nesting present in real backend code/tests is 14 — well
// below 32. The cap is configurable via REQUEST_BODY_MAX_DEPTH but the
// value is read once at module load — changing it requires a process
// restart. This is intentional: in-process mutation of a security cap
// would not be auditable. Use the env var only for ops emergencies and
// only with a doctrine review; do not relax it casually.
//
// Exported so test code can pin the boundary by reference rather than
// hardcoding the value (21R-SEC-3-REVIEW-1 iteration-3, Blind Hunter F7).
export const DEFAULT_MAX_DEPTH = 32;

// Hard ceiling for any operator override. 21R-SEC-3-REVIEW-1
// review-feedback-2 (P1): without an upper bound, a numeric string that
// passes /^[1-9]\d*$/ but parses to an integer-valued float beyond
// Number.MAX_SAFE_INTEGER (e.g. '999999999999999999999999' → ~1e24)
// would set MAX_DEPTH to that float, and `if (depth > 1e24)` is
// effectively never true — the same class of bypass REVIEW-1 was filed
// to fix.
//
// Iteration-3 (Blind Hunter F3 / Edge Case Hunter F3): tightened from
// 1024 to 256. 1024 was chosen for "feels safe" rather than reasoned
// against actual call-stack budgets and amplification surface. 256 is
// 8× the default (generous for ops emergencies) but small enough that
// even a permitted-by-ceiling override (256-deep payload) cannot itself
// constitute meaningful CPU/stack pressure on the recursive scanner. An
// attacker who finds env-injection or operator typo (`256` instead of
// `64`) gets a much smaller amplification window.
//
// Exported so test code can pin the ceiling boundary by reference.
export const MAX_ALLOWED_OVERRIDE = 256;

// 21R-SEC-3-REVIEW-1 (Equoria-h50v): the original parse path was
//   const MAX_DEPTH = Number.parseInt(process.env.REQUEST_BODY_MAX_DEPTH ?? '32', 10)
// which silently produced NaN for any non-numeric env value. Every
// `if (depth > NaN)` evaluates false, so a single bad env var (`invalid`,
// empty string, `'-5'`, `'NaN'`, `'Infinity'`) silently disabled the
// entire depth-cap defense — the opposite of fail-closed. Hostile inputs
// like `'32abc'` were also accepted by parseInt's leading-digit lenience.
//
// This validator:
//   1. Returns DEFAULT_MAX_DEPTH if env var is unset (normal path, silent).
//   2. Falls back to DEFAULT_MAX_DEPTH (with logger.error) if the env value
//      is not a strict positive-integer string (matches /^[1-9]\d*$/).
//   3. Falls back to DEFAULT_MAX_DEPTH (with logger.error) if the parsed
//      value exceeds MAX_ALLOWED_OVERRIDE — closes the float-overflow
//      bypass surfaced by REVIEW-1 review-feedback-2.
// The result is always a finite positive integer in [1, MAX_ALLOWED_OVERRIDE].
function resolveMaxDepth() {
  const raw = process.env.REQUEST_BODY_MAX_DEPTH;
  if (raw === undefined) {
    return DEFAULT_MAX_DEPTH;
  }
  if (typeof raw !== 'string' || !/^[1-9]\d*$/.test(raw)) {
    logger.error(
      '[RequestBodySecurity] REQUEST_BODY_MAX_DEPTH is not a positive integer; ' +
        `falling back to default ${DEFAULT_MAX_DEPTH}`,
      { provided: raw, fallback: DEFAULT_MAX_DEPTH },
    );
    return DEFAULT_MAX_DEPTH;
  }
  const parsed = Number.parseInt(raw, 10);
  // The regex above guarantees parsed is a positive integer for inputs
  // up to ~16 digits. Beyond that, parseInt returns an integer-valued
  // float that may exceed MAX_SAFE_INTEGER. Number.isInteger still
  // returns true for those (1e24 is a whole number), so the legacy
  // !Number.isInteger || <1 check would not catch them — only the
  // upper-bound check below does. Both checks remain as defense-in-depth.
  if (!Number.isInteger(parsed) || parsed < 1) {
    logger.error(
      '[RequestBodySecurity] REQUEST_BODY_MAX_DEPTH parsed to non-positive integer; ' +
        `falling back to default ${DEFAULT_MAX_DEPTH}`,
      { provided: raw, parsed, fallback: DEFAULT_MAX_DEPTH },
    );
    return DEFAULT_MAX_DEPTH;
  }
  if (parsed > MAX_ALLOWED_OVERRIDE) {
    logger.error(
      '[RequestBodySecurity] REQUEST_BODY_MAX_DEPTH exceeds MAX_ALLOWED_OVERRIDE; ' +
        `falling back to default ${DEFAULT_MAX_DEPTH}`,
      { provided: raw, parsed, ceiling: MAX_ALLOWED_OVERRIDE, fallback: DEFAULT_MAX_DEPTH },
    );
    return DEFAULT_MAX_DEPTH;
  }
  return parsed;
}

const MAX_DEPTH = resolveMaxDepth();

class JsonScanner {
  constructor(source) {
    this.source = source;
    this.index = 0;
  }

  scan() {
    this.skipWhitespace();
    this.scanValue(0);
    this.skipWhitespace();
  }

  scanValue(depth) {
    if (depth > MAX_DEPTH) {
      throw new AppError('Invalid request body: nesting too deep', 400);
    }

    this.skipWhitespace();
    const char = this.source[this.index];

    if (char === '{') {
      this.scanObject(depth + 1);
      return;
    }

    if (char === '[') {
      this.scanArray(depth + 1);
      return;
    }

    if (char === '"') {
      this.scanString();
      return;
    }

    if (char === '-' || this.isDigit(char)) {
      this.scanNumber();
      return;
    }

    if (this.source.startsWith('true', this.index)) {
      this.index += 4;
      return;
    }

    if (this.source.startsWith('false', this.index)) {
      this.index += 5;
      return;
    }

    if (this.source.startsWith('null', this.index)) {
      this.index += 4;
    }
  }

  scanObject(depth) {
    const keys = new Set();
    this.index += 1;
    this.skipWhitespace();

    if (this.source[this.index] === '}') {
      this.index += 1;
      return;
    }

    while (this.index < this.source.length) {
      this.skipWhitespace();
      const key = this.scanString();

      if (keys.has(key)) {
        throw new AppError(`Invalid request body: duplicate JSON key "${key}"`, 400);
      }
      keys.add(key);

      this.skipWhitespace();
      if (this.source[this.index] !== ':') {
        return;
      }

      this.index += 1;
      this.scanValue(depth);
      this.skipWhitespace();

      if (this.source[this.index] === ',') {
        this.index += 1;
        continue;
      }

      if (this.source[this.index] === '}') {
        this.index += 1;
        return;
      }

      return;
    }
  }

  scanArray(depth) {
    this.index += 1;
    this.skipWhitespace();

    if (this.source[this.index] === ']') {
      this.index += 1;
      return;
    }

    while (this.index < this.source.length) {
      this.scanValue(depth);
      this.skipWhitespace();

      if (this.source[this.index] === ',') {
        this.index += 1;
        continue;
      }

      if (this.source[this.index] === ']') {
        this.index += 1;
        return;
      }

      return;
    }
  }

  scanString() {
    this.index += 1;
    let value = '';

    while (this.index < this.source.length) {
      const char = this.source[this.index];

      if (char === '\\') {
        value += char;
        this.index += 1;
        if (this.index < this.source.length) {
          value += this.source[this.index];
        }
        this.index += 1;
        continue;
      }

      if (char === '"') {
        this.index += 1;
        return value;
      }

      value += char;
      this.index += 1;
    }

    return value;
  }

  scanNumber() {
    if (this.source[this.index] === '-') {
      this.index += 1;
    }

    while (this.isDigit(this.source[this.index])) {
      this.index += 1;
    }

    if (this.source[this.index] === '.') {
      this.index += 1;
      while (this.isDigit(this.source[this.index])) {
        this.index += 1;
      }
    }

    if (this.source[this.index] === 'e' || this.source[this.index] === 'E') {
      this.index += 1;
      if (this.source[this.index] === '+' || this.source[this.index] === '-') {
        this.index += 1;
      }
      while (this.isDigit(this.source[this.index])) {
        this.index += 1;
      }
    }
  }

  skipWhitespace() {
    while (/\s/.test(this.source[this.index] || '')) {
      this.index += 1;
    }
  }

  isDigit(char) {
    return char >= '0' && char <= '9';
  }
}

function assertNoPollutingKeys(value, path = 'body', depth = 0) {
  if (depth > MAX_DEPTH) {
    throw new AppError('Invalid request body: nesting too deep', 400);
  }

  if (!value || typeof value !== 'object') {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      assertNoPollutingKeys(entry, `${path}[${index}]`, depth + 1);
    });
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    if (key === FORBIDDEN_KEY) {
      throw new AppError(`Invalid request body: forbidden key "${key}"`, 400);
    }

    if (
      key === FORBIDDEN_CONSTRUCTOR_KEY &&
      child &&
      typeof child === 'object' &&
      Object.prototype.hasOwnProperty.call(child, FORBIDDEN_PROTOTYPE_KEY)
    ) {
      throw new AppError('Invalid request body: forbidden key path "constructor.prototype"', 400);
    }

    assertNoPollutingKeys(child, `${path}.${key}`, depth + 1);
  }
}

export function verifyJsonBody(req, _res, buffer) {
  const contentType = req.headers['content-type'] || '';
  if (!contentType.includes('application/json') || buffer.length === 0) {
    return;
  }

  try {
    const raw = buffer.toString('utf8');
    new JsonScanner(raw).scan();
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    // 21R-SEC-3-FOLLOW-1 (Equoria-ixqg): fail closed on every other
    // exception class. The original silent-catch path here would let
    // RangeError/TypeError/etc. through, allowing express.json to then
    // parse the same body — defeating the depth cap and prototype-
    // pollution defenses for any error class other than AppError.
    // Log first so we never lose the original forensic data, then
    // re-throw a 400 AppError that the canonical error envelope handler
    // turns into HTTP 400 with a generic message (we deliberately avoid
    // surfacing the raw error class to clients).
    //
    // Logged at WARN (matching the canonical "Rejected malicious request
    // body" path in `requestBodySecurityErrorHandler`) and tagged with
    // `unexpected: true` so SIEM rules can rate-alert on this specific
    // signal without paging on every legitimate-attack rejection. Logging
    // at ERROR here would invert the alert hierarchy: real attacks (depth
    // cap, __proto__) at WARN, synthetic scanner crashes at ERROR — an
    // attacker who finds a payload that crashes the scanner could page
    // on-call at will.
    //
    // `message` and `stack` are bounded and stripped of control characters
    // before logging. A future scanner change that puts user-controlled
    // bytes in `error.message` could otherwise inject CRLF/ANSI escapes
    // into log files (log poisoning). Stack truncation also caps log-pipe
    // pressure from sustained malformed-payload bursts.
    logger.warn(UNEXPECTED_SCANNER_LOG_PREFIX, {
      unexpected: true,
      errorClass: error?.constructor?.name,
      message: sanitizeForLog(error?.message, 256),
      stack: sanitizeForLog(error?.stack, 2048),
    });
    // Message MUST start with ERROR_MESSAGE_PREFIX so requestBodySecurityErrorHandler
    // recognizes it and returns 400 with our envelope. Without the prefix the
    // message falls through to the global error handler and surfaces as 500,
    // which would leak that something unusual happened upstream. The shared
    // constant prevents the two ends from drifting silently.
    throw new AppError(`${ERROR_MESSAGE_PREFIX} scanner failure`, 400);
  }
}

export function rejectPollutedRequestBody(req, _res, next) {
  try {
    assertNoPollutingKeys(req.body);
    next();
  } catch (error) {
    next(error);
  }
}

// Test-only export. The scanner is part of this module's internal contract;
// the production surface is `verifyJsonBody`. Exporting here lets the
// integration tests for 21R-SEC-3-FOLLOW-1 (Equoria-ixqg) inject a controlled
// non-AppError throw inside `scan()` and prove the silent-catch fix works.
//
// The export is **runtime-gated on NODE_ENV=test** so production code that
// tries to import this reference resolves to `undefined`. Pre-fix, the
// underscore-prefixed name was a comment-level guard — any code in the
// process could `import { __TESTING_ONLY_JsonScanner } from ...` and
// `__TESTING_ONLY_JsonScanner.prototype.scan = () => {}` to disable the
// scanner for every subsequent request, restoring the exact bypass this
// story closed. Post-fix, the binding is null in non-test environments,
// so a malicious dependency or compromised in-tree module cannot tamper
// with the scanner's prototype via this export.
//
// In production this evaluates to `undefined`. ESM bindings are static —
// the name still appears in the module's export map — but the value is
// not the class. Test code must import in `NODE_ENV=test`.
export const __TESTING_ONLY_JsonScanner = process.env.NODE_ENV === 'test' ? JsonScanner : undefined;

export function requestBodySecurityErrorHandler(err, req, res, next) {
  if (typeof err?.message !== 'string' || !err.message.startsWith(ERROR_MESSAGE_PREFIX)) {
    return next(err);
  }

  logger.warn('[RequestBodySecurity] Rejected malicious request body', {
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    message: err.message,
  });

  return res.status(400).json({
    success: false,
    message: err.message,
  });
}
