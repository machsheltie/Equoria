/**
 * AppError, AuthorizationError, NotFoundError, ValidationError — unit tests (Equoria-rr7)
 *
 * Pure error class tests, no DB required.
 */

import { describe, it, expect } from '@jest/globals';
import AppError, { APP_ERROR_MARKER } from '../../../errors/AppError.mjs';
import AuthorizationError from '../../../errors/AuthorizationError.mjs';
import NotFoundError from '../../../errors/NotFoundError.mjs';
import ValidationError from '../../../errors/ValidationError.mjs';

// ---------------------------------------------------------------------------
// AppError
// ---------------------------------------------------------------------------
describe('AppError', () => {
  it('is an instance of Error', () => {
    expect(new AppError('test')).toBeInstanceOf(Error);
  });

  it('stores message', () => {
    expect(new AppError('oops').message).toBe('oops');
  });

  it('defaults statusCode to 500', () => {
    expect(new AppError('test').statusCode).toBe(500);
  });

  it('sets status to "error" for 5xx codes', () => {
    expect(new AppError('test', 500).status).toBe('error');
    expect(new AppError('test', 503).status).toBe('error');
  });

  it('sets status to "fail" for 4xx codes', () => {
    expect(new AppError('test', 400).status).toBe('fail');
    expect(new AppError('test', 404).status).toBe('fail');
  });

  it('defaults isOperational to true', () => {
    expect(new AppError('test').isOperational).toBe(true);
  });

  it('accepts explicit isOperational=false', () => {
    expect(new AppError('test', 500, false).isOperational).toBe(false);
  });

  it('tags instance with APP_ERROR_MARKER', () => {
    const err = new AppError('test');
    expect(err[APP_ERROR_MARKER]).toBe(true);
  });

  it('static isAppError returns true for AppError instances', () => {
    expect(AppError.isAppError(new AppError('test'))).toBe(true);
  });

  it('static isAppError returns false for plain Error', () => {
    expect(AppError.isAppError(new Error('plain'))).toBe(false);
  });

  it('static isAppError returns false for null', () => {
    expect(AppError.isAppError(null)).toBe(false);
  });

  it('static isAppError returns false for non-object', () => {
    expect(AppError.isAppError('string')).toBe(false);
  });

  it('has a stack trace', () => {
    expect(new AppError('test').stack).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// AuthorizationError
// ---------------------------------------------------------------------------
describe('AuthorizationError', () => {
  it('is an instance of AppError and Error', () => {
    const err = new AuthorizationError();
    expect(err).toBeInstanceOf(AppError);
    expect(err).toBeInstanceOf(Error);
  });

  it('has statusCode 403', () => {
    expect(new AuthorizationError().statusCode).toBe(403);
  });

  it('has name AuthorizationError', () => {
    expect(new AuthorizationError().name).toBe('AuthorizationError');
  });

  it('defaults to "Authorization failed" message', () => {
    expect(new AuthorizationError().message).toBe('Authorization failed');
  });

  it('accepts a custom message', () => {
    expect(new AuthorizationError('Forbidden').message).toBe('Forbidden');
  });

  it('is tagged with APP_ERROR_MARKER', () => {
    expect(AppError.isAppError(new AuthorizationError())).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// NotFoundError
// ---------------------------------------------------------------------------
describe('NotFoundError', () => {
  it('is an instance of AppError', () => {
    expect(new NotFoundError()).toBeInstanceOf(AppError);
  });

  it('has statusCode 404', () => {
    expect(new NotFoundError().statusCode).toBe(404);
  });

  it('has name NotFoundError', () => {
    expect(new NotFoundError().name).toBe('NotFoundError');
  });

  it('formats message with resource and id', () => {
    const err = new NotFoundError('Horse', 42);
    expect(err.message).toBe('Horse with ID 42 not found');
  });

  it('formats message with resource only', () => {
    const err = new NotFoundError('Horse');
    expect(err.message).toBe('Horse not found');
  });

  it('defaults to "Resource not found"', () => {
    expect(new NotFoundError().message).toBe('Resource not found');
  });

  it('stores resource and resourceId', () => {
    const err = new NotFoundError('User', 99);
    expect(err.resource).toBe('User');
    expect(err.resourceId).toBe(99);
  });

  it('resourceId is null when not provided', () => {
    expect(new NotFoundError('Horse').resourceId).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// ValidationError
// ---------------------------------------------------------------------------
describe('ValidationError', () => {
  it('is an instance of AppError', () => {
    expect(new ValidationError('bad input')).toBeInstanceOf(AppError);
  });

  it('has statusCode 400', () => {
    expect(new ValidationError('bad input').statusCode).toBe(400);
  });

  it('has name ValidationError', () => {
    expect(new ValidationError('bad input').name).toBe('ValidationError');
  });

  it('stores message', () => {
    expect(new ValidationError('invalid email').message).toBe('invalid email');
  });

  it('stores field when provided', () => {
    const err = new ValidationError('bad', 'email');
    expect(err.field).toBe('email');
  });

  it('stores value when provided', () => {
    const err = new ValidationError('bad', 'email', 'notanemail');
    expect(err.value).toBe('notanemail');
  });

  it('field defaults to null', () => {
    expect(new ValidationError('bad').field).toBeNull();
  });

  it('value defaults to null', () => {
    expect(new ValidationError('bad').value).toBeNull();
  });
});
