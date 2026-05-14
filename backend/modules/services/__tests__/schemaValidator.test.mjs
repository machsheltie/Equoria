/**
 * schemaValidator — branch-coverage tests (Equoria-rr7)
 *
 * After fixing the take:0→findMany({take:1}) bug, validateDatabaseSchema()
 * now returns true when the DB has the required models/fields (the success path).
 * Tests cover:
 *   - success path (returns true, lines 63 / 92-93)
 *   - validateDatabaseSchemaOrExit() success path (no process.exit, lines 113-119)
 *
 * Branches that remain untestable without DB manipulation (capped at ~85%):
 *   - missing-field error (lines 66-73): requires the schema to be missing a field
 *   - outer-catch return false (line 101): requires prisma.$connect() to fail
 *   - validateDatabaseSchemaOrExit outer-catch (lines 121-122): inner fn never throws
 *     when called with throwOnError:false
 */

import { describe, it, expect } from '@jest/globals';
import { validateDatabaseSchema, validateDatabaseSchemaOrExit } from '../../../utils/schemaValidator.mjs';

describe('validateDatabaseSchema()', () => {
  it('returns true when required models and fields are present', async () => {
    const result = await validateDatabaseSchema();
    expect(result).toBe(true);
  });

  it('returns true with explicit throwOnError=false', async () => {
    const result = await validateDatabaseSchema({ throwOnError: false });
    expect(result).toBe(true);
  });

  it('returns true with throwOnError=true when schema is valid', async () => {
    const result = await validateDatabaseSchema({ throwOnError: true });
    expect(result).toBe(true);
  });
});

describe('validateDatabaseSchemaOrExit()', () => {
  it('does NOT call process.exit when schema is valid', async () => {
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

    // Schema is valid → isValid=true → process.exit is never called
    expect(exitCode).toBeNull();
  });
});
