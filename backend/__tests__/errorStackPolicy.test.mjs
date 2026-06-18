/**
 * Sentinel — error-stack exposure policy (Equoria-x928y).
 *
 * Proves the explicit EXPOSE_ERROR_STACK boundary flag (1) PRESERVES the prior
 * dev-only default for every env when unset, (2) lets an operator force stack
 * exposure on/off, and (3) NEVER leaks a stack in a deployable env by default.
 * Pure function — NODE_ENV is passed explicitly, no process.env mutation.
 */
import { describe, it, expect } from '@jest/globals';
import { resolveExposeErrorStack } from '../utils/errorStackPolicy.mjs';

describe('resolveExposeErrorStack (Equoria-x928y)', () => {
  it('defaults to TRUE only in development (preserves prior behavior)', () => {
    expect(resolveExposeErrorStack({ nodeEnv: 'development' })).toBe(true);
  });

  it('defaults to FALSE in every deployable / non-dev env (no stack leaked)', () => {
    for (const env of ['production', 'beta', 'staging', 'test', undefined, 'unknown']) {
      expect(resolveExposeErrorStack({ nodeEnv: env })).toBe(false);
    }
  });

  it('EXPOSE_ERROR_STACK=true forces exposure even in production', () => {
    expect(resolveExposeErrorStack({ nodeEnv: 'production', exposeErrorStackEnv: 'true' })).toBe(true);
    // case/whitespace-insensitive
    expect(resolveExposeErrorStack({ nodeEnv: 'beta', exposeErrorStackEnv: '  TRUE ' })).toBe(true);
  });

  it('EXPOSE_ERROR_STACK=false forces OFF even in development', () => {
    expect(resolveExposeErrorStack({ nodeEnv: 'development', exposeErrorStackEnv: 'false' })).toBe(false);
  });

  it('a typo override is NOT silently honored — falls through to the NODE_ENV default', () => {
    // 'yes'/'1' are not the explicit literals — must NOT expose in production.
    expect(resolveExposeErrorStack({ nodeEnv: 'production', exposeErrorStackEnv: 'yes' })).toBe(false);
    expect(resolveExposeErrorStack({ nodeEnv: 'development', exposeErrorStackEnv: '1' })).toBe(true);
  });
});
