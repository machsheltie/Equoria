import logger from '../utils/logger.mjs';

/**
 * Request Logging Middleware
 * Logs all incoming requests with relevant details
 */
export const requestLogger = (req, res, next) => {
  const start = Date.now();

  // Log request start
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
 * Logs failed requests with additional error context
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
    body: req.body,
    params: req.params,
    query: req.query,
  });

  next(err);
};
