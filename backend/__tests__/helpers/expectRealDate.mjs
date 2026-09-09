/**
 * Realm-independent "this is a real timestamp" assertion (Equoria-m9lz1 fix
 * round 2).
 *
 * DO NOT REPLACE THESE CALLS WITH `expect(value).toBeInstanceOf(Date)`.
 *
 * WHY `toBeInstanceOf(Date)` IS THE WRONG INSTRUMENT HERE
 *   The backend suite runs under `--experimental-vm-modules`, which can evaluate
 *   the application's modules in a different V8 module realm from the test file's.
 *   `instanceof` is *identity* on the constructor object, not a structural check,
 *   so a `Date` produced inside Prisma's realm fails `toBeInstanceOf(Date)` when
 *   `Date` in the test file resolves to a different realm's constructor. The
 *   failure is genuinely baffling to read — Jest prints:
 *
 *       expect(received).toBeInstanceOf(expected)
 *       Expected constructor: Date
 *       Received constructor: Date
 *
 *   …because both sides stringify identically while being different objects.
 *
 *   Worse, it is LOAD-ORDER DEPENDENT: it passes when the file runs alone (one
 *   realm) and fails inside a shard alongside other suites, which is exactly how
 *   this reached a full sharded run green-on-single-file. That makes it a
 *   scheduling-sensitive false failure, not a real one.
 *
 * WHAT THIS CHECKS INSTEAD
 *   `Object.prototype.toString.call(value)` reads the internal `[[Class]]` brand,
 *   which is a property of the *value* rather than of any constructor identity,
 *   so it crosses realms. Plus a non-NaN `getTime()`, because `new Date('nonsense')`
 *   is a `[object Date]` too and an Invalid Date is never what a test means by
 *   "this row has a real timestamp". Together these assert exactly what the
 *   original assertions meant — a real, usable date, and specifically not `null`,
 *   which is the pre-fix state most of these guard against.
 */

/**
 * Is this a real, valid Date, regardless of which realm constructed it?
 *
 * @param {unknown} value
 * @returns {boolean}
 */
export function isRealDate(value) {
  return (
    Object.prototype.toString.call(value) === '[object Date]' &&
    Number.isFinite(/** @type {Date} */ (value).getTime())
  );
}

/**
 * A description of `value` fit for an assertion message, so a failure says what
 * arrived instead of a date rather than just `false`.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function describeDateLike(value) {
  if (value === null) {
    return 'null';
  }
  if (value === undefined) {
    return 'undefined';
  }
  const brand = Object.prototype.toString.call(value);
  if (brand === '[object Date]') {
    return `Invalid Date (${String(value)})`;
  }
  return `${brand} ${JSON.stringify(value) ?? String(value)}`;
}

/**
 * Assert that `value` is a real, valid date. Use with Jest's `expect`:
 *
 *   expect(realDateOrReason(row.endDate)).toBe('valid date');
 *
 * Returning a STRING rather than throwing keeps the failure readable: Jest shows
 * `Expected "valid date", Received "null"`, which names the actual defect
 * (the column was never written) instead of a realm-identity red herring.
 *
 * @param {unknown} value
 * @returns {string} `'valid date'` when real, otherwise a description of what arrived
 */
export function realDateOrReason(value) {
  return isRealDate(value) ? 'valid date' : describeDateLike(value);
}

export default { isRealDate, describeDateLike, realDateOrReason };
