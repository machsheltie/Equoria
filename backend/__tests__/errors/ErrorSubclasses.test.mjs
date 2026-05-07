/**
 * Error subclasses — unit tests (Equoria-rr7)
 *
 * AuthorizationError, NotFoundError, ValidationError — pure classes extending AppError.
 */

import { describe, it, expect } from '@jest/globals';
import AuthorizationError from '../../errors/AuthorizationError.mjs';
import NotFoundError from '../../errors/NotFoundError.mjs';
import ValidationError from '../../errors/ValidationError.mjs';
import AppError from '../../errors/AppError.mjs';

// ---------------------------------------------------------------------------
// AuthorizationError
// ---------------------------------------------------------------------------
describe('AuthorizationError', () => {
  it('is an instance of AppError', () => {
    const err = new AuthorizationError();
    expect(err).toBeInstanceOf(AppError);
    expect(err).toBeInstanceOf(Error);
  });

  it('defaults to 403 status', () => {
    const err = new AuthorizationError();
    expect(err.statusCode).toBe(403);
  });

  it('defaults message to "Authorization failed"', () => {
    const err = new AuthorizationError();
    expect(err.message).toBe('Authorization failed');
  });

  it('accepts custom message', () => {
    const err = new AuthorizationError('You shall not pass');
    expect(err.message).toBe('You shall not pass');
  });

  it('name is "AuthorizationError"', () => {
    expect(new AuthorizationError().name).toBe('AuthorizationError');
  });
});

// ---------------------------------------------------------------------------
// NotFoundError
// ---------------------------------------------------------------------------
describe('NotFoundError', () => {
  it('is an instance of AppError', () => {
    const err = new NotFoundError();
    expect(err).toBeInstanceOf(AppError);
  });

  it('defaults to 404 status', () => {
    const err = new NotFoundError();
    expect(err.statusCode).toBe(404);
  });

  it('message includes resource name with no ID', () => {
    const err = new NotFoundError('Horse');
    expect(err.message).toBe('Horse not found');
  });

  it('message includes resource name and ID when both provided', () => {
    const err = new NotFoundError('Horse', 42);
    expect(err.message).toBe('Horse with ID 42 not found');
  });

  it('defaults resource to "Resource" when not specified', () => {
    const err = new NotFoundError();
    expect(err.message).toBe('Resource not found');
  });

  it('stores resource and resourceId properties', () => {
    const err = new NotFoundError('Groom', 99);
    expect(err.resource).toBe('Groom');
    expect(err.resourceId).toBe(99);
  });

  it('resourceId is null when ID not provided', () => {
    const err = new NotFoundError('Competition');
    expect(err.resourceId).toBeNull();
  });

  it('name is "NotFoundError"', () => {
    expect(new NotFoundError().name).toBe('NotFoundError');
  });
});

// ---------------------------------------------------------------------------
// ValidationError
// ---------------------------------------------------------------------------
describe('ValidationError', () => {
  it('is an instance of AppError', () => {
    const err = new ValidationError('Invalid email');
    expect(err).toBeInstanceOf(AppError);
  });

  it('defaults to 400 status', () => {
    const err = new ValidationError('bad input');
    expect(err.statusCode).toBe(400);
  });

  it('stores message', () => {
    const err = new ValidationError('Email is required');
    expect(err.message).toBe('Email is required');
  });

  it('stores field when provided', () => {
    const err = new ValidationError('Required', 'email');
    expect(err.field).toBe('email');
  });

  it('stores value when provided', () => {
    const err = new ValidationError('Invalid', 'age', -5);
    expect(err.value).toBe(-5);
  });

  it('field defaults to null', () => {
    const err = new ValidationError('Error');
    expect(err.field).toBeNull();
  });

  it('value defaults to null', () => {
    const err = new ValidationError('Error', 'fieldName');
    expect(err.value).toBeNull();
  });

  it('name is "ValidationError"', () => {
    expect(new ValidationError('x').name).toBe('ValidationError');
  });
});
