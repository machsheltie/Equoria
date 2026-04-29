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
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      // 21R-OBS-1: preserve metadata fields passed as the second argument
      // to logger calls. The previous printf destructured only timestamp/
      // level/message and silently dropped every other field, so structured
      // forensic context (errorClass, requestId, etc.) never reached
      // stdout / SIEM. Append non-empty metadata as JSON.
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
