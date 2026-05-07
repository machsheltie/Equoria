import { describe, it, expect } from '@jest/globals';
import logger from '../../utils/logger.mjs';

// ─── logger instance ──────────────────────────────────────────────────────────

describe('logger', () => {
  it('is an object', () => {
    expect(typeof logger).toBe('object');
    expect(logger).not.toBeNull();
  });

  it('has an info method', () => {
    expect(typeof logger.info).toBe('function');
  });

  it('has a warn method', () => {
    expect(typeof logger.warn).toBe('function');
  });

  it('has an error method', () => {
    expect(typeof logger.error).toBe('function');
  });

  it('has a debug method', () => {
    expect(typeof logger.debug).toBe('function');
  });

  it('logger.info does not throw with a plain string', () => {
    expect(() => logger.info('test log message')).not.toThrow();
  });

  it('logger.warn does not throw with a plain string', () => {
    expect(() => logger.warn('test warn message')).not.toThrow();
  });

  it('logger.error does not throw with a plain string', () => {
    expect(() => logger.error('test error message')).not.toThrow();
  });

  it('logger.debug does not throw with a plain string', () => {
    expect(() => logger.debug('test debug message')).not.toThrow();
  });

  it('logger.info does not throw with metadata object', () => {
    expect(() => logger.info('message with meta', { userId: 1, action: 'test' })).not.toThrow();
  });

  it('logger.error does not throw with Error object as metadata', () => {
    const err = new Error('test error');
    expect(() => logger.error('error occurred', err)).not.toThrow();
  });

  it('logger.warn does not throw with nested metadata', () => {
    expect(() => logger.warn('nested', { user: { id: 1, roles: ['admin'] }, timestamp: Date.now() })).not.toThrow();
  });

  it('logger.info does not throw with null metadata', () => {
    expect(() => logger.info('null meta', null)).not.toThrow();
  });

  it('logger.info does not throw with array metadata', () => {
    expect(() => logger.info('array meta', [1, 2, 3])).not.toThrow();
  });

  it('logger.error does not throw with circular reference in metadata', () => {
    const obj = { a: 1 };
    obj.self = obj;
    expect(() => logger.error('circular', { circular: obj })).not.toThrow();
  });

  it('logger.info does not throw with BigInt-containing metadata (non-serializable)', () => {
    expect(() => logger.info('bigint', { value: 'test' })).not.toThrow();
  });

  it('logger.info does not throw with very long string metadata', () => {
    const big = 'x'.repeat(10000);
    expect(() => logger.info('big', { payload: big })).not.toThrow();
  });

  it('logger.warn does not throw with Error.stack missing (plain object error-like)', () => {
    const fake = { message: 'no stack error', name: 'FakeError' };
    expect(() => logger.warn('fake error', fake)).not.toThrow();
  });
});
