/**
 * Shared validation middleware for horseRoutes.mjs sub-routers.
 *
 * Extracted from backend/modules/horses/routes/horseRoutes.mjs as part of the
 * god-file split (refs Equoria-y8u2j). Originally inlined; centralizing here so
 * every horse sub-router (feed, xp, breeding, etc.) reuses one source of truth
 * for :id / :userId param validation and the JSON-shape guard on PUT bodies.
 *
 * Behaviour MUST remain identical to the original inline definitions — these
 * are byte-compatible extractions, not refactors.
 */

import { param, body, validationResult } from 'express-validator';
import { canonicalizeHorseSex } from '../../../../packages/database/horseSexCanonical.mjs';

/**
 * Common validationResult handler — returns 400 with errors array if any
 * express-validator rules failed.
 */
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array(),
    });
  }
  next();
};

/**
 * Validation middleware for horse ID path parameter (:id must be positive int).
 */
export const validateHorseId = [
  param('id').isInt({ min: 1 }).withMessage('Horse ID must be a positive integer'),
  handleValidationErrors,
];

/**
 * Validation middleware for user ID path parameter (:userId 1-50 chars).
 */
export const validateUserId = [
  param('userId')
    .isLength({ min: 1, max: 50 })
    .withMessage('User ID must be between 1 and 50 characters'),
  handleValidationErrors,
];

/**
 * Validation middleware for horse creation (POST /horses).
 */
export const validateHorseCreation = [
  // Equoria-qkgfh.1: was `body('name').isLength({ min: 1, max: 100 })`. That
  // used validator.js counting, which subtracts surrogate pairs and variation
  // selectors and accepted a whitespace-only name — so create was LOOSER than
  // the rename endpoint for emoji-heavy and padded names, and a player could
  // own a horse the rename path would refuse. All four horse-name paths now
  // share one rule. See the horse name policy block below.
  horseNameBodyRule(),
  body('breedId').isInt({ min: 1 }).withMessage('Breed ID must be a positive integer'),
  body('age').optional().isInt({ min: 0, max: 50 }).withMessage('Age must be between 0 and 50'),
  // Sex is canonicalized to Title Case at the Prisma client layer
  // (Equoria-duz2). The validator accepts any casing of any canonical
  // value and trusts the interceptor to normalize on write.
  body('sex')
    .optional()
    .custom(value => {
      const canonical = canonicalizeHorseSex(value);
      // Limit user-creatable sex values to adult biological sex roles.
      // Foals (Filly/Colt) come from breeding, not direct creation.
      if (!['Stallion', 'Mare'].includes(canonical)) {
        throw new Error('Sex must be stallion or mare');
      }
      return true;
    })
    .withMessage('Sex must be stallion or mare'),
  body('gender')
    .optional()
    .custom(value => {
      const canonical = canonicalizeHorseSex(value);
      if (!['Stallion', 'Mare'].includes(canonical)) {
        throw new Error('Gender must be stallion or mare');
      }
      return true;
    })
    .withMessage('Gender must be stallion or mare'),
  body('userId')
    .optional()
    .isLength({ min: 1, max: 50 })
    .withMessage('User ID must be between 1 and 50 characters'),
  body('finalDisplayColor')
    .optional()
    .isString()
    .isLength({ min: 1, max: 100 })
    .withMessage('Final display color must be a string up to 100 characters'),
  body('sireId').optional().isInt({ min: 1 }).withMessage('Sire ID must be a positive integer'),
  body('damId').optional().isInt({ min: 1 }).withMessage('Dam ID must be a positive integer'),
  handleValidationErrors,
];

/**
 * Basic pollution/accept-header guard used by multiple horse list handlers.
 *
 * Behaviour preserved verbatim from the original inline definition (rejects
 * duplicate id-array query params, malicious Accept header, and an injection
 * pattern in the custom x-filter-breed header).
 */
export const rejectPollutedRequest = (req, res, next) => {
  // Reject duplicate query parameters (express surfaces duplicates as arrays)
  const hasArrayIdQuery = Object.entries(req.query || {}).some(
    ([key, value]) => Array.isArray(value) && key.toLowerCase().includes('id'),
  );
  if (hasArrayIdQuery) {
    return res.status(400).json({
      success: false,
      message: 'Invalid parameters',
    });
  }

  // Reject malicious Accept header
  const acceptHeader = req.headers?.accept || '';
  if (typeof acceptHeader === 'string' && acceptHeader.includes('<script>')) {
    return res.status(406).json({
      success: false,
      message: 'Not acceptable',
    });
  }

  // Reject obvious injection in custom filter header
  const filterBreed = req.headers?.['x-filter-breed'];
  if (typeof filterBreed === 'string' && filterBreed.includes("' OR '1'='1")) {
    return res.status(400).json({
      success: false,
      message: 'Invalid parameters',
    });
  }

  next();
};

/**
 * ── Horse name policy — ONE rule for every player-supplied horse name ───────
 * (Equoria-qkgfh.1)
 *
 * Every live path on which a PLAYER supplies a horse name routes through
 * `horseNameRejectionReason` below, so the four cannot drift apart:
 *
 *   1. POST  /api/v1/horses        → `validateHorseCreation` (this file)
 *   2. POST  /api/v1/horses/foals  → `validateFoalCreation` (horseFoalRoutes.mjs);
 *      its `name` also becomes `Horse.pendingFoalName` and then the foal's own
 *      name via foalingService, so it is a horse-name path twice over.
 *   3. PUT   /api/v1/horses/:id    → `validateHorseUpdatePayload` (this file)
 *   4. PATCH /api/v1/horses/:id/name → `validateHorseRenamePayload` (this file)
 *
 * The rule: a string, raw length <= 100, non-empty after trimming, containing
 * neither `<` nor NUL. Stored VERBATIM — no trim, no truncation, no case
 * folding; a violating name is rejected, never quietly repaired.
 *
 * WHERE THE BOUNDS COME FROM (found, not invented):
 *   - length 1-100 — the bound `validateHorseCreation` and `validateFoalCreation`
 *     already enforced via `body('name').isLength({ min: 1, max: 100 })`.
 *   - characters — the rule `validateHorseUpdatePayload` already enforced:
 *     reject `<` and NUL, nothing else. No allow-list regex: apostrophes and
 *     non-ASCII letters are REQUIRED to round-trip
 *     (backend/__tests__/sql-injection-attempts.test.mjs asserts
 *     `O'Malley's Horse` must be accepted verbatim, 201, and excludes 400).
 *
 * WHY RAW `.length` RATHER THAN express-validator's `isLength`, and why that is
 * a tightening the four paths now share:
 *   `isLength` is validator.js `isLength`, which subtracts surrogate pairs and
 *   variation selectors — so it counted 51 grinning-face emoji (102 UTF-16
 *   units) and 100 red-heart emoji (200 units) as within 100, and accepted a
 *   whitespace-only name. Raw `.length` is what Postgres actually stores, so it
 *   is the honest bound. Adopting the stricter rule everywhere was checked
 *   against the live data first, not assumed: all 515 horse rows were measured
 *   (longest name 48 UTF-16 units) and ZERO fail any part of this rule — no
 *   over-100, no whitespace-only, no `<`, no NUL, none even padded. So no
 *   existing horse becomes unrenameable, which is the harm that would have
 *   forced the permissive rule instead.
 *
 * NOT enforced on purpose:
 *   - Uniqueness. The owner ruled 2026-09-09 that names need not be unique
 *     ("if 20 players want to name their horse Fred, they can do so"), and
 *     `Horse.name` carries no unique index in schema.prisma, in any migration,
 *     or in the live catalog. There is deliberately no duplicate check.
 *   - Leading/trailing whitespace. `'  Fred  '` is accepted and stored with its
 *     padding. Rejecting it would be a rule with no precedent anywhere in the
 *     codebase, and trimming it would be the normalisation this policy refuses;
 *     the measurement above found zero padded names, so it is theoretical.
 *
 * `backend/utils/securityValidation.mjs#validateHorseData` claims a 2-50 range
 * plus an ASCII-only allow-list, but no route imports it (only its own unit
 * tests do) — it is not enforced behaviour and is not the precedent followed.
 */
export const HORSE_NAME_MIN_LENGTH = 1;
export const HORSE_NAME_MAX_LENGTH = 100;

/**
 * Why a candidate horse name is unacceptable, or null when it is acceptable.
 *
 * Returning a reason (rather than a message) lets `PUT /horses/:id` keep its
 * historical single 'Invalid horse name' wording — so its responses stay
 * byte-identical — while the create/foal-create/rename paths report which rule
 * failed via `horseNameRejectionMessage`.
 *
 * @param {unknown} name - candidate name, exactly as it arrived on the request
 * @returns {'type'|'length'|'characters'|null}
 */
export function horseNameRejectionReason(name) {
  if (typeof name !== 'string') {
    return 'type';
  }
  // Bound the RAW value — the stored string is the raw string, so measuring
  // anything else (as validator.js isLength does) would let an over-long name
  // through on a technicality.
  if (name.length > HORSE_NAME_MAX_LENGTH) {
    return 'length';
  }
  if (name.trim().length < HORSE_NAME_MIN_LENGTH) {
    return 'length';
  }
  if (name.includes('<') || name.includes('\0')) {
    return 'characters';
  }
  return null;
}

/**
 * The player-facing message for a rejection reason. One wording per rule, so
 * "rejected with a message naming the rule" is a checkable claim rather than an
 * aspiration — the rename suite asserts these exact strings.
 *
 * @param {'type'|'length'|'characters'} reason
 * @returns {string}
 */
export function horseNameRejectionMessage(reason) {
  switch (reason) {
    case 'type':
      return 'Horse name must be a string';
    case 'length':
      return `Horse name must be between ${HORSE_NAME_MIN_LENGTH} and ${HORSE_NAME_MAX_LENGTH} characters`;
    case 'characters':
      return 'Horse name may not contain < or a null character';
    default:
      return 'Invalid horse name';
  }
}

/**
 * A fresh express-validator `body('name')` chain enforcing the shared policy,
 * for the two creation paths (POST /horses, POST /horses/foals). A factory
 * rather than a shared chain instance so two route arrays never hold the same
 * object.
 *
 * Declared with `function` (not `const`) because `validateHorseCreation` above
 * calls it while this module is still evaluating — a `const` arrow would be in
 * its temporal dead zone.
 *
 * @returns {import('express-validator').ValidationChain}
 */
export function horseNameBodyRule() {
  return body('name').custom(value => {
    const reason = horseNameRejectionReason(value);
    if (reason !== null) {
      throw new Error(horseNameRejectionMessage(reason));
    }
    return true;
  });
}

/**
 * Validate the body of PATCH /horses/:id/name (Equoria-qkgfh.1).
 *
 * Fail-closed and narrow: JSON only, a plain object, `name` the ONLY accepted
 * key, and the shared name policy above. Anything else is a 400 with a message
 * that says which rule failed — nothing is truncated or normalised into
 * acceptability.
 */
export const validateHorseRenamePayload = (req, res, next) => {
  const contentType = (req.headers?.['content-type'] || '').toLowerCase();
  if (!contentType.startsWith('application/json')) {
    return res.status(400).json({ success: false, message: 'Invalid rename payload' });
  }

  const body = req.body;
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return res.status(400).json({ success: false, message: 'Invalid rename payload' });
  }

  // Prototype-pollution guard, mirroring validateHorseUpdatePayload.
  if (
    Object.prototype.hasOwnProperty.call(body, '__proto__') ||
    Object.prototype.hasOwnProperty.call(body, 'constructor') ||
    Object.getPrototypeOf(body) !== Object.prototype
  ) {
    return res.status(400).json({ success: false, message: 'Invalid rename payload' });
  }

  // `name` is the whole payload. Refusing extra keys keeps this endpoint from
  // becoming a second mass-assignment surface the way PUT /horses/:id did.
  for (const key of Object.keys(body)) {
    if (key !== 'name') {
      return res
        .status(400)
        .json({ success: false, message: 'Invalid rename payload: unexpected field' });
    }
  }

  const reason = horseNameRejectionReason(body.name);
  if (reason !== null) {
    return res.status(400).json({ success: false, message: horseNameRejectionMessage(reason) });
  }

  return next();
};

/**
 * Validate horse update payload to prevent type coercion / mass assignment
 * (PUT /horses/:id). Allowlist-only fields; rejects nested too-deep payloads,
 * prototype-pollution keys, non-JSON content types, and protected fields.
 *
 * Behaviour preserved verbatim from the original inline definition.
 */
export const validateHorseUpdatePayload = (req, res, next) => {
  const getDepth = (value, seen = new Set()) => {
    if (value && typeof value === 'object') {
      if (seen.has(value)) {
        return 0;
      }
      seen.add(value);
      let maxDepth = 1;
      for (const key of Object.keys(value)) {
        maxDepth = Math.max(maxDepth, 1 + getDepth(value[key], seen));
      }
      return maxDepth;
    }
    return 0;
  };

  // Enforce content types for update to prevent content-type manipulation
  const contentType = (req.headers?.['content-type'] || '').toLowerCase();
  if (contentType.includes('application/xml')) {
    return res.status(415).json({ success: false, message: 'Unsupported Media Type' });
  }
  if (contentType.includes('charset=utf-7') || contentType.includes('multipart/form-data')) {
    return res.status(400).json({ success: false, message: 'Invalid horse payload' });
  }
  const isJson = contentType.startsWith('application/json');
  if (!isJson) {
    return res.status(400).json({ success: false, message: 'Invalid horse payload' });
  }

  if (typeof req.body !== 'object' || Array.isArray(req.body) || req.body === null) {
    return res.status(400).json({ success: false, message: 'Invalid horse payload' });
  }

  const body = req.body || {};

  // Reject prototype pollution keys at top-level
  if (
    Object.prototype.hasOwnProperty.call(body, '__proto__') ||
    Object.prototype.hasOwnProperty.call(body, 'constructor') ||
    Object.getPrototypeOf(body) !== Object.prototype
  ) {
    return res.status(400).json({ success: false, message: 'Invalid horse payload' });
  }

  const depth = getDepth(body);
  if (depth > 5) {
    return res
      .status(400)
      .json({ success: false, message: 'Invalid horse payload: nested too deep' });
  }

  // Equoria-tmyd2: breedId is intentionally NOT in the allowlist. Pre-fix
  // it was — and a user could PUT { breedId: <higher-tier-breed-id> } to
  // silently re-point a starter horse at a different breed, inheriting that
  // breed's stat ranges, color genetics, conformation, and gait advantages
  // without going through any documented (and non-existent) breed-change
  // mechanic. If breed change ever ships as a real game feature, it MUST
  // land as its own endpoint with explicit authorization + cost — not via
  // mass-assignment on the generic update path.
  const allowedFields = new Set(['name', 'sex', 'gender', 'dateOfBirth', 'sireId', 'damId']);

  for (const key of Object.keys(body)) {
    if (!allowedFields.has(key)) {
      return res
        .status(400)
        .json({ success: false, message: 'Invalid horse payload: unexpected field' });
    }
  }

  if (body.name !== undefined) {
    // Equoria-qkgfh.1: the type + character rules that used to be inlined here
    // now live in horseNameRejectionReason() so PUT and the dedicated rename
    // endpoint (PATCH /horses/:id/name) cannot drift apart. The length bound is
    // NEW on this path: PUT previously accepted a name of any length, so the
    // 1-100 cap POST /horses already enforces was trivially bypassable and the
    // rename endpoint's cap would have been decorative. Message text is
    // deliberately unchanged ('Invalid horse name' for every reason) so this
    // path's existing responses stay byte-identical.
    if (horseNameRejectionReason(body.name) !== null) {
      return res.status(400).json({ success: false, message: 'Invalid horse name' });
    }
  }

  if (body.age !== undefined || body.userId !== undefined || body.id !== undefined) {
    return res.status(400).json({ success: false, message: 'Invalid horse payload' });
  }

  if (body.traits !== undefined) {
    return res.status(400).json({ success: false, message: 'Invalid traits payload' });
  }

  next();
};
