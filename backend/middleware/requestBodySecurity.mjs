import { AppError } from '../errors/index.mjs';
import logger from '../utils/logger.mjs';

const FORBIDDEN_KEY = '__proto__';
const FORBIDDEN_CONSTRUCTOR_KEY = 'constructor';
const FORBIDDEN_PROTOTYPE_KEY = 'prototype';

// Sanitize a value for inclusion in a structured log payload.
//
// Strips: ASCII C0 control chars (0x00-0x1F + 0x7F), C1 control chars
// (0x80-0x9F — includes CSI 0x9B used by single-byte ANSI sequences),
// Unicode bidi formatting (LRM/RLM/LRE/RLE/PDF/LRO/RLO + LRI/RLI/FSI/PDI),
// and the BOM (U+FEFF). Bidi controls let an attacker visually re-order a
// log line in any consumer that renders text directionally (Kibana,
// modern terminals); the canonical example is `'\u202EkcatTA'` rendering
// as "ATtack" in the viewer. Replaces each control with `?` (no length
// change so the truncation cap math stays simple).
//
// Does NOT decode percent-encoded or backslash-u-escaped sequences — a
// downstream log shipper that re-decodes message fields can still
// reintroduce control bytes. That is a downstream-pipeline concern, not
// something this sanitiser can solve at the producer side. (Review
// patch #29: comment scope tightened so the protection claim matches
// what the code actually does.)
//
// Truncation operates on UTF-16 code units (matching JS string semantics),
// but back-tracks one position when the cap would split a surrogate pair.
// Splitting a surrogate produces an unpaired surrogate which JSON-serialise
// rejects in some pipelines (`Unexpected token \uD800`). Length after
// truncation is therefore either `maxLength + 1` (cap + ellipsis) or
// `maxLength` (cap - 1 + ellipsis, when boundary fell inside a pair).
//
// Edge case: maxLength = 1. The high-surrogate back-up logic would slice
// to `[0, 0)` (empty string) + `…` → length 1. Safe but degenerate;
// callers should pass maxLength ≥ 2. Guard added below to make this
// explicit instead of relying on the slice math (review patch #23).
//
// eslint-disable-next-line no-control-regex
const LOG_INJECTION_STRIP = /[\x00-\x1F\x7F\x80-\x9F\u200E\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g;
function sanitizeForLog(value, maxLength) {
  if (typeof value !== 'string') {
    return undefined;
  }
  if (typeof maxLength !== 'number' || maxLength < 2) {
    // Defensive: caller bug. Return a safe stub rather than producing
    // a truncated-into-orphaned-surrogate string.
    return '…';
  }
  const stripped = value.replace(LOG_INJECTION_STRIP, '?');
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
// Exported so the contract can be pinned by unit tests AND used by every
// in-module throw. Review patch #10: ALL throws in this module
// (depth cap, dup key, __proto__, constructor.prototype, scanner failure)
// now derive their prefix from this constant. A future rename of the
// constant therefore breaks every call site at lint/grep time, not at
// runtime when an operator notices 500s instead of 400s.
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
// DEPTH-COUNTING CONTRACT (21R-SEC-3-REVIEW-2, Equoria-ncbs):
// Both the parser-layer scanner (JsonScanner.scanValue) AND the
// post-parse pollutant detector (assertNoPollutingKeys) count depth
// the same way for any given input. Specifically:
//   - The top-level value enters at depth=0.
//   - Each container (object or array) increments depth by 1 before
//     recursing into its children.
//   - A primitive leaf is reached at depth=N when nested under N
//     containers; the depth check fires there.
//   - The check is `depth > MAX_DEPTH`, so depth=MAX_DEPTH passes and
//     depth=MAX_DEPTH+1 fails — both functions reject the same payloads.
// For empty-leaf inputs (e.g. `[[[]]]`) the recursion exits one level
// short of the leaf in both functions (scanner's scanArray sees `]`
// without recursing into scanValue; assertNoPollutingKeys's forEach
// over an empty array has nothing to recurse into), so both functions
// reach max depth N-1 for an N-bracketed empty-leaf input — still
// symmetric.
// This contract is enforced by the boundary suite at
// __tests__/integration/security/request-body-depth-cap-boundary.test.mjs
// (12 boundary tests + 6 cross-function symmetry tests). Any change
// that desyncs the counters will break exactly one of those tests.
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
      throw new AppError(`${ERROR_MESSAGE_PREFIX} nesting too deep`, 400);
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
        throw new AppError(`${ERROR_MESSAGE_PREFIX} duplicate JSON key "${key}"`, 400);
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

  // 21R-SEC-1 (Equoria-w45l): scanString MUST return the decoded string
  // (post-JSON-escape-collapse) so scanObject's duplicate-key Set compares
  // semantically equal keys. Pre-fix this preserved backslash sequences
  // verbatim (`\u006eame` returned as a 9-char literal containing a real
  // backslash), making `{"name":"x","\u006eame":"y"}` look like two distinct
  // keys to the scanner while JSON.parse silently collapsed them — a clean
  // duplicate-key bypass.
  //
  // We delegate decoding to JSON.parse on the raw quoted substring rather
  // than re-implementing the escape table. Two upsides:
  //   1. Spec-compliant by construction (handles `\uXXXX`, `\"`, `\\`,
  //      `\/`, `\b`, `\f`, `\n`, `\r`, `\t`, surrogate pairs).
  //   2. Stays in sync if a future Node.js JSON spec relaxation changes
  //      what counts as a valid escape — we don't have a parallel table
  //      to update.
  //
  // Cursor advancement still uses the original advance-past-`\\`-plus-next
  // logic (which is correct because every JSON escape starts with `\\` +
  // exactly one terminator char `"\\/bfnrtu`; the 4 hex digits of `\\uXXXX`
  // never include `"`, so we don't need to consume them eagerly to find
  // the closing quote). Decoding is one JSON.parse on the captured slice.
  scanString() {
    const startIdx = this.index; // points at opening `"`
    this.index += 1;

    while (this.index < this.source.length) {
      const char = this.source[this.index];

      if (char === '\\') {
        this.index += 2; // skip backslash + escape terminator
        continue;
      }

      if (char === '"') {
        this.index += 1; // consume closing `"`
        const raw = this.source.slice(startIdx, this.index);
        try {
          return JSON.parse(raw);
        } catch {
          // Malformed escape (e.g. `\\uXYZW` with non-hex digits). Return
          // the body without quotes; downstream JSON.parse on the full
          // payload will reject the whole request, so this fallback is
          // never the final disposition for an attack — it just keeps
          // the scanner from throwing here.
          return raw.slice(1, -1);
        }
      }

      this.index += 1;
    }

    // Unterminated string — best-effort: return what we captured. The
    // outer pipeline's JSON.parse will reject the malformed payload.
    return this.source.slice(startIdx + 1);
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
    throw new AppError(`${ERROR_MESSAGE_PREFIX} nesting too deep`, 400);
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
      throw new AppError(`${ERROR_MESSAGE_PREFIX} forbidden key "${key}"`, 400);
    }

    if (
      key === FORBIDDEN_CONSTRUCTOR_KEY &&
      child &&
      typeof child === 'object' &&
      Object.prototype.hasOwnProperty.call(child, FORBIDDEN_PROTOTYPE_KEY)
    ) {
      throw new AppError(`${ERROR_MESSAGE_PREFIX} forbidden key path "constructor.prototype"`, 400);
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
    // Patch #5 (review hardening): use AppError.isAppError(error) instead
    // of `error instanceof AppError`. The `instanceof` check is fragile
    // across module-cache duplication: if a test mocks the errors module
    // via `jest.unstable_mockModule`, an AppError thrown by the scanner
    // is a non-instance of the AppError reference imported here, and the
    // catch wraps it as a "scanner failure" — corrupting the legitimate
    // depth-cap / dup-key / __proto__ rejection messages in test
    // isolation. The Symbol-marker check survives module duplication
    // because Symbol.for(...) is shared via the global symbol registry.
    if (AppError.isAppError(error)) {
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

// 21R-SEC-5 (Equoria-lf3z): urlencoded duplicate-key detector.
//
// Sibling to verifyJsonBody. express.urlencoded historically had no verify
// hook — `name=Valid&name=Hacked` with Content-Type
// application/x-www-form-urlencoded reaches the controller as either
// `{ name: ['Valid', 'Hacked'] }` (qs-extended) or `'Hacked'`
// (last-value-wins) depending on parser config. Either form reopens the
// pollution attack vector closed for JSON in 21R-SEC-3 / 21R-SEC-1.
//
// The scanner walks the raw body bytes BEFORE qs/querystring parses
// them. Splits on `&`, extracts each key (substring before `=`),
// percent-decodes (with `+` → space per RFC 1866 / WHATWG URL
// application/x-www-form-urlencoded rules), and tracks seen keys.
// Duplicate after decoding → AppError(400) with the canonical message
// prefix that the requestBodySecurityErrorHandler matches.
//
// Why not URLSearchParams: URLSearchParams silently merges duplicate
// keys (you can iterate them, but it does not signal duplication as
// an error). Using it here would re-introduce the same swallow-and-
// continue defect the JSON scanner closed.
//
// Why not qs.parse: qs returns the parsed object (array on duplicate)
// without exposing whether duplicates were collapsed. Same swallow
// problem.
//
// Bracketed-array form: `name[]=a&name[]=b` IS flagged as a duplicate
// (literal key `name[]` appears twice). This is deliberate. Codebase
// audit (Equoria-lf3z, 2026-04-30) found zero legitimate callers using
// either plain or bracketed-array urlencoded duplicates — every form
// submission expects scalar values. A future controller that needs
// array-of-string urlencoded input should use JSON instead, or
// explicitly opt out via a per-route override (not yet built; file a
// follow-up if a real caller emerges).
function detectDuplicateUrlEncodedKeys(raw) {
  const seen = new Set();
  const pairs = raw.split('&');
  for (const pair of pairs) {
    if (pair.length === 0) {
      continue;
    }
    const eq = pair.indexOf('=');
    const rawKey = eq === -1 ? pair : pair.slice(0, eq);
    if (rawKey.length === 0) {
      continue;
    }
    let key;
    try {
      // RFC 1866 / WHATWG: `+` is the encoding for space in
      // application/x-www-form-urlencoded; decodeURIComponent does NOT
      // decode `+`, so do it manually before the percent-decode pass.
      key = decodeURIComponent(rawKey.replace(/\+/g, ' '));
    } catch {
      // Malformed percent-encoding. Compare raw bytes — this still
      // catches identical literal duplicates and lets express.urlencoded
      // surface its own malformed-body error for the broken pair.
      key = rawKey;
    }
    if (seen.has(key)) {
      throw new AppError(`${ERROR_MESSAGE_PREFIX} duplicate urlencoded key "${key}"`, 400);
    }
    seen.add(key);
  }
}

export function verifyUrlEncodedBody(req, _res, buffer) {
  const contentType = req.headers['content-type'] || '';
  // Match `application/x-www-form-urlencoded` with optional parameters
  // (e.g., `; charset=utf-8`). Use startsWith on the lowercased prefix
  // so a charset parameter does not bypass the gate.
  if (
    !contentType.toLowerCase().startsWith('application/x-www-form-urlencoded') ||
    buffer.length === 0
  ) {
    return;
  }

  try {
    const raw = buffer.toString('utf8');
    detectDuplicateUrlEncodedKeys(raw);
  } catch (error) {
    // Same fail-closed semantics as verifyJsonBody (21R-SEC-3-FOLLOW-1):
    // re-throw AppError verbatim, log + 400 on every other class.
    if (AppError.isAppError(error)) {
      throw error;
    }
    logger.warn(UNEXPECTED_SCANNER_LOG_PREFIX, {
      unexpected: true,
      errorClass: error?.constructor?.name,
      message: sanitizeForLog(error?.message, 256),
      stack: sanitizeForLog(error?.stack, 2048),
    });
    throw new AppError(`${ERROR_MESSAGE_PREFIX} scanner failure`, 400);
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
// Review patch #12: case-insensitive NODE_ENV check. Some local debug
// configurations set NODE_ENV='Test' or omit it entirely; the strict
// equality silently resolved the binding to `undefined` in those cases
// and produced opaque "Cannot read properties of undefined (reading
// 'prototype')" failures across every test that monkey-patches the
// scanner. Normalising to lowercase makes the gate forgiving on input
// while still rejecting any non-test value (production, staging, ci).
export const __TESTING_ONLY_JsonScanner =
  String(process.env.NODE_ENV ?? '').toLowerCase() === 'test' ? JsonScanner : undefined;

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
