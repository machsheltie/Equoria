import winston from 'winston';
import config from '../config/config.mjs'; // Changed to ES module import

const enumerateErrorFormat = winston.format(info => {
  if (info instanceof Error) {
    Object.assign(info, { message: info.stack });
  }
  return info;
});

// 21R-OBS-3 (Equoria-aweq) hardening — three defects in the printf format
// fixed below as preprocessor helpers.
//
// Defect #3: Error.message / Error.stack / Error.name are non-enumerable, so
// `JSON.stringify({err: new Error('m')})` returns `{"err":{}}` — useless
// metadata. Pre-process: walk the metadata tree, swap any Error instance
// for `{name, message, stack: stack.slice(0, ERROR_STACK_CAP)}`. Stack is
// capped to bound log-line size even when an attacker forges a 100KB stack.
//
// Defect #4: when callers do `logger.error(msg, errorInstance)`, Winston's
// internal stack-hoist path puts the stack into BOTH `info.message` (via
// `enumerateErrorFormat` above) AND keeps it enumerable as `info.stack`.
// The printf rest-pattern then emits `stack` in the JSON suffix — stack
// appears twice per line. We strip the top-level `stack` field from the
// meta object IF the message already contains the same stack string
// (i.e. the enumerateErrorFormat hoist already happened).
//
// Defect #2: oversized metadata. Cap the JSON suffix at SUFFIX_BYTE_CAP;
// on overage, slice + append `[truncated-N-bytes]` marker.

const ERROR_STACK_CAP = 1024;
const SUFFIX_BYTE_CAP = 4096;

function preprocessMetaValue(value, depth = 0, seen = new WeakSet()) {
  // Hard recursion-depth guard mirrors the request-body scanner's contract
  // (see middleware/requestBodySecurity.mjs). 32 is far beyond any
  // legitimate metadata shape; back-stop only — the WeakSet below catches
  // genuine cycles before this fires.
  if (depth > 32) {
    return '[meta-too-deep]';
  }
  if (value === null || value === undefined) {
    return value;
  }
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: typeof value.stack === 'string' ? value.stack.slice(0, ERROR_STACK_CAP) : undefined,
    };
  }
  if (typeof value !== 'object') {
    return value;
  }
  // Object / Array path. Circular detection: if we've seen this exact
  // object reference earlier in the recursion, throw a TypeError matching
  // JSON.stringify's "Converting circular structure to JSON" signature so
  // buildMetaSuffix's catch falls through to the legacy unserializable
  // marker — preserving the 21R-OBS-1 test contract for circular refs.
  if (seen.has(value)) {
    throw new TypeError('Converting circular structure to JSON');
  }
  seen.add(value);
  if (Array.isArray(value)) {
    return value.map(v => preprocessMetaValue(v, depth + 1, seen));
  }
  // Plain objects only — leave Buffer / Date / Map / Set untouched so
  // JSON.stringify's normal serialisation rules apply.
  const proto = Object.getPrototypeOf(value);
  if (proto !== null && proto !== Object.prototype) {
    return value;
  }
  const out = {};
  for (const k of Object.keys(value)) {
    out[k] = preprocessMetaValue(value[k], depth + 1, seen);
  }
  return out;
}

function buildMetaSuffix(meta, message) {
  // Defect #4 de-dup: if message already contains the stack from
  // enumerateErrorFormat's hoist, drop the redundant top-level stack
  // field from meta so it doesn't get emitted again in JSON.
  let cleaned = meta;
  if (typeof meta === 'object' && meta !== null && typeof meta.stack === 'string') {
    if (typeof message === 'string' && message.includes(meta.stack)) {
      const { stack: _stack, ...rest } = meta;
      cleaned = rest;
    }
  }
  if (Object.keys(cleaned).length === 0) {
    return '';
  }
  let json;
  try {
    const processed = preprocessMetaValue(cleaned);
    json = JSON.stringify(processed);
  } catch (err) {
    return ` [unserializable meta: ${err?.constructor?.name ?? 'Error'}: ${String(
      err?.message ?? '',
    ).slice(0, 200)}]`;
  }
  if (json.length <= SUFFIX_BYTE_CAP) {
    return ` ${json}`;
  }
  // Defect #2 truncation: cut to cap, append explicit marker reporting
  // dropped byte count. Operators must SEE that data was lost — silent
  // truncation would mask forensic gaps.
  const dropped = json.length - SUFFIX_BYTE_CAP;
  return ` ${json.slice(0, SUFFIX_BYTE_CAP)}[truncated-${dropped}-bytes]`;
}

const logger = winston.createLogger({
  level: config.env === 'development' ? 'debug' : 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), // Added timestamp
    enumerateErrorFormat(),
    config.env === 'development' ? winston.format.colorize() : winston.format.uncolorize(),
    winston.format.splat(),
    // 21R-OBS-1 (Equoria-8m7j): the previous printf format destructured only
    // `{ timestamp, level, message }` and silently discarded every metadata
    // field passed by callers via `logger.<level>(msg, { ... })`. That made
    // 89+ logger-with-metadata call sites across backend/ produce useless
    // `[ts] level: <message>` lines in production while their tests passed
    // (because tests typically spied on logger.<level> at the API boundary,
    // observing the call BEFORE the format chain ran).
    //
    // The fix: destructure the rest of the info object and append it as
    // JSON when present. For calls without metadata the output is byte-
    // identical to the previous format. For calls with metadata, the
    // structured fields are preserved in a single JSON-encoded suffix that
    // both humans and SIEM ingestion pipelines can parse.
    //
    // Winston populates internal symbol-keyed properties (`level`, `message`,
    // `splat`, `winston-trace-id`) on the info object alongside user-facing
    // fields. Symbol properties are NOT enumerated by `Object.keys` and
    // are NOT serialised by `JSON.stringify`, so the rest pattern only
    // captures user-supplied metadata. Verified empirically by the
    // logger-metadata-emission tests.
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      // 21R-OBS-3 (Equoria-aweq): full robustness pipeline:
      //   - circular / BigInt safety   (catch JSON.stringify throws)
      //   - oversized-meta truncation  (cap at SUFFIX_BYTE_CAP)
      //   - Error-as-value extraction  (preprocessMetaValue swap)
      //   - bare-Error stack de-dup    (strip duplicate top-level stack)
      // See helper docs above for per-defect rationale.
      const metaStr = buildMetaSuffix(meta, message);
      return `[${timestamp}] ${level}: ${message}${metaStr}`;
    }),
  ),
  transports: [
    new winston.transports.Console({
      stderrLevels: ['error'],
    }),
  ],
});

export default logger; // Changed to ES module export
