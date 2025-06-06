import { AppError, ValidationError, DatabaseError, NotFoundError } from '../../errors/index.mjs';

describe('Error Classes', () => {
  describe('AppError', () => {
    it('should create an AppError with default values', () => {
      const error = new AppError('Test error');

      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(500);
      expect(error.status).toBe('error');
      expect(error.isOperational).toBe(true);
      expect(error.name).toBe('Error');
    });

    it('should create an AppError with custom values', () => {
      const error = new AppError('Custom error', 400, false);

      expect(error.message).toBe('Custom error');
      expect(error.statusCode).toBe(400);
      expect(error.status).toBe('fail');
      expect(error.isOperational).toBe(false);
    });

    it('should set status to "fail" for 4xx status codes', () => {
      const error400 = new AppError('Bad request', 400);
      const error404 = new AppError('Not found', 404);

      expect(error400.status).toBe('fail');
      expect(error404.status).toBe('fail');
    });

    it('should set status to "error" for 5xx status codes', () => {
      const error500 = new AppError('Internal error', 500);
      const error503 = new AppError('Service unavailable', 503);

      expect(error500.status).toBe('error');
      expect(error503.status).toBe('error');
    });

    it('should capture stack trace', () => {
      const error = new AppError('Test error');

      expect(error.stack).toBeDefined();
      expect(typeof error.stack).toBe('string');
    });
  });

  describe('ValidationError', () => {
    it('should create a ValidationError with default values', () => {
      const error = new ValidationError('Invalid input');

      expect(error.message).toBe('Invalid input');
      expect(error.statusCode).toBe(400);
      expect(error.status).toBe('fail');
      expect(error.name).toBe('ValidationError');
      expect(error.field).toBeNull();
      expect(error.value).toBeNull();
    });

    it('should create a ValidationError with field and value', () => {
      const error = new ValidationError('Invalid email', 'email', 'invalid-email');

      expect(error.field).toBe('email');
      expect(error.value).toBe('invalid-email');
    });

    it('should inherit from AppError', () => {
      const error = new ValidationError('Test');

      expect(error instanceof AppError).toBe(true);
      expect(error instanceof ValidationError).toBe(true);
    });
  });

  describe('DatabaseError', () => {
    it('should create a DatabaseError with default values', () => {
      const error = new DatabaseError('Database connection failed');

      expect(error.message).toBe('Database connection failed');
      expect(error.statusCode).toBe(500);
      expect(error.status).toBe('error');
      expect(error.name).toBe('DatabaseError');
      expect(error.originalError).toBeNull();
    });

    it('should create a DatabaseError with original error', () => {
      const originalError = new Error('Connection timeout');
      const error = new DatabaseError('Database error', originalError);

      expect(error.originalError).toBe(originalError);
    });

    it('should inherit from AppError', () => {
      const error = new DatabaseError('Test');

      expect(error instanceof AppError).toBe(true);
      expect(error instanceof DatabaseError).toBe(true);
    });
  });

  describe('NotFoundError', () => {
    it('should create a NotFoundError with default message', () => {
      const error = new NotFoundError();

      expect(error.message).toBe('Resource not found');
      expect(error.statusCode).toBe(404);
      expect(error.status).toBe('fail');
      expect(error.name).toBe('NotFoundError');
      expect(error.resource).toBe('Resource');
      expect(error.resourceId).toBeNull();
    });

    it('should create a NotFoundError with custom resource', () => {
      const error = new NotFoundError('Horse');

      expect(error.message).toBe('Horse not found');
      expect(error.resource).toBe('Horse');
    });

    it('should create a NotFoundError with resource and ID', () => {
      const error = new NotFoundError('Horse', 123);

      expect(error.message).toBe('Horse with ID 123 not found');
      expect(error.resource).toBe('Horse');
      expect(error.resourceId).toBe(123);
    });

    it('should inherit from AppError', () => {
      const error = new NotFoundError();

      expect(error instanceof AppError).toBe(true);
      expect(error instanceof NotFoundError).toBe(true);
    });
  });
});
