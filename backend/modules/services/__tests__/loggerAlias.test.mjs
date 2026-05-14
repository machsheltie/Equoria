/**
 * _logger.mjs — backward-compat alias re-export test (Equoria-rr7)
 *
 * `_logger.mjs` is a thin alias re-exporting the default winston logger from
 * `logger.mjs`. It exists purely for backward-compatibility with older imports
 * (some legacy modules used `import logger from './_logger.mjs'`). This test
 * proves the alias re-export resolves to the same logger instance — covering
 * the 3 statements in the file.
 */

import { describe, it, expect } from '@jest/globals';
import aliasLogger from '../../../utils/_logger.mjs';
import canonicalLogger from '../../../utils/logger.mjs';

describe('_logger alias module (Equoria-rr7)', () => {
  it('re-exports a defined default logger instance', () => {
    expect(aliasLogger).toBeDefined();
    expect(aliasLogger).not.toBeNull();
  });

  it('alias logger is the same reference as canonical logger', () => {
    // Winston loggers are singletons. The alias must point to the same
    // object so log routing, transports, and metadata stay consistent
    // regardless of which import path callers use.
    expect(aliasLogger).toBe(canonicalLogger);
  });

  it('exposes the standard winston logging methods', () => {
    // Smoke check the public API surface used throughout the backend.
    expect(typeof aliasLogger.info).toBe('function');
    expect(typeof aliasLogger.warn).toBe('function');
    expect(typeof aliasLogger.error).toBe('function');
    expect(typeof aliasLogger.debug).toBe('function');
  });
});
