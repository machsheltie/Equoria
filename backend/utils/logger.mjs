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
      const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
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
