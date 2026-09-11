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
 *      Jest prints:
 *
 *          expect(received).rejects.toThrow()
 *          Received function did not throw
 *
 *      …for a promise that rejected with a real Prisma error. Same root cause as
 *      the `toBeInstanceOf(Date)` failure `expectRealDate.mjs` exists for.
 *
 *      THE EXACT MECHANISM, corrected 2026-09-11 (task 27) — this paragraph used
 *      to say the matcher decides with a bare `instanceof Error` check, which is
 *      half the story and would mislead anyone reasoning about a non-Prisma
 *      rejection. `@jest/expect-utils`'s `isError`
 *      (`node_modules/@jest/expect-utils/build/index.js:687`) FIRST switches on
 *      `Object.prototype.toString.call(value)` for `[object Error]` /
 *      `[object Exception]` / `[object DOMException]`, and only falls back to
 *      `value instanceof Error`. That brand fast path is realm-independent, so a
 *      plain cross-realm `Error` is recognised fine. What defeats it is Prisma:
 *      its error prototypes carry their own `Symbol.toStringTag`, so their brand
 *      is `[object PrismaClientKnownRequestError]` — never `[object Error]` — and
 *      `instanceof`, which is constructor IDENTITY, is left to decide alone.
 *      With `isError` false and `received` not a function, `createMatcher`
 *      (`node_modules/expect/build/index.js:1813`) leaves `thrown = null` and
 *      `toThrow` renders DID_NOT_THROW.
 *
 *      WHERE IT REPRODUCES. Originally measured by the round-3 reviewer on
 *      `groomEngagementLifecycle.integration` (4 runs in 4 red under
 *      `--runInBand`, 3 in 3 green under `--maxWorkers=2`) and NOT on that
 *      author's machine, which is why this file once called the split
 *      "environment-dependent". Task 27 measured it deterministically: under
 *      `backend/jest.config.mjs` — the config the authoritative sharded profile
 *      actually runs — a Prisma rejection has `instanceof Error === false` every
 *      time, and `groomAgeModel.integration` fails on `.rejects.toThrow()` as the
 *      first and only file in a fresh process. The earlier "passes here"
 *      measurements were taken through the ROOT `jest.config.js`
 *      (`--selectProjects backend`), a different config. The trigger of the split
 *      is still unestablished; its presence under that config is not.
 *      Tracked in `Equoria-wl6ln`.
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
 *   Deliberately NOT the message, FOR A P-CODED ERROR: on Prisma 6.8.2 a P2002's
 *   `message` begins with an empty line and does not name the index at all
 *   (measured), so message matching there would assert nothing useful and would
 *   break on a Prisma bump. That refusal still stands and binds the coded branch
 *   below. It does NOT bind the uncoded branch: a CHECK violation has no `code`
 *   and no `meta` at all, so its message is the only place the discriminating data
 *   exists. See EXTENSION 2026-09-11 further down, which reads the connector's
 *   passthrough of PostgreSQL's own text and states the limits of doing so.
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
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * EXTENSION 2026-09-11 (Equoria-wl6ln, task 27): CONSTRAINTS PRISMA GIVES NO CODE
 *
 * WHAT WAS MISSING. `describePrismaRejection` only had a signature for errors
 * that carry a `code`. A CHECK constraint has none: measured on Prisma 6.8.2
 * against the live `equoria` database, `prisma.groom.update({ data: { startAge:
 * 17 } })` against `grooms_start_age_range` rejects with a
 * `PrismaClientUnknownRequestError` whose OWN PROPERTIES are exactly
 * `stack, message, clientVersion, batchRequestIdx, name` — no `code`, no `meta`.
 * Prisma has no P-code for SQLSTATE 23514, so it passes the driver error through
 * as text. The old fallback therefore described the CHECK violation as
 * `'[object PrismaClientUnknownRequestError] Invalid `prisma.groom.update()`
 * invocation:'` — which distinguishes it from a P-coded failure but does not say
 * WHICH constraint refused the write, so widening the CHECK in the database
 * while leaving the draw alone would still have satisfied it.
 *
 * WHY THIS ONE PARSES THE MESSAGE WHEN THE P2002 PATH REFUSES TO. The refusal
 * above stands for coded errors: for a P2002 the message names no index at all,
 * so matching it would assert nothing. Here the message is the ONLY place the
 * discriminating data exists, and the part being read is not Prisma's prose — it
 * is PostgreSQL's own `code:` and `violates … constraint "…"` text, which Prisma
 * passes through verbatim from the connector. The failure direction is also the
 * safe one: if a Prisma bump changes the wrapper, extraction returns null, the
 * brand fallback takes over, and the assertion FAILS LOUDLY rather than passing
 * vacuously. Nothing here is asked about an object's class, so it is as
 * realm-independent as the coded path.
 *
 * MEASURED DISCRIMINATION (the plant this extension is judged by). Against the
 * same row, `prisma.groom.update({ where: { id: -999999 } })` rejects with a
 * `PrismaClientKnownRequestError` carrying `code: 'P2025'` and no Postgres
 * payload, so it describes as `'P2025'` — a different string. An assertion on
 * `'23514 on grooms_start_age_range'` therefore fails on that plant, where a
 * bare `.rejects.toThrow()` passed.
 *
 * WHAT GATES THE MESSAGE READ, and the limit that remains. Reading a message is
 * loose by construction: a rejection that merely CONTAINS the connector text
 * would satisfy the signature. Measured — a bare
 * `new Error('… PostgresError { code: "23514" … grooms_start_age_range …')`
 * did satisfy it. That is the same family of defect this helper exists to remove,
 * so the read is now gated on the value's own STRUCTURED properties first:
 * `clientVersion` must be a non-empty string and `name` must match
 * `/^PrismaClient[A-Za-z]*Error$/`, both plain own properties (measured on the
 * real rejection) and therefore realm-crossing. The message must additionally
 * carry the connector envelope `PostgresError {`. After that gate the bare forged
 * Error falls through to the brand fallback.
 *   THE RESIDUAL LIMIT, stated because an unstated limit is how the next person
 *   gets a false green: an object that deliberately forges BOTH `name` and
 *   `clientVersion` alongside the text still satisfies it (measured: it does).
 *   Nothing can close that gap for this error shape — the ORM's CHECK rejection
 *   has no structured SQLSTATE anywhere on it, only `message` — so what this
 *   assertion proves is "a Prisma client reported SQLSTATE X on constraint Y",
 *   not "no value could have impersonated that". For a test whose fixtures it
 *   controls, that is the right strength; do not reach for it to validate
 *   untrusted input.
 *
 * RAW SQL IS DIFFERENT, AND IT IS NOT A BLIND SPOT — measured 2026-09-11. The
 * SAME constraint reached through `$executeRawUnsafe` rejects with a
 * `PrismaClientKnownRequestError` carrying `code: 'P2010'`, so the CODED branch
 * wins and the uncoded read above never runs. That used to collapse the signature
 * to a bare `'P2010'`, which says nothing about which constraint fired. But the
 * SQLSTATE and the constraint name are not lost: a P2010 carries them in
 * STRUCTURED fields — `meta.code === '23514'` and `meta.message ===
 * 'ERROR: new row for relation "grooms" violates check constraint
 * "grooms_start_age_range"\nDETAIL: …'`, the driver's own message in its own
 * field rather than buried in Prisma's prose. So the coded branch now reports
 * `'P2010 23514 on grooms_start_age_range'`, and a caller CAN discriminate a
 * raw-SQL constraint violation. Note the asymmetry when writing an assertion: the
 * ORM path and the raw-SQL path for one constraint produce DIFFERENT signatures,
 * because they genuinely are different errors. Assert the one your code takes.
 */

/**
 * PostgreSQL's SQLSTATE as the connector reports it, e.g. `code: "23514"`.
 * Five characters, digits and upper-case letters, per the SQLSTATE grammar.
 */
const POSTGRES_SQLSTATE = /\bcode:\s*"([0-9A-Z]{5})"/;

/** A SQLSTATE standing alone in a structured field, as `meta.code` carries it. */
const SQLSTATE_ALONE = /^[0-9A-Z]{5}$/;

/** The connector envelope. Its presence is what makes a message worth reading. */
const POSTGRES_ENVELOPE = 'PostgresError {';

/**
 * Prisma's own error names. Used as STRUCTURAL evidence that a value came from a
 * Prisma client before any of its message text is trusted.
 */
const PRISMA_ERROR_NAME = /^PrismaClient[A-Za-z]*Error$/;

/**
 * The constraint PostgreSQL names in its own message. In a
 * `PrismaClientUnknownRequestError.message` the quotes arrive backslash-escaped,
 * because the connector embeds the driver message inside a Rust debug rendering;
 * in a P2010's `meta.message` they are bare. The backslash is therefore optional
 * rather than required, so one pattern reads both and neither depends on that
 * nesting surviving a Prisma bump.
 */
const POSTGRES_CONSTRAINT =
  /\bviolates\s+(?:check|unique|foreign key|not-null|exclusion)\s+constraint\s+\\?"([^"\\]+)/;

/**
 * Does this value carry Prisma's own structural markers? Both are plain own
 * properties (measured), so the question crosses realms — nothing is asked about
 * the value's class. This gate is what stops a bare `Error` whose message merely
 * contains connector text from satisfying a constraint signature.
 *
 * @param {unknown} reason
 * @returns {boolean}
 */
function isPrismaClientError(reason) {
  const { name, clientVersion } = /** @type {{ name?: unknown, clientVersion?: unknown }} */ (
    reason
  );
  return (
    typeof clientVersion === 'string' &&
    clientVersion.length > 0 &&
    typeof name === 'string' &&
    PRISMA_ERROR_NAME.test(name)
  );
}

/**
 * The constraint PostgreSQL named, read from a driver message.
 *
 * @param {unknown} message
 * @returns {string | undefined}
 */
function constraintIn(message) {
  return typeof message === 'string' ? POSTGRES_CONSTRAINT.exec(message)?.[1] : undefined;
}

/**
 * The `sqlstate on constraint` signature of a raw driver error that Prisma did
 * not map to a P-code, or `null` when the rejection is not a Prisma client error
 * or carries no Postgres payload.
 *
 * @param {unknown} reason - a promise rejection value
 * @returns {string | null} e.g. `'23514 on grooms_start_age_range'`, or `'23514'`
 *   when Postgres named no constraint (a bare `CHECK (…)` expression does not)
 */
function describeDriverRejection(reason) {
  if (!isPrismaClientError(reason)) {
    return null;
  }

  const message = /** @type {{ message?: unknown }} */ (reason).message;
  if (typeof message !== 'string' || !message.includes(POSTGRES_ENVELOPE)) {
    return null;
  }

  const sqlstate = POSTGRES_SQLSTATE.exec(message)?.[1];
  if (!sqlstate) {
    return null;
  }

  const constraint = constraintIn(message);
  return constraint ? `${sqlstate} on ${constraint}` : sqlstate;
}

/**
 * The `code on target` signature of a rejection, or a description of whatever
 * arrived instead.
 *
 * @param {unknown} reason - a promise rejection value
 * @returns {string} e.g. `'P2002 on groomId'`, `'P2003 on groom_id_fkey'`,
 *   `'P1001'` (no target), `'P2010 23514 on grooms_start_age_range'` for a
 *   constraint hit through raw SQL, `'23514 on grooms_start_age_range'` for one
 *   hit through the ORM (which Prisma gives no code), or a brand + first message
 *   line for anything else
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

    // A raw-query failure (P2010) has no `target`, but it does carry the driver's
    // own error in STRUCTURED fields: `meta.code` is the bare SQLSTATE and
    // `meta.message` is PostgreSQL's message in its own field. Without this the
    // signature collapsed to `'P2010'`, which says nothing about which constraint
    // fired — a caller asserting a raw-SQL constraint violation would have got a
    // signature that a dropped column or a syntax error also produces.
    const meta = /** @type {{ meta?: { code?: unknown, message?: unknown } }} */ (reason).meta;
    if (typeof meta?.code === 'string' && SQLSTATE_ALONE.test(meta.code)) {
      const constraint = constraintIn(meta.message);
      return constraint ? `${code} ${meta.code} on ${constraint}` : `${code} ${meta.code}`;
    }

    return code;
  }

  // No P-code. A raw driver error may still carry PostgreSQL's own SQLSTATE and
  // constraint name — the only discriminating data a CHECK violation has.
  const driver = describeDriverRejection(reason);
  if (driver) {
    return driver;
  }

  // Not a Prisma known-request error, and no Postgres payload either. Say what it
  // was, brand first, because the brand is the one thing that survives a realm
  // boundary.
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
