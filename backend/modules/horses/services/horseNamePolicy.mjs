/**
 * horseNamePolicy.mjs — the horse-name rule, and the one clamp the system needs
 * to obey it (Equoria-qkgfh.1)
 *
 * WHY THIS LIVES IN services/ AND NOT IN routes/_validators.mjs
 *   The rule has two kinds of consumer: request validators (routes layer) and
 *   `foalingService`, which DERIVES a name rather than accepting one. A service
 *   importing from `routes/` would invert the layering, so the rule itself sits
 *   here and `routes/_validators.mjs` imports it. `horseNameBodyRule` and the
 *   express-validator middleware stay in the routes layer, where they belong.
 *
 * ── THE RULE ────────────────────────────────────────────────────────────────
 * A horse name is a string, raw `.length` <= 100, non-empty after trimming, and
 * contains neither `<` nor NUL. Player-supplied names are stored VERBATIM — no
 * trim, no truncation, no case folding; a violating name is REJECTED, never
 * quietly repaired.
 *
 * WHERE THE BOUNDS COME FROM (found, not invented)
 *   - length 1-100 — the bound `validateHorseCreation` and `validateFoalCreation`
 *     already enforced via `body('name').isLength({ min: 1, max: 100 })`.
 *   - characters — the rule `validateHorseUpdatePayload` already enforced:
 *     reject `<` and NUL, nothing else. No allow-list regex, because
 *     `backend/__tests__/sql-injection-attempts.test.mjs` requires
 *     `O'Malley's Horse` to be accepted verbatim (201) and excludes 400.
 *
 * WHY RAW `.length` AND NOT express-validator's `isLength`
 *   `isLength` is validator.js `isLength`, which computes
 *   `str.length - presentationSequences.length - surrogatePairs.length`. It
 *   therefore counted 51 grinning-face emoji (102 UTF-16 units) and 100
 *   red-heart emoji (200 units) as inside 100, and accepted a whitespace-only
 *   name. Raw `.length` is what Postgres actually stores, so it is the honest
 *   bound. Adopting the stricter count everywhere was checked against the live
 *   data BEFORE it was chosen, not assumed: 515 horse rows measured, longest
 *   name 48 UTF-16 units, ZERO failing any clause — plus the indirect column
 *   `Horse.pendingFoalName`, 6 rows, longest 30, also zero. So no existing horse
 *   became unrenameable, which is the harm that would have forced the permissive
 *   rule instead.
 *
 * NOT enforced, on purpose
 *   - Uniqueness. The owner ruled 2026-09-09 that names need not be unique, and
 *     `Horse.name` carries no unique index in schema.prisma, in any migration,
 *     or in the live catalog.
 *   - Leading/trailing whitespace. `'  Fred  '` is accepted and stored padded.
 *     Rejecting it has no precedent in this codebase and trimming it would be
 *     the normalisation this policy refuses; zero live names are padded.
 *
 * `backend/utils/securityValidation.mjs#validateHorseData` claims 2-50 plus an
 * ASCII allow-list, but no route imports it — only its own unit tests do. It is
 * not enforced behaviour and is not the precedent followed.
 */

export const HORSE_NAME_MIN_LENGTH = 1;
export const HORSE_NAME_MAX_LENGTH = 100;

/** The suffix `foalingService` appends when no name was chosen for a foal. */
export const DERIVED_FOAL_NAME_SUFFIX = ' Foal';

/**
 * Why a candidate horse name is unacceptable, or null when it is acceptable.
 *
 * Returning a reason (rather than a message) lets `PUT /horses/:id` keep its
 * historical single 'Invalid horse name' wording — so its responses stay
 * byte-identical — while the other gated paths report which rule failed.
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
 * Truncate to at most `max` UTF-16 units WITHOUT splitting a surrogate pair.
 *
 * A naive `slice` can cut between the high and low half of an astral character,
 * leaving a lone surrogate — not valid UTF-16, and something Postgres will
 * either reject or store as a replacement character. So if the cut lands on a
 * high surrogate, drop it and return one unit shorter.
 *
 * @param {string} value
 * @param {number} max
 * @returns {string}
 */
function truncateWithoutSplittingSurrogates(value, max) {
  if (value.length <= max) {
    return value;
  }
  const cut = value.slice(0, max);
  const lastCode = cut.charCodeAt(cut.length - 1);
  const isHighSurrogate = lastCode >= 0xd800 && lastCode <= 0xdbff;
  return isHighSurrogate ? cut.slice(0, -1) : cut;
}

/**
 * Build the fallback name for a foal nobody named: `<Dam> Foal`, guaranteed to
 * satisfy the policy.
 *
 * THE DEFECT THIS CLOSES
 *   `foalingService` built `${dam.name} Foal` with no bound, so a dam named at
 *   the 100-unit cap produced a 105-unit foal name — a name the game itself
 *   minted that its own four gated paths would refuse. The invariant "every
 *   stored horse name satisfies the rule" therefore held only by luck (the
 *   longest live name is 48 units), not by construction. Reachable in practice:
 *   rename a mare to a 100-unit name through PATCH /horses/:id/name, then breed
 *   her. Not a lockout — the foal was always renameable — but the system should
 *   not be able to write a value it would reject on the way in.
 *
 *   `options.name` and `dam.pendingFoalName` are deliberately NOT clamped here:
 *   both arrive already validated through a gated path, and silently reshaping a
 *   value someone supplied is exactly what this policy refuses.
 *
 * WHY THIS TRUNCATES WHERE THE VALIDATORS REJECT
 *   The policy refuses to silently repair a name a PLAYER wrote, because a
 *   player has an intent worth preserving and a rejection tells them their
 *   intent was not honoured. This string is not a player's intent — the game
 *   generates it precisely BECAUSE nobody chose a name, and it exists to be
 *   replaced. There is nobody to tell and nothing to preserve, so rejecting is
 *   not an option: refusing would mean refusing to record a foal that has
 *   already been born. Truncation is the correct act here, and it is a different
 *   act from truncating what someone typed.
 *
 * WHY THE SUFFIX SURVIVES AND THE DAM'S NAME GIVES WAY
 *   ` Foal` is the load-bearing half: it is the signal to the player that this
 *   horse still needs a name. So the dam-name prefix is what gets shortened, and
 *   the result always ends in ` Foal`.
 *
 * @param {string} damName - the dam's stored name; may itself violate the policy
 *   if it predates the rule, which is why this clamps rather than trusting it
 * @returns {string} a name satisfying `horseNameRejectionReason(...) === null`,
 *   except that a dam whose name is entirely whitespace yields the bare suffix
 *   trimmed to `Foal` rather than a whitespace-led string
 */
export function deriveFoalName(damName) {
  const dam = typeof damName === 'string' ? damName : '';
  const prefixBudget = HORSE_NAME_MAX_LENGTH - DERIVED_FOAL_NAME_SUFFIX.length;
  const prefix = truncateWithoutSplittingSurrogates(dam, prefixBudget);
  const derived = `${prefix}${DERIVED_FOAL_NAME_SUFFIX}`;
  // A dam named '   ' (impossible through any gated path, possible in legacy
  // data) would otherwise yield '    Foal'. Trim only in that degenerate case,
  // so the ordinary path keeps the dam's name byte-for-byte.
  return prefix.trim().length === 0 ? DERIVED_FOAL_NAME_SUFFIX.trim() : derived;
}
