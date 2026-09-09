/**
 * Realm-independent "this database write was refused, and refused for THIS reason"
 * assertion (Equoria-ypb7d fix round 4, sibling of `expectRealDate.mjs`).
 *
 * DO NOT REPLACE THESE CALLS WITH `await expect(promise).rejects.toThrow()`.
 *
 * WHY `.rejects.toThrow()` IS THE WRONG INSTRUMENT HERE
 *   Two independent defects, one of which is silent.
 *
 *   1. IT CAN REPORT "did not throw" FOR A PROMISE THAT DID REJECT. The backend
 *      suite runs under `--experimental-vm-modules`, which can evaluate the
 *      application's modules in a different V8 module realm from the test file's.
 *      Jest's `.rejects.toThrow()` decides whether a rejection value is an error
 *      with an `instanceof Error` check, and `instanceof` is constructor
 *      IDENTITY, not a structural check — so where Prisma's
 *      `PrismaClientKnownRequestError` comes from a different realm than the test
 *      file's `Error`, the check is false and Jest prints:
 *
 *          expect(received).rejects.toThrow()
 *          Received function did not throw
 *
 *      …for a promise that rejected with a real P2002. Same root cause as the
 *      `toBeInstanceOf(Date)` failure `expectRealDate.mjs` exists for.
 *
 *      WHOSE MEASUREMENT, AND WHERE IT DOES NOT REPRODUCE — stated precisely,
 *      because this helper must not claim a failure its author never saw. The
 *      red was measured by the round-3 reviewer on
 *      `groomEngagementLifecycle.integration`: 4 runs in 4 red under
 *      `--runInBand`, 3 in 3 green under `--maxWorkers=2`, identical test bytes,
 *      with `instanceof Error = false` printed from inside the suite. It does
 *      NOT reproduce on this author's machine: an in-suite probe in both
 *      invocations printed `instanceof Error = true`, `code = P2002`,
 *      `target = ["groomId"]`, and the old assertion passed in both. So the
 *      realm split is environment-dependent — which is the strongest reason to
 *      stop asserting on identity at all rather than to wait for a machine that
 *      shows it. Defect 2 below is present in EVERY environment, including this
 *      one, and is what the plant for this change actually exercised.
 *      Environment sensitivity tracked in `Equoria-wl6ln`.
 *
 *   2. IT DOES NOT SAY WHICH REFUSAL. A bare `.rejects.toThrow()` passes on ANY
 *      rejection — a foreign-key violation, a missing required column, a typo in
 *      the model name, a dropped connection. A test whose subject is one specific
 *      constraint must fail when a DIFFERENT constraint fires, or it is not
 *      evidence about that constraint. This is the defect that survives even in
 *      the invocation where the matcher works.
 *
 * WHAT THIS CHECKS INSTEAD
 *   The error's own discriminating DATA rather than its class: Prisma's `code`
 *   (`'P2002'` for a unique violation) and `meta.target` (which column or index
 *   the violation was on). Both are plain own properties of the value, so they
 *   cross realms for the same reason `Object.prototype.toString.call` does in
 *   `expectRealDate.mjs` — nothing is asked about where the object came from.
 *
 *   Deliberately NOT the message: on Prisma 6.8.2 a P2002's `message` begins with
 *   an empty line and does not name the index at all (measured), so message
 *   matching here would assert nothing useful and would break on a Prisma bump.
 *
 *   This is a codification, not an invention: `groomAssignmentActiveUnique`
 *   `.integration.test.mjs:101` already asserts `rejected[0].reason.code` for the
 *   sibling partial unique index. What the helper adds is the target, the
 *   resolved-without-rejecting case, and a readable failure.
 *
 * WHY THESE RETURN STRINGS RATHER THAN THROWING
 *   Same reason as `realDateOrReason`: the failure reads as
 *
 *       Expected: "P2002 on groomId"
 *       Received: "resolved without rejecting"
 *
 *   which names the actual defect — the constraint did not fire — instead of a
 *   realm-identity red herring.
 *
 * SCOPE. Applied to ONE site by the task that added it. The tree-wide sweep (317
 * rejection assertions, 22 lines pairing an identity-dependent matcher with a
 * Prisma reference) is `Equoria-wl6ln` and is deliberately not done here.
 */

/**
 * The `code on target` signature of a rejection, or a description of whatever
 * arrived instead.
 *
 * @param {unknown} reason - a promise rejection value
 * @returns {string} e.g. `'P2002 on groomId'`, `'P2003 on groom_id_fkey'`,
 *   `'P1001'` (no target), or a brand + first message line for anything that is
 *   not a Prisma known-request error
 */
export function describePrismaRejection(reason) {
  if (reason === null || reason === undefined) {
    return `rejected with ${String(reason)}`;
  }

  const code = /** @type {{ code?: unknown }} */ (reason).code;
  if (typeof code === 'string' && code.length > 0) {
    const target = /** @type {{ meta?: { target?: unknown } }} */ (reason).meta?.target;
    if (Array.isArray(target)) {
      // Sorted so the signature does not depend on column order, which Postgres
      // reports from the index definition rather than from the write.
      return target.length > 0 ? `${code} on ${[...target].sort().join('+')}` : code;
    }
    if (typeof target === 'string' && target.length > 0) {
      return `${code} on ${target}`;
    }
    return code;
  }

  // Not a Prisma known-request error. Say what it was, brand first, because the
  // brand is the one thing that survives a realm boundary.
  const brand = Object.prototype.toString.call(reason);
  const firstLine = String(/** @type {{ message?: unknown }} */ (reason).message ?? reason)
    .split('\n')
    .find(line => line.trim().length > 0);
  return firstLine ? `${brand} ${firstLine.trim()}` : brand;
}

/**
 * Await `promise` and report how it settled, as a string fit for `toBe`.
 *
 * Usage:
 *
 *   expect(await prismaRejectionOf(prisma.groomEngagement.create({ … }))).toBe(
 *     'P2002 on groomId',
 *   );
 *
 * A promise that FULFILS returns `'resolved without rejecting'` rather than
 * throwing, so the assertion — not the helper — reports the failure, and reports
 * it as the difference between two readable strings.
 *
 * @param {Promise<unknown>} promise
 * @returns {Promise<string>}
 */
export async function prismaRejectionOf(promise) {
  try {
    await promise;
  } catch (reason) {
    return describePrismaRejection(reason);
  }
  return 'resolved without rejecting';
}

export default { describePrismaRejection, prismaRejectionOf };
