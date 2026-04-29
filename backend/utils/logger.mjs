import winston from 'winston';
import config from '../config/config.mjs'; // Changed to ES module import

const enumerateErrorFormat = winston.format(info => {
  if (info instanceof Error) {
    Object.assign(info, { message: info.stack });
  }
  return info;
});

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
      // 21R-OBS-1 hardening (review patch #1): wrap JSON.stringify in
      // try/catch so a circular reference, BigInt, or any other
      // non-serialisable value passed in metadata does NOT crash the
      // format pipeline. Pre-fix, an uncaught throw here would propagate
      // out of Winston's format chain and surface on the logger's
      // `error` event — and if no listener is attached, Node would
      // re-throw to the process. In a security middleware hot path
      // (e.g., requestBodySecurity.mjs:catch-block forensic log on a
      // future Error.cause cycle), that is fail-OPEN: the request is
      // dropped while the offending body has already been parsed.
      // Fallback string is bounded so a pathologically large meta
      // object does not flood the log pipe.
      let metaStr = '';
      if (Object.keys(meta).length > 0) {
        try {
          metaStr = ` ${JSON.stringify(meta)}`;
        } catch (err) {
          metaStr = ` [unserializable meta: ${err?.constructor?.name ?? 'Error'}: ${
            String(err?.message ?? '').slice(0, 200)
          }]`;
        }
      }
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
