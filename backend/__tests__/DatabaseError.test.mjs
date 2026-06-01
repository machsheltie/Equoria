/**
 * DatabaseError — unit tests (Equoria-rr7)
 */

import { describe, it, expect } from '@jest/globals';
import DatabaseError from '../errors/DatabaseError.mjs';
import AppError from '../errors/AppError.mjs';

describe('DatabaseError', () => {
  it('is an instance of Error and AppError', () => {
    const err = new DatabaseError('db failure');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AppError);
    expect(err).toBeInstanceOf(DatabaseError);
  });

  it('sets message correctly', () => {
    const err = new DatabaseError('connection timeout');
    expect(err.message).toBe('connection timeout');
  });

  it('sets name to DatabaseError', () => {
    const err = new DatabaseError('oops');
    expect(err.name).toBe('DatabaseError');
  });

  it('sets statusCode to 500 via AppError', () => {
    const err = new DatabaseError('oops');
    expect(err.statusCode).toBe(500);
  });

  it('defaults originalError to null', () => {
    const err = new DatabaseError('oops');
    expect(err.originalError).toBeNull();
  });

  it('stores originalError when provided', () => {
    const cause = new Error('underlying cause');
    const err = new DatabaseError('wrapper', cause);
    expect(err.originalError).toBe(cause);
  });
});
