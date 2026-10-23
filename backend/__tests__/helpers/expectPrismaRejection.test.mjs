/**
 * Unit tests for expectPrismaRejection.mjs (Equoria-709u5).
 *
 * The helper's behaviour was hardened in Equoria-ypb7d / wl6ln task 27 and
 * verified then by an out-of-band probe plus two consumer suites, never by a test
 * of the helper itself. This file pins each measured behaviour so a Prisma bump
 * or a refactor of the helper cannot quietly turn a constraint assertion into one
 * that passes on any rejection.
 *
 * The error values below are plain objects carrying exactly the own properties
 * that were MEASURED on Prisma 6.8.2 against the live `equoria` database (see the
 * helper's docblock), so this is a pure unit test: no database, no fixtures.
 */

import { describe, it, expect } from '@jest/globals';
import { runInNewContext } from 'node:vm';
import { describePrismaRejection, prismaRejectionOf } from './expectPrismaRejection.mjs';

const clientVersion = '6.8.2';

/** A P-coded known-request error: `code`, `meta`, `clientVersion`, `name`. */
function knownRequestError(code, meta, message = `\nInvalid invocation (${code})`) {
  return Object.assign(new Error(message), {
    name: 'PrismaClientKnownRequestError',
    code,
    meta,
    clientVersion,
  });
}

/** The ORM's CHECK rejection: no code, no meta, Postgres text inside the message. */
function unknownRequestError(message) {
  return Object.assign(new Error(message), {
    name: 'PrismaClientUnknownRequestError',
    clientVersion,
    batchRequestIdx: 0,
  });
}

const checkMessage =
  'Invalid `prisma.groom.update()` invocation:\n\n\n' +
  'Raw query failed. Code: `23514`. Message: `db error: PostgresError { code: "23514", ' +
  'message: "new row for relation \\"grooms\\" violates check constraint \\"grooms_start_age_range\\"", ' +
  'severity: "ERROR" }`';

describe('describePrismaRejection: P-coded errors (the code and meta.target are the signature)', () => {
  it('reports a P2002 with its target column', () => {
    expect(describePrismaRejection(knownRequestError('P2002', { target: ['groomId'] }))).toBe('P2002 on groomId');
  });

  it('reports a string target (a named index) as-is', () => {
    expect(describePrismaRejection(knownRequestError('P2002', { target: 'groom_engagement_groom_id_key' }))).toBe(
      'P2002 on groom_engagement_groom_id_key',
    );
  });

  it('sorts a multi-column target so column order cannot change the signature', () => {
    const forward = describePrismaRejection(knownRequestError('P2002', { target: ['userId', 'groomId'] }));
    const reverse = describePrismaRejection(knownRequestError('P2002', { target: ['groomId', 'userId'] }));
    expect(forward).toBe('P2002 on groomId+userId');
    expect(reverse).toBe(forward);
  });

  it('reports a P2025 (record not found) as the bare code, distinct from P2002', () => {
    expect(describePrismaRejection(knownRequestError('P2025', { cause: 'Record to update not found.' }))).toBe('P2025');
  });

  it('reports a coded error with an empty target array as the bare code', () => {
    expect(describePrismaRejection(knownRequestError('P2002', { target: [] }))).toBe('P2002');
  });
});

describe('describePrismaRejection: raw SQL (P2010) reads the structured meta fields', () => {
  it('names the SQLSTATE and the constraint from meta.code / meta.message', () => {
    const error = knownRequestError('P2010', {
      code: '23514',
      message:
        'ERROR: new row for relation "grooms" violates check constraint "grooms_start_age_range"\nDETAIL: Failing row',
    });
    expect(describePrismaRejection(error)).toBe('P2010 23514 on grooms_start_age_range');
  });

  it('reports the SQLSTATE alone when meta.message names no constraint', () => {
    expect(
      describePrismaRejection(knownRequestError('P2010', { code: '42P01', message: 'relation does not exist' })),
    ).toBe('P2010 42P01');
  });

  it('does not read a meta.code that is not a SQLSTATE', () => {
    expect(describePrismaRejection(knownRequestError('P2010', { code: 'not-a-sqlstate' }))).toBe('P2010');
  });
});

describe('describePrismaRejection: the ORM CHECK violation has no code, so the Postgres text is read', () => {
  it('reports SQLSTATE and constraint from a PrismaClientUnknownRequestError message', () => {
    expect(describePrismaRejection(unknownRequestError(checkMessage))).toBe('23514 on grooms_start_age_range');
  });

  it('reports the SQLSTATE alone when Postgres named no constraint', () => {
    const message = 'Raw query failed. db error: PostgresError { code: "23514", message: "check failed" }';
    expect(describePrismaRejection(unknownRequestError(message))).toBe('23514');
  });

  it('is distinguishable from a P2025 on the same row (the measured plant)', () => {
    const check = describePrismaRejection(unknownRequestError(checkMessage));
    const notFound = describePrismaRejection(knownRequestError('P2025', {}));
    expect(check).not.toBe(notFound);
    expect(notFound).toBe('P2025');
  });
});

describe('describePrismaRejection: the structural gate runs before any message text is trusted', () => {
  it('a bare Error whose message merely contains connector text does NOT satisfy a constraint signature', () => {
    const forged = new Error(
      'x PostgresError { code: "23514", message: "violates check constraint \\"grooms_start_age_range\\"" }',
    );
    const description = describePrismaRejection(forged);
    expect(description).not.toBe('23514 on grooms_start_age_range');
    expect(description.startsWith('[object Error] ')).toBe(true);
  });

  it('a Prisma-named error with no clientVersion is not trusted either', () => {
    const forged = Object.assign(new Error(checkMessage), { name: 'PrismaClientUnknownRequestError' });
    expect(describePrismaRejection(forged)).not.toBe('23514 on grooms_start_age_range');
  });

  it('a clientVersion without a PrismaClient*Error name is not trusted either', () => {
    const forged = Object.assign(new Error(checkMessage), { name: 'Error', clientVersion });
    expect(describePrismaRejection(forged)).not.toBe('23514 on grooms_start_age_range');
  });

  it('a Prisma-shaped error without the PostgresError envelope is not read', () => {
    const noEnvelope = unknownRequestError('code: "23514" violates check constraint "grooms_start_age_range"');
    expect(describePrismaRejection(noEnvelope)).not.toBe('23514 on grooms_start_age_range');
  });

  it('DOCUMENTED RESIDUAL LIMIT: an object forging BOTH name and clientVersion alongside the text still satisfies it', () => {
    // A limit to pin, not to fix (see the helper's docblock): the ORM's CHECK
    // rejection has no structured SQLSTATE anywhere, so nothing can close this.
    // If this ever starts failing, the helper got stricter; update the docblock.
    const forged = Object.assign(new Error(checkMessage), {
      name: 'PrismaClientUnknownRequestError',
      clientVersion: 'forged',
    });
    expect(describePrismaRejection(forged)).toBe('23514 on grooms_start_age_range');
  });
});

describe('describePrismaRejection: everything else says what arrived', () => {
  it('describes null and undefined rejections', () => {
    expect(describePrismaRejection(null)).toBe('rejected with null');
    expect(describePrismaRejection(undefined)).toBe('rejected with undefined');
  });

  it('describes a plain Error by brand and first non-blank message line', () => {
    expect(describePrismaRejection(new Error('\n\n  boom here\nsecond line'))).toBe('[object Error] boom here');
  });

  it('describes a non-error rejection value by brand', () => {
    expect(describePrismaRejection('just a string')).toBe('[object String] just a string');
  });
});

describe('describePrismaRejection: realm independence (the reason the helper exists)', () => {
  it('describes an error object minted in ANOTHER realm exactly as a same-realm one', () => {
    const foreign = runInNewContext(
      'Object.assign(new Error("x"), { name: "PrismaClientKnownRequestError", code: "P2002", ' +
        'meta: { target: ["groomId"] }, clientVersion: "6.8.2" })',
    );
    expect(foreign instanceof Error).toBe(false);
    expect(describePrismaRejection(foreign)).toBe('P2002 on groomId');
  });
});

describe('prismaRejectionOf', () => {
  it('returns the signature of a rejected promise', async () => {
    const rejected = Promise.reject(knownRequestError('P2002', { target: ['groomId'] }));
    expect(await prismaRejectionOf(rejected)).toBe('P2002 on groomId');
  });

  it("returns 'resolved without rejecting' for a promise that fulfils, instead of throwing", async () => {
    expect(await prismaRejectionOf(Promise.resolve({ id: 1 }))).toBe('resolved without rejecting');
  });

  it('returns a description for a non-Prisma rejection', async () => {
    expect(await prismaRejectionOf(Promise.reject(new Error('socket closed')))).toBe('[object Error] socket closed');
  });
});
