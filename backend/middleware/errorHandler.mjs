import logger from '../utils/logger.mjs';
import { AppError } from '../errors/index.mjs';

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
  let error = { ...err };
  error.message = err.message;

  // Log error details
  logger.error(`Error ${err.message}`, {
    error: err.message,
    stack: err.stack,
    url: req?.originalUrl,
    method: req?.method,
    ip: req?.ip,
    userAgent: req?.get('User-Agent'),
  });

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

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message);
    error = new AppError(message, 400);
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
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Server Error',
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
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
