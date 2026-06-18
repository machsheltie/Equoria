import logger from '../utils/logger.mjs';
import { AppError } from '../errors/index.mjs';
import { resolveExposeErrorStack } from '../utils/errorStackPolicy.mjs';

/**
 * Global Error Handler Middleware
 * Handles all errors in a consistent manner with proper logging
 */
const errorHandler = (err, req, res, next) => {
  // Defensive checks for response object
  if (!res || typeof res.status !== 'function') {
    logger.error('Error Handler: Invalid response object', {
      error: err.message,
      stack: err.stack,
      url: req?.originalUrl,
      method: req?.method,
    });
    return next(err); // Pass to Express default handler
  }

  // Check if response already sent
  if (res.headersSent) {
    logger.error('Error Handler: Headers already sent', {
      error: err.message,
      url: req?.originalUrl,
      method: req?.method,
    });
    return next(err); // Pass to Express default handler
  }
  // Log error details
  logger.error(`Error ${err.message}`, {
    error: err.message,
    stack: err.stack,
    url: req?.originalUrl,
    method: req?.method,
    ip: req?.ip,
    userAgent: req?.get('User-Agent'),
  });

  // If it's already our custom error class (AppError or subclass), use it directly
  let error = err;

  // Only process/transform if it's NOT already an AppError instance.
  // Symbol-marker check survives module-cache duplication
  // (jest.unstable_mockModule etc.); see errors/AppError.mjs comment.
  if (!AppError.isAppError(err)) {
    error = { ...err };
    error.message = err.message;

    // Mongoose bad ObjectId
    if (err.name === 'CastError') {
      const message = 'Resource not found';
      error = new AppError(message, 404);
    }

    // Mongoose duplicate key
    if (err.code === 11000) {
      const message = 'Duplicate field value entered';
      error = new AppError(message, 400);
    }

    // Mongoose validation error (check for errors property to distinguish from our ValidationError)
    if (err.name === 'ValidationError' && err.errors) {
      const message = Object.values(err.errors).map(val => val.message);
      error = new AppError(message, 400);
    }
  }

  // Prisma errors
  if (err.code === 'P2002') {
    const message = 'Duplicate field value entered';
    error = new AppError(message, 400);
  }

  if (err.code === 'P2025') {
    const message = 'Record not found';
    error = new AppError(message, 404);
  }

  // Send error response
  try {
    const errorMessage = error.message || 'Server Error';
    // Equoria-x928y: stack exposure is an explicit boundary flag (mirrors
    // EXPOSE_VALIDATION_DETAILS). Default unchanged (dev-only); EXPOSE_ERROR_STACK
    // = 'true'/'false' lets an operator force it on for a non-dev debug session
    // or off in dev, no code change. Deployable envs stay CLOSED by default.
    const exposeStack = resolveExposeErrorStack({
      nodeEnv: process.env.NODE_ENV,
      exposeErrorStackEnv: process.env.EXPOSE_ERROR_STACK,
    });
    res.status(error.statusCode || 500).json({
      success: false,
      message: errorMessage,
      ...(exposeStack && { stack: err.stack }),
    });
  } catch (responseError) {
    logger.error('Error Handler: Failed to send response', {
      originalError: err.message,
      responseError: responseError.message,
    });
    next(err);
  }
};

export default errorHandler;
