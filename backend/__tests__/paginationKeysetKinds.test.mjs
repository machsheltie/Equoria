/**
 * Keyset helper: boolean and nullable sort keys, and readKeysetParams
 * (Equoria-cmw85.21). Pure functions, no database; the real-DB walks that rely on
 * them are in the forum and marketplace suites.
 */

import { describe, it, expect } from '@jest/globals';
import {
  InvalidCursorError,
  decodeCursor,
  encodeCursor,
  keysetWhere,
  readKeysetParams,
} from '../utils/paginationHelper.mjs';

describe('keysetWhere on boolean keys', () => {
  const sort = [
    { key: 'isPinned', dir: 'desc' },
    { key: 'id', dir: 'desc' },
  ];

  it('after a pinned row: the rest of the pinned rows, then every unpinned row', () => {
    expect(keysetWhere(sort, [true, 9])).toEqual({
      OR: [{ isPinned: false }, { isPinned: true, id: { lt: 9 } }],
    });
  });

  it('after an unpinned row: only the lower ids among unpinned rows', () => {
    expect(keysetWhere(sort, [false, 9])).toEqual({
      OR: [{ isPinned: false, id: { lt: 9 } }],
    });
  });

  it('ascending mirrors it', () => {
    const asc = [
      { key: 'isPinned', dir: 'asc' },
      { key: 'id', dir: 'asc' },
    ];
    expect(keysetWhere(asc, [false, 3])).toEqual({
      OR: [{ isPinned: true }, { isPinned: false, id: { gt: 3 } }],
    });
    expect(keysetWhere(asc, [true, 3])).toEqual({
      OR: [{ isPinned: true, id: { gt: 3 } }],
    });
  });
});

describe('keysetWhere on nullable keys (Postgres: NULL is the largest value)', () => {
  const asc = [
    { key: 'salePrice', dir: 'asc', nullable: true },
    { key: 'id', dir: 'asc' },
  ];
  const desc = [
    { key: 'salePrice', dir: 'desc', nullable: true },
    { key: 'id', dir: 'asc' },
  ];

  it('ascending after a value: larger values or NULL (NULL sorts last)', () => {
    expect(keysetWhere(asc, [50, 4])).toEqual({
      OR: [{ OR: [{ salePrice: { gt: 50 } }, { salePrice: null }] }, { salePrice: 50, id: { gt: 4 } }],
    });
  });

  it('ascending after NULL: only the NULL rows with a higher id', () => {
    expect(keysetWhere(asc, [null, 4])).toEqual({ OR: [{ salePrice: null, id: { gt: 4 } }] });
  });

  it('descending after NULL (NULL sorts first): every value, then NULLs with a higher id', () => {
    expect(keysetWhere(desc, [null, 4])).toEqual({
      OR: [{ salePrice: { not: null } }, { salePrice: null, id: { gt: 4 } }],
    });
  });

  it('descending after a value: smaller values only', () => {
    expect(keysetWhere(desc, [50, 4])).toEqual({
      OR: [{ salePrice: { lt: 50 } }, { salePrice: 50, id: { gt: 4 } }],
    });
  });
});

describe('keysetWhere with an explicit nulls position', () => {
  it('ascending with NULLs first: after a value, only larger values; after NULL, every value', () => {
    const feeAsc = [
      { key: 'studFee', dir: 'asc', nullable: true, nulls: 'first' },
      { key: 'id', dir: 'asc' },
    ];
    expect(keysetWhere(feeAsc, [20, 4])).toEqual({
      OR: [{ studFee: { gt: 20 } }, { studFee: 20, id: { gt: 4 } }],
    });
    expect(keysetWhere(feeAsc, [null, 4])).toEqual({
      OR: [{ studFee: { not: null } }, { studFee: null, id: { gt: 4 } }],
    });
  });

  it('descending with NULLs last: after a value, smaller values or NULL', () => {
    const feeDesc = [
      { key: 'studFee', dir: 'desc', nullable: true, nulls: 'last' },
      { key: 'id', dir: 'asc' },
    ];
    expect(keysetWhere(feeDesc, [20, 4])).toEqual({
      OR: [{ OR: [{ studFee: { lt: 20 } }, { studFee: null }] }, { studFee: 20, id: { gt: 4 } }],
    });
    expect(keysetWhere(feeDesc, [null, 4])).toEqual({ OR: [{ studFee: null, id: { gt: 4 } }] });
  });
});

describe('cursor values: booleans and nulls', () => {
  it('round-trips a boolean and, for a nullable type, a null', () => {
    const cursor = encodeCursor([true, null, 7]);
    expect(decodeCursor(cursor, ['bool', 'int?', 'int'])).toEqual([true, null, 7]);
  });

  it('refuses a null in a column that is not nullable, and a non-boolean for bool', () => {
    expect(() => decodeCursor(encodeCursor([null, 7]), ['int', 'int'])).toThrow(InvalidCursorError);
    expect(() => decodeCursor(encodeCursor(['yes', 7]), ['bool', 'int'])).toThrow(InvalidCursorError);
  });
});

describe('readKeysetParams', () => {
  it('clamps the limit and defaults the offset to zero', () => {
    expect(readKeysetParams({ limit: '5000' }, { def: 50, max: 100 })).toEqual({
      limit: 100,
      cursor: null,
      skip: 0,
    });
    expect(readKeysetParams({}, { def: 50, max: 100 }).limit).toBe(50);
  });

  it('reads the legacy ?offset, else ?page, and passes the cursor through untouched', () => {
    expect(readKeysetParams({ limit: '10', offset: '30' }).skip).toBe(30);
    expect(readKeysetParams({ limit: '10', page: '3' }).skip).toBe(20);
    expect(readKeysetParams({ cursor: 'c1:abc' }).cursor).toBe('c1:abc');
    expect(readKeysetParams({ cursor: '' }).cursor).toBeNull();
    expect(readKeysetParams({ page: '-4', offset: 'x' }).skip).toBe(0);
  });
});
