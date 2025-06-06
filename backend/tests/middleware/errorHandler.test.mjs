import errorHandler from '../../middleware/errorHandler.mjs';
import { AppError } from '../../errors/index.mjs';

describe('Error Handler Middleware', () => {
  let req, res, next, statusCode, responseData;

  beforeEach(() => {
    req = {
      originalUrl: '/test',
      method: 'GET',
      ip: '127.0.0.1',
      get: () => 'test-user-agent',
    };

    res = {
      status: code => {
        statusCode = code;
        return res;
      },
      json: data => {
        responseData = data;
        return res;
      },
    };

    next = () => {};
    statusCode = null;
    responseData = null;
  });

  it('should handle AppError correctly', () => {
    const error = new AppError('Test error', 400);

    errorHandler(error, req, res, next);

    expect(statusCode).toBe(400);
    expect(responseData).toEqual({
      success: false,
      error: 'Test error',
    });
  });

  it('should handle generic errors with 500 status', () => {
    const error = new Error('Generic error');

    errorHandler(error, req, res, next);

    expect(statusCode).toBe(500);
    expect(responseData).toEqual({
      success: false,
      error: 'Generic error',
    });
  });

  it('should handle Prisma P2002 error (duplicate)', () => {
    const error = new Error('Unique constraint failed');
    error.code = 'P2002';

    errorHandler(error, req, res, next);

    expect(statusCode).toBe(400);
    expect(responseData).toEqual({
      success: false,
      error: 'Duplicate field value entered',
    });
  });

  it('should handle Prisma P2025 error (not found)', () => {
    const error = new Error('Record not found');
    error.code = 'P2025';

    errorHandler(error, req, res, next);

    expect(statusCode).toBe(404);
    expect(responseData).toEqual({
      success: false,
      error: 'Record not found',
    });
  });

  it('should include stack trace in development mode', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    const error = new Error('Test error');
    error.stack = 'Error stack trace';

    errorHandler(error, req, res, next);

    expect(responseData).toEqual({
      success: false,
      error: 'Test error',
      stack: 'Error stack trace',
    });

    process.env.NODE_ENV = originalEnv;
  });

  it('should not include stack trace in production mode', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const error = new Error('Test error');
    error.stack = 'Error stack trace';

    errorHandler(error, req, res, next);

    expect(responseData).toEqual({
      success: false,
      error: 'Test error',
    });

    process.env.NODE_ENV = originalEnv;
  });

  it('should handle errors without throwing', () => {
    const error = new Error('Test error');

    expect(() => {
      errorHandler(error, req, res, next);
    }).not.toThrow();

    expect(statusCode).toBe(500);
    expect(responseData.success).toBe(false);
  });
});
