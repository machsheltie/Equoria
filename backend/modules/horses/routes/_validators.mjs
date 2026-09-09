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
// The horse-name rule itself lives one layer down, in services/, because
// foalingService needs it too and a service must not import from routes/.
import {
  horseNameRejectionReason,
  horseNameRejectionMessage,
} from '../services/horseNamePolicy.mjs';

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
  // Equoria-qkgfh.1: was `body('name').isLength({ min: 1, max: 100 })`. Four of
  // the five player-supplied horse-name paths now share one rule; the two-half
  // account of what this widened, and the fifth ungated path, are in the block
  // below. `POST /horses` has no frontend caller, so nothing live changed here.
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
 * ── Horse name validation ─ which paths are GATED, and which one is not ────
 * (Equoria-qkgfh.1)
 *
 * The rule itself lives in `../services/horseNamePolicy.mjs` — read it there for
 * the bounds, their provenance, and the live measurement that justified them.
 * This module wires it into the request layer.
 *
 * FIVE live paths let a PLAYER put a string into `horses.name`. FOUR route
 * through `horseNameRejectionReason`; the fifth does not, and saying otherwise
 * would be a false guarantee in the one file a future reader trusts most:
 *
 *   1. POST  /api/v1/horses            → `validateHorseCreation` (this file)      GATED
 *   2. POST  /api/v1/horses/foals      → `validateFoalCreation`                   GATED
 *        (horseFoalRoutes.mjs). Its `name` also lands in `Horse.pendingFoalName`
 *        and later becomes the foal's own name via foalingService, so it is a
 *        horse-name path twice over.
 *   3. PUT   /api/v1/horses/:id        → `validateHorseUpdatePayload` (this file)  GATED
 *   4. PATCH /api/v1/horses/:id/name   → `validateHorseRenamePayload` (this file)  GATED
 *   5. POST  /api/v1/auth/advance-onboarding                                  NOT GATED
 *        `onboardingController.advanceOnboarding` reads a player-typed
 *        `horseName` from the beta-live /onboarding page and writes it to
 *        `horses.name` — updating the player's EXISTING starter horse where one
 *        exists, so it is a rename path, not only a creation path. It diverges
 *        from this rule two ways: it `trim().slice(0, 40)`s, i.e. it SILENTLY
 *        TRUNCATES where this policy rejects; and it applies NO character check,
 *        so `Fred <3` is settable there and never settable again by rename.
 *        Deliberately left alone: routing it through this rule would turn a
 *        silent truncation into a 400 on the new-player flow, which is a
 *        behaviour change on beta-live code and the owner's call, not this
 *        task's. Filed rather than fixed.
 *
 * Also writing `horses.name` without a player string: `foalingService`'s derived
 * `<Dam> Foal` fallback (clamped to the policy by `deriveFoalName`), its
 * compensation restore of an already-validated `pendingFoalName`,
 * `onboardingService`'s `<username>'s First Horse`, `marketplaceController`'s
 * store horses, and `gdprAccountService`'s lineage anonymization. Seeds,
 * operator scripts, and anything writing the database outside the app are
 * ungated by construction and no route validator can reach them.
 *
 * WHAT THE FIX ROUND WIDENED ON THE TWO CREATION PATHS — two halves, two reasons.
 * Eight input classes that `POST /horses` and `POST /horses/foals` accepted
 * before now get a 400. They are not all the same change:
 *
 *   (a) THE LENGTH HALF — `'   '`, 51 grinning-face emoji (102 UTF-16 units),
 *       100 red-heart emoji (200 units). Cause: `isLength` counted differently
 *       (see horseNamePolicy.mjs). Reason for changing it: without a shared
 *       count, creation could mint a name the rename endpoint would refuse to
 *       restore, and the cap was bypassable by changing verb. This half is
 *       load-bearing for the rename endpoint being honestly bounded.
 *   (b) THE CHARACTER + TYPE HALF — `'<script>Fred'`, a NUL-bearing name, and
 *       the coercions `42`, `true`, `['Fred']` (express-validator stringified
 *       them, so they passed validation and then failed at Prisma as a 500).
 *       Cause: the `<`/NUL rule and the type check had never applied at
 *       creation. Reason: the asymmetry ran the other way — creation could mint
 *       a name rename would never restore. Right on the merits, but a DIFFERENT
 *       justification from (a), and `Fred <3` is a plausible player-chosen name
 *       rather than a payload. Whether `<` belongs in a horse name is the
 *       owner's ruling, filed; this half is disclosed here so the next reader
 *       does not mistake it for a side effect of the counting fix.
 *
 * Nothing live was broken by either half: `horsesApi.create` has no caller
 * anywhere in the frontend, and the sole `POST /horses/foals` client sends no
 * `name` field at all. The creation rejection text also changed from
 * 'Name must be between 1 and 100 characters' to 'Horse name must be …'; the
 * old string has zero references in backend, frontend, e2e or packages.
 */
export {
  HORSE_NAME_MIN_LENGTH,
  HORSE_NAME_MAX_LENGTH,
  horseNameRejectionReason,
  horseNameRejectionMessage,
} from '../services/horseNamePolicy.mjs';

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
 * @param {object} [options]
 * @param {boolean} [options.optional=false] - when true, an ABSENT `name` passes
 *   and a PRESENT one is still held to the full policy. No caller on this branch
 *   passes it; it exists because `POST /horses/foals` has diverged between
 *   branches — see the MERGE HAZARD note at that call site in
 *   horseFoalRoutes.mjs — and whoever reconciles them needs `optional: true` to
 *   be one word rather than a rewrite.
 * @returns {import('express-validator').ValidationChain}
 */
export function horseNameBodyRule({ optional = false } = {}) {
  const chain = optional ? body('name').optional() : body('name');
  return chain.custom(value => {
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
