/**
 * schemaValidator — safe-DB branch-coverage tests (Equoria-rr7)
 *
 * validateDatabaseSchema():
 *   In the current codebase, prisma.findFirst({ take: 0 }) throws a Prisma
 *   "take must be 1" error for every model.  This populates validationErrors,
 *   so the function always returns false — covering lines 81-89.
 *
 *   Calling with throwOnError:true covers lines 85-86 (throw inside outer try)
 *   and then lines 94-99 (outer catch with re-throw).
 *
 * validateDatabaseSchemaOrExit():
 *   Always calls process.exit(1) because the schema check above returns false.
 *   We stub process.exit to prevent the process from dying and assert it was
 *   called with code 1.  This covers lines 113-122.
 */

import { describe, it, expect } from '@jest/globals';
import { validateDatabaseSchema, validateDatabaseSchemaOrExit } from '../../../utils/schemaValidator.mjs';

describe('validateDatabaseSchema()', () => {
  it('returns false (schema validation fails due to Prisma take:0 constraint)', async () => {
    const result = await validateDatabaseSchema();
    expect(result).toBe(false);
  });

  it('returns false with explicit throwOnError=false', async () => {
    const result = await validateDatabaseSchema({ throwOnError: false });
    expect(result).toBe(false);
  });

  it('rejects when throwOnError=true (validation error thrown then re-thrown by outer catch)', async () => {
    await expect(validateDatabaseSchema({ throwOnError: true })).rejects.toThrow(/Database schema validation failed/);
  });
});

describe('validateDatabaseSchemaOrExit()', () => {
  it('calls process.exit(1) because the schema check returns false', async () => {
    const original = process.exit;
    let exitCode = null;

    process.exit = code => {
      exitCode = code;
    };

    try {
      await validateDatabaseSchemaOrExit();
    } finally {
      process.exit = original;
    }

    expect(exitCode).toBe(1);
  });
});
